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
 * Helper pro načítání Apple Wallet certifikátů podle prefixu (obsah do paměti)
 * @param {string} prefix - 6-znakový prefix (např. "000001", "123456")
 * @returns {Object} Objekt s obsahem certifikátů (Buffer objekty)
 */
async function getAppleCertificateContentsByPrefix(prefix = null) {
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
    
    // Stáhneme soubory přímo do paměti
    const [certContents] = await bucket.file(`${folderPath}${filePrefix}passCert.pem`).download();
    const [keyContents] = await bucket.file(`${folderPath}${filePrefix}privatekey.key`).download();
    
    return {
      cert: certContents,
      key: keyContents
    };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů pro prefix ${prefix}:`, error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální certifikáty jako fallback...');
    return {
      cert: fs.readFileSync(path.join(__dirname, 'certificates', 'passCert.pem')),
      key: fs.readFileSync(path.join(__dirname, 'certificates', 'privatekey.key'))
    };
  }
}

/**
 * Helper pro načítání Firebase credentials podle prefixu
 * @param {string} prefix - 6-znakový prefix (volitelný)
 * @returns {Object} Načtené credentials
 */
async function getFirebaseCredentialsByPrefix(prefix = null) {
  try {
    console.log(`🔐 Načítám Firebase credentials pro prefix: ${prefix || 'original'}`);
    
    const bucket = storage.bucket(bucketName);
    
    let fileName;
    
    if (prefix) {
      // Použití prefixu - credentials jsou ve složce podle prefixu
      fileName = `${prefix}/${prefix}_credentials.json`;
    } else {
      // Fallback na původní credentials
      fileName = 'original/firebase-credentials/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json';
    }
    
    const file = bucket.file(fileName);
    const [contents] = await file.download();
    
    return JSON.parse(contents.toString());
    
  } catch (error) {
    console.error(`❌ Chyba při načítání credentials pro prefix ${prefix}:`, error);
    
    // Fallback na lokální soubory
    console.log('🔄 Používám lokální credentials jako fallback...');
    return require('./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');
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

module.exports = {
  getAppleCertificateContentsByPrefix,
  getFirebaseCredentialsByPrefix,
  extractPrefix,
  uploadCertificatesWithPrefix,
  
  // Zpětná kompatibilita - původní funkce používají prefix null (= original)
  getAppleCertificateContents: () => getAppleCertificateContentsByPrefix(null),
  getFirebaseCredentials: () => getFirebaseCredentialsByPrefix(null)
};
