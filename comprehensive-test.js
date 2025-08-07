const { Storage } = require('@google-cloud/storage');
const { Datastore } = require('@google-cloud/datastore');

// Inicializace služeb
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function comprehensiveTest() {
  console.log('🧪 KOMPLEXNÍ TEST CELÉHO SYSTÉMU CERTIFIKÁTŮ');
  console.log('=' .repeat(80));
  console.log('Testování: Cloud Storage + Datastore + Helper funkce\n');
  
  let testResults = {
    cloudStorage: false,
    datastore: false,
    helperFunctions: false,
    integration: false
  };
  
  try {
    // ========================================
    // TEST 1: CLOUD STORAGE STRUKTURA
    // ========================================
    console.log('📋 TEST 1: CLOUD STORAGE STRUKTURA');
    console.log('-' .repeat(50));
    
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles();
    
    // Kontrola požadované struktury
    const requiredFiles = [
      'original/apple-wallet/AppleWWDRCAG4.pem',
      '000001/0000001_Certifikáty.p12'
    ];
    
    let cloudStorageOK = true;
    
    console.log('📁 Nalezené soubory v Cloud Storage:');
    files.forEach(file => console.log(`   📄 ${file.name}`));
    console.log('');
    
    for (const requiredFile of requiredFiles) {
      const found = files.some(file => file.name === requiredFile);
      if (found) {
        console.log(`✅ ${requiredFile} - NALEZEN`);
      } else {
        console.log(`❌ ${requiredFile} - CHYBÍ`);
        console.log(`   🔍 Hledám podobné soubory...`);
        const similar = files.filter(file => file.name.includes(requiredFile.split('/').pop().split('.')[0]));
        similar.forEach(file => console.log(`      📄 Podobný: ${file.name}`));
        cloudStorageOK = false;
      }
    }
    
    // Kontrola .p12 souborů
    const p12Files = files.filter(file => file.name.endsWith('.p12'));
    console.log(`📄 Nalezeno ${p12Files.length} .p12 souborů:`);
    p12Files.forEach(file => console.log(`   🔐 ${file.name}`));
    
    testResults.cloudStorage = cloudStorageOK;
    console.log(`\n🎯 Cloud Storage test: ${cloudStorageOK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // TEST 2: DATASTORE KOLEKCE CERTIFICATES
    // ========================================
    console.log('📋 TEST 2: DATASTORE KOLEKCE CERTIFICATES');
    console.log('-' .repeat(50));
    
    const query = datastore.createQuery('certificates').order('rank');
    const [certificates] = await datastore.runQuery(query);
    
    console.log(`📊 Nalezeno ${certificates.length} záznamů v kolekci certificates:`);
    
    let datastoreOK = true;
    const expectedRecords = ['original', '000001'];
    
    for (const expectedKey of expectedRecords) {
      const found = certificates.find(cert => cert.key === expectedKey);
      if (found) {
        console.log(`✅ Záznam "${expectedKey}" - NALEZEN`);
        console.log(`   🔢 Rank: ${found.rank}`);
        console.log(`   ☕ CafeId: ${found.cafeId || 'null'}`);
        console.log(`   📄 P12 Path: ${found.p12Path || 'null'}`);
        console.log(`   🍎 WWDR Path: ${found.wwdrPath}`);
        
        // Validace cest
        if (expectedKey === 'original') {
          if (found.cafeId !== '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029') {
            console.log(`   ⚠️  Nesprávné cafeId pro original`);
            datastoreOK = false;
          }
          if (found.wwdrPath !== 'original/apple-wallet/AppleWWDRCAG4.pem') {
            console.log(`   ⚠️  Nesprávná wwdrPath pro original`);
            datastoreOK = false;
          }
        } else if (expectedKey === '000001') {
          if (found.p12Path !== '000001/0000001_Certifikáty.p12') {
            console.log(`   ⚠️  Nesprávná p12Path pro 000001`);
            datastoreOK = false;
          }
        }
      } else {
        console.log(`❌ Záznam "${expectedKey}" - CHYBÍ`);
        datastoreOK = false;
      }
      console.log('');
    }
    
    testResults.datastore = datastoreOK;
    console.log(`🎯 Datastore test: ${datastoreOK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // TEST 3: HELPER FUNKCE
    // ========================================
    console.log('📋 TEST 3: HELPER FUNKCE');
    console.log('-' .repeat(50));
    
    let helperOK = true;
    
    try {
      // Test vernostkarty helper
      console.log('🔧 Testování vernostkarty helper funkcí...');
      const { getAppleCertificatesByPrefix } = require('./vernostkarty/functions/certificateHelperV2');
      
      // Test původních certifikátů
      console.log('   📋 Test původních certifikátů (original)...');
      const originalCerts = await getAppleCertificatesByPrefix(null);
      if (originalCerts && originalCerts.wwdr && originalCerts.signerCert && originalCerts.signerKey) {
        console.log('   ✅ Původní certifikáty načteny úspěšně');
      } else {
        console.log('   ❌ Chyba při načítání původních certifikátů');
        helperOK = false;
      }
      
      // Test vernostkarty-db helper
      console.log('🔧 Testování vernostkarty-db helper funkcí...');
      const { getAppleCertificateContentsByPrefix } = require('./vernostkarty-db/functions/certificateHelperV2');
      
      console.log('   📋 Test původních certifikátů (DB)...');
      const originalDbCerts = await getAppleCertificateContentsByPrefix(null);
      if (originalDbCerts && originalDbCerts.cert && originalDbCerts.key) {
        console.log('   ✅ Původní DB certifikáty načteny úspěšně');
        console.log(`   📊 Velikosti: cert=${originalDbCerts.cert.length}B, key=${originalDbCerts.key.length}B`);
      } else {
        console.log('   ❌ Chyba při načítání původních DB certifikátů');
        helperOK = false;
      }
      
    } catch (error) {
      console.log(`   ❌ Chyba při testování helper funkcí: ${error.message}`);
      helperOK = false;
    }
    
    testResults.helperFunctions = helperOK;
    console.log(`\n🎯 Helper funkce test: ${helperOK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // TEST 4: INTEGRACE - NAČÍTÁNÍ PODLE DATASTORE
    // ========================================
    console.log('📋 TEST 4: INTEGRACE - NAČÍTÁNÍ PODLE DATASTORE');
    console.log('-' .repeat(50));
    
    let integrationOK = true;
    
    try {
      // Funkce pro načítání certifikátů podle cafeId z Datastore
      async function getCertificatesByCafeId(cafeId) {
        const query = datastore.createQuery('certificates')
          .filter('cafeId', '=', cafeId);
        const [results] = await datastore.runQuery(query);
        return results[0] || null;
      }
      
      // Test načítání pro konkrétní kavárnu
      console.log('🔍 Hledání certifikátů pro cafeId: 1cf87e2e-e29a-4734-9e9a-ffa03fbd8029');
      const cafeConfig = await getCertificatesByCafeId('1cf87e2e-e29a-4734-9e9a-ffa03fbd8029');
      
      if (cafeConfig) {
        console.log(`✅ Nalezena konfigurace pro kavárnu:`);
        console.log(`   🔑 Key: ${cafeConfig.key}`);
        console.log(`   📄 P12 Path: ${cafeConfig.p12Path || 'null'}`);
        console.log(`   🍎 WWDR Path: ${cafeConfig.wwdrPath}`);
        
        // Ověření existence souborů v Cloud Storage
        if (cafeConfig.wwdrPath) {
          try {
            const wwdrFile = bucket.file(cafeConfig.wwdrPath);
            const [exists] = await wwdrFile.exists();
            if (exists) {
              console.log(`   ✅ WWDR soubor existuje v Cloud Storage`);
            } else {
              console.log(`   ❌ WWDR soubor neexistuje v Cloud Storage`);
              integrationOK = false;
            }
          } catch (error) {
            console.log(`   ❌ Chyba při kontrole WWDR souboru: ${error.message}`);
            integrationOK = false;
          }
        }
        
      } else {
        console.log(`❌ Konfigurace pro kavárnu nenalezena`);
        integrationOK = false;
      }
      
    } catch (error) {
      console.log(`❌ Chyba při integračním testu: ${error.message}`);
      integrationOK = false;
    }
    
    testResults.integration = integrationOK;
    console.log(`\n🎯 Integrační test: ${integrationOK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // FINÁLNÍ VYHODNOCENÍ
    // ========================================
    console.log('🏆 FINÁLNÍ VYHODNOCENÍ');
    console.log('=' .repeat(80));
    
    const allTestsPassed = Object.values(testResults).every(result => result === true);
    
    console.log('📊 Výsledky testů:');
    console.log(`   📁 Cloud Storage:     ${testResults.cloudStorage ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🗄️  Datastore:        ${testResults.datastore ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🔧 Helper funkce:     ${testResults.helperFunctions ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🔗 Integrace:         ${testResults.integration ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    
    console.log(`\n🎯 CELKOVÝ VÝSLEDEK: ${allTestsPassed ? '🎉 VŠECHNY TESTY ÚSPĚŠNÉ' : '⚠️  NĚKTERÉ TESTY SELHALY'}`);
    
    if (allTestsPassed) {
      console.log('\n✅ Systém je připraven k použití!');
      console.log('📋 Můžete začít používat:');
      console.log('   • Načítání certifikátů podle cafeId z Datastore');
      console.log('   • Helper funkce pro dynamické načítání z Cloud Storage');
      console.log('   • Systém prefixů pro různé podniky');
    } else {
      console.log('\n⚠️  Některé komponenty vyžadují opravu před použitím.');
    }
    
  } catch (error) {
    console.error('❌ Kritická chyba při testování:', error);
    process.exit(1);
  }
}

// Spuštění komplexního testu
comprehensiveTest();
