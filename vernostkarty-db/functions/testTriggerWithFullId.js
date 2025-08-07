const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Použití nalezeného Firebase přihlašovacího souboru
const serviceAccount = require('./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json');

// Inicializace Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Testovací skript pro spuštění triggeru notifyDeviceOnPassUpdate
 * Aktualizuje uživatele v Firestore, což by mělo spustit trigger
 */
async function testTrigger() {
  try {
    // Parametry testu
    const cafeId = '81e91ab5-2396-4490-b48f-9db043f90397'; // ID kavárny
    const emailId = 'asdasdasdsdaads@adsadas.ccas'; // Email uživatele
    
    console.log(`🔍 Hledám uživatele s emailem ${emailId} v kolekci users/${cafeId}/emails`);
    
    // Získání dokumentu uživatele
    const userRef = db.collection('users').doc(cafeId).collection('emails').doc(emailId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ Uživatel s emailem ${emailId} nebyl nalezen!`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`✅ Uživatel nalezen: ${JSON.stringify({
      email: userData.email,
      fullId: userData.fullId,
      cafeId: userData.cafeId,
      anonymousID: userData.anonymousID
    }, null, 2)}`);
    
    // Aktualizace uživatele - změna hodnoty stampValInput
    const newStampValue = Math.floor(Math.random() * 1000).toString();
    console.log(`🔄 Aktualizuji stampValInput na: ${newStampValue}`);
    
    await userRef.update({
      stampValInput: newStampValue,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ Uživatel byl úspěšně aktualizován, trigger by měl být spuštěn`);
    console.log(`📋 Pro kontrolu logů triggeru použijte příkaz:`);
    console.log(`firebase functions:log --only notifyDeviceOnPassUpdate`);
    
  } catch (error) {
    console.error(`❌ Chyba při testování triggeru:`, error);
  }
}

// Spuštění testu
testTrigger()
  .then(() => {
    console.log('✅ Test dokončen');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test selhal:', error);
    process.exit(1);
  });
