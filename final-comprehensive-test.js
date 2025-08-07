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

async function finalComprehensiveTest() {
  console.log('🧪 FINÁLNÍ KOMPLEXNÍ TEST CELÉHO SYSTÉMU CERTIFIKÁTŮ');
  console.log('=' .repeat(80));
  console.log('Testování: Cloud Storage + Datastore + Helper funkce + .P12 certifikáty\n');
  
  let testResults = {
    cloudStorage: false,
    datastore: false,
    helperFunctions: false,
    integration: false,
    p12Certificates: false
  };
  
  try {
    // ========================================
    // TEST 1: CLOUD STORAGE STRUKTURA
    // ========================================
    console.log('📋 TEST 1: CLOUD STORAGE STRUKTURA');
    console.log('-' .repeat(50));
    
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles();
    
    console.log('📁 Nalezené soubory v Cloud Storage:');
    files.forEach(file => console.log(`   📄 ${file.name}`));
    console.log('');
    
    // Kontrola požadované struktury - OPRAVENÉ NÁZVY SOUBORŮ
    const requiredFiles = [
      'original/apple-wallet/AppleWWDRCAG4.pem',
      'original/apple-wallet/certificates.p12',
      '000001/0000001_Certifikáty.p12'
    ];
    
    let cloudStorageOK = true;
    
    for (const requiredFile of requiredFiles) {
      const found = files.some(file => file.name === requiredFile);
      if (found) {
        console.log(`✅ ${requiredFile} - NALEZEN`);
      } else {
        console.log(`❌ ${requiredFile} - CHYBÍ`);
        cloudStorageOK = false;
      }
    }
    
    // Kontrola .p12 souborů
    const p12Files = files.filter(file => file.name.endsWith('.p12'));
    console.log(`\n📄 Nalezeno ${p12Files.length} .p12 souborů:`);
    p12Files.forEach(file => console.log(`   🔐 ${file.name}`));
    
    testResults.cloudStorage = cloudStorageOK;
    console.log(`\n🎯 Cloud Storage test: ${cloudStorageOK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // TEST 2: .P12 CERTIFIKÁTY VALIDACE
    // ========================================
    console.log('📋 TEST 2: .P12 CERTIFIKÁTY VALIDACE');
    console.log('-' .repeat(50));
    
    let p12OK = true;
    
    for (const p12File of p12Files) {
      console.log(`🔍 Validuji ${p12File.name}...`);
      try {
        // Stažení a kontrola velikosti
        const [metadata] = await p12File.getMetadata();
        const sizeKB = Math.round(metadata.size / 1024);
        console.log(`   📊 Velikost: ${sizeKB} KB`);
        
        if (metadata.size > 0) {
          console.log(`   ✅ Soubor má platnou velikost`);
        } else {
          console.log(`   ❌ Soubor je prázdný`);
          p12OK = false;
        }
        
        // Kontrola MIME typu
        if (metadata.contentType === 'application/x-pkcs12') {
          console.log(`   ✅ Správný MIME typ: ${metadata.contentType}`);
        } else {
          console.log(`   ⚠️  MIME typ: ${metadata.contentType || 'neznámý'}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Chyba při validaci: ${error.message}`);
        p12OK = false;
      }
      console.log('');
    }
    
    testResults.p12Certificates = p12OK;
    console.log(`🎯 .P12 certifikáty test: ${p12OK ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}\n`);
    
    // ========================================
    // TEST 3: DATASTORE KOLEKCE CERTIFICATES
    // ========================================
    console.log('📋 TEST 3: DATASTORE KOLEKCE CERTIFICATES');
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
          if (found.p12Path !== 'original/apple-wallet/certificates.p12') {
            console.log(`   ⚠️  Nesprávná p12Path pro original`);
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
        
        // Ověření existence souborů v Cloud Storage
        if (found.p12Path) {
          const p12File = bucket.file(found.p12Path);
          const [exists] = await p12File.exists();
          if (exists) {
            console.log(`   ✅ P12 soubor existuje v Cloud Storage`);
          } else {
            console.log(`   ❌ P12 soubor neexistuje v Cloud Storage`);
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
    // TEST 4: HELPER FUNKCE
    // ========================================
    console.log('📋 TEST 4: HELPER FUNKCE');
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
    // TEST 5: INTEGRACE - NAČÍTÁNÍ PODLE DATASTORE
    // ========================================
    console.log('📋 TEST 5: INTEGRACE - NAČÍTÁNÍ PODLE DATASTORE');
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
        console.log(`   📄 P12 Path: ${cafeConfig.p12Path}`);
        console.log(`   🍎 WWDR Path: ${cafeConfig.wwdrPath}`);
        
        // Ověření existence souborů v Cloud Storage
        const filesToCheck = [
          { name: 'P12', path: cafeConfig.p12Path },
          { name: 'WWDR', path: cafeConfig.wwdrPath }
        ];
        
        for (const fileInfo of filesToCheck) {
          if (fileInfo.path) {
            try {
              const file = bucket.file(fileInfo.path);
              const [exists] = await file.exists();
              if (exists) {
                console.log(`   ✅ ${fileInfo.name} soubor existuje v Cloud Storage`);
              } else {
                console.log(`   ❌ ${fileInfo.name} soubor neexistuje v Cloud Storage`);
                integrationOK = false;
              }
            } catch (error) {
              console.log(`   ❌ Chyba při kontrole ${fileInfo.name} souboru: ${error.message}`);
              integrationOK = false;
            }
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
    console.log(`   🔐 .P12 certifikáty:  ${testResults.p12Certificates ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🗄️  Datastore:        ${testResults.datastore ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🔧 Helper funkce:     ${testResults.helperFunctions ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    console.log(`   🔗 Integrace:         ${testResults.integration ? '✅ ÚSPĚCH' : '❌ SELHÁNÍ'}`);
    
    console.log(`\n🎯 CELKOVÝ VÝSLEDEK: ${allTestsPassed ? '🎉 VŠECHNY TESTY ÚSPĚŠNÉ' : '⚠️  NĚKTERÉ TESTY SELHALY'}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 SYSTÉM JE PLNĚ FUNKČNÍ A PŘIPRAVEN K POUŽITÍ!');
      console.log('=' .repeat(60));
      console.log('✅ Úspěšně implementováno:');
      console.log('   • Cloud Storage s organizovanou strukturou (original/ + prefixy)');
      console.log('   • .P12 certifikáty vytvořené z PEM souborů');
      console.log('   • Datastore kolekce "certificates" s kompletními metadaty');
      console.log('   • Helper funkce V2 s podporou prefixů a fallbacku');
      console.log('   • Integrační logika pro načítání podle cafeId');
      console.log('');
      console.log('📋 Systém podporuje:');
      console.log('   • Dynamické načítání certifikátů podle cafeId');
      console.log('   • Prefix-based organizaci pro různé podniky');
      console.log('   • Fallback mechanismus na lokální soubory');
      console.log('   • Bezpečné úložiště v Google Cloud Storage');
      console.log('   • Metadata management přes Datastore');
    } else {
      console.log('\n⚠️  Některé komponenty vyžadují opravu před použitím.');
    }
    
  } catch (error) {
    console.error('❌ Kritická chyba při testování:', error);
    process.exit(1);
  }
}

// Spuštění finálního komplexního testu
finalComprehensiveTest();
