const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Storage s credentials z vernostkarty projektu
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function setupCertificates() {
  try {
    console.log('🚀 Začínám setup certifikátů...');
    
    // 1. Vytvoření bucketu
    console.log('📦 Vytvářím Cloud Storage bucket...');
    try {
      const [bucket] = await storage.createBucket(bucketName, {
        location: 'europe-central2', // Stejná lokace jako Firebase projekt
        storageClass: 'STANDARD',
      });
      console.log(`✅ Bucket ${bucketName} byl vytvořen.`);
    } catch (error) {
      if (error.code === 409) {
        console.log(`ℹ️  Bucket ${bucketName} již existuje.`);
      } else {
        throw error;
      }
    }
    
    const bucket = storage.bucket(bucketName);
    
    // 2. Nahrání Apple Wallet certifikátů
    console.log('📤 Nahrávám Apple Wallet certifikáty...');
    
    const appleCerts = [
      {
        local: './vernostkarty/functions/certificates/passCert.pem',
        remote: 'apple-wallet/passCert.pem'
      },
      {
        local: './vernostkarty/functions/certificates/privatekey.key',
        remote: 'apple-wallet/privatekey.key'
      },
      {
        local: './vernostkarty/functions/certificates/AppleWWDRCAG4.pem',
        remote: 'apple-wallet/AppleWWDRCAG4.pem'
      }
    ];
    
    for (const cert of appleCerts) {
      if (fs.existsSync(cert.local)) {
        console.log(`📤 Nahrávám ${cert.local} -> ${cert.remote}`);
        await bucket.upload(cert.local, {
          destination: cert.remote,
          metadata: {
            cacheControl: 'no-cache',
          },
        });
        console.log(`✅ ${cert.remote} nahráno.`);
      } else {
        console.log(`⚠️  Soubor ${cert.local} nebyl nalezen.`);
      }
    }
    
    // 3. Nahrání Firebase credentials
    console.log('📤 Nahrávám Firebase credentials...');
    
    const firebaseCreds = [
      {
        local: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json',
        remote: 'firebase-credentials/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
      },
      {
        local: './vernostkarty/functions/certificates/vernostkarty-db-service-account.json',
        remote: 'firebase-credentials/vernostkarty-db-service-account.json'
      },
      {
        local: './vernostkarty-db/functions/certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json',
        remote: 'firebase-credentials/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json'
      }
    ];
    
    for (const cred of firebaseCreds) {
      if (fs.existsSync(cred.local)) {
        console.log(`📤 Nahrávám ${cred.local} -> ${cred.remote}`);
        await bucket.upload(cred.local, {
          destination: cred.remote,
          metadata: {
            cacheControl: 'no-cache',
          },
        });
        console.log(`✅ ${cred.remote} nahráno.`);
      } else {
        console.log(`⚠️  Soubor ${cred.local} nebyl nalezen.`);
      }
    }
    
    // 4. Nastavení přístupových práv (pouze pro Firebase funkce)
    console.log('🔒 Nastavuji přístupová práva...');
    await bucket.makePrivate();
    console.log('✅ Bucket je nastaven jako privátní.');
    
    console.log('🎉 Setup certifikátů dokončen!');
    console.log('📋 Struktura v Cloud Storage:');
    
    const [files] = await bucket.getFiles();
    files.forEach(file => {
      console.log(`   📄 ${file.name}`);
    });
    
  } catch (error) {
    console.error('❌ Chyba při setup certifikátů:', error);
    process.exit(1);
  }
}

// Spuštění
setupCertificates();
