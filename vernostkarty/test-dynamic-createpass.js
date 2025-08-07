// Test dynamického načítání certifikátů v createPass
const https = require('https');

const testCreatePass = async () => {
  console.log('🧪 Testuji dynamické načítání certifikátů v createPass...');
  
  // Test data pro vytvoření karty
  const testData = {
    cafeId: "1cf87e2e-e29a-4734-9e9a-ffa03fbd8029", // dlouhé cafeId (original)
    cardColor: "#FF5733",
    textColor: "#FFFFFF",
    businessName: "Test Kavárna",
    customerName: "Test Zákazník",
    discount: 10
  };
  
  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'createpass-2sun3frzja-uc.a.run.app',
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', data);
        resolve(data);
      });
    });
    
    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
};

// Spustit test
testCreatePass()
  .then(() => {
    console.log('\n✅ Test dokončen. Zkontroluj Firebase logy pro detaily o načítání certifikátů.');
  })
  .catch((error) => {
    console.error('❌ Test selhal:', error);
  });
