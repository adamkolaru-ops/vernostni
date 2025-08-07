const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

// Inicializace Google Cloud Storage s credentials pro přístup k vernostkarty bucketu
const storage = new Storage({
  projectId: 'vernostkarty',  // Bucket vernostni-certificates patří projektu vernostkarty
  keyFilename: './certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});
const bucketName = 'vernostni-certificates';



/**
 * Načte Apple Wallet certifikáty přímo z Cloud Storage (vernostni-certificates/original/apple-wallet/)
 * @param {string} cafeId - ID kavárny (pro kompatibilitu, ale vždy používá original)
 * @returns {Object} Objekt s obsahem certifikátů (signerCert, signerKey, wwdrBuffer)
 */
async function getAppleCertificatesByCafeId(cafeId) {
  try {
    console.log(`🔐 Načítám Apple Wallet certifikáty pro cafeId: ${cafeId} přímo z Cloud Storage`);
    
    // Přímé cesty k certifikátům v Cloud Storage (bez WWDR - ten je lokální)
    const pemCertPath = 'original/apple-wallet/passCert.pem';
    const pemKeyPath = 'original/apple-wallet/privatekey.key';
    
    console.log(`✅ Používám přímé cesty: ${pemCertPath}, ${pemKeyPath}`);
    console.log(`✅ WWDR certifikát se načítá lokálně`);
    
    const bucket = storage.bucket(bucketName);
    
    console.log(`📥 Stahuji PEM certifikáty z Cloud Storage...`);
    console.log(`  - ${pemCertPath}`);
    console.log(`  - ${pemKeyPath}`);
    console.log(`  - WWDR lokálně: ./certificates/AppleWWDRCAG4.pem`);
    
    // Načtení PEM souborů z Cloud Storage
    const certFile = bucket.file(pemCertPath);
    const keyFile = bucket.file(pemKeyPath);
    
    const [signerCert] = await certFile.download();
    const [signerKey] = await keyFile.download();
    
    // OPRAVA: WWDR certifikát se načítá lokálně, ne z Cloud Storage
    const wwdrBuffer = fs.readFileSync('./certificates/AppleWWDRCAG4.pem');
    
    console.log('✅ PEM certifikáty úspěšně načteny z Cloud Storage');
    console.log(`  - signerCert: ${signerCert.length} bytes`);
    console.log(`  - signerKey: ${signerKey.length} bytes`);
    console.log(`  - wwdrBuffer: ${wwdrBuffer.length} bytes`);
    
    return {
      signerCert,      // PEM certifikát z Cloud Storage
      signerKey,       // PEM privátní klíč z Cloud Storage
      wwdrBuffer,      // WWDR certifikát lokálně
      p12Path: 'original/apple-wallet/certificates.p12',  // Pro debug
      wwdrPath: './certificates/AppleWWDRCAG4.pem'  // Pro debug - lokální cesta
    };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů pro cafeId ${cafeId}:`, error);
    throw new Error(`Nelze načíst certifikáty z Cloud Storage: ${error.message}`);
  }
}

/**
 * Načte Apple Wallet certifikáty z konkrétních cest v Cloud Storage
 * @param {string} pemPath - Cesta k PEM certifikátu v Cloud Storage
 * @param {string} keyPath - Cesta k privátnímu klíči v Cloud Storage
 * @returns {Object} Objekt s obsahem certifikátů (signerCert, signerKey, wwdrBuffer)
 */
async function getAppleCertificateBuffers(pemPath, keyPath) {
  try {
    console.log(`VERIFICATION: Načítám certifikáty z dynamických cest: PEM='${pemPath}', KEY='${keyPath}'`);
    
    const bucket = storage.bucket(bucketName);
    const fs = require('fs');
    
    console.log(`📥 Načítám certifikáty...`);
    console.log(`  - PEM z Cloud Storage: ${pemPath}`);
    console.log(`  - KEY z Cloud Storage: ${keyPath}`);
    console.log(`  - WWDR lokálně: ./certificates/AppleWWDRCAG4.pem`);
    
    // Načtení PEM a KEY z Cloud Storage
    const certFile = bucket.file(pemPath);
    const keyFile = bucket.file(keyPath);
    
    const [signerCert] = await certFile.download();
    const [signerKey] = await keyFile.download();
    
    // Načtení WWDR certifikátu lokálně
    const wwdrBuffer = fs.readFileSync('./certificates/AppleWWDRCAG4.pem');
    
    console.log('✅ Certifikáty úspěšně načteny z dynamických cest');
    console.log(`  - signerCert: ${signerCert.length} bytes`);
    console.log(`  - signerKey: ${signerKey.length} bytes`);
    console.log(`  - wwdrBuffer: ${wwdrBuffer.length} bytes`);
    
    return {
      signerCert,      // PEM certifikát z Cloud Storage
      signerKey,       // PEM privátní klíč z Cloud Storage
      wwdrBuffer       // WWDR certifikát z Cloud Storage
    };
    
  } catch (error) {
    console.error(`❌ Chyba při načítání certifikátů z cest PEM='${pemPath}', KEY='${keyPath}':`, error);
    throw new Error(`Nelze načíst certifikáty z Cloud Storage: ${error.message}`);
  }
}

module.exports = {
  getAppleCertificatesByCafeId,
  getAppleCertificateBuffers
};
