const { Storage } = require('@google-cloud/storage');
const { Datastore } = require('@google-cloud/datastore');
const fs = require('fs');
const path = require('path');
const certificateConfig = require('./certificateConfig');

// Inicializace Google Cloud Storage s credentials
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});
const bucketName = 'vernostni-certificates';

// Inicializace Datastore
const datastore = new Datastore({
  projectId: 'vernostkarty',
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
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
    throw error;
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
 * Načte cesty k certifikátům přímo z Cloud Storage (vernostni-certificates/original/apple-wallet/)
 * @param {string} cafeId - ID kavárny (pro kompatibilitu, ale vždy používá original)
 * @returns {Object} Objekt s p12Path, wwdrPath, pemCertPath, pemKeyPath
 */
function getCertificatePathsByCafeId(cafeId) {
  console.log(`🔍 Načítám cesty k certifikátům pro cafeId: ${cafeId} přímo z Cloud Storage`);
  
  // Přímé cesty k certifikátům v Cloud Storage
  const p12Path = 'original/apple-wallet/certificates.p12';
  const wwdrPath = 'original/apple-wallet/AppleWWDRCAG4.pem';
  const pemCertPath = 'original/apple-wallet/passCert.pem';
  const pemKeyPath = 'original/apple-wallet/privatekey.key';
  
  console.log(`✅ Používám přímé cesty: p12Path=${p12Path}, wwdrPath=${wwdrPath}, pemCertPath=${pemCertPath}, pemKeyPath=${pemKeyPath}`);
  
  return { p12Path, wwdrPath, pemCertPath, pemKeyPath };
}

/**
 * Načte Apple Wallet certifikáty podle cafeId
 * @param {string} cafeId - ID kavárny
 * @returns {Object} Objekt s obsahem certifikátů (p12Buffer, wwdrBuffer)
 */
async function getAppleCertificatesByCafeId(cafeId) {
  try {
    console.log(`🔐 Načítám Apple Wallet certifikáty pro cafeId: ${cafeId}`);
    
    // 1) NAČTENÍ CEST K CERTIFIKÁTŮM PŘÍMO Z CLOUD STORAGE
    const { p12Path, wwdrPath, pemCertPath, pemKeyPath } = getCertificatePathsByCafeId(cafeId);
    console.log(`✅ Nalezeny cesty - p12Path: ${p12Path}, wwdrPath: ${wwdrPath}, pemCertPath: ${pemCertPath}, pemKeyPath: ${pemKeyPath}`);
    
    // 2) STAŽENÍ CERTIFIKÁTŮ Z CLOUD STORAGE PODLE CEST
    const bucket = storage.bucket(bucketName);
    
    console.log(`📥 Stahuji .p12 certifikát z: ${p12Path}`);
    const p12File = bucket.file(p12Path);
    const [p12Buffer] = await p12File.download();
    
    console.log(`📥 Stahuji WWDR certifikát z: ${wwdrPath}`);
    const wwdrFile = bucket.file(wwdrPath);
    const [wwdrBuffer] = await wwdrFile.download();
    
    // 3) KONVERZE .P12 NA PEM FORMÁT PRO PKPASS
    console.log('🔄 Konvertuji .p12 na PEM formát...');
    
    // Import crypto a p12 knihovny (jsou součástí Node.js)
    const crypto = require('crypto');
    
    try {
      // Pokus o extrakci PEM certifikátů z .p12 souboru
      // P12 nemusí mít heslo, takže zkusíme prázdné heslo
      const p12Der = p12Buffer;
      
      // 3) NAČTENÍ PEM SOUBORŮ Z CLOUD STORAGE PODLE CEST Z DATASTORE
      const prefix = p12Path.split('/')[0]; // např. 'original' nebo '000001'
      
      console.log(`🔍 Načítám PEM soubory z Cloud Storage: ${pemCertPath}, ${pemKeyPath}`);
      
      let signerCert, signerKey;
      
      try {
        // Načtení PEM souborů z Cloud Storage podle přesných cest z Datastore
        const certFile = bucket.file(pemCertPath);
        const keyFile = bucket.file(pemKeyPath);
        
        const [certBuffer] = await certFile.download();
        const [keyBuffer] = await keyFile.download();
        
        signerCert = certBuffer;
        signerKey = keyBuffer;
        
        console.log('✅ PEM soubory úspěšně načteny z Cloud Storage podle cest z Datastore');
      } catch (pemError) {
        console.error('❌ Chyba při načítání PEM souborů z Cloud Storage:', pemError);
        throw new Error(`Nelze načíst PEM soubory z Cloud Storage: ${pemCertPath}, ${pemKeyPath}`);
      }
      
      console.log(`✅ Certifikáty pro cafeId ${cafeId} úspěšně načteny (${prefix})`);
      
      return {
        signerCert,      // PEM certifikát
        signerKey,       // PEM privátní klíč  
        wwdrBuffer,      // Stažený WWDR z Cloud Storage
        p12Path,         // Cesta k .p12 pro debug
        wwdrPath         // Cesta k WWDR pro debug
      };
      
    } catch (conversionError) {
      console.error('❌ Chyba při konverzi .p12:', conversionError);
      throw conversionError;
    }
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů pro cafeId ${cafeId}:`, error);
    throw new Error(`Nelze načíst certifikáty pro cafeId ${cafeId} z Cloud Storage: ${error.message}`);
  }
}

async function getAppleCertificateBuffers(pemPath, keyPath) {
  console.log(`Downloading certificates from GCS -> PEM: ${pemPath}, Key: ${keyPath}`);

  try {
    // Stáhnout signerCert (PEM)
    const [signerCertBuffer] = await storage.bucket(bucketName).file(pemPath).download();
    console.log('✅ Downloaded signerCert from GCS.');

    // Stáhnout signerKey (KEY)
    const [signerKeyBuffer] = await storage.bucket(bucketName).file(keyPath).download();
    console.log('✅ Downloaded signerKey from GCS.');

    // Načíst WWDR lokálně
    const wwdrBuffer = fs.readFileSync(path.join(__dirname, 'certificates', 'AppleWWDRCAG4.pem'));
    console.log('✅ Loaded local WWDR certificate.');

    return {
      pem: signerCertBuffer,
      key: signerKeyBuffer,
      wwdr: wwdrBuffer,
    };
  } catch (error) {
    console.error(`💥 Failed to get certificate buffers from paths: ${pemPath}, ${keyPath}`, error);
    throw new Error('Could not load certificate buffers from provided paths.');
  }
}

module.exports = {
  getAppleCertificatesByPrefix,
  getFirebaseCredentialsByPrefix,
  extractPrefix,
  uploadCertificatesWithPrefix,
  getAppleCertificateBuffers,
  getCertificatePathsByCafeId,
  getAppleCertificatesByCafeId,
  
  // Zpětná kompatibilita - původní funkce používají prefix null (= original)
  getAppleCertificatePaths: () => getAppleCertificatesByPrefix(null),
  getFirebaseCredentials: (type) => getFirebaseCredentialsByPrefix(type, null)
};
