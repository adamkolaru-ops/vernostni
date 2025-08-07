// Přímé nahrání PEM souborů do Cloud Storage pomocí Firebase Admin SDK
const admin = require('firebase-admin');
const fs = require('fs');

// Inicializace Firebase Admin SDK
admin.initializeApp();

const bucket = admin.storage().bucket('vernostni-certificates');

async function uploadPEMFiles() {
  console.log('📤 Nahrávám PEM soubory do Cloud Storage...');
  
  const uploads = [
    // Original složka
    {
      local: './certificates/passCert.pem',
      remote: 'original/apple-wallet/passCert.pem'
    },
    {
      local: './certificates/privatekey.key', 
      remote: 'original/apple-wallet/privatekey.key'
    },
    // 000001 složka s prefixem
    {
      local: './certificates/passCert.pem',
      remote: '000001/000001_passCert.pem'
    },
    {
      local: './certificates/privatekey.key',
      remote: '000001/000001_privatekey.key'
    }
  ];
  
  for (const upload of uploads) {
    try {
      await bucket.upload(upload.local, {
        destination: upload.remote
      });
      console.log(`✅ Nahrán: ${upload.remote}`);
    } catch (error) {
      console.error(`❌ Chyba při nahrávání ${upload.remote}:`, error.message);
    }
  }
  
  console.log('\n✅ Všechny PEM soubory nahrány!');
}

uploadPEMFiles().catch(console.error);
