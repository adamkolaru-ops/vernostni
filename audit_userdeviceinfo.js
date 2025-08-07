const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty'
});

async function auditUserDeviceInfo() {
  console.log('🔍 Auditování userdeviceinfo záznamů...');
  
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
    
    Object.keys(groupedByEmailId).forEach(emailId => {
      const records = groupedByEmailId[emailId];
      if (records.length > 1) {
        duplicatesFound++;
        console.log(`\n❌ DUPLICITA pro emailId: ${emailId} (${records.length} záznamů)`);
        records.forEach((record, index) => {
          console.log(`  ${index + 1}. Key: ${record.key.id || record.key.name}`);
          console.log(`     serialNumber: ${record.serialNumber}`);
          console.log(`     deviceLibraryIdentifier: ${record.deviceLibraryIdentifier}`);
          console.log(`     pushToken: ${record.pushToken ? record.pushToken.substring(0, 20) + '...' : 'null'}`);
          console.log(`     passTypeIdentifier: ${record.passTypeIdentifier}`);
          console.log(`     dateCreated: ${record.dateCreated}`);
        });
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
    Object.keys(groupedByDeviceSerial).forEach(key => {
      const records = groupedByDeviceSerial[key];
      if (records.length > 1) {
        deviceSerialDuplicates++;
        console.log(`\n❌ DUPLICITA pro deviceLibraryIdentifier|serialNumber: ${key} (${records.length} záznamů)`);
        records.forEach((record, index) => {
          console.log(`  ${index + 1}. emailId: ${record.emailId}`);
          console.log(`     pushToken: ${record.pushToken ? record.pushToken.substring(0, 20) + '...' : 'null'}`);
          console.log(`     dateCreated: ${record.dateCreated}`);
        });
      }
    });
    
    if (deviceSerialDuplicates === 0) {
      console.log('✅ Žádné duplicity podle deviceLibraryIdentifier + serialNumber nebyly nalezeny');
    } else {
      console.log(`\n⚠️  Celkem nalezeno ${deviceSerialDuplicates} duplicitních kombinací deviceLibraryIdentifier + serialNumber`);
    }
    
  } catch (error) {
    console.error('❌ Chyba při auditování:', error);
  }
}

auditUserDeviceInfo();
