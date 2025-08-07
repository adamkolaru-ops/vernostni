const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Inicializace Storage s credentials z vernostkarty projektu
const storage = new Storage({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const bucketName = 'vernostni-certificates';

async function reorganizeCertificates() {
  try {
    console.log('🔄 Začínám reorganizaci struktury certifikátů...');
    
    const bucket = storage.bucket(bucketName);
    
    // 1. Nejprve přesuneme současné soubory do složky "original"
    console.log('📦 Přesouvám současné certifikáty do složky "original"...');
    
    const [files] = await bucket.getFiles();
    
    for (const file of files) {
      const oldName = file.name;
      const newName = `original/${oldName}`;
      
      console.log(`📁 Přesouvám: ${oldName} -> ${newName}`);
      
      try {
        await file.move(newName);
        console.log(`✅ Přesunuto: ${newName}`);
      } catch (error) {
        console.error(`❌ Chyba při přesunu ${oldName}:`, error.message);
      }
    }
    
    console.log('🎉 Reorganizace dokončena!');
    console.log('📋 Nová struktura:');
    
    // Výpis nové struktury
    const [newFiles] = await bucket.getFiles();
    const structure = {};
    
    newFiles.forEach(file => {
      const parts = file.name.split('/');
      const folder = parts[0];
      const fileName = parts.slice(1).join('/');
      
      if (!structure[folder]) {
        structure[folder] = [];
      }
      structure[folder].push(fileName);
    });
    
    Object.keys(structure).forEach(folder => {
      console.log(`📁 ${folder}/`);
      structure[folder].forEach(file => {
        console.log(`   📄 ${file}`);
      });
    });
    
    console.log('\n📋 Jak přidat nové certifikáty s prefixem:');
    console.log('1. Pojmenujte soubory s prefixem (např. 000001_passCert.pem)');
    console.log('2. Nahrajte je do složky podle prefixu (např. 000001/)');
    console.log('3. Helper funkce automaticky rozpozná prefix a načte správné certifikáty');
    
  } catch (error) {
    console.error('❌ Chyba při reorganizaci:', error);
    process.exit(1);
  }
}

// Spuštění reorganizace
reorganizeCertificates();
