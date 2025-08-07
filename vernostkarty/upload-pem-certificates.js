const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Storage - použití defaultních credentials
const storage = new Storage({
  projectId: 'vernostkarty'
  // Nespecifikujeme keyFilename - použijí se defaultní credentials z prostředí
});

const bucketName = 'vernostni-certificates';

async function uploadPEMCertificates() {
  const bucket = storage.bucket(bucketName);
  
  // 1) Nahrát PEM soubory do složky 'original'
  console.log('📤 Nahrávám PEM certifikáty do složky original/apple-wallet/...');
  
  const pemFiles = [
    {
      localPath: './certificates/passCert.pem',
      cloudPath: 'original/apple-wallet/passCert.pem'
    },
    {
      localPath: './certificates/privatekey.key',
      cloudPath: 'original/apple-wallet/privatekey.key'
    }
  ];
  
  for (const file of pemFiles) {
    try {
      await bucket.upload(file.localPath, {
        destination: file.cloudPath,
        metadata: {
          contentType: 'application/x-pem-file'
        }
      });
      console.log(`✅ Nahrán: ${file.cloudPath}`);
    } catch (error) {
      console.error(`❌ Chyba při nahrávání ${file.cloudPath}:`, error.message);
    }
  }
  
  // 2) Nahrát PEM soubory do složky '000001' (s prefixem)
  console.log('\n📤 Nahrávám PEM certifikáty do složky 000001/...');
  
  const prefixedPemFiles = [
    {
      localPath: './certificates/passCert.pem',
      cloudPath: '000001/000001_passCert.pem'
    },
    {
      localPath: './certificates/privatekey.key',
      cloudPath: '000001/000001_privatekey.key'
    }
  ];
  
  for (const file of prefixedPemFiles) {
    try {
      await bucket.upload(file.localPath, {
        destination: file.cloudPath,
        metadata: {
          contentType: 'application/x-pem-file'
        }
      });
      console.log(`✅ Nahrán: ${file.cloudPath}`);
    } catch (error) {
      console.error(`❌ Chyba při nahrávání ${file.cloudPath}:`, error.message);
    }
  }
  
  console.log('\n🎯 Hotovo! PEM certifikáty byly nahrány do Cloud Storage.');
}

// Spustit nahrávání
uploadPEMCertificates().catch(console.error);
