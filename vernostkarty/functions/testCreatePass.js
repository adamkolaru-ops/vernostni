// testCreatePass.js
const axios = require('axios');

// URL nasazené funkce createPass
const createPassUrl = 'https://createpass-2sun3frzja-uc.a.run.app';

// Testovací data
const testData = {
  // Identifikátory
  cafeId: '81e91ab5-2396-4490-b48f-9db043f90397',
  fullId: '81e91ab5-2396-4490-b48f-9db043f90397',
  wixid: '81e91ab5-2396-4490-b48f-9db043f90397',
  anonymousId: '18bdcxwmgqxs00000000000000000000000000000000',
  userId: '18bdcxwmgqxs',
  
  // Uživatelská data
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  
  // Data karty
  cardType: 'card-razitka',
  stampValInput: '5',
  stampCount: '10',
  bodyValInput: '100',
  bodyLabel1Input: 'BODY',
  bodyBottomTopInput: 'ZA 100B KÁVA ZDARMA',
  bodyBottomBotInput: '10Kč=1BOD',
  
  // Design
  cardColor: '#ffdd00',
  textColor: '#000000',
  
  // Certifikáty - tyto hodnoty by měly být ignorovány a načteny z Firestore
  pempath: 'original/apple-wallet/passCert.pem',
  keypath: 'original/apple-wallet/privatekey.key',
  passTypeIdentifier: 'pass.pass.com.example.vernostkarty2'
};

console.log('🔄 Sending test request to createPass function...');
console.log('📋 Request data:', JSON.stringify(testData, null, 2));

// Odeslání požadavku
axios.post(createPassUrl, testData)
  .then(response => {
    console.log('✅ Response status:', response.status);
    console.log('📋 Response headers:', response.headers);
    
    // Kontrola, zda je odpověď pass soubor
    if (response.headers['content-type'] === 'application/vnd.apple.pkpass') {
      console.log('✅ Successfully received PKPass file!');
      console.log(`📦 PKPass size: ${response.data.length} bytes`);
      
      // Uložení pass souboru pro testování
      const fs = require('fs');
      fs.writeFileSync('test.pkpass', response.data);
      console.log('💾 PKPass saved as test.pkpass');
    } else {
      console.log('📋 Response data:', response.data);
    }
  })
  .catch(error => {
    console.error('❌ Error calling createPass:', error.message);
    if (error.response) {
      console.error('📋 Error response data:', error.response.data);
      console.error('📋 Error response status:', error.response.status);
    }
  });
