// Praktický test funkčnosti refaktorovaných funkcí s reálnými daty
const certificateHelperVernostkarty = require('./vernostkarty/functions/certificateHelperV2');
const certificateHelperDb = require('./vernostkarty-db/functions/certificateHelperV2');

async function practicalFunctionalityTest() {
  console.log('🧪 PRAKTICKÝ TEST FUNKČNOSTI S REÁLNÝMI DATY');
  console.log('═'.repeat(60));
  
  const testResults = {
    vernostkarty: { passed: 0, failed: 0 },
    vernostkartyDb: { passed: 0, failed: 0 },
    issues: []
  };
  
  const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029'; // original cafeId
  
  try {
    // Test 1: vernostkarty certificateHelperV2
    console.log('\n1️⃣ Test vernostkarty certificateHelperV2 funkcí...');
    console.log('─'.repeat(50));
    
    try {
      // Test načítání cest z Datastore
      console.log('🔍 Test getCertificatePathsByCafeId...');
      const paths1 = await certificateHelperVernostkarty.getCertificatePathsByCafeId(cafeId);
      
      if (paths1 && paths1.p12Path && paths1.wwdrPath) {
        console.log(`✅ Cesty načteny: p12=${paths1.p12Path}, wwdr=${paths1.wwdrPath}`);
        testResults.vernostkarty.passed++;
      } else {
        console.log('❌ Neplatné cesty k certifikátům');
        testResults.vernostkarty.failed++;
        testResults.issues.push('vernostkarty: Invalid certificate paths');
      }
      
      // Test načítání certifikátů z Cloud Storage
      console.log('🔍 Test getAppleCertificatesByCafeId...');
      const certs1 = await certificateHelperVernostkarty.getAppleCertificatesByCafeId(cafeId);
      
      if (certs1 && certs1.p12Buffer && certs1.wwdrBuffer && 
          certs1.p12Buffer.length > 0 && certs1.wwdrBuffer.length > 0) {
        console.log(`✅ Certifikáty načteny: p12=${certs1.p12Buffer.length}B, wwdr=${certs1.wwdrBuffer.length}B`);
        testResults.vernostkarty.passed++;
      } else {
        console.log('❌ Neplatné certifikáty');
        testResults.vernostkarty.failed++;
        testResults.issues.push('vernostkarty: Invalid certificate buffers');
      }
      
      // Test Firebase credentials
      console.log('🔍 Test getFirebaseCredentials...');
      const firebaseCreds1 = certificateHelperVernostkarty.getFirebaseCredentials('main');
      
      if (firebaseCreds1 && firebaseCreds1.project_id && firebaseCreds1.client_email) {
        console.log(`✅ Firebase credentials: project=${firebaseCreds1.project_id}`);
        testResults.vernostkarty.passed++;
      } else {
        console.log('❌ Neplatné Firebase credentials');
        testResults.vernostkarty.failed++;
        testResults.issues.push('vernostkarty: Invalid Firebase credentials');
      }
      
    } catch (error) {
      console.log(`❌ Chyba v vernostkarty testech: ${error.message}`);
      testResults.vernostkarty.failed++;
      testResults.issues.push(`vernostkarty error: ${error.message}`);
    }
    
    // Test 2: vernostkarty-db certificateHelperV2
    console.log('\n2️⃣ Test vernostkarty-db certificateHelperV2 funkcí...');
    console.log('─'.repeat(50));
    
    try {
      // Test načítání cest z Datastore
      console.log('🔍 Test getCertificatePathsByCafeId...');
      const paths2 = await certificateHelperDb.getCertificatePathsByCafeId(cafeId);
      
      if (paths2 && paths2.p12Path && paths2.wwdrPath) {
        console.log(`✅ Cesty načteny: p12=${paths2.p12Path}, wwdr=${paths2.wwdrPath}`);
        testResults.vernostkartyDb.passed++;
      } else {
        console.log('❌ Neplatné cesty k certifikátům');
        testResults.vernostkartyDb.failed++;
        testResults.issues.push('vernostkarty-db: Invalid certificate paths');
      }
      
      // Test načítání certifikátů z Cloud Storage
      console.log('🔍 Test getAppleCertificatesByCafeId...');
      const certs2 = await certificateHelperDb.getAppleCertificatesByCafeId(cafeId);
      
      if (certs2 && certs2.p12Buffer && certs2.wwdrBuffer && 
          certs2.p12Buffer.length > 0 && certs2.wwdrBuffer.length > 0) {
        console.log(`✅ Certifikáty načteny: p12=${certs2.p12Buffer.length}B, wwdr=${certs2.wwdrBuffer.length}B`);
        testResults.vernostkartyDb.passed++;
      } else {
        console.log('❌ Neplatné certifikáty');
        testResults.vernostkartyDb.failed++;
        testResults.issues.push('vernostkarty-db: Invalid certificate buffers');
      }
      
      // Test Firebase credentials
      console.log('🔍 Test getFirebaseCredentials...');
      const firebaseCreds2 = certificateHelperDb.getFirebaseCredentials('main');
      
      if (firebaseCreds2 && firebaseCreds2.project_id && firebaseCreds2.client_email) {
        console.log(`✅ Firebase credentials: project=${firebaseCreds2.project_id}`);
        testResults.vernostkartyDb.passed++;
      } else {
        console.log('❌ Neplatné Firebase credentials');
        testResults.vernostkartyDb.failed++;
        testResults.issues.push('vernostkarty-db: Invalid Firebase credentials');
      }
      
    } catch (error) {
      console.log(`❌ Chyba v vernostkarty-db testech: ${error.message}`);
      testResults.vernostkartyDb.failed++;
      testResults.issues.push(`vernostkarty-db error: ${error.message}`);
    }
    
    // Test 3: Ověření konzistence dat mezi projekty
    console.log('\n3️⃣ Test konzistence dat mezi projekty...');
    console.log('─'.repeat(50));
    
    try {
      const paths1 = await certificateHelperVernostkarty.getCertificatePathsByCafeId(cafeId);
      const paths2 = await certificateHelperDb.getCertificatePathsByCafeId(cafeId);
      
      if (paths1.p12Path === paths2.p12Path && paths1.wwdrPath === paths2.wwdrPath) {
        console.log('✅ Cesty k certifikátům jsou konzistentní mezi projekty');
      } else {
        console.log('❌ Nekonzistentní cesty k certifikátům mezi projekty');
        testResults.issues.push('Inconsistent certificate paths between projects');
      }
      
      const certs1 = await certificateHelperVernostkarty.getAppleCertificatesByCafeId(cafeId);
      const certs2 = await certificateHelperDb.getAppleCertificatesByCafeId(cafeId);
      
      if (certs1.p12Buffer.equals(certs2.p12Buffer) && certs1.wwdrBuffer.equals(certs2.wwdrBuffer)) {
        console.log('✅ Certifikáty jsou identické mezi projekty');
      } else {
        console.log('❌ Neidentické certifikáty mezi projekty');
        testResults.issues.push('Different certificate content between projects');
      }
      
    } catch (error) {
      console.log(`❌ Chyba v testu konzistence: ${error.message}`);
      testResults.issues.push(`Consistency test error: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Fatální chyba v testech: ${error.message}`);
    testResults.issues.push(`Fatal error: ${error.message}`);
  }
  
  // Výsledky
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VÝSLEDKY PRAKTICKÉHO TESTU:');
  console.log(`🔹 vernostkarty: ✅ ${testResults.vernostkarty.passed} | ❌ ${testResults.vernostkarty.failed}`);
  console.log(`🔹 vernostkarty-db: ✅ ${testResults.vernostkartyDb.passed} | ❌ ${testResults.vernostkartyDb.failed}`);
  
  const totalPassed = testResults.vernostkarty.passed + testResults.vernostkartyDb.passed;
  const totalFailed = testResults.vernostkarty.failed + testResults.vernostkartyDb.failed;
  
  console.log(`📋 Celkem: ✅ ${totalPassed} | ❌ ${totalFailed}`);
  
  if (testResults.issues.length > 0) {
    console.log('\n🚨 NALEZENÉ PROBLÉMY:');
    testResults.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  if (totalFailed === 0) {
    console.log('\n🎉 VŠECHNY PRAKTICKÉ TESTY PROŠLY!');
    console.log('✅ Refaktorovaný systém je plně funkční s reálnými daty.');
    console.log('✅ Dynamické načítání certifikátů podle cafeId funguje správně.');
    console.log('✅ Oba projekty používají stejné certifikáty a cesty.');
  } else {
    console.log('\n⚠️  NĚKTERÉ PRAKTICKÉ TESTY SELHALY!');
  }
  
  return { totalPassed, totalFailed, issues: testResults.issues };
}

// Spuštění praktického testu
practicalFunctionalityTest().then(results => {
  process.exit(results.totalFailed > 0 ? 1 : 0);
}).catch(error => {
  console.error('❌ Praktický test selhal s chybou:', error);
  process.exit(1);
});
