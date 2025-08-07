const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Storage s credentials z vernostkarty projektu
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function completeReorganization() {
  try {
    console.log('🔄 Dokončujem reorganizaci - nahrávám soubory s prefixem 0000001...');
    
    const bucket = storage.bucket(bucketName);
    const rotateDir = './certificates-rotate';
    
    // Najdeme všechny soubory s prefixem 0000001_ ve složce certificates-rotate
    const files = fs.readdirSync(rotateDir);
    const prefixFiles = files.filter(file => file.startsWith('0000001_'));
    
    console.log('📋 Nalezené soubory s prefixem 0000001_:');
    prefixFiles.forEach(file => console.log(`   📄 ${file}`));
    
    // Nahrajeme každý soubor s prefixem do složky 000001
    for (const fileName of prefixFiles) {
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
    
    // Také nahrajeme základní Apple certifikáty do složky 000001 (bez prefixu v názvu)
    const basicCerts = [
      { local: 'passCert.pem', cloud: '000001_passCert.pem' },
      { local: 'privatekey.key', cloud: '000001_privatekey.key' },
      { local: 'AppleWWDRCAG4.pem', cloud: '000001_AppleWWDRCAG4.pem' }
    ];
    
    console.log('\n📤 Nahrávám základní Apple certifikáty do složky 000001...');
    
    for (const cert of basicCerts) {
      const localPath = path.join(rotateDir, cert.local);
      const cloudPath = `000001/${cert.cloud}`;
      
      if (fs.existsSync(localPath)) {
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
          console.error(`❌ Chyba při nahrávání ${cert.local}:`, error.message);
        }
      } else {
        console.log(`⚠️  Soubor ${localPath} neexistuje, přeskakuji...`);
      }
    }
    
    // Nahrajeme Firebase credentials do složky 000001
    const firebaseFiles = [
      'vernostkarty-firebase-adminsdk-2j135-d46f086885.json',
      'vernostkarty-db-service-account.json',
      'vernostkarty-db-credentials.json'
    ];
    
    console.log('\n📤 Nahrávám Firebase credentials do složky 000001...');
    
    for (const fileName of firebaseFiles) {
      const localPath = path.join(rotateDir, fileName);
      const cloudPath = `000001/000001_${fileName}`;
      
      if (fs.existsSync(localPath)) {
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
      } else {
        console.log(`⚠️  Soubor ${localPath} neexistuje, přeskakuji...`);
      }
    }
    
    console.log('\n🎉 Reorganizace dokončena!');
    console.log('📋 Finální struktura v Cloud Storage:');
    
    // Výpis finální struktury
    const [allFiles] = await bucket.getFiles();
    const structure = {};
    
    allFiles.forEach(file => {
      const parts = file.name.split('/');
      const folder = parts[0];
      const fileName = parts.slice(1).join('/');
      
      if (!structure[folder]) {
        structure[folder] = [];
      }
      structure[folder].push(fileName);
    });
    
    Object.keys(structure).sort().forEach(folder => {
      console.log(`📁 ${folder}/`);
      structure[folder].sort().forEach(file => {
        console.log(`   📄 ${file}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Chyba při dokončování reorganizace:', error);
    process.exit(1);
  }
}

// Spuštění dokončení reorganizace
completeReorganization();
