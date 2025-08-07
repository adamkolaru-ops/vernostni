/**
 * Testovací skript pro end-to-end test notifyDeviceOnPassUpdate triggeru
 * 
 * Tento skript:
 * 1. Najde existující dokument v users/{fullId}/emails/{emailId}
 * 2. Změní relevantní pole (např. stampCount)
 * 3. Trigger se spustí a pošle notifikaci pouze pro tento konkrétní email/pass
 */

const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function testTriggerEndToEnd() {
  try {
    console.log('🧪 Spouštím end-to-end test notifyDeviceOnPassUpdate triggeru...');
    
    // Testovací data - použijeme existující fullId a emailId z logů
    const fullId = '81e91ab5-2396-4490-b48f-9db043f90397';
    const emailId = 'BrdOOOOH@ddqwd.cc'; // Email z logů, který má pushToken a deviceLibraryIdentifier
    
    console.log(`📋 Testuji pro fullId: ${fullId}, emailId: ${emailId}`);
    
    // Cesta k dokumentu
    const docPath = `users/${fullId}/emails/${emailId}`;
    const docRef = db.doc(docPath);
    
    // Načteme současná data
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.error(`❌ Dokument ${docPath} neexistuje!`);
      return;
    }
    
    const currentData = docSnap.data();
    console.log(`📋 Současná data dokumentu:`, JSON.stringify(currentData, null, 2));
    
    // Zkontrolujeme, že dokument má potřebné údaje pro notifikaci
    if (!currentData.pushToken || !currentData.deviceLibraryIdentifier) {
      console.error(`❌ Dokument nemá pushToken nebo deviceLibraryIdentifier!`);
      console.error(`  - pushToken: ${currentData.pushToken || 'CHYBÍ'}`);
      console.error(`  - deviceLibraryIdentifier: ${currentData.deviceLibraryIdentifier || 'CHYBÍ'}`);
      return;
    }
    
    console.log(`✅ Dokument má potřebné údaje pro notifikaci:`);
    console.log(`  - pushToken: ${currentData.pushToken}`);
    console.log(`  - deviceLibraryIdentifier: ${currentData.deviceLibraryIdentifier}`);
    console.log(`  - serialNumber: ${currentData.serialNumber}`);
    console.log(`  - passTypeIdentifier: ${currentData.passTypeIdentifier || 'bude načten z cardzapier'}`);
    
    // Změníme relevantní pole, které vyvolá trigger
    const newStampCount = parseInt(currentData.stampCount || 0) + 1;
    const newLastUpdated = new Date().toISOString();
    
    console.log(`🔄 Měním data pro vyvolání triggeru:`);
    console.log(`  - stampCount: ${currentData.stampCount} → ${newStampCount}`);
    console.log(`  - lastUpdated: ${currentData.lastUpdated} → ${newLastUpdated}`);
    
    // Aktualizujeme dokument - toto by mělo vyvolat trigger
    await docRef.update({
      stampCount: newStampCount.toString(), // stampCount je string
      lastUpdated: newLastUpdated,
      dateUpdated: newLastUpdated
    });
    
    console.log(`✅ Dokument aktualizován! Cesta: ${docPath}`);
    console.log(`🔔 Trigger notifyDeviceOnPassUpdate by se měl nyní spustit pro tento konkrétní email/pass.`);
    console.log(`📋 Pro kontrolu logů triggeru spusťte: firebase functions:log --only notifyDeviceOnPassUpdate`);
    console.log(`🎯 Očekáváme APN notifikaci pouze pro emailId: ${emailId} (ne pro jiné emaily)`);
    
  } catch (error) {
    console.error('❌ Chyba při testování:', error);
  }
}

// Spuštění testu
testTriggerEndToEnd()
  .then(() => {
    console.log('🏁 Test dokončen.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatální chyba:', error);
    process.exit(1);
  });
