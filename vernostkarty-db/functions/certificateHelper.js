const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Google Cloud Storage s credentials
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json'
});
const bucketName = 'vernostni-certificates';

/**
 * Helper pro načítání Apple Wallet certifikátů z Cloud Storage
 * @returns {Object} Objekt s obsahem certifikátů (Buffer objekty)
 */
async function getAppleCertificateContents() {
  try {
    console.log('🔐 Načítám Apple Wallet certifikáty z Cloud Storage...');
    
    const bucket = storage.bucket(bucketName);
    
    // Stáhneme soubory přímo do paměti
    const [certContents] = await bucket.file('apple-wallet/passCert.pem').download();
    const [keyContents] = await bucket.file('apple-wallet/privatekey.key').download();
    
    return {
      cert: certContents,
      key: keyContents
    };
    
  } catch (error) {
    console.error('❌ Chyba při načítání certifikátů z Cloud Storage:', error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální certifikáty jako fallback...');
    return {
      cert: fs.readFileSync(path.join(__dirname, 'certificates', 'passCert.pem')),
      key: fs.readFileSync(path.join(__dirname, 'certificates', 'privatekey.key'))
    };
  }
}

/**
 * Helper pro načítání Firebase credentials z Cloud Storage
 * @returns {Object} Načtené credentials
 */
async function getFirebaseCredentials() {
  try {
    console.log('🔐 Načítám Firebase credentials z Cloud Storage...');
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file('firebase-credentials/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');
    const [contents] = await file.download();
    
    return JSON.parse(contents.toString());
    
  } catch (error) {
    console.error('❌ Chyba při načítání credentials z Cloud Storage:', error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální credentials jako fallback...');
    return require('./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');
  }
}

module.exports = {
  getAppleCertificateContents,
  getFirebaseCredentials
};
