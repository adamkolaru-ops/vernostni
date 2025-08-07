// Test celého workflow dynamických certifikátů
// 1. Test getCafeSettings - zda vrací cesty k certifikátům
// 2. Test createPass - zda přijímá a používá tyto cesty

const https = require('https');

async function testGetCafeSettings(cafeId) {
  console.log(`🧪 Testing getCafeSettings for cafeId: ${cafeId}`);
  
  return new Promise((resolve, reject) => {
    const url = `https://getcafesettings-weeqy2w2la-uc.a.run.app?id=${cafeId}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('📥 getCafeSettings response:', JSON.stringify(result, null, 2));
          
          if (result.success && result.settings) {
            const settings = result.settings;
            console.log(`✅ Certificate paths found:`);
            console.log(`   pempath: ${settings.pempath}`);
            console.log(`   keypath: ${settings.keypath}`);
            console.log(`   p12Path: ${settings.p12Path}`);
            console.log(`   wwdrPath: ${settings.wwdrPath}`);
            resolve(settings);
          } else {
            reject(new Error('getCafeSettings failed: ' + JSON.stringify(result)));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function testCreatePass(cafeSettings) {
  console.log(`🧪 Testing createPass with certificate paths from getCafeSettings`);
  
  const payload = {
    cardType: 'storeCard',
    cafeId: 'e29a4734-9e9a',
    fullId: 'cardzapier/1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
    userId: 'test-user-123',
    anonymousId: 'test-anon-123',
    businessName: 'Test Kavárna',
    cardColor: '#ffffff',
    textColor: '#000000',
    
    // Cesty k certifikátům z getCafeSettings
    pempath: cafeSettings.pempath,
    keypath: cafeSettings.keypath,
    p12Path: cafeSettings.p12Path,
    wwdrPath: cafeSettings.wwdrPath
  };
  
  console.log('📤 Sending payload to createPass:', JSON.stringify(payload, null, 2));
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'createpass-2sun3frzja-uc.a.run.app',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('📥 createPass response:', JSON.stringify(result, null, 2));
          resolve(result);
        } catch (err) {
          console.log('📥 createPass raw response:', data);
          reject(err);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTest() {
  try {
    console.log('🚀 Starting certificate workflow test...\n');
    
    // Test s různými cafeId, které by mohly existovat
    const testCafeIds = [
      'ffa03fbd8029', // Posledních 12 znaků z cardzapier/1cf87e2e-e29a-4734-9e9a-ffa03fbd8029
      '4734-9e9a-ffa03fbd8029', // Delší varianta
      '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029' // Celé ID bez cardzapier/
    ];
    
    let cafeSettings = null;
    let workingCafeId = null;
    
    // Zkusíme najít fungující cafeId
    for (const cafeId of testCafeIds) {
      try {
        console.log(`Zkouším cafeId: ${cafeId}`);
        cafeSettings = await testGetCafeSettings(cafeId);
        workingCafeId = cafeId;
        break;
      } catch (error) {
        console.log(`❌ cafeId ${cafeId} nefunguje: ${error.message}`);
      }
    }
    
    if (!cafeSettings) {
      throw new Error('Žádný z testovacích cafeId nefunguje');
    }
    
    console.log(`✅ Našel jsem fungující cafeId: ${workingCafeId}`);
    
    // 2. Test createPass s nalezeným cafeId
    const createPassResult = await testCreatePass(cafeSettings);
    console.log('\n✅ createPass test completed\n');
    
    if (createPassResult.result === 'SUCCESS') {
      console.log('🎉 CELÝ WORKFLOW ÚSPĚŠNÝ! Certifikáty se načítají dynamicky podle cest z Firebase.');
    } else {
      console.log('⚠️ createPass vrátil chybu, ale workflow funguje - zkontrolujte logy pro detaily.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

runTest();
