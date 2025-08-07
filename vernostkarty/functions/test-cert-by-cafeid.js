const certificateHelper = require('./certificateHelperV2');

async function testCertificatesByCafeId() {
  console.log('🧪 Testování načítání certifikátů podle cafeId...');
  
  try {
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    
    console.log(`\n1️⃣ Test načítání cest k certifikátům pro cafeId: ${cafeId}`);
    const paths = await certificateHelper.getCertificatePathsByCafeId(cafeId);
    console.log('📋 Nalezené cesty:', paths);
    
    console.log(`\n2️⃣ Test načítání samotných certifikátů pro cafeId: ${cafeId}`);
    const certs = await certificateHelper.getAppleCertificatesByCafeId(cafeId);
    console.log('📋 Načtené certifikáty:');
    console.log(`  - signerCert: ${certs.signerCert.length} bytes`);
    console.log(`  - signerKey: ${certs.signerKey.length} bytes`);
    console.log(`  - wwdrBuffer: ${certs.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certs.p12Path}`);
    console.log(`  - wwdrPath: ${certs.wwdrPath}`);
    
    console.log('\n✅ Test úspěšně dokončen!');
    
  } catch (error) {
    console.error('❌ Test selhal:', error);
  } finally {
    process.exit(0);
  }
}

testCertificatesByCafeId();
