const functions = require('firebase-functions');
const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty'
});

exports.detailedAudit = functions.https.onRequest(async (req, res) => {
  console.log('🔍 Detailní audit pro anonymousId: 5psqxpjdu8w');
  
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    const targetAnonymousId = '5psqxpjdu8w';
    const targetSerialNumber = 'tomrehufhlc000000000000000000';
    
    console.log(`🎯 Hledám záznamy pro anonymousId: ${targetAnonymousId}`);
    console.log(`🎯 Hledám záznamy pro serialNumber: ${targetSerialNumber}`);
    
    // 1. Zkontrolovat userdeviceinfo
    console.log('\n📋 === USERDEVICEINFO ===');
    const userDeviceQuery = datastore.createQuery('userdeviceinfo');
    const [userDeviceEntities] = await datastore.runQuery(userDeviceQuery);
    
    console.log(`📊 Celkem ${userDeviceEntities.length} záznamů v userdeviceinfo:`);
    userDeviceEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. emailId: ${entity.emailId}`);
      console.log(`     serialNumber: ${entity.serialNumber}`);
      console.log(`     deviceLibraryIdentifier: ${entity.deviceLibraryIdentifier}`);
      console.log(`     pushToken: ${entity.pushToken ? entity.pushToken.substring(0, 20) + '...' : 'null'}`);
      console.log(`     passTypeIdentifier: ${entity.passTypeIdentifier}`);
      console.log(`     dateCreated: ${entity.dateCreated}`);
      console.log('');
    });
    
    // 2. Zkontrolovat cards podle anonymousId
    console.log('\n🃏 === CARDS (podle anonymousId) ===');
    const cardsAnonymousQuery = datastore.createQuery('cards')
      .filter('anonymousId', '=', targetAnonymousId);
    const [cardsAnonymousEntities] = await datastore.runQuery(cardsAnonymousQuery);
    
    console.log(`📊 Nalezeno ${cardsAnonymousEntities.length} karet s anonymousId: ${targetAnonymousId}`);
    cardsAnonymousEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. Key: ${entity[datastore.KEY].id || entity[datastore.KEY].name}`);
      console.log(`     anonymousId: ${entity.anonymousId}`);
      console.log(`     userId: ${entity.userId}`);
      console.log(`     email: ${entity.email}`);
      console.log(`     name: ${entity.name}`);
      console.log(`     dateCreated: ${entity.dateCreated}`);
      console.log(`     dateUpdated: ${entity.dateUpdated}`);
      console.log('');
    });
    
    // 3. Zkontrolovat cards podle userId (pokud je anonymousId použit jako userId)
    console.log('\n🃏 === CARDS (podle userId) ===');
    const cardsUserIdQuery = datastore.createQuery('cards')
      .filter('userId', '=', targetAnonymousId);
    const [cardsUserIdEntities] = await datastore.runQuery(cardsUserIdQuery);
    
    console.log(`📊 Nalezeno ${cardsUserIdEntities.length} karet s userId: ${targetAnonymousId}`);
    cardsUserIdEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. Key: ${entity[datastore.KEY].id || entity[datastore.KEY].name}`);
      console.log(`     anonymousId: ${entity.anonymousId}`);
      console.log(`     userId: ${entity.userId}`);
      console.log(`     email: ${entity.email}`);
      console.log(`     name: ${entity.name}`);
      console.log(`     dateCreated: ${entity.dateCreated}`);
      console.log(`     dateUpdated: ${entity.dateUpdated}`);
      console.log('');
    });
    
    // 4. Zkontrolovat cards podle serialNumber z logu
    console.log('\n🃏 === CARDS (podle serialNumber z logu) ===');
    const cardsSerialQuery = datastore.createQuery('cards')
      .filter('userId', '=', targetSerialNumber);
    const [cardsSerialEntities] = await datastore.runQuery(cardsSerialQuery);
    
    console.log(`📊 Nalezeno ${cardsSerialEntities.length} karet s userId: ${targetSerialNumber}`);
    cardsSerialEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. Key: ${entity[datastore.KEY].id || entity[datastore.KEY].name}`);
      console.log(`     anonymousId: ${entity.anonymousId}`);
      console.log(`     userId: ${entity.userId}`);
      console.log(`     email: ${entity.email}`);
      console.log(`     name: ${entity.name}`);
      console.log(`     dateCreated: ${entity.dateCreated}`);
      console.log(`     dateUpdated: ${entity.dateUpdated}`);
      console.log('');
    });
    
    // 5. Zkontrolovat všechny cards s podobnými ID
    console.log('\n🃏 === VŠECHNY CARDS (pro porovnání) ===');
    const allCardsQuery = datastore.createQuery('cards').limit(10);
    const [allCardsEntities] = await datastore.runQuery(allCardsQuery);
    
    console.log(`📊 Prvních 10 karet v databázi:`);
    allCardsEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. Key: ${entity[datastore.KEY].id || entity[datastore.KEY].name}`);
      console.log(`     anonymousId: ${entity.anonymousId}`);
      console.log(`     userId: ${entity.userId}`);
      console.log(`     email: ${entity.email}`);
      console.log(`     name: ${entity.name}`);
      console.log(`     dateCreated: ${entity.dateCreated}`);
      console.log(`     dateUpdated: ${entity.dateUpdated}`);
      console.log('');
    });
    
    const response = {
      success: true,
      targetAnonymousId: targetAnonymousId,
      targetSerialNumber: targetSerialNumber,
      userDeviceInfoCount: userDeviceEntities.length,
      cardsWithAnonymousId: cardsAnonymousEntities.length,
      cardsWithUserId: cardsUserIdEntities.length,
      cardsWithSerialNumber: cardsSerialEntities.length,
      userDeviceInfo: userDeviceEntities.map(e => ({
        emailId: e.emailId,
        serialNumber: e.serialNumber,
        deviceLibraryIdentifier: e.deviceLibraryIdentifier,
        pushToken: e.pushToken ? e.pushToken.substring(0, 20) + '...' : null
      })),
      cardsData: {
        byAnonymousId: cardsAnonymousEntities.map(e => ({
          key: e[datastore.KEY].id || e[datastore.KEY].name,
          anonymousId: e.anonymousId,
          userId: e.userId,
          email: e.email,
          name: e.name
        })),
        byUserId: cardsUserIdEntities.map(e => ({
          key: e[datastore.KEY].id || e[datastore.KEY].name,
          anonymousId: e.anonymousId,
          userId: e.userId,
          email: e.email,
          name: e.name
        })),
        bySerialNumber: cardsSerialEntities.map(e => ({
          key: e[datastore.KEY].id || e[datastore.KEY].name,
          anonymousId: e.anonymousId,
          userId: e.userId,
          email: e.email,
          name: e.name
        }))
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chyba při detailním auditu:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});
