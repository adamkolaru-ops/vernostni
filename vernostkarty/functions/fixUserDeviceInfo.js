/**
 * Skript pro opravu problémů s userdeviceinfo záznamy
 * 1. Odstraní duplicitní záznamy podle deviceLibraryIdentifier
 * 2. Aktualizuje záznamy přidáním passTypeIdentifier, pokud chybí
 * 3. Zajistí konzistenci mezi Datastore a Firestore
 */

const admin = require('firebase-admin');
const { Datastore } = require('@google-cloud/datastore');
const fs = require('fs');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty'
});

// Inicializace Firebase
const serviceAccountDb = require("./certificates/vernostkarty-db-service-account.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountDb)
  }, 'dbAdmin');
} catch (e) {
  console.log('Secondary app already initialized.');
}

const firestoreDb = admin.app('dbAdmin').firestore();

/**
 * Opraví záznamy v userdeviceinfo
 */
async function fixUserDeviceInfo() {
  console.log('🔧 Opravuji userdeviceinfo záznamy...');
  
  try {
    // 1. Načtení všech záznamů z userdeviceinfo
    console.log('📊 Načítám záznamy z Datastore...');
    const query = datastore.createQuery('userdeviceinfo');
    const [entities] = await datastore.runQuery(query);
    
    console.log(`📊 Celkem nalezeno ${entities.length} záznamů v userdeviceinfo`);
    
    // 2. Seskupení podle deviceLibraryIdentifier
    const groupedByDevice = {};
    
    entities.forEach(entity => {
      const deviceId = entity.deviceLibraryIdentifier;
      if (!deviceId) return; // Přeskočit neplatné záznamy
      
      if (!groupedByDevice[deviceId]) {
        groupedByDevice[deviceId] = [];
      }
      groupedByDevice[deviceId].push({
        key: entity[datastore.KEY],
        entity: entity
      });
    });
    
    // 3. Najít duplicity a aktualizovat záznamy
    console.log('\n🔍 Kontroluji duplicitní záznamy podle deviceLibraryIdentifier...');
    
    const recordsToUpdate = [];
    const recordsToDelete = [];
    const recordsToSync = [];
    
    for (const [deviceId, records] of Object.entries(groupedByDevice)) {
      if (records.length > 1) {
        console.log(`\n❌ DUPLICITA pro deviceLibraryIdentifier: ${deviceId} (${records.length} záznamů)`);
        
        // Seřadit podle dateUpdated nebo dateCreated nebo timestamp (nejnovější první)
        records.sort((a, b) => {
          const dateA = new Date(a.entity.dateUpdated || a.entity.dateCreated || a.entity.timestamp || '1970-01-01');
          const dateB = new Date(b.entity.dateUpdated || b.entity.dateCreated || b.entity.timestamp || '1970-01-01');
          return dateB - dateA;
        });
        
        // Ponechat nejnovější záznam, ostatní smazat
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);
        
        console.log(`✅ PONECHÁM: emailId=${keepRecord.entity.emailId}, serialNumber=${keepRecord.entity.serialNumber}`);
        
        // Aktualizovat zachovaný záznam, pokud chybí důležitá pole
        const recordToUpdate = {
          key: keepRecord.key,
          entity: {
            ...keepRecord.entity,
            dateCreated: keepRecord.entity.dateCreated || keepRecord.entity.timestamp || new Date().toISOString(),
            dateUpdated: new Date().toISOString()
          }
        };
        
        // Přidat passTypeIdentifier, pokud chybí
        if (!recordToUpdate.entity.passTypeIdentifier) {
          recordToUpdate.entity.passTypeIdentifier = 'pass.vernostni.cz.vernostnikarty';
        }
        
        recordsToUpdate.push(recordToUpdate);
        recordsToSync.push(recordToUpdate);
        
        // Označit záznamy ke smazání
        deleteRecords.forEach(record => {
          console.log(`❌ SMAŽU: emailId=${record.entity.emailId}, serialNumber=${record.entity.serialNumber}`);
          recordsToDelete.push(record.key);
        });
      } else if (records.length === 1) {
        // Aktualizovat záznam, pokud chybí důležitá pole
        const record = records[0];
        const needsUpdate = !record.entity.dateCreated || !record.entity.dateUpdated || !record.entity.passTypeIdentifier;
        
        if (needsUpdate) {
          const updatedEntity = {
            ...record.entity,
            dateCreated: record.entity.dateCreated || record.entity.timestamp || new Date().toISOString(),
            dateUpdated: new Date().toISOString(),
            passTypeIdentifier: record.entity.passTypeIdentifier || 'pass.vernostni.cz.vernostnikarty'
          };
          
          recordsToUpdate.push({
            key: record.key,
            entity: updatedEntity
          });
          
          recordsToSync.push({
            key: record.key,
            entity: updatedEntity
          });
          
          console.log(`📝 AKTUALIZUJI: deviceLibraryIdentifier=${record.entity.deviceLibraryIdentifier}, emailId=${record.entity.emailId}`);
        } else {
          recordsToSync.push(record);
        }
      }
    }
    
    console.log(`\n📊 Souhrn:`);
    console.log(`- Záznamy k aktualizaci: ${recordsToUpdate.length}`);
    console.log(`- Záznamy ke smazání: ${recordsToDelete.length}`);
    console.log(`- Záznamy k synchronizaci s Firestore: ${recordsToSync.length}`);
    
    // 4. Provést aktualizace v Datastore
    if (recordsToUpdate.length > 0) {
      console.log(`\n📝 Aktualizuji ${recordsToUpdate.length} záznamů v Datastore...`);
      
      for (const record of recordsToUpdate) {
        await datastore.save({
          key: record.key,
          data: record.entity
        });
      }
      
      console.log(`✅ Úspěšně aktualizováno ${recordsToUpdate.length} záznamů`);
    }
    
    // 5. Smazat duplicitní záznamy
    if (recordsToDelete.length > 0) {
      console.log(`\n🗑️ Mažu ${recordsToDelete.length} duplicitních záznamů...`);
      await datastore.delete(recordsToDelete);
      console.log(`✅ Úspěšně smazáno ${recordsToDelete.length} duplicitních záznamů`);
    }
    
    // 6. Synchronizovat s Firestore
    console.log(`\n🔄 Synchronizuji ${recordsToSync.length} záznamů s Firestore...`);
    
    let syncCount = 0;
    for (const record of recordsToSync) {
      try {
        const deviceId = record.entity.deviceLibraryIdentifier;
        if (!deviceId) continue;
        
        const docRef = firestoreDb.collection('userdeviceinfo').doc(deviceId);
        await docRef.set(record.entity);
        syncCount++;
        
        // Aktualizovat také u konkrétního uživatele, pokud je k dispozici emailId a cafeId
        if (record.entity.emailId && record.entity.cafeId) {
          const shortCafeId = record.entity.cafeId.length > 12 ? record.entity.cafeId.slice(-12) : record.entity.cafeId;
          const userEmail = record.entity.emailId;
          
          const userDocPath = `users/${shortCafeId}/emails/${userEmail}`;
          const userDocRef = firestoreDb.doc(userDocPath);
          
          // Nejprve ověřit, jestli dokument existuje
          const userDoc = await userDocRef.get();
          
          const deviceData = {
            deviceLibraryIdentifier: record.entity.deviceLibraryIdentifier,
            pushToken: record.entity.pushToken,
            serialNumber: record.entity.serialNumber,
            dateUpdated: new Date().toISOString()
          };
          
          if (userDoc.exists) {
            // Dokument existuje, zachovat historii zařízení
            const userData = userDoc.data();
            if (userData.deviceLibraryIdentifier && userData.deviceLibraryIdentifier !== record.entity.deviceLibraryIdentifier) {
              deviceData.previousDevices = userData.previousDevices || [];
              deviceData.previousDevices.push({
                deviceLibraryIdentifier: userData.deviceLibraryIdentifier,
                pushToken: userData.pushToken,
                serialNumber: userData.serialNumber,
                timestamp: userData.timestamp || new Date().toISOString()
              });
            }
          }
          
          // Aktualizovat dokument
          await userDocRef.set(deviceData, { merge: true });
          console.log(`✅ Aktualizován uživatelský dokument: ${userDocPath}`);
        }
      } catch (error) {
        console.error(`❌ Chyba při synchronizaci záznamu ${record.entity.deviceLibraryIdentifier}:`, error);
      }
    }
    
    console.log(`✅ Úspěšně synchronizováno ${syncCount} záznamů s Firestore`);
    
    console.log('\n✅ Oprava userdeviceinfo dokončena!');
    
    return {
      success: true,
      totalRecords: entities.length,
      updatedRecords: recordsToUpdate.length,
      deletedRecords: recordsToDelete.length,
      syncedRecords: syncCount
    };
    
  } catch (error) {
    console.error('❌ Chyba při opravě userdeviceinfo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Spustit opravu
fixUserDeviceInfo()
  .then(result => {
    console.log('📋 Výsledek:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatální chyba:', error);
    process.exit(1);
  });
