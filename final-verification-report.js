// Finální ověření stavu refaktorování - kontrola bez spouštění funkcí
const fs = require('fs');
const path = require('path');

function finalVerificationReport() {
  console.log('🔍 FINÁLNÍ OVĚŘENÍ STAVU REFAKTOROVÁNÍ');
  console.log('═'.repeat(60));
  
  const report = {
    structuralChanges: [],
    codeChanges: [],
    issues: [],
    summary: {
      completed: 0,
      total: 0
    }
  };
  
  // 1. Strukturální změny
  console.log('\n1️⃣ STRUKTURÁLNÍ ZMĚNY:');
  console.log('─'.repeat(40));
  
  const structuralChecks = [
    {
      description: 'certificateHelperV2.js v vernostkarty/functions/',
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/certificateHelperV2.js',
      expected: true
    },
    {
      description: 'certificateHelperV2.js v vernostkarty-db/functions/',
      path: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/certificateHelperV2.js',
      expected: true
    }
  ];
  
  structuralChecks.forEach(check => {
    const exists = fs.existsSync(check.path);
    const status = exists === check.expected ? '✅' : '❌';
    console.log(`${status} ${check.description}`);
    
    if (exists === check.expected) {
      report.structuralChanges.push({ description: check.description, status: 'OK' });
      report.summary.completed++;
    } else {
      report.issues.push(`Missing: ${check.description}`);
    }
    report.summary.total++;
  });
  
  // 2. Změny kódu - kontrola importů
  console.log('\n2️⃣ ZMĚNY KÓDU - IMPORTY:');
  console.log('─'.repeat(40));
  
  const importChecks = [
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
      pattern: "const certificateHelper = require('./certificateHelperV2');",
      description: 'vernostkarty/index.js - import certificateHelperV2'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
      pattern: "const certificateHelper = require('./certificateHelperV2');",
      description: 'vernostkarty/appleWalletWebhook.js - import certificateHelperV2'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/index.js',
      pattern: "const certificateHelper = require('./certificateHelperV2');",
      description: 'vernostkarty-db/index.js - import certificateHelperV2'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
      pattern: "const certificateHelper = require('./certificateHelperV2');",
      description: 'vernostkarty-db/newPassUpdateTrigger.js - import certificateHelperV2'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js',
      pattern: "const certificateHelper = require('./certificateHelperV2');",
      description: 'vernostkarty-db/passUpdateTrigger.js - import certificateHelperV2'
    }
  ];
  
  importChecks.forEach(check => {
    if (fs.existsSync(check.file)) {
      const content = fs.readFileSync(check.file, 'utf8');
      const hasImport = content.includes(check.pattern);
      const status = hasImport ? '✅' : '❌';
      console.log(`${status} ${check.description}`);
      
      if (hasImport) {
        report.codeChanges.push({ description: check.description, status: 'OK' });
        report.summary.completed++;
      } else {
        report.issues.push(`Missing import: ${check.description}`);
      }
    } else {
      console.log(`❌ ${check.description} - FILE NOT FOUND`);
      report.issues.push(`File not found: ${check.file}`);
    }
    report.summary.total++;
  });
  
  // 3. Změny kódu - dynamické načítání
  console.log('\n3️⃣ ZMĚNY KÓDU - DYNAMICKÉ NAČÍTÁNÍ:');
  console.log('─'.repeat(40));
  
  const dynamicLoadingChecks = [
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
      patterns: [
        'getAppleCertificatesByCafeId(passData.cafeId)',
        'getAppleCertificatesByCafeId(originalCard.cafeId)'
      ],
      description: 'vernostkarty/index.js - dynamické načítání podle cafeId'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
      patterns: ['getAppleCertificatesByCafeId(userData.cafeId)'],
      description: 'vernostkarty/appleWalletWebhook.js - dynamické načítání podle cafeId'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
      patterns: ['getAppleCertificatesByCafeId(cafeId)'],
      description: 'vernostkarty-db/newPassUpdateTrigger.js - dynamické načítání podle cafeId'
    },
    {
      file: '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js',
      patterns: ['getAppleCertificatesByCafeId(cafeId)'],
      description: 'vernostkarty-db/passUpdateTrigger.js - dynamické načítání podle cafeId'
    }
  ];
  
  dynamicLoadingChecks.forEach(check => {
    if (fs.existsSync(check.file)) {
      const content = fs.readFileSync(check.file, 'utf8');
      const allPatternsFound = check.patterns.every(pattern => content.includes(pattern));
      const status = allPatternsFound ? '✅' : '❌';
      console.log(`${status} ${check.description}`);
      
      if (allPatternsFound) {
        report.codeChanges.push({ description: check.description, status: 'OK' });
        report.summary.completed++;
      } else {
        const missingPatterns = check.patterns.filter(pattern => !content.includes(pattern));
        report.issues.push(`Missing patterns in ${check.description}: ${missingPatterns.join(', ')}`);
      }
    } else {
      console.log(`❌ ${check.description} - FILE NOT FOUND`);
      report.issues.push(`File not found: ${check.file}`);
    }
    report.summary.total++;
  });
  
  // 4. Kontrola odstranění statických cest
  console.log('\n4️⃣ KONTROLA ODSTRANĚNÍ STATICKÝCH CEST:');
  console.log('─'.repeat(40));
  
  const staticPathChecks = [
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/index.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/appleWalletWebhook.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/newPassUpdateTrigger.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/passUpdateTrigger.js'
  ];
  
  const staticPatterns = [
    './certificates/passCert.pem',
    './certificates/privatekey.key',
    './certificates/AppleWWDRCAG4.pem',
    'fs.readFileSync("./certificates/',
    'fs.readFileSync(certPaths.'
  ];
  
  staticPathChecks.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasStaticPaths = staticPatterns.some(pattern => content.includes(pattern));
      const status = !hasStaticPaths ? '✅' : '❌';
      const fileName = path.basename(filePath);
      console.log(`${status} ${fileName} - ${hasStaticPaths ? 'obsahuje statické cesty' : 'bez statických cest'}`);
      
      if (!hasStaticPaths) {
        report.codeChanges.push({ description: `${fileName} - removed static paths`, status: 'OK' });
        report.summary.completed++;
      } else {
        const foundPatterns = staticPatterns.filter(pattern => content.includes(pattern));
        report.issues.push(`Static paths found in ${fileName}: ${foundPatterns.join(', ')}`);
      }
    }
    report.summary.total++;
  });
  
  // 5. Kontrola helper funkcí
  console.log('\n5️⃣ KONTROLA HELPER FUNKCÍ:');
  console.log('─'.repeat(40));
  
  const helperFunctionChecks = [
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty/functions/certificateHelperV2.js',
    '/Users/adamkolar/Desktop/vernostni.cz/vernostni/vernostkarty-db/functions/certificateHelperV2.js'
  ];
  
  const requiredFunctions = [
    'async function getCertificatePathsByCafeId',
    'async function getAppleCertificatesByCafeId'
  ];
  
  helperFunctionChecks.forEach(helperPath => {
    if (fs.existsSync(helperPath)) {
      const content = fs.readFileSync(helperPath, 'utf8');
      const allFunctionsPresent = requiredFunctions.every(func => content.includes(func));
      const status = allFunctionsPresent ? '✅' : '❌';
      const fileName = path.basename(helperPath);
      console.log(`${status} ${fileName} - ${allFunctionsPresent ? 'všechny funkce přítomny' : 'chybí funkce'}`);
      
      if (allFunctionsPresent) {
        report.codeChanges.push({ description: `${fileName} - all required functions`, status: 'OK' });
        report.summary.completed++;
      } else {
        const missingFunctions = requiredFunctions.filter(func => !content.includes(func));
        report.issues.push(`Missing functions in ${fileName}: ${missingFunctions.join(', ')}`);
      }
    }
    report.summary.total++;
  });
  
  // SOUHRN
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINÁLNÍ SOUHRN REFAKTOROVÁNÍ:');
  console.log(`✅ Dokončeno: ${report.summary.completed}/${report.summary.total}`);
  console.log(`📈 Úspěšnost: ${Math.round((report.summary.completed / report.summary.total) * 100)}%`);
  
  if (report.issues.length > 0) {
    console.log('\n🚨 NALEZENÉ PROBLÉMY:');
    report.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  if (report.summary.completed === report.summary.total) {
    console.log('\n🎉 REFAKTOROVÁNÍ JE 100% DOKONČENO!');
    console.log('✅ Všechny soubory byly úspěšně refaktorovány');
    console.log('✅ Dynamické načítání certifikátů podle cafeId je implementováno');
    console.log('✅ Statické cesty k certifikátům byly odstraněny');
    console.log('✅ Helper funkce jsou přítomny v obou projektech');
    console.log('✅ Systém je připraven pro multi-tenant použití');
  } else {
    console.log('\n⚠️  REFAKTOROVÁNÍ NENÍ ÚPLNĚ DOKONČENO');
    console.log('Prosím, opravte nalezené problémy.');
  }
  
  return report;
}

// Spuštění finálního ověření
const report = finalVerificationReport();
process.exit(report.summary.completed === report.summary.total ? 0 : 1);
