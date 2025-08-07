const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Storage s credentials z vernostkarty projektu
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function fixUpload() {
  try {
    console.log('🔧 Opravuji nahrání - smažu špatné soubory a nahrajeme pouze správné...');
    
    const bucket = storage.bucket(bucketName);
    
    // 1. Nejprve smažeme všechny soubory ve složce 000001
    console.log('🗑️  Mažu všechny soubory ve složce 000001...');
    
    const [files] = await bucket.getFiles({ prefix: '000001/' });
    
    for (const file of files) {
      console.log(`🗑️  Mažu: ${file.name}`);
      await file.delete();
    }
    
    console.log('✅ Složka 000001 vyčištěna.');
    
    // 2. Nyní nahrajeme POUZE soubory, které skutečně začínají "0000001_"
    console.log('\n📤 Nahrávám POUZE soubory začínající "0000001_"...');
    
    const rotateDir = './certificates-rotate';
    const files_in_rotate = fs.readdirSync(rotateDir);
    
    // Filtrujeme pouze soubory začínající "0000001_"
    const correctFiles = files_in_rotate.filter(file => file.startsWith('0000001_'));
    
    console.log('📋 Soubory k nahrání:');
    correctFiles.forEach(file => console.log(`   📄 ${file}`));
    
    if (correctFiles.length === 0) {
      console.log('⚠️  Žádné soubory začínající "0000001_" nenalezeny!');
      return;
    }
    
    // Nahrajeme každý správný soubor
    for (const fileName of correctFiles) {
      const localPath = path.join(rotateDir, fileName);
      const cloudPath = `000001/${fileName}`;
      
      console.log(`📤 Nahrávám ${localPath} -> ${cloudPath}`);
      
      try {
        await bucket.upload(localPath, {
          destination: cloudPath,
          metadata: {
            cacheControl: 'no-cache',
          },
        });
        console.log(`✅ ${cloudPath} nahráno.`);
      } catch (error) {
        console.error(`❌ Chyba při nahrávání ${fileName}:`, error.message);
      }
    }
    
    console.log('\n🎉 Oprava dokončena!');
    console.log('📋 Finální struktura ve složce 000001:');
    
    // Výpis obsahu složky 000001
    const [finalFiles] = await bucket.getFiles({ prefix: '000001/' });
    finalFiles.forEach(file => {
      console.log(`   📄 ${file.name}`);
    });
    
  } catch (error) {
    console.error('❌ Chyba při opravě:', error);
    process.exit(1);
  }
}

// Spuštění opravy
fixUpload();
