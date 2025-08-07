// Komplexní test refaktorované logiky dynamické správy certifikátů
const fs = require('fs');
const path = require('path');

async function comprehensiveRefactoringTest() {
  console.log('🔍 KOMPLEXNÍ TEST REFAKTOROVANÉ LOGIKY');
  console.log('═'.repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    issues: []
  };
  
  // Test 1: Kontrola existence certificateHelperV2.js v obou projektech
  console.log('\n1️⃣ Test existence certificateHelperV2.js souborů...');
  const helperPaths = [
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/certificateHelperV2.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/certificateHelperV2.js'
  ];
  
  for (const helperPath of helperPaths) {
    if (fs.existsSync(helperPath)) {
      console.log(`✅ ${helperPath} - EXISTS`);
      results.passed++;
    } else {
      console.log(`❌ ${helperPath} - MISSING`);
      results.failed++;
      results.issues.push(`Missing certificateHelperV2.js: ${helperPath}`);
    }
  }
  
  // Test 2: Kontrola importů certificateHelperV2 v refaktorovaných souborech
  console.log('\n2️⃣ Test importů certificateHelperV2...');
  const filesToCheck = [
    {
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
      expectedImport: "const certificateHelper = require('./certificateHelperV2');"
    },
    {
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
      expectedImport: "const certificateHelper = require('./certificateHelperV2');"
    },
    {
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/index.js',
      expectedImport: "const certificateHelper = require('./certificateHelperV2');"
    },
    {
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
      expectedImport: "const certificateHelper = require('./certificateHelperV2');"
    },
    {
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js',
      expectedImport: "const certificateHelper = require('./certificateHelperV2');"
    }
  ];
  
  for (const file of filesToCheck) {
    if (fs.existsSync(file.path)) {
      const content = fs.readFileSync(file.path, 'utf8');
      if (content.includes(file.expectedImport)) {
        console.log(`✅ ${path.basename(file.path)} - IMPORT OK`);
        results.passed++;
      } else {
        console.log(`❌ ${path.basename(file.path)} - MISSING IMPORT`);
        results.failed++;
        results.issues.push(`Missing import in ${file.path}: ${file.expectedImport}`);
      }
    } else {
      console.log(`❌ ${path.basename(file.path)} - FILE NOT FOUND`);
      results.failed++;
      results.issues.push(`File not found: ${file.path}`);
    }
  }
  
  // Test 3: Kontrola dynamického načítání certifikátů podle cafeId
  console.log('\n3️⃣ Test dynamického načítání certifikátů podle cafeId...');
  const dynamicLoadingChecks = [
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
      patterns: [
        'getAppleCertificatesByCafeId(passData.cafeId)',
        'getAppleCertificatesByCafeId(originalCard.cafeId)'
      ]
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
      patterns: [
        'getAppleCertificatesByCafeId(userData.cafeId)'
      ]
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
      patterns: [
        'getAppleCertificatesByCafeId(cafeId)'
      ]
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js',
      patterns: [
        'getAppleCertificatesByCafeId(cafeId)'
      ]
    }
  ];
  
  for (const check of dynamicLoadingChecks) {
    if (fs.existsSync(check.file)) {
      const content = fs.readFileSync(check.file, 'utf8');
      let allPatternsFound = true;
      
      for (const pattern of check.patterns) {
        if (!content.includes(pattern)) {
          allPatternsFound = false;
          results.issues.push(`Missing pattern in ${path.basename(check.file)}: ${pattern}`);
        }
      }
      
      if (allPatternsFound) {
        console.log(`✅ ${path.basename(check.file)} - DYNAMIC LOADING OK`);
        results.passed++;
      } else {
        console.log(`❌ ${path.basename(check.file)} - MISSING DYNAMIC LOADING`);
        results.failed++;
      }
    }
  }
  
  // Test 4: Kontrola, že se nepoužívají staré statické cesty k certifikátům
  console.log('\n4️⃣ Test absence starých statických cest...');
  const staticPathPatterns = [
    './certificates/passCert.pem',
    './certificates/privatekey.key',
    './certificates/AppleWWDRCAG4.pem',
    'fs.readFileSync("./certificates/',
    'fs.readFileSync(certPaths.',
    'fs.readFileSync(certPath'
  ];
  
  const filesToCheckForStatic = [
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js'
  ];
  
  for (const filePath of filesToCheckForStatic) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      let hasStaticPaths = false;
      
      for (const pattern of staticPathPatterns) {
        if (content.includes(pattern)) {
          hasStaticPaths = true;
          results.issues.push(`Found static path in ${path.basename(filePath)}: ${pattern}`);
        }
      }
      
      if (!hasStaticPaths) {
        console.log(`✅ ${path.basename(filePath)} - NO STATIC PATHS`);
        results.passed++;
      } else {
        console.log(`❌ ${path.basename(filePath)} - CONTAINS STATIC PATHS`);
        results.failed++;
      }
    }
  }
  
  // Test 5: Kontrola funkcí v certificateHelperV2.js
  console.log('\n5️⃣ Test funkcí v certificateHelperV2.js...');
  const requiredFunctions = [
    'getCertificatePathsByCafeId',
    'getAppleCertificatesByCafeId'
  ];
  
  for (const helperPath of helperPaths) {
    if (fs.existsSync(helperPath)) {
      const content = fs.readFileSync(helperPath, 'utf8');
      let allFunctionsFound = true;
      
      for (const func of requiredFunctions) {
        if (!content.includes(`async function ${func}`)) {
          allFunctionsFound = false;
          results.issues.push(`Missing function in ${path.basename(helperPath)}: ${func}`);
        }
      }
      
      if (allFunctionsFound) {
        console.log(`✅ ${path.basename(helperPath)} - ALL FUNCTIONS PRESENT`);
        results.passed++;
      } else {
        console.log(`❌ ${path.basename(helperPath)} - MISSING FUNCTIONS`);
        results.failed++;
      }
    }
  }
  
  // Výsledky
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VÝSLEDKY TESTU:');
  console.log(`✅ Úspěšné testy: ${results.passed}`);
  console.log(`❌ Neúspěšné testy: ${results.failed}`);
  console.log(`📋 Celkem testů: ${results.passed + results.failed}`);
  
  if (results.issues.length > 0) {
    console.log('\n🚨 NALEZENÉ PROBLÉMY:');
    results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  if (results.failed === 0) {
    console.log('\n🎉 VŠECHNY TESTY PROŠLY! Refaktorování je kompletní a správné.');
  } else {
    console.log('\n⚠️  NĚKTERÉ TESTY SELHALY! Je potřeba opravit nalezené problémy.');
  }
  
  return results;
}

// Spuštění testu
comprehensiveRefactoringTest().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('❌ Test selhal s chybou:', error);
  process.exit(1);
});
