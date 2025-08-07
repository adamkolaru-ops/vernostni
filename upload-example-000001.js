// Ukázkový skript pro nahrání certifikátů s prefixem 000001

const { uploadCertificatesWithPrefix } = require('./vernostkarty/functions/certificateHelperV2');

async function uploadExample() {
  try {
    console.log('📤 Ukázka nahrání certifikátů s prefixem 000001...');
    
    // PŘÍKLAD: Cesty k vašim novým certifikátům s prefixem 000001
    // Tyto soubory by měly existovat na vašem disku
    const certificateFiles = {
      passCert: './certificates-rotate/000001_passCert.pem',      // Cesta k 000001_passCert.pem
      privateKey: './certificates-rotate/000001_privatekey.key',  // Cesta k 000001_privatekey.key
      wwdrCert: './certificates-rotate/000001_AppleWWDRCAG4.pem', // Cesta k 000001_AppleWWDRCAG4.pem
      credentials: './certificates-rotate/000001_credentials.json' // Cesta k 000001_credentials.json
    };
    
    // Nahrání certifikátů s prefixem 000001
    await uploadCertificatesWithPrefix('000001', certificateFiles);
    
    console.log('🎉 Certifikáty s prefixem 000001 úspěšně nahrány!');
    
    // Test načítání nově nahraných certifikátů
    console.log('\n🧪 Testování načítání nových certifikátů...');
    const { getAppleCertificatesByPrefix } = require('./vernostkarty/functions/certificateHelperV2');
    
    const newCerts = await getAppleCertificatesByPrefix('000001');
    console.log('✅ Nové certifikáty načteny:', newCerts);
    
  } catch (error) {
    console.error('❌ Chyba při nahrávání:', error);
    
    if (error.code === 'ENOENT') {
      console.log('\n💡 Tip: Vytvořte nejprve soubory s prefixem 000001:');
      console.log('   - 000001_passCert.pem');
      console.log('   - 000001_privatekey.key');
      console.log('   - 000001_AppleWWDRCAG4.pem');
      console.log('   - 000001_credentials.json');
      console.log('   a umístěte je do složky certificates-rotate/');
    }
  }
}

// Spuštění ukázky (zakomentováno, abyste to spustili pouze když budete chtít)
// uploadExample().catch(console.error);

console.log('📋 Tento skript je připraven k použití.');
console.log('💡 Odkomentujte poslední řádek a spusťte: node upload-example-000001.js');
console.log('📁 Nejprve vytvořte certifikáty s prefixem 000001 ve složce certificates-rotate/');

module.exports = { uploadExample };
