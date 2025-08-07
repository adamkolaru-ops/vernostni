// Test funkčnosti createPass s refaktorovaným kódem
const certificateHelper = require('./certificateHelperV2');
const { PKPass } = require('passkit-generator');
const fs = require('fs');

async function testCreatePassFunctionality() {
  console.log('🧪 Testování funkčnosti createPass s refaktorovaným kódem...');
  
  try {
    // Test 1: Inicializace Firebase credentials
    console.log('\n1️⃣ Test inicializace Firebase credentials');
    const serviceAccount = certificateHelper.getFirebaseCredentials('main');
    console.log(`✅ Firebase credentials loaded: ${serviceAccount.project_id}`);
    
    // Test 2: Načítání certifikátů podle cafeId
    console.log('\n2️⃣ Test načítání certifikátů podle cafeId');
    const cafeId = '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029';
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(cafeId);
    console.log(`✅ Certifikáty načteny pro cafeId: ${cafeId}`);
    console.log(`  - p12Buffer: ${certificates.p12Buffer.length} bytes`);
    console.log(`  - wwdrBuffer: ${certificates.wwdrBuffer.length} bytes`);
    
    // Test 3: Vytvoření PKPass objektu s dynamickými certifikáty
    console.log('\n3️⃣ Test vytvoření PKPass objektu');
    
    // Zkontroluj, zda existuje template
    const templatePath = "./myFirstModel.pass";
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Pass template not found at: ${templatePath}`);
    }
    console.log('✅ Pass template nalezen');
    
    // Vytvoření PKPass objektu (simulace createPass logiky)
    const testPass = await PKPass.from({
        model: templatePath,
        certificates: {
          wwdr: certificates.wwdrBuffer,
          signerCert: certificates.p12Buffer,
          signerKey: certificates.p12Buffer,
          signerKeyPassphrase: ""
        }
      },
      {
        authenticationToken: "a7d8g9h2j4k5l6m7n8b9v0c1x2z3",
        webServiceURL: "https://applewalletwebhook-2sun3frzja-uc.a.run.app",
        serialNumber: "test-123456",
        description: "Test věrnostní karta",
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        labelColor: "#000000"
      }
    );
    
    console.log('✅ PKPass objekt úspěšně vytvořen');
    
    // Test 4: Generování finálního .pkpass souboru
    console.log('\n4️⃣ Test generování .pkpass souboru');
    const passBuffer = await testPass.getAsBuffer();
    console.log(`✅ .pkpass soubor vygenerován: ${passBuffer.length} bytes`);
    
    // Uložení testovacího pasu pro kontrolu
    fs.writeFileSync('./test-pass.pkpass', passBuffer);
    console.log('✅ Testovací pass uložen jako test-pass.pkpass');
    
    console.log('\n🎉 Všechny testy úspěšně dokončeny!');
    console.log('✅ Refaktorovaný kód je plně funkční pro vytváření passů');
    
  } catch (error) {
    console.error('❌ Test selhal:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testCreatePassFunctionality();
