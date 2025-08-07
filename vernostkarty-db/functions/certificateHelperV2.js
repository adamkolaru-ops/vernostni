const { Storage } = require('@google-cloud/storage');
const { Datastore } = require('@google-cloud/datastore');
const fs = require('fs');
const path = require('path');

// Inicializace Google Cloud Storage s credentials pro přístup k vernostkarty bucketu
const storage = new Storage({
  projectId: 'vernostkarty',  // Bucket vern ostni-certificates patří projektu vernostkarty
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'  // Použijeme vernostkarty credentials
});
const bucketName = 'vernostni-certificates';

// Inicializace Datastore pro vernostkarty-db
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-db-service-account.json'
});

/**
 * Helper pro načítání Apple Wallet certifikátů podle prefixu
 * @param {string} prefix - 6-znakový prefix (např. "000001", "123456")
 * @returns {Object} Objekt s cestami k certifikátům
 */
async function getAppleCertificatesByPrefix(prefix = null) {
  try {
    console.log(`🔐 Načítám Apple Wallet certifikáty pro prefix: ${prefix || 'original'}`);
    
    const bucket = storage.bucket(bucketName);
    
    let folderPath, filePrefix;
    
    if (prefix) {
      // Použití prefixu - certifikáty jsou ve složce podle prefixu
      folderPath = `${prefix}/`;
      filePrefix = `${prefix}_`;
    } else {
      // Fallback na původní certifikáty
      folderPath = 'original/apple-wallet/';
      filePrefix = '';
    }
    
    // Názvy souborů podle prefixu
    const certFiles = {
      passCert: `${folderPath}${filePrefix}passCert.pem`,
      privateKey: `${folderPath}${filePrefix}privatekey.key`,
      wwdrCert: `${folderPath}${filePrefix}AppleWWDRCAG4.pem`
    };
    
    // Stáhneme soubory do dočasné paměti
    const tempDir = `/tmp/certificates_${prefix || 'original'}`;
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const localPaths = {};
    
    // Stáhneme každý soubor
    for (const [key, cloudPath] of Object.entries(certFiles)) {
      try {
        const file = bucket.file(cloudPath);
        const localPath = path.join(tempDir, path.basename(cloudPath));
        
        console.log(`📥 Stahuji ${cloudPath} do ${localPath}`);
        await file.download({ destination: localPath });
        
        localPaths[key] = localPath;
      } catch (error) {
        console.error(`❌ Chyba při stahování ${cloudPath}:`, error.message);
        throw error;
      }
    }
    
    // Vrátíme cesty pro zpětnou kompatibilitu
    return {
      wwdr: localPaths.wwdrCert,
      signerCert: localPaths.passCert,
      signerKey: localPaths.privateKey
    };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů pro prefix ${prefix}:`, error);
    
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
 * Helper pro načítání Firebase credentials podle prefixu
 * @param {string} credentialType - Typ credentials ('main', 'db', 'db-admin')
 * @param {string} prefix - 6-znakový prefix (volitelný)
 * @returns {Object} Načtené credentials
 */
async function getFirebaseCredentialsByPrefix(credentialType, prefix = null) {
  try {
    console.log(`🔐 Načítám Firebase credentials (${credentialType}) pro prefix: ${prefix || 'original'}`);
    
    const bucket = storage.bucket(bucketName);
    
    let fileName;
    
    if (prefix) {
      // Použití prefixu - credentials jsou ve složce podle prefixu
      fileName = `${prefix}/${prefix}_credentials.json`;
    } else {
      // Fallback na původní credentials
      switch (credentialType) {
        case 'main':
          fileName = 'original/firebase-credentials/vernostkarty-firebase-adminsdk-2j135-d46f086885.json';
          break;
        case 'db':
          fileName = 'original/firebase-credentials/vernostkarty-db-service-account.json';
          break;
        case 'db-admin':
          fileName = 'original/firebase-credentials/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json';
          break;
        default:
          throw new Error(`Neznámý typ credentials: ${credentialType}`);
      }
    }
    
    const file = bucket.file(fileName);
    const [contents] = await file.download();
    
    return JSON.parse(contents.toString());
    
  } catch (error) {
    console.error(`❌ Chyba při načítání ${credentialType} credentials pro prefix ${prefix}:`, error);
    
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

/**
 * Pomocná funkce pro extrakci prefixu z názvu souboru nebo ID
 * @param {string} input - Název souboru nebo ID (např. "000001_passCert.pem" nebo "000001")
 * @returns {string} 6-znakový prefix
 */
function extractPrefix(input) {
  if (!input) return null;
  
  // Pokud už je to 6-znakový prefix
  if (input.length === 6 && /^\d{6}$/.test(input)) {
    return input;
  }
  
  // Extrakce z názvu souboru (např. "000001_passCert.pem" -> "000001")
  const match = input.match(/^(\d{6})_/);
  return match ? match[1] : null;
}

/**
 * Funkce pro nahrání nových certifikátů s prefixem
 * @param {string} prefix - 6-znakový prefix
 * @param {Object} files - Objekt s cestami k lokálním souborům
 */
async function uploadCertificatesWithPrefix(prefix, files) {
  try {
    console.log(`📤 Nahrávám certifikáty pro prefix: ${prefix}`);
    
    const bucket = storage.bucket(bucketName);
    
    for (const [type, localPath] of Object.entries(files)) {
      if (!fs.existsSync(localPath)) {
        console.log(`⚠️  Soubor ${localPath} neexistuje, přeskakuji...`);
        continue;
      }
      
      const fileName = path.basename(localPath);
      const prefixedFileName = fileName.startsWith(prefix) ? fileName : `${prefix}_${fileName}`;
      const cloudPath = `${prefix}/${prefixedFileName}`;
      
      console.log(`📤 Nahrávám ${localPath} -> ${cloudPath}`);
      
      await bucket.upload(localPath, {
        destination: cloudPath,
        metadata: {
          cacheControl: 'no-cache',
        },
      });
      
      console.log(`✅ ${cloudPath} nahráno.`);
    }
    
    console.log(`🎉 Všechny certifikáty pro prefix ${prefix} nahrány!`);
    
  } catch (error) {
    console.error(`❌ Chyba při nahrávání certifikátů pro prefix ${prefix}:`, error);
    throw error;
  }
}

/**
 * Načte cesty k certifikátům podle cafeId z Datastore
 * @param {string} cafeId - ID kavárny
 * @returns {Object} Objekt s p12Path a wwdrPath
 */
async function getCertificatePathsByCafeId(cafeId) {
  try {
    console.log(`🔍 Načítám cesty k certifikátům pro cafeId: ${cafeId}`);
    
    const key = datastore.key(['cardzapier', cafeId]);
    const [entity] = await datastore.get(key);
    
    if (!entity) {
      throw new Error(`Nenalezeny cesty k certifikátům pro cafeId: ${cafeId}`);
    }
    
    const { p12Path, wwdrPath } = entity;
    
    if (!p12Path || !wwdrPath) {
      throw new Error(`Neúplné cesty k certifikátům pro cafeId: ${cafeId}`);
    }
    
    console.log(`✅ Nalezeny cesty: p12Path=${p12Path}, wwdrPath=${wwdrPath}`);
    
    return { p12Path, wwdrPath };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání cest k certifikátům pro cafeId ${cafeId}:`, error);
    throw error;
  }
}

