const { Storage } = require('@google-cloud/storage');

// Inicializace Storage s credentials z vernostkarty projektu
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function inspectCloudStorage() {
  try {
    console.log('🔍 Detailní inspekce Cloud Storage struktury...\n');
    
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles();
    
    // Organizace souborů podle složek
    const structure = {};
    
    files.forEach(file => {
      const parts = file.name.split('/');
      const folder = parts[0];
      const fileName = parts.slice(1).join('/');
      
      if (!structure[folder]) {
        structure[folder] = [];
      }
      structure[folder].push({
        name: fileName,
        size: file.metadata.size,
        updated: file.metadata.updated
      });
    });
    
    console.log('📋 KOMPLETNÍ STRUKTURA V CLOUD STORAGE:');
    console.log('=' .repeat(60));
    
    Object.keys(structure).sort().forEach(folder => {
      console.log(`\n📁 ${folder}/`);
      console.log('-'.repeat(40));
      
      structure[folder].sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
        const sizeKB = Math.round(parseInt(file.size) / 1024);
        console.log(`   📄 ${file.name} (${sizeKB} KB)`);
      });
    });
    
    // Hledání .p12 souborů
    console.log('\n🔍 HLEDÁNÍ .p12 SOUBORŮ:');
    console.log('=' .repeat(60));
    
    const p12Files = [];
    files.forEach(file => {
      if (file.name.endsWith('.p12')) {
        p12Files.push(file.name);
      }
    });
    
    if (p12Files.length > 0) {
      console.log('✅ Nalezené .p12 soubory:');
      p12Files.forEach(file => {
        console.log(`   🔐 ${file}`);
      });
    } else {
      console.log('⚠️  Žádné .p12 soubory nenalezeny!');
    }
    
    // Hledání AppleWWDRCAG4.pem
    console.log('\n🔍 HLEDÁNÍ AppleWWDRCAG4.pem:');
    console.log('=' .repeat(60));
    
    const wwdrFiles = [];
    files.forEach(file => {
      if (file.name.includes('AppleWWDRCAG4.pem')) {
        wwdrFiles.push(file.name);
      }
    });
    
    if (wwdrFiles.length > 0) {
      console.log('✅ Nalezené AppleWWDRCAG4.pem soubory:');
      wwdrFiles.forEach(file => {
        console.log(`   🍎 ${file}`);
      });
    } else {
      console.log('⚠️  AppleWWDRCAG4.pem soubory nenalezeny!');
    }
    
    // Analýza prefixů
    console.log('\n🔍 ANALÝZA PREFIXŮ:');
    console.log('=' .repeat(60));
    
    const prefixes = new Set();
    files.forEach(file => {
      const fileName = file.name.split('/').pop();
      const match = fileName.match(/^(\d{6,7})_/);
      if (match) {
        prefixes.add(match[1]);
      }
    });
    
    if (prefixes.size > 0) {
      console.log('✅ Nalezené prefixy:');
      Array.from(prefixes).sort().forEach(prefix => {
        console.log(`   🔢 ${prefix}`);
      });
    } else {
      console.log('⚠️  Žádné prefixy nenalezeny!');
    }
    
  } catch (error) {
    console.error('❌ Chyba při inspekci:', error);
    process.exit(1);
  }
}

// Spuštění inspekce
inspectCloudStorage();
