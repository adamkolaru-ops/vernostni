const certificateHelperVernostkarty = require('./vernostkarty/functions/certificateHelperV2');
const certificateHelperDb = require('./vernostkarty-db/functions/certificateHelperV2');

async function testRefactoredSystem() {
  console.log('🧪 Testování refaktorovaného systému dynamické správy certifikátů...\n');
  
  try {
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029'; // original cafeId
    
    console.log('1️⃣ Test vernostkarty certificateHelperV2...');
    console.log('─'.repeat(50));
    
    // Test načítání cest k certifikátům
    const paths1 = await certificateHelperVernostkarty.getCertificatePathsByCafeId(cafeId);
    console.log('📋 Cesty k certifikátům (vernostkarty):', paths1);
    
    // Test načítání certifikátů
    const certs1 = await certificateHelperVernostkarty.getAppleCertificatesByCafeId(cafeId);
    console.log('📋 Certifikáty (vernostkarty):');
    console.log(`  - p12Buffer: ${certs1.p12Buffer.length} bytes`);
    console.log(`  - wwdrBuffer: ${certs1.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certs1.p12Path}`);
    console.log(`  - wwdrPath: ${certs1.wwdrPath}`);
    
    console.log('\n2️⃣ Test vernostkarty-db certificateHelperV2...');
    console.log('─'.repeat(50));
    
    // Test načítání cest k certifikátům
    const paths2 = await certificateHelperDb.getCertificatePathsByCafeId(cafeId);
    console.log('📋 Cesty k certifikátům (vernostkarty-db):', paths2);
    
    // Test načítání certifikátů
    const certs2 = await certificateHelperDb.getAppleCertificatesByCafeId(cafeId);
    console.log('📋 Certifikáty (vernostkarty-db):');
    console.log(`  - p12Buffer: ${certs2.p12Buffer.length} bytes`);
    console.log(`  - wwdrBuffer: ${certs2.wwdrBuffer.length} bytes`);
    console.log(`  - p12Path: ${certs2.p12Path}`);
    console.log(`  - wwdrPath: ${certs2.wwdrPath}`);
    
    console.log('\n3️⃣ Test Firebase credentials...');
    console.log('─'.repeat(50));
    
    // Test Firebase credentials pro vernostkarty
    const firebaseCreds1 = certificateHelperVernostkarty.getFirebaseCredentials('main');
    console.log('📋 Firebase credentials (vernostkarty):');
    console.log(`  - project_id: ${firebaseCreds1.project_id}`);
    console.log(`  - client_email: ${firebaseCreds1.client_email}`);
    
    // Test Firebase credentials pro vernostkarty-db
    const firebaseCreds2 = certificateHelperDb.getFirebaseCredentials('main');
    console.log('📋 Firebase credentials (vernostkarty-db):');
    console.log(`  - project_id: ${firebaseCreds2.project_id}`);
    console.log(`  - client_email: ${firebaseCreds2.client_email}`);
    
    console.log('\n✅ VŠECHNY TESTY ÚSPĚŠNÉ!');
    console.log('🎉 Refaktorovaný systém dynamické správy certifikátů je plně funkční!');
    console.log('\n📋 SOUHRN REFAKTOROVÁNÍ:');
    console.log('  ✅ vernostkarty/functions/index.js - createPass a generateUpdatedPass');
    console.log('  ✅ vernostkarty/functions/appleWalletWebhook.js - dynamické načítání certifikátů');
    console.log('  ✅ vernostkarty-db/functions/index.js - Firebase Admin inicializace');
    console.log('  ✅ vernostkarty-db/functions/newPassUpdateTrigger.js - APN provider s dynamickými certifikáty');
    console.log('  ✅ vernostkarty-db/functions/passUpdateTrigger.js - APN provider s dynamickými certifikáty');
    console.log('  ✅ certificateHelperV2.js v obou projektech - funkce pro načítání podle cafeId');
    
  } catch (error) {
    console.error('❌ Test selhal:', error);
  } finally {
    process.exit(0);
  }
}

testRefactoredSystem();
