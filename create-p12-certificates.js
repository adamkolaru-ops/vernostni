const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Inicializace Cloud Storage
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function createP12Certificates() {
  console.log('🔐 VYTVÁŘENÍ .P12 CERTIFIKÁTŮ Z PEM SOUBORŮ');
  console.log('=' .repeat(70));
  
  const bucket = storage.bucket(bucketName);
  const tempDir = '/tmp/p12_creation';
  
  try {
    // Vytvoření dočasné složky
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ========================================
    // 1. VYTVOŘENÍ .P12 PRO ORIGINAL
    // ========================================
    console.log('📋 1. VYTVÁŘENÍ .P12 PRO ORIGINAL');
    console.log('-' .repeat(50));
    
    // Stažení original souborů
    console.log('📥 Stahuji original soubory...');
    const originalCertFile = bucket.file('original/apple-wallet/passCert.pem');
    const originalKeyFile = bucket.file('original/apple-wallet/privatekey.key');
    
    const originalCertPath = path.join(tempDir, 'original_passCert.pem');
    const originalKeyPath = path.join(tempDir, 'original_privatekey.key');
    const originalP12Path = path.join(tempDir, 'original_certificates.p12');
    
    await originalCertFile.download({ destination: originalCertPath });
    await originalKeyFile.download({ destination: originalKeyPath });
    console.log('✅ Original soubory staženy');
    
    // Vytvoření .p12 souboru pro original
    console.log('🔧 Vytvářím .p12 soubor pro original...');
    try {
      const openSSLCommand = `openssl pkcs12 -export -out "${originalP12Path}" -inkey "${originalKeyPath}" -in "${originalCertPath}" -passout pass:`;
      execSync(openSSLCommand, { stdio: 'inherit' });
      console.log('✅ Original .p12 soubor vytvořen');
    } catch (error) {
      console.error('❌ Chyba při vytváření original .p12:', error.message);
      throw error;
    }
    
    // Nahrání original .p12 do Cloud Storage
    console.log('📤 Nahrávám original .p12 do Cloud Storage...');
    await bucket.upload(originalP12Path, {
      destination: 'original/apple-wallet/certificates.p12',
      metadata: {
        contentType: 'application/x-pkcs12'
      }
    });
    console.log('✅ Original .p12 nahrán do Cloud Storage\n');
    
    // ========================================
    // 2. VYTVOŘENÍ .P12 PRO 000001 PREFIX
    // ========================================
    console.log('📋 2. VYTVÁŘENÍ .P12 PRO PREFIX 000001');
    console.log('-' .repeat(50));
    
    // Zkopírování souborů pro 000001 (použijeme stejné certifikáty)
    const prefix001CertPath = path.join(tempDir, '0000001_passCert.pem');
    const prefix001KeyPath = path.join(tempDir, '0000001_privatekey.key');
    const prefix001P12Path = path.join(tempDir, '0000001_Certifikáty.p12');
    
    // Zkopírujeme original soubory
    fs.copyFileSync(originalCertPath, prefix001CertPath);
    fs.copyFileSync(originalKeyPath, prefix001KeyPath);
    console.log('📋 Soubory zkopírovány pro prefix 000001');
    
    // Vytvoření .p12 souboru pro 000001
    console.log('🔧 Vytvářím .p12 soubor pro prefix 000001...');
    try {
      const openSSLCommand = `openssl pkcs12 -export -out "${prefix001P12Path}" -inkey "${prefix001KeyPath}" -in "${prefix001CertPath}" -passout pass:`;
      execSync(openSSLCommand, { stdio: 'inherit' });
      console.log('✅ Prefix 000001 .p12 soubor vytvořen');
    } catch (error) {
      console.error('❌ Chyba při vytváření prefix 000001 .p12:', error.message);
      throw error;
    }
    
    // Nahrání 000001 .p12 do Cloud Storage (přepsat existující)
    console.log('📤 Nahrávám prefix 000001 .p12 do Cloud Storage...');
    await bucket.upload(prefix001P12Path, {
      destination: '000001/0000001_Certifikáty.p12',
      metadata: {
        contentType: 'application/x-pkcs12'
      }
    });
    console.log('✅ Prefix 000001 .p12 nahrán do Cloud Storage\n');
    
    // ========================================
    // 3. OVĚŘENÍ VÝSLEDKŮ
    // ========================================
    console.log('📋 3. OVĚŘENÍ VÝSLEDKŮ');
    console.log('-' .repeat(50));
    
    const [files] = await bucket.getFiles();
    const p12Files = files.filter(file => file.name.endsWith('.p12'));
    
    console.log('🔐 Nalezené .p12 soubory v Cloud Storage:');
    for (const file of p12Files) {
      const sizeKB = Math.round(file.metadata.size / 1024);
      console.log(`   📄 ${file.name} (${sizeKB} KB)`);
      
      // Ověření, že soubor lze stáhnout
      try {
        const tempTestPath = path.join(tempDir, `test_${path.basename(file.name)}`);
        await file.download({ destination: tempTestPath });
        console.log(`   ✅ Soubor je platný a lze jej stáhnout`);
        fs.unlinkSync(tempTestPath); // Smazání testovacího souboru
      } catch (error) {
        console.log(`   ❌ Chyba při ověření souboru: ${error.message}`);
      }
    }
    
    // Vyčištění dočasných souborů
    console.log('\n🧹 Čištění dočasných souborů...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('\n🎉 ÚSPĚCH! .P12 certifikáty byly vytvořeny a nahrány');
    console.log('📋 Další kroky:');
    console.log('   1. Aktualizovat Datastore záznam pro "original" s p12Path');
    console.log('   2. Spustit komplexní test pro ověření funkčnosti');
    
  } catch (error) {
    console.error('❌ Kritická chyba při vytváření .p12 certifikátů:', error);
    
    // Vyčištění při chybě
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

// Spuštění vytvoření .p12 certifikátů
createP12Certificates();
