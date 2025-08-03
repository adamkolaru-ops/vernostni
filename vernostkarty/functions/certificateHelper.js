const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

// Inicializace Google Cloud Storage s credentials
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});
const bucketName = 'vernostni-certificates';

/**
 * Helper pro načítání Apple Wallet certifikátů z Cloud Storage
 * @returns {Object} Objekt s cestami k certifikátům (pro zpětnou kompatibilitu)
 */
async function getAppleCertificatePaths() {
  try {
    console.log('🔐 Načítám Apple Wallet certifikáty z Cloud Storage...');
    
    const bucket = storage.bucket(bucketName);
    
    // Názvy souborů v Cloud Storage
    const files = [
      'apple-wallet/passCert.pem',
      'apple-wallet/privatekey.key', 
      'apple-wallet/AppleWWDRCAG4.pem'
    ];
    
    // Stáhneme soubory do dočasné paměti
    const tempDir = '/tmp/certificates';
    const fs = require('fs');
    const path = require('path');
    
    // Vytvoříme dočasný adresář
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Stáhneme každý soubor
    for (const fileName of files) {
      const file = bucket.file(fileName);
      const localPath = path.join(tempDir, path.basename(fileName));
      
      console.log(`📥 Stahuji ${fileName} do ${localPath}`);
      await file.download({ destination: localPath });
    }
    
    // Vrátíme cesty pro zpětnou kompatibilitu
    return {
      wwdr: path.join(tempDir, 'AppleWWDRCAG4.pem'),
      signerCert: path.join(tempDir, 'passCert.pem'),
      signerKey: path.join(tempDir, 'privatekey.key')
    };
    
  } catch (error) {
    console.error('❌ Chyba při načítání certifikátů z Cloud Storage:', error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální certifikáty jako fallback...');
    return {
      wwdr: "./certificates/AppleWWDRCAG4.pem",
      signerCert: "./certificates/passCert.pem", 
      signerKey: "./certificates/privatekey.key"
    };
  }
}

/**
 * Helper pro načítání Firebase credentials z Cloud Storage
 * @param {string} credentialType - Typ credentials ('main' nebo 'db')
 * @returns {Object} Načtené credentials
 */
async function getFirebaseCredentials(credentialType) {
  try {
    console.log(`🔐 Načítám Firebase credentials (${credentialType}) z Cloud Storage...`);
    
    const bucket = storage.bucket(bucketName);
    
    let fileName;
    switch (credentialType) {
      case 'main':
        fileName = 'firebase-credentials/vernostkarty-firebase-adminsdk-2j135-d46f086885.json';
        break;
      case 'db':
        fileName = 'firebase-credentials/vernostkarty-db-service-account.json';
        break;
      case 'db-admin':
        fileName = 'firebase-credentials/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json';
        break;
      default:
        throw new Error(`Neznámý typ credentials: ${credentialType}`);
    }
    
    const file = bucket.file(fileName);
    const [contents] = await file.download();
    
    return JSON.parse(contents.toString());
    
  } catch (error) {
    console.error(`❌ Chyba při načítání ${credentialType} credentials z Cloud Storage:`, error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální credentials jako fallback...');
    switch (credentialType) {
      case 'main':
        return require('./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json');
      case 'db':
        return require('./certificates/vernostkarty-db-service-account.json');
      case 'db-admin':
        return require('./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');
      default:
        throw new Error(`Neznámý typ credentials: ${credentialType}`);
    }
  }
}

module.exports = {
  getAppleCertificatePaths,
  getFirebaseCredentials
};