/**
 * Načte Apple Wallet certifikáty podle cafeId
 * @param {string} cafeId - ID kavárny
 * @returns {Object} Objekt s obsahem certifikátů (p12Buffer, wwdrBuffer)
 */
async function getAppleCertificatesByCafeId(cafeId) {
  try {
    console.log(`🔐 Načítám Apple Wallet certifikáty pro cafeId: ${cafeId}`);
    
    // Načteme cesty z Datastore
    const { p12Path, wwdrPath } = await getCertificatePathsByCafeId(cafeId);
    
    const bucket = storage.bucket(bucketName);
    
    // Stáhneme .p12 certifikát
    console.log(`📥 Stahování .p12 certifikátu z: ${p12Path}`);
    const p12File = bucket.file(p12Path);
    const [p12Buffer] = await p12File.download();
    
    // Stáhneme WWDR certifikát
    console.log(`📥 Stahování WWDR certifikátu z: ${wwdrPath}`);
    const wwdrFile = bucket.file(wwdrPath);
    const [wwdrBuffer] = await wwdrFile.download();
    
    console.log(`✅ Certifikáty pro cafeId ${cafeId} úspěšně načteny`);
    
    return {
      p12Buffer,
      wwdrBuffer,
      p12Path,
      wwdrPath
    };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů pro cafeId ${cafeId}:`, error);
    
    // Fallback na original certifikáty
    console.log('🔄 Používám original certifikáty jako fallback...');
    try {
      const originalCerts = await getAppleCertificatesByPrefix(null);
      
      // Převedeme lokální soubory na buffery
      const p12Buffer = fs.readFileSync(originalCerts.passCert);
      const wwdrBuffer = fs.readFileSync(originalCerts.wwdrCert);
      
      return {
        p12Buffer,
        wwdrBuffer,
        p12Path: 'fallback-local',
        wwdrPath: 'fallback-local'
      };
    } catch (fallbackError) {
      console.error('❌ Fallback také selhal:', fallbackError);
      throw new Error(`Nelze načíst certifikáty pro cafeId ${cafeId} ani fallback`);
    }
  }
}

module.exports = {
  getAppleCertificatesByPrefix,
  getFirebaseCredentialsByPrefix,
  extractPrefix,
  uploadCertificatesWithPrefix,
  getCertificatePathsByCafeId,
  getAppleCertificatesByCafeId,
  
  // Zpětná kompatibilita - původní funkce používají prefix null (= original)
  getAppleCertificatePaths: () => getAppleCertificatesByPrefix(null),
  getFirebaseCredentials: (type) => getFirebaseCredentialsByPrefix(type, null)
};
