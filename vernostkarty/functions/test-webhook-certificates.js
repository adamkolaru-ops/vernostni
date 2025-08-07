const certificateHelper = require('./certificateHelperV2');

async function testWebhookCertificates() {
  console.log('🧪 Testování načítání certifikátů pro webhook...');
  
  try {
    // Simulace userData z webhooku
    const userData = {
      cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029'
    };
    
    console.log(`\n🔐 Loading certificates for cafeId: ${userData.cafeId}...`);
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(userData.cafeId);
    console.log(`✅ Certificates loaded from: ${certificates.p12Path}, ${certificates.wwdrPath}`);
    
    console.log('\n📋 Načtené certifikáty pro webhook:');
    console.log(`  - signerCert: ${certificates.signerCert.length} bytes`);
    console.log(`  - signerKey: ${certificates.signerKey.length} bytes`);
    console.log(`  - wwdrBuffer: ${certificates.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certificates.p12Path}`);
    console.log(`  - wwdrPath: ${certificates.wwdrPath}`);
    
    // Ověření, že certifikáty jsou skutečně z Cloud Storage (ne lokální fallback)
    if (certificates.p12Path.includes('original/apple-wallet/') && 
        certificates.wwdrPath.includes('original/apple-wallet/')) {
      console.log('\n✅ POTVRZENO: Webhook používá certifikáty z Cloud Storage vernostni-certificates/original/apple-wallet/');
    } else {
      console.log('\n❌ VAROVÁNÍ: Webhook možná stále používá lokální fallback');
    }
    
    console.log('\n✅ Test webhooku úspěšně dokončen!');
    
  } catch (error) {
    console.error('❌ Test webhooku selhal:', error);
  } finally {
    process.exit(0);
  }
}

testWebhookCertificates();
