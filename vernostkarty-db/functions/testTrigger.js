const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Inicializace Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(require("./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json")),
    databaseURL: "https://vernostkarty-db-default-rtdb.europe-west1.firebasedatabase.app"
  });
  console.log('✅ Firebase Admin inicializován');
} catch (err) {
  console.error('❌ Chyba při inicializaci Firebase Admin:', err);
  process.exit(1);
}

const db = admin.firestore();

// Funkce pro získání všech uživatelů
async function listAllUsers() {
  try {
    console.log('🔍 Hledám všechny uživatele v kolekci "users"...');
    const usersSnapshot = await db.collection('users').limit(10).get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Žádní uživatelé nebyli nalezeni v kolekci "users"');
      return null;
    }
    
    console.log(`💾 Nalezeno ${usersSnapshot.size} uživatelů:`);
    
    const users = [];
    for (const userDoc of usersSnapshot.docs) {
      console.log(`- User ID: ${userDoc.id}`);
      
      // Získáme emaily pro každého uživatele
      const emailsSnapshot = await userDoc.ref.collection('emails').get();
      
      if (!emailsSnapshot.empty) {
        console.log(`  📧 Emaily pro uživatele ${userDoc.id}:`);
        
        for (const emailDoc of emailsSnapshot.docs) {
          console.log(`  - ${emailDoc.id}`);
          
          users.push({
            userId: userDoc.id,
            email: emailDoc.id,
            data: emailDoc.data()
          });
        }
      } else {
        console.log(`  ❗ Žádné emaily pro uživatele ${userDoc.id}`);
      }
    }
    
    return users;
  } catch (err) {
    console.error('❌ Chyba při získávání uživatelů:', err);
    return null;
  }
}

// Testovací funkce pro aktualizaci uživatele
async function testUpdateUser() {
  try {
    const specificUserId = '81e91ab5-2396-4490-b48f-9db043f90397';
    const specificEmail = 'asdasdasdsdaads@adsadas.ccas';
    
    console.log(`🔍 Hledám konkrétního uživatele s ID: ${specificUserId} a emailem: ${specificEmail}`);
    
    // Přímý přístup k dokumentu uživatele a emailu
    const userEmailRef = db.collection('users').doc(specificUserId).collection('emails').doc(specificEmail);
    const userEmailDoc = await userEmailRef.get();
    
    if (!userEmailDoc.exists) {
      console.log(`❌ Uživatel s ID ${specificUserId} a emailem ${specificEmail} nebyl nalezen`);
      return;
    }
    
    console.log(`✅ Uživatel s ID ${specificUserId} a emailem ${specificEmail} byl nalezen`);
    
    // Získáme data uživatele
    const userData = userEmailDoc.data();
    
    // Kontrola, zda má uživatel pushToken a deviceLibraryIdentifier
    if (!userData.pushToken || !userData.deviceLibraryIdentifier) {
      console.log(`❌ Uživatel nemá pushToken nebo deviceLibraryIdentifier`);
      console.log('📋 Data uživatele:', userData);
      return;
    }
    
    console.log('👉 Nalezen uživatel s pushToken/deviceLibraryIdentifier!');
    
    // Vytvoříme objekt s informacemi o uživateli
    const selectedUser = {
      userId: specificUserId,
      email: specificEmail,
      data: userData
    };
    console.log(`💾 Vybrán uživatel pro testování: userId=${selectedUser.userId}, email=${selectedUser.email}`);
    console.log('📋 Aktuální data:', selectedUser.data);
    
    // Připravíme aktualizovaná data
    const updatedData = {
      ...selectedUser.data,
      stampCount: String(parseInt(selectedUser.data.stampCount || '0') + 91), // Výrazně zvýšíme počet razítek
      lastUpdated: new Date().toISOString()
    };
    
    // Aktualizujeme dokument
    console.log('🔄 Aktualizuji data...');
    const userRef = db.collection('users').doc(selectedUser.userId).collection('emails').doc(selectedUser.email);
    await userRef.set(updatedData, { merge: true });
    
    console.log('✅ Data úspěšně aktualizována');
    console.log('📋 Nová data:', updatedData);
    
    // Počkáme chvíli, aby se trigger mohl spustit
    console.log('⏳ Čekám 5 sekund na spuštění triggeru...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (err) {
    console.error('❌ Chyba při aktualizaci dat:', err);
  }
}

// Spustíme test
testUpdateUser()
  .then(() => {
    console.log('✅ Test dokončen');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Chyba při spuštění testu:', err);
    process.exit(1);
  });
