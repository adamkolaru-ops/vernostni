// appleWalletWebhook.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializace sekundární aplikace pro 'vernostkarty-db'
// Dáváme jí unikátní jméno 'dbAdmin', aby se nepletla s hlavní aplikací
const serviceAccountDb = require("./certificates/vernostkarty-db-service-account.json");
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountDb)
  }, 'dbAdmin');
} catch (e) {
  console.log('Secondary app already initialized.');
}
const firestoreDb = admin.app('dbAdmin').firestore();
const { Datastore } = require('@google-cloud/datastore');
const datastore = new Datastore();

// Inicializace sekundární aplikace pro 'vernostkarty-db'


exports.appleWalletWebhook = functions.https.onRequest(async (req, res) => {
  console.log(`Webhook call: ${req.method} ${req.path}`);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  // Výhybka pro logovací endpoint od Apple - MUSÍ BÝT PŘED AUTORIZACÍ!
  if (req.path.endsWith('/log')) {
    console.log('Received logs from Apple Wallet:', req.body);
    return res.status(200).send('Log received.');
  }

  // 1. Ověření autorizačního tokenu
  const authHeader = req.headers.authorization || '';
  const providedToken = authHeader.startsWith('ApplePass ') ? authHeader.substring(10) : '';
  if (providedToken !== 'a7d8g9h2j4k5l6m7n8b9v0c1x2z3') {
    console.warn(`Unauthorized access attempt with token: '${providedToken}'`);
    return res.status(401).send('Unauthorized');
  }

  // Struktura cesty: /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
  const pathParts = req.path.split('/');
  // Cesta pro registraci: /v1/devices/{id}/registrations/{pass_id}/{serial}
  // Pole má 7 částí, sériové číslo je na indexu 6.
  if (pathParts.length < 7) {
    console.error("Invalid path format for registration:", req.path);
    return res.status(400).send('Invalid path format.');
  }

  const deviceLibraryIdentifier = pathParts[3];
  const serialNumber = pathParts[6];

  // 2. Zpracování registrace nového zařízení
  if (req.method === 'POST' && req.path.includes('/registrations/')) {
    try {
      const { pushToken } = req.body;
      if (!pushToken) {
        console.error("Push token is missing in the request body.");
        return res.status(400).send('Push token is required.');
      }

      const cardKey = datastore.key(['cards', datastore.int(serialNumber)]);
      const [card] = await datastore.get(cardKey);

      if (!card) {
        console.error(`Card with serial number ${serialNumber} not found.`);
        return res.status(404).send('Card not found.');
      }

      // Vytvoření nového záznamu v kolekci 'userdeviceinfo'
      const deviceInfoKey = datastore.key(['userdeviceinfo', deviceLibraryIdentifier]);
      const deviceInfoData = {
        deviceLibraryIdentifier,
        pushToken,
        serialNumber,
        userId: card.userId || null, // Zajistíme, že pole existuje
        cafeId: card.cafeId || null, // Zajistíme, že pole existuje
        timestamp: new Date().toISOString(),
      };

      // Krok 1: Zápis do Datastore (projekt vernostkarty)
      await datastore.save({ key: deviceInfoKey, data: deviceInfoData });
      console.log(`Successfully saved device info for ${deviceLibraryIdentifier} to Datastore.`);

      // Krok 2: Zápis do Firestore (projekt vernostkarty-db) - Původní jednoduchý zápis
      try {
        const logRef = firestoreDb.collection('userdeviceinfo').doc(deviceLibraryIdentifier);
        await logRef.set(deviceInfoData);
        console.log(`Successfully logged device info for ${deviceLibraryIdentifier} to 'userdeviceinfo' collection.`);
      } catch (dbError) {
        console.error(`Failed to log device info to 'userdeviceinfo':`, dbError);
      }

      // Krok 3: Pokročilý zápis ke konkrétnímu uživateli
      try {
        const { userId, cafeId } = deviceInfoData;
        if (!userId || !cafeId) {
          throw new Error('Missing userId or cafeId for advanced save.');
        }

        // 1. Získání e-mailu
        const shortCafeId = cafeId.slice(-12);
        const emailDocPath = `usersid/${shortCafeId}/users/${userId}`;
        const emailDoc = await firestoreDb.doc(emailDocPath).get();

        if (!emailDoc.exists || !emailDoc.data().email) {
          throw new Error(`Email not found for user ${userId} at ${emailDocPath}`);
        }
        const userEmail = emailDoc.data().email;
        console.log(`Found email ${userEmail} for user ${userId}`);

        // 2. Zápis dat o zařízení k uživateli
                const finalDocRef = firestoreDb.collection('users').doc(cafeId).collection('emails').doc(userEmail);
        const deviceDataToWrite = {
          deviceLibraryIdentifier: deviceInfoData.deviceLibraryIdentifier,
          pushToken: deviceInfoData.pushToken,
          timestamp: deviceInfoData.timestamp
        };
        await finalDocRef.set(deviceDataToWrite, { merge: true });
        console.log(`Successfully saved device info to user ${userEmail} under cafe ${cafeId}`);

      } catch (advancedError) {
        console.error('Failed to perform advanced save:', advancedError);
      }

      console.log(`Device ${deviceLibraryIdentifier} successfully registered for card ${serialNumber}.`);
      return res.status(201).send('Device registered.');

    } catch (error) {
      console.error(`Registration failed for card ${serialNumber}:`, error);
      return res.status(500).send('Registration failed.');
    }
  }

  // 3. Zpracování odregistrace zařízení
  if (req.method === 'DELETE') {
    console.log(`Device ${deviceLibraryIdentifier} unregistered for card ${serialNumber}. Logic to be implemented.`);
    // V budoucnu zde bude logika pro odstranění tokenu z Datastore
    return res.status(200).send('Device unregistered.');
  }

  // 4. Zpracování žádosti o nejnovější verzi passu
  if (req.method === 'GET' && req.path.includes('/passes/')) {
      console.log(`Update request for card ${serialNumber}. No changes.`);
      // Vracíme 304, protože zatím nemáme logiku pro aktualizaci passu
      return res.status(304).send();
  }

  // Ostatní požadavky
  console.log("Unhandled request type. Path:", req.path);
  res.status(200).send('Request received.');
});
