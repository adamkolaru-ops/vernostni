const functions = require('firebase-functions');
const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty'
});

exports.auditUserDeviceInfo = functions.https.onRequest(async (req, res) => {
  console.log('🔍 Auditování userdeviceinfo záznamů...');
  
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
    
    // Seskupit podle emailId
    const groupedByEmailId = {};
    
    entities.forEach(entity => {
      const emailId = entity.emailId;
      if (!groupedByEmailId[emailId]) {
        groupedByEmailId[emailId] = [];
      }
      groupedByEmailId[emailId].push({
        key: entity[datastore.KEY],
        emailId: entity.emailId,
        serialNumber: entity.serialNumber,
        deviceLibraryIdentifier: entity.deviceLibraryIdentifier,
        pushToken: entity.pushToken,
        passTypeIdentifier: entity.passTypeIdentifier,
        dateCreated: entity.dateCreated
      });
    });
    
    // Najít duplicity
    console.log('\n🔍 Hledání duplicitních záznamů podle emailId:');
    let duplicatesFound = 0;
    const duplicateReport = [];
    
    Object.keys(groupedByEmailId).forEach(emailId => {
      const records = groupedByEmailId[emailId];
      if (records.length > 1) {
        duplicatesFound++;
        console.log(`\n❌ DUPLICITA pro emailId: ${emailId} (${records.length} záznamů)`);
        
        const duplicateInfo = {
          emailId: emailId,
          count: records.length,
          records: []
        };
        
        records.forEach((record, index) => {
          const recordInfo = {
            index: index + 1,
            key: record.key.id || record.key.name,
            serialNumber: record.serialNumber,
            deviceLibraryIdentifier: record.deviceLibraryIdentifier,
            pushToken: record.pushToken ? record.pushToken.substring(0, 20) + '...' : 'null',
            passTypeIdentifier: record.passTypeIdentifier,
            dateCreated: record.dateCreated
          };
          
          console.log(`  ${recordInfo.index}. Key: ${recordInfo.key}`);
          console.log(`     serialNumber: ${recordInfo.serialNumber}`);
          console.log(`     deviceLibraryIdentifier: ${recordInfo.deviceLibraryIdentifier}`);
          console.log(`     pushToken: ${recordInfo.pushToken}`);
          console.log(`     passTypeIdentifier: ${recordInfo.passTypeIdentifier}`);
          console.log(`     dateCreated: ${recordInfo.dateCreated}`);
          
          duplicateInfo.records.push(recordInfo);
        });
        
        duplicateReport.push(duplicateInfo);
      }
    });
    
    if (duplicatesFound === 0) {
      console.log('✅ Žádné duplicity podle emailId nebyly nalezeny');
    } else {
      console.log(`\n⚠️  Celkem nalezeno ${duplicatesFound} duplicitních emailId`);
    }
    
    // Zkontrolovat také duplicity podle deviceLibraryIdentifier + serialNumber
    console.log('\n🔍 Hledání duplicitních záznamů podle deviceLibraryIdentifier + serialNumber:');
    const groupedByDeviceSerial = {};
    
    entities.forEach(entity => {
      const key = `${entity.deviceLibraryIdentifier}|${entity.serialNumber}`;
      if (!groupedByDeviceSerial[key]) {
        groupedByDeviceSerial[key] = [];
      }
      groupedByDeviceSerial[key].push(entity);
    });
    
    let deviceSerialDuplicates = 0;
    const deviceSerialDuplicateReport = [];
    
    Object.keys(groupedByDeviceSerial).forEach(key => {
      const records = groupedByDeviceSerial[key];
      if (records.length > 1) {
        deviceSerialDuplicates++;
        console.log(`\n❌ DUPLICITA pro deviceLibraryIdentifier|serialNumber: ${key} (${records.length} záznamů)`);
        
        const duplicateInfo = {
          key: key,
          count: records.length,
          records: []
        };
        
        records.forEach((record, index) => {
          const recordInfo = {
            index: index + 1,
            emailId: record.emailId,
            pushToken: record.pushToken ? record.pushToken.substring(0, 20) + '...' : 'null',
            dateCreated: record.dateCreated
          };
          
          console.log(`  ${recordInfo.index}. emailId: ${recordInfo.emailId}`);
          console.log(`     pushToken: ${recordInfo.pushToken}`);
          console.log(`     dateCreated: ${recordInfo.dateCreated}`);
          
          duplicateInfo.records.push(recordInfo);
        });
        
        deviceSerialDuplicateReport.push(duplicateInfo);
      }
    });
    
    if (deviceSerialDuplicates === 0) {
      console.log('✅ Žádné duplicity podle deviceLibraryIdentifier + serialNumber nebyly nalezeny');
    } else {
      console.log(`\n⚠️  Celkem nalezeno ${deviceSerialDuplicates} duplicitních kombinací deviceLibraryIdentifier + serialNumber`);
    }
    
    const response = {
      success: true,
      totalRecords: entities.length,
      emailIdDuplicates: duplicatesFound,
      deviceSerialDuplicates: deviceSerialDuplicates,
      duplicatesByEmailId: duplicateReport,
      duplicatesByDeviceSerial: deviceSerialDuplicateReport
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chyba při auditování:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});
