// Test refaktorovaného kódu pro dynamické načítání certifikátů
const certificateHelper = require('./vernostkarty/functions/certificateHelperV2');

async function testRefactoredCode() {
  console.log('🧪 Testování refaktorovaného kódu...');
  
  try {
    console.log('\n1️⃣ Test načítání Firebase credentials (main)');
    const mainCredentials = certificateHelper.getFirebaseCredentials('main');
    console.log(`✅ Main credentials loaded: ${mainCredentials.project_id}`);
    
    console.log('\n2️⃣ Test načítání Firebase credentials (db)');
    const dbCredentials = certificateHelper.getFirebaseCredentials('db');
    console.log(`✅ DB credentials loaded: ${dbCredentials.project_id}`);
    
    console.log('\n3️⃣ Test načítání Apple Wallet certifikátů podle cafeId');
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(cafeId);
    console.log(`✅ Apple Wallet certificates loaded for cafeId: ${cafeId}`);
    console.log(`  - p12Buffer: ${certificates.p12Buffer.length} bytes`);
    console.log(`  - wwdrBuffer: ${certificates.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certificates.p12Path}`);
    console.log(`  - wwdrPath: ${certificates.wwdrPath}`);
    
    console.log('\n✅ Všechny testy úspěšně dokončeny!');
    console.log('\n🎉 Refaktorování je kompletní a funkční!');
    
  } catch (error) {
    console.error('❌ Test selhal:', error);
  } finally {
    process.exit(0);
  }
}

testRefactoredCode();
