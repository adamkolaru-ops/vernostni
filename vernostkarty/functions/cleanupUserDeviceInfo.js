const functions = require('firebase-functions');
const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty'
});

exports.cleanupUserDeviceInfo = functions.https.onRequest(async (req, res) => {
  console.log('🧹 Čištění a deduplikace userdeviceinfo záznamů...');
  
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    // Načíst všechny záznamy z userdeviceinfo
    const query = datastore.createQuery('userdeviceinfo');
    const [entities] = await datastore.runQuery(query);
    
    console.log(`📊 Celkem nalezeno ${entities.length} záznamů v userdeviceinfo`);
    
    // Seskupit podle deviceLibraryIdentifier
    const groupedByDevice = {};
    
    entities.forEach(entity => {
      const deviceId = entity.deviceLibraryIdentifier;
      if (!groupedByDevice[deviceId]) {
        groupedByDevice[deviceId] = [];
      }
      groupedByDevice[deviceId].push({
        key: entity[datastore.KEY],
        entity: entity
      });
    });
    
    let duplicatesFound = 0;
    let recordsToDelete = [];
    let recordsToKeep = [];
    
    // Analyzovat každou skupinu podle deviceLibraryIdentifier
    Object.keys(groupedByDevice).forEach(deviceId => {
      const records = groupedByDevice[deviceId];
      
      if (records.length > 1) {
        duplicatesFound++;
        console.log(`\n❌ DUPLICITA pro deviceLibraryIdentifier: ${deviceId} (${records.length} záznamů)`);
        
        // Seřadit podle dateCreated (nejnovější první)
        records.sort((a, b) => {
          const dateA = new Date(a.entity.dateCreated || '1970-01-01');
          const dateB = new Date(b.entity.dateCreated || '1970-01-01');
          return dateB - dateA;
        });
        
        // Ponechat nejnovější záznam, ostatní označit ke smazání
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);
        
        console.log(`✅ PONECHÁM: emailId=${keepRecord.entity.emailId}, serialNumber=${keepRecord.entity.serialNumber}, dateCreated=${keepRecord.entity.dateCreated}`);
        recordsToKeep.push(keepRecord);
        
        deleteRecords.forEach((record, index) => {
          console.log(`❌ SMAŽU: emailId=${record.entity.emailId}, serialNumber=${record.entity.serialNumber}, dateCreated=${record.entity.dateCreated}`);
          recordsToDelete.push(record);
        });
      } else {
        // Pouze jeden záznam pro toto zařízení - ponechat
        recordsToKeep.push(records[0]);
      }
    });
    
    console.log(`\n📊 Souhrn:`);
    console.log(`- Duplicitní deviceLibraryIdentifier: ${duplicatesFound}`);
    console.log(`- Záznamy k ponechání: ${recordsToKeep.length}`);
    console.log(`- Záznamy ke smazání: ${recordsToDelete.length}`);
    
    // Pokud je parametr ?execute=true, provést skutečné smazání
    const executeCleanup = req.query.execute === 'true';
    
    if (executeCleanup && recordsToDelete.length > 0) {
      console.log(`\n🗑️ Provádím smazání ${recordsToDelete.length} duplicitních záznamů...`);
      
      const keysToDelete = recordsToDelete.map(record => record.key);
      await datastore.delete(keysToDelete);
      
      console.log(`✅ Úspěšně smazáno ${recordsToDelete.length} duplicitních záznamů`);
    } else if (recordsToDelete.length > 0) {
      console.log(`\n⚠️ Pro provedení smazání přidejte parametr ?execute=true`);
    }
    
    const response = {
      success: true,
      totalRecords: entities.length,
      duplicateDevices: duplicatesFound,
      recordsToKeep: recordsToKeep.length,
      recordsToDelete: recordsToDelete.length,
      executed: executeCleanup,
      deletedRecords: executeCleanup ? recordsToDelete.length : 0,
      duplicateDetails: Object.keys(groupedByDevice)
        .filter(deviceId => groupedByDevice[deviceId].length > 1)
        .map(deviceId => ({
          deviceLibraryIdentifier: deviceId,
          duplicateCount: groupedByDevice[deviceId].length,
          records: groupedByDevice[deviceId].map(r => ({
            emailId: r.entity.emailId,
            serialNumber: r.entity.serialNumber,
            dateCreated: r.entity.dateCreated,
            willKeep: r === groupedByDevice[deviceId][0]
          }))
        }))
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chyba při čištění userdeviceinfo:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});
