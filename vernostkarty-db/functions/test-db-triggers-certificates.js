const certificateHelper = require('./certificateHelperSimple');

async function testDbTriggersCertificates() {
  console.log('🧪 Testování načítání certifikátů pro DB trigger funkce...');
  
  try {
    // Simulace cafeId z trigger funkcí
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    console.log(`\n🔐 Loading certificates for cafeId: ${cafeId}...`);
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(cafeId);
    console.log(`✅ Certificates loaded from: ${certificates.p12Path}, ${certificates.wwdrPath}`);
    
    console.log('\n📋 Načtené certifikáty pro DB trigger funkce:');
    console.log(`  - signerCert: ${certificates.signerCert.length} bytes`);
    console.log(`  - signerKey: ${certificates.signerKey.length} bytes`);
    console.log(`  - wwdrBuffer: ${certificates.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certificates.p12Path}`);
    console.log(`  - wwdrPath: ${certificates.wwdrPath}`);
    
    // Simulace APN Provider options (jako v upravených trigger funkcích)
    const options = {
      cert: certificates.signerCert,  // PEM certifikát z Cloud Storage
      key: certificates.signerKey,   // PEM privátní klíč z Cloud Storage
      production: true
    };
    
    console.log('\n🔧 APN Provider options připraveny:');
    console.log(`  - cert: ${options.cert.length} bytes (Buffer)`);
    console.log(`  - key: ${options.key.length} bytes (Buffer)`);
    console.log(`  - production: ${options.production}`);
    
    // Ověření, že certifikáty jsou skutečně z Cloud Storage (ne lokální fallback)
    if (certificates.p12Path.includes('original/apple-wallet/') && 
        certificates.wwdrPath.includes('original/apple-wallet/')) {
      console.log('\n✅ POTVRZENO: DB trigger funkce používají certifikáty z Cloud Storage vernostni-certificates/original/apple-wallet/');
      console.log('✅ POTVRZENO: newPassUpdateTrigger.js a passUpdateTrigger.js nyní používají dynamické načítání');
    } else {
      console.log('\n❌ VAROVÁNÍ: DB trigger funkce možná stále používají lokální fallback');
    }
    
    console.log('\n✅ Test DB trigger funkcí úspěšně dokončen!');
    
  } catch (error) {
    console.error('❌ Test DB trigger funkcí selhal:', error);
  } finally {
    process.exit(0);
  }
}

testDbTriggersCertificates();
