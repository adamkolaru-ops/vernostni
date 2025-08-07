// Test nového přístupu - cesty k certifikátům z payloadu
const axios = require('axios');

async function testNewCertificateApproach() {
  try {
    console.log('🧪 Testování nového přístupu s pempath/keypath z payloadu...');
    
    const testPayload = {
      cardType: "card-body",
      cafeId: "/cardzapier/1cf87e2e-e29a-4734-9e9a-ffa03fbd8029",
      userId: "test-user-123",
      primaryLabel: "TEST KARTA",
      primaryValue: "Testovací hodnota",
      // NOVÉ: Cesty k certifikátům přímo v payloadu
      pempath: "original/apple-wallet/passCert.pem",
      keypath: "original/apple-wallet/privatekey.key"
    };
    
    console.log('📤 Posílám test payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await axios.post('https://createpass-2sun3frzja-uc.a.run.app', testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      responseType: 'arraybuffer'
    });
    
    if (response.status === 200) {
      console.log('✅ Test úspěšný! Pass byl vygenerován.');
      console.log(`📊 Velikost pass souboru: ${response.data.length} bytes`);
      console.log('🎯 Nový přístup s pempath/keypath funguje!');
    } else {
      console.log('❌ Test neúspěšný, status:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Chyba při testu:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data.toString());
    }
  }
}

testNewCertificateApproach();
