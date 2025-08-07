// Test skript pro ověření funkčnosti certificate helperu

async function testVernostkartyHelper() {
  console.log('🧪 Testování helper funkcí pro vernostkarty...');
  
  try {
    // Test načítání Apple certifikátů
    const { getAppleCertificatePaths, getFirebaseCredentials } = require('./vernostkarty/functions/certificateHelper');
    
    console.log('📋 Test 1: Načítání Apple Wallet certifikátů...');
    const appleCerts = await getAppleCertificatePaths();
    console.log('✅ Apple certifikáty načteny:', appleCerts);
    
    console.log('📋 Test 2: Načítání Firebase credentials (main)...');
    const mainCreds = await getFirebaseCredentials('main');
    console.log('✅ Main credentials načteny, project_id:', mainCreds.project_id);
    
    console.log('📋 Test 3: Načítání Firebase credentials (db)...');
    const dbCreds = await getFirebaseCredentials('db');
    console.log('✅ DB credentials načteny, project_id:', dbCreds.project_id);
    
  } catch (error) {
    console.error('❌ Chyba při testování vernostkarty helperu:', error);
  }
}

async function testVernostkartyDbHelper() {
  console.log('\n🧪 Testování helper funkcí pro vernostkarty-db...');
  
  try {
    const { getAppleCertificateContents, getFirebaseCredentials } = require('./vernostkarty-db/functions/certificateHelper');
    
    console.log('📋 Test 1: Načítání Apple Wallet certifikátů (obsah)...');
    const appleCerts = await getAppleCertificateContents();
    console.log('✅ Apple certifikáty načteny, velikosti:', {
      cert: appleCerts.cert.length + ' bytes',
      key: appleCerts.key.length + ' bytes'
    });
    
    console.log('📋 Test 2: Načítání Firebase credentials...');
    const creds = await getFirebaseCredentials();
    console.log('✅ Credentials načteny, project_id:', creds.project_id);
    
  } catch (error) {
    console.error('❌ Chyba při testování vernostkarty-db helperu:', error);
  }
}

async function runTests() {
  console.log('🚀 Spouštím testy certificate helperů...\n');
  
  await testVernostkartyHelper();
  await testVernostkartyDbHelper();
  
  console.log('\n🎉 Testy dokončeny!');
}

// Spuštění testů
runTests().catch(console.error);
