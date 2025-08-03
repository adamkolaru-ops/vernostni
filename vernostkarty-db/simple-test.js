// Jednoduchý test pro simulaci změny v Firestore
const https = require('https');

function simulateFirestoreChange() {
  console.log('🧪 Simuluji změnu v Firestore, která spustí trigger...');
  
  // Simulace HTTP POST na updateUserDataFromEditor endpoint
  const postData = JSON.stringify({
    wixid: 'test123456789012',
    email: 'test@example.com',
    name: 'Test User FINAL TEST',
    phone: '111222333',
    points: '30'
  });
  
  const options = {
    hostname: 'us-central1-vernostkarty-db.cloudfunctions.net',
    port: 443,
    path: '/updateUserDataFromEditor',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('📋 Response status:', res.statusCode);
      console.log('📋 Response data:', data);
      console.log('✅ Test dokončen - zkontroluj logy triggeru za 10-20 sekund');
    });
  });
  
  req.on('error', (e) => {
    console.error('❌ Chyba při testu:', e.message);
  });
  
  req.write(postData);
  req.end();
}

simulateFirestoreChange();
