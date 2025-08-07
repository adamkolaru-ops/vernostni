// Test načítání certifikátů s prefixem 000001

async function test000001Certificates() {
  console.log('🧪 Testování načítání certifikátů s prefixem 000001...\n');
  
  try {
    // Test vernostkarty helper
    console.log('📋 Test 1: Načítání Apple certifikátů s prefixem 000001');
    const { getAppleCertificatesByPrefix } = require('./vernostkarty/functions/certificateHelperV2');
    
    const certs000001 = await getAppleCertificatesByPrefix('000001');
    console.log('✅ Certifikáty 000001 načteny:', certs000001);
    
    // Test vernostkarty-db helper
    console.log('\n📋 Test 2: Načítání DB certifikátů s prefixem 000001');
    const { getAppleCertificateContentsByPrefix } = require('./vernostkarty-db/functions/certificateHelperV2');
    
    const dbCerts000001 = await getAppleCertificateContentsByPrefix('000001');
    console.log('✅ DB certifikáty 000001 načteny, velikosti:', {
      cert: dbCerts000001.cert.length + ' bytes',
      key: dbCerts000001.key.length + ' bytes'
    });
    
    // Test Firebase credentials s prefixem
    console.log('\n📋 Test 3: Načítání Firebase credentials s prefixem 000001');
    const { getFirebaseCredentialsByPrefix } = require('./vernostkarty/functions/certificateHelperV2');
    
    const firebaseCreds = await getFirebaseCredentialsByPrefix('main', '000001');
    console.log('✅ Firebase credentials 000001 načteny, project_id:', firebaseCreds.project_id);
    
    console.log('\n🎉 Všechny testy s prefixem 000001 úspěšné!');
    
    console.log('\n📋 Porovnání - původní vs. 000001:');
    console.log('🔸 Původní (original): getAppleCertificatesByPrefix(null)');
    console.log('🔸 Prefix 000001: getAppleCertificatesByPrefix("000001")');
    
  } catch (error) {
    console.error('❌ Chyba při testování 000001:', error);
  }
}

// Spuštění testu
test000001Certificates().catch(console.error);
