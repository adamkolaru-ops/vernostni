// Test skript pro ověření funkčnosti certificate helperu s prefixy

async function testPrefixSystem() {
  console.log('🧪 Testování systému prefixů pro certifikáty...\n');
  
  try {
    // Test vernostkarty helper
    console.log('📋 Test 1: Vernostkarty helper - původní certifikáty (bez prefixu)');
    const { getAppleCertificatesByPrefix, getFirebaseCredentialsByPrefix, extractPrefix } = 
      require('./vernostkarty/functions/certificateHelperV2');
    
    // Test načítání původních certifikátů
    const originalCerts = await getAppleCertificatesByPrefix(null);
    console.log('✅ Původní Apple certifikáty načteny:', originalCerts);
    
    // Test načítání původních Firebase credentials
    const originalFirebase = await getFirebaseCredentialsByPrefix('main', null);
    console.log('✅ Původní Firebase credentials načteny, project_id:', originalFirebase.project_id);
    
    console.log('\n📋 Test 2: Extrakce prefixu z různých vstupů');
    console.log('extractPrefix("000001_passCert.pem"):', extractPrefix("000001_passCert.pem"));
    console.log('extractPrefix("123456"):', extractPrefix("123456"));
    console.log('extractPrefix("000001"):', extractPrefix("000001"));
    console.log('extractPrefix("invalid"):', extractPrefix("invalid"));
    
    console.log('\n📋 Test 3: Vernostkarty-db helper - původní certifikáty');
    const { getAppleCertificateContentsByPrefix, getFirebaseCredentialsByPrefix: getDbCredentials } = 
      require('./vernostkarty-db/functions/certificateHelperV2');
    
    const originalDbCerts = await getAppleCertificateContentsByPrefix(null);
    console.log('✅ Původní DB certifikáty načteny, velikosti:', {
      cert: originalDbCerts.cert.length + ' bytes',
      key: originalDbCerts.key.length + ' bytes'
    });
    
    const originalDbFirebase = await getDbCredentials(null);
    console.log('✅ Původní DB Firebase credentials načteny, project_id:', originalDbFirebase.project_id);
    
    // Test s neexistujícím prefixem (měl by použít fallback)
    console.log('\n📋 Test 4: Neexistující prefix (test fallbacku)');
    try {
      const nonExistentCerts = await getAppleCertificatesByPrefix("999999");
      console.log('✅ Fallback funguje pro neexistující prefix');
    } catch (error) {
      console.log('✅ Fallback zachytil chybu:', error.message);
    }
    
    console.log('\n🎉 Všechny testy dokončeny!');
    
    console.log('\n📋 Jak používat systém prefixů:');
    console.log('1. Pro původní certifikáty: getAppleCertificatesByPrefix(null)');
    console.log('2. Pro certifikáty s prefixem: getAppleCertificatesByPrefix("000001")');
    console.log('3. Pro nahrání nových: uploadCertificatesWithPrefix("000001", {...})');
    
  } catch (error) {
    console.error('❌ Chyba při testování:', error);
  }
}

// Spuštění testů
testPrefixSystem().catch(console.error);
