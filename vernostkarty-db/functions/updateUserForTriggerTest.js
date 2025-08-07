const admin = require('firebase-admin');
const fs = require('fs');

// Hledání správného souboru s přihlašovacími údaji
let serviceAccount;
try {
  // Zkusíme najít soubor v různých umístěních
  if (fs.existsSync('./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json')) {
    serviceAccount = require('./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json');
    console.log('✅ Nalezen soubor s přihlašovacími údaji: ./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json');
  } else {
    console.error('❌ Nelze najít soubor s Firebase přihlašovacími údaji!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Chyba při načítání Firebase přihlašovacích údajů:', error);
  process.exit(1);
}

// Inicializace Firebase
try {
  admin.app();
} catch (e) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Testovací parametry
const cafeId = '81e91ab5-2396-4490-b48f-9db043f90397';
const emailId = 'asdasdasdsdaads@adsadas.ccas';

async function updateUser() {
  try {
    console.log(`🔍 Hledám uživatele s cafeId: ${cafeId} a emailId: ${emailId}`);
    
    // Načtení aktuálních dat uživatele
    const userRef = db.collection('users').doc(cafeId).collection('emails').doc(emailId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ Uživatel s cafeId: ${cafeId} a emailId: ${emailId} nebyl nalezen!`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`✅ Uživatel nalezen:`);
    console.log(JSON.stringify(userData, null, 2));
    
    // Kontrola, zda má uživatel deviceLibraryIdentifier a pushToken
    if (!userData.deviceLibraryIdentifier || !userData.pushToken) {
      console.warn(`⚠️ Uživatel nemá deviceLibraryIdentifier nebo pushToken! Notifikace nebude fungovat.`);
      console.log(`deviceLibraryIdentifier: ${userData.deviceLibraryIdentifier || 'chybí'}`);
      console.log(`pushToken: ${userData.pushToken || 'chybí'}`);
    } else {
      console.log(`✅ Uživatel má deviceLibraryIdentifier: ${userData.deviceLibraryIdentifier}`);
      console.log(`✅ Uživatel má pushToken: ${userData.pushToken}`);
    }
    
    // Aktualizace uživatele - změna hodnoty stampCount a stampValInput
    const currentStampCount = userData.stampCount || '0';
    const newStampCount = String(parseInt(currentStampCount) + 1);
    const currentStampValInput = userData.stampValInput || '0';
    const newStampValInput = String(parseInt(currentStampValInput) + 1);
    
    console.log(`🔄 Aktualizuji stampCount z ${currentStampCount} na ${newStampCount}`);
    console.log(`🔄 Aktualizuji stampValInput z ${currentStampValInput} na ${newStampValInput}`);
    
    // Aktualizace dokumentu s časovým razítkem pro lepší sledování v logu
    const timestamp = new Date().toISOString();
    await userRef.update({
      stampCount: newStampCount,
      stampValInput: newStampValInput,
      lastUpdated: timestamp
    });
    
    console.log(`✅ Uživatel byl úspěšně aktualizován v ${timestamp}!`);
    console.log(`🔔 Trigger notifyDeviceOnPassUpdate by měl být nyní spuštěn.`);
    console.log(`📋 Pro kontrolu logů triggeru spusťte: firebase functions:log --only notifyDeviceOnPassUpdate`);
    console.log(`⏱️ Počkejte prosím několik minut, než se logy zobrazí.`);
    
  } catch (error) {
    console.error(`❌ Chyba při aktualizaci uživatele:`, error);
  } finally {
    process.exit(0);
  }
}

// Spuštění aktualizace
updateUser();
