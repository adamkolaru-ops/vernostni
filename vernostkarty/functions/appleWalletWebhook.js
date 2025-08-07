// appleWalletWebhook.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require('fs');
const axios = require('axios');
const certificateHelper = require('./certificateHelperV2');

// Inicializace sekundární aplikace pro 'vernostkarty-db' pro deployment
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
const { PKPass } = require('passkit-generator');
const datastore = new Datastore();

// Inicializace sekundární aplikace pro 'vernostkarty-db'


exports.appleWalletWebhook = functions.https.onRequest(async (req, res) => {
  console.log(`🔴 WEBHOOK START: method: ${req.method}, path: ${req.path}`);
  console.log(`🔴 WEBHOOK: Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`🔴 WEBHOOK: Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔴 WEBHOOK: Query:`, JSON.stringify(req.query, null, 2));
  console.log(`🔴 WEBHOOK: URL:`, req.url);
  console.log(`🔴 WEBHOOK: Original URL:`, req.originalUrl);

  console.log(`Webhook call: ${req.method} ${req.path}`);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  // Výhybka pro logovací endpoint od Apple - MUSÍ BÝT PŘED AUTORIZACÍ!
  if (req.path.endsWith('/log')) {
    console.log('Received logs from Apple Wallet:', req.body);
    return res.status(200).send('Log received.');
  }

  // 1. Ověření autorizačního tokenu (pouze pro POST a DELETE, GET /registrations je bez tokenu)
  const isLogEndpoint = req.path.endsWith('/log');
  const isGetRegistrations = req.method === 'GET' && req.path.includes('/registrations/');
  const isGetPasses = req.method === 'GET' && req.path.includes('/passes/');
  const requiresAuth = (req.method === 'POST' || req.method === 'DELETE') && !isLogEndpoint;
  
  console.log(`Auth check: method=${req.method}, path=${req.path}, requiresAuth=${requiresAuth}, isGetRegistrations=${isGetRegistrations}`);
  
  if (requiresAuth) {
    const authHeader = req.headers.authorization || '';
    const providedToken = authHeader.startsWith('ApplePass ') ? authHeader.substring(10) : '';
    if (providedToken !== 'a7d8g9h2j4k5l6m7n8b9v0c1x2z3') {
      console.warn(`Unauthorized access attempt with token: '${providedToken}'`);
      return res.status(401).send('Unauthorized');
    }
  } else {
    console.log(`Skipping auth for ${req.method} ${req.path}`);
  }

  // Struktura cesty - různé endpointy mají různý počet částí:
  // GET /v1/devices/{id}/registrations/{passType} - 6 částí (seznam karet)
  // POST /v1/devices/{id}/registrations/{passType}/{serial} - 7 částí (registrace)
  // GET /v1/passes/{passType}/{serial} - 5 částí (stažení karty)
  const pathParts = req.path.split('/');
  console.log(`Path parts (${pathParts.length}):`, pathParts);
  
  let deviceLibraryIdentifier, serialNumber, passTypeIdentifier;
  
  if (req.path.includes('/passes/')) {
    // GET /v1/passes/{passType}/{serial}
    if (pathParts.length < 5) {
      console.error("Invalid path format for passes:", req.path);
      return res.status(400).send('Invalid path format.');
    }
    passTypeIdentifier = pathParts[3];
    serialNumber = pathParts[4];
  } else if (req.path.includes('/registrations/')) {
    // /v1/devices/{id}/registrations/{passType} nebo /v1/devices/{id}/registrations/{passType}/{serial}
    if (pathParts.length < 6) {
      console.error("Invalid path format for registrations:", req.path);
      return res.status(400).send('Invalid path format.');
    }
    deviceLibraryIdentifier = pathParts[3];
    passTypeIdentifier = pathParts[5];
    serialNumber = pathParts.length >= 7 ? pathParts[6] : null;
  } else {
    console.error("Unknown path format:", req.path);
    return res.status(400).send('Unknown path format.');
  }

  // 2. Zpracování registrace nového zařízení
  if (req.method === 'POST' && req.path.includes('/registrations/')) {
    try {
      const { pushToken } = req.body;
      if (!pushToken) {
        console.error("Push token is missing in the request body.");
        return res.status(400).send('Push token is required.');
      }

      console.log(`🔍 WEBHOOK: Fetching card with serialNumber (userId/anonymousId): ${serialNumber}`);
      
      // Normalizace serialNumber - odstranění prefixu "ID=" pokud existuje
      let normalizedSerialNumber = serialNumber;
      if (normalizedSerialNumber && normalizedSerialNumber.startsWith('ID=')) {
        normalizedSerialNumber = normalizedSerialNumber.substring(3);
        console.log(`🔍 WEBHOOK: Normalizován serialNumber z ${serialNumber} na ${normalizedSerialNumber}`);
      }
      
      // Strategie 1: Přesné hledání podle userId nebo anonymousId
      console.log(`🔍 WEBHOOK: Strategie 1 - Přesné hledání podle userId=${normalizedSerialNumber} nebo anonymousId=${normalizedSerialNumber}`);
      
      const userIdQuery = datastore.createQuery('cards')
        .filter('userId', '=', normalizedSerialNumber)
        .limit(1);
      
      const anonymousIdQuery = datastore.createQuery('cards')
        .filter('anonymousId', '=', normalizedSerialNumber)
        .limit(1);
      
      const [userIdResults] = await datastore.runQuery(userIdQuery);
      let card = userIdResults[0];
      
      if (!card) {
        console.log(`🔍 WEBHOOK: Karta podle userId nenalezena, zkouším anonymousId`);
        const [anonymousIdResults] = await datastore.runQuery(anonymousIdQuery);
        card = anonymousIdResults[0];
      }
      
      // Strategie 2: Pokud serialNumber obsahuje '/', zkusíme rozdělit a hledat podle části za '/'
      if (!card && normalizedSerialNumber.includes('/')) {
        const parts = normalizedSerialNumber.split('/');
        const lastPart = parts[parts.length - 1];
        
        console.log(`🔍 WEBHOOK: Strategie 2 - Rozdělení normalizedSerialNumber='${normalizedSerialNumber}', hledání podle lastPart='${lastPart}'`);
        
        const partUserIdQuery = datastore.createQuery('cards')
          .filter('userId', '=', lastPart)
          .limit(1);
        
        const partAnonymousIdQuery = datastore.createQuery('cards')
          .filter('anonymousId', '=', lastPart)
          .limit(1);
        
        const [partUserIdResults] = await datastore.runQuery(partUserIdQuery);
        if (partUserIdResults.length > 0) {
          card = partUserIdResults[0];
        } else {
          const [partAnonymousIdResults] = await datastore.runQuery(partAnonymousIdQuery);
          if (partAnonymousIdResults.length > 0) {
            card = partAnonymousIdResults[0];
          }
        }
      }
      
      // Strategie 3: Fallback na hledání podle fullId (typicky pro anonymní karty)
      if (!card) {
        console.log(`🔍 WEBHOOK: Strategie 3 - Fallback na hledání podle fullId=${normalizedSerialNumber}`);
        
        // Zkusíme hledat podle fullId (používané např. pro anonymní karty)
        const fullIdQuery = datastore.createQuery('cards')
          .filter('fullId', '=', normalizedSerialNumber)
          .limit(1);
          
        const [fullIdResults] = await datastore.runQuery(fullIdQuery);
        if (fullIdResults.length > 0) {
          card = fullIdResults[0];
        }
      }
      
      // Strategie 4: Hledání v celé kolekci (podobně jako v editoru)
      if (!card) {
        console.log(`🔍 WEBHOOK: Strategie 4 - Hledání v celé kolekci podle anonymousId=${normalizedSerialNumber}`);
        
        // Hledáme v celé kolekci karty, které mají anonymousId obsahující serialNumber
        const fullCollectionQuery = datastore.createQuery('cards')
          .filter('anonymousId', '=', normalizedSerialNumber);
          
        const [fullCollectionResults] = await datastore.runQuery(fullCollectionQuery);
        if (fullCollectionResults.length > 0) {
          card = fullCollectionResults[0];
          console.log(`🔍 WEBHOOK: Nalezena karta v celé kolekci: ${card.userId || card.anonymousId}`);
        }
      }
      
      // Strategie 5: Hledání podle emailu (nová logika - serialNumber je nyní email)
      if (!card && normalizedSerialNumber.includes('@')) {
        console.log(`🔍 WEBHOOK: Strategie 5 - Hledání podle emailu: ${normalizedSerialNumber}`);
        
        // Hledáme v uživatelských datech podle emailu
        const emailQuery = datastore.createQuery('cards')
          .filter('email', '=', normalizedSerialNumber)
          .limit(1);
        
        const [emailResults] = await datastore.runQuery(emailQuery);
        if (emailResults.length > 0) {
          card = emailResults[0];
          console.log(`🔍 WEBHOOK: Nalezena karta podle emailu: ${normalizedSerialNumber}`);
        }
      }
      
      // Strategie 6: Zkusit hledání podle původního serialNumber s prefixem "ID=" (fallback)
      if (!card && normalizedSerialNumber !== serialNumber) {
        console.log(`🔍 WEBHOOK: Strategie 6 - Zkouším původní serialNumber s prefixem ID=: ${serialNumber}`);
        
        const originalSerialNumberQuery = datastore.createQuery('cards')
          .filter('anonymousId', '=', serialNumber)
          .limit(1);
        
        const [originalResults] = await datastore.runQuery(originalSerialNumberQuery);
        if (originalResults.length > 0) {
          card = originalResults[0];
          console.log(`🔍 WEBHOOK: Nalezena karta podle původního serialNumber s prefixem: ${serialNumber}`);
        }
      }

      if (!card) {
        console.error(`❌ WEBHOOK: Card with serialNumber ${serialNumber} not found using any method.`);
        return res.status(404).send('Card not found.');
      }
      
      console.log(`✅ WEBHOOK: Karta nalezena metodou vyhledávání`);
      
      console.log("📋 WEBHOOK: RAW card data from Datastore:", JSON.stringify(card, null, 2));
      console.log("🔍 WEBHOOK: Detailní analýza klíčů v kartě:");
      console.log("  - card.userId:", card.userId, "(typ:", typeof card.userId, ")");
      console.log("  - card.anonymousId:", card.anonymousId, "(typ:", typeof card.anonymousId, ")");
      console.log("  - card.cafeId:", card.cafeId, "(typ:", typeof card.cafeId, ")");
      console.log("  - card.fullId:", card.fullId, "(typ:", typeof card.fullId, ")");
      console.log("  - card.wixid:", card.wixid, "(typ:", typeof card.wixid, ")");

      // Sjednocené mapování identifikátorů s fallback logikou
      const userId = card.userId || card.anonymousId || null;
      const cafeId = card.cafeId || (card.fullId ? card.fullId.slice(-12) : null) || (card.wixid ? card.wixid.slice(-12) : null);
      const fullId = card.fullId || card.wixid || card.cafeId || null;
      const wixid = card.wixid || card.fullId || card.cafeId || null;
      const anonymousId = card.anonymousId || card.userId || null;
      
      // NOVÁ LOGIKA: serialNumber je nyní přímo email uživatele
      let emailId = '';
      
      // serialNumber je nyní přímo email uživatele (změna z anonymousId na email)
      if (normalizedSerialNumber) {
        emailId = normalizedSerialNumber;
        console.log(`🔍 WEBHOOK: Použit normalizedSerialNumber jako emailId: ${emailId}`);
      } else if (anonymousId) {
        // Fallback na anonymousId pro staré záznamy
        emailId = anonymousId;
        console.log(`🔍 WEBHOOK: Fallback - použit anonymousId jako emailId: ${emailId}`);
      }

      console.log("🔍 WEBHOOK: Identifikátory karty pro registraci zařízení:");
      console.log("  - userId:", userId);
      console.log("  - cafeId:", cafeId);
      console.log("  - fullId:", fullId);
      console.log("🔴 WEBHOOK DEBUG: Pokračuji k dalšímu kroku...");
      console.log("  - wixid:", wixid);
      console.log("  - anonymousId:", anonymousId);
      console.log("  - emailId:", emailId);
      console.log("🔴 WEBHOOK: Pokračuji v POST registraci - kontrola existujících zařízení");
      
      // PŘÍMÝ ZÁPIS DO FIRESTORE - hned po identifikaci fullId
      try {
        console.log(`📦 DIRECT WEBHOOK: Zapísuji pushToken a deviceLibraryIdentifier do Firestore`);
        console.log(`📦 DIRECT WEBHOOK: Cesta: users/${fullId}/emails/${emailId}`);
        
        const userEmailRef = firestoreDb.doc(`users/${fullId}/emails/${emailId}`);
        
        const firestoreData = {
          pushToken,
          deviceLibraryIdentifier,
          serialNumber: emailId, // Email jako serialNumber
          passTypeIdentifier,
          dateUpdated: new Date().toISOString(),
          // Zachováme existující data pokud existují
          ...((await userEmailRef.get()).exists ? {} : { dateCreated: new Date().toISOString() })
        };
        
        await userEmailRef.set(firestoreData, { merge: true });
        console.log(`✅ DIRECT WEBHOOK: Úspěšně zapsáno do Firestore users/${fullId}/emails/${emailId}`);
        console.log(`📋 DIRECT WEBHOOK: Zapsaná data:`, JSON.stringify(firestoreData, null, 2));
        
      } catch (firestoreError) {
        console.error(`❌ DIRECT WEBHOOK: Chyba při zápisu do Firestore:`, firestoreError);
      }

      // Nejprve zkontrolujeme, zda již v kolekci 'userdeviceinfo' neexistuje záznam s tímto serialNumber (emailId)
      const existingDeviceQuery = datastore.createQuery('userdeviceinfo')
        .filter('serialNumber', '=', emailId);
      
      const [existingDevices] = await datastore.runQuery(existingDeviceQuery);
      
      // Vytvoření datového objektu pro Datastore - KLÍČ JE serialNumber (emailId) pro jedinečnost každé karty
      const deviceInfoKey = datastore.key(['userdeviceinfo', emailId]);
      const deviceInfoData = {
        deviceLibraryIdentifier,
        pushToken,
        serialNumber: emailId, // NOVÉ: Uložíme email jako serialNumber
        userId,
        cafeId,
        fullId,
        wixid,
        anonymousId,
        emailId,
        passTypeIdentifier, // Přidáme passTypeIdentifier pro správnou identifikaci passu
        dateCreated: existingDevices.length > 0 ? existingDevices[0].dateCreated : new Date().toISOString(), // Zachováme původní datum vytvoření
        dateUpdated: new Date().toISOString(),
      };
      console.log("📋 WEBHOOK: Prepared deviceInfoData for Datastore:", JSON.stringify(deviceInfoData, null, 2));
      console.log("WEBHOOK: Ukládám do Datastore deviceInfoData:");
      console.log("  - deviceLibraryIdentifier:", deviceInfoData.deviceLibraryIdentifier, "(typ:", typeof deviceInfoData.deviceLibraryIdentifier, ")");
      console.log("  - pushToken:", deviceInfoData.pushToken, "(typ:", typeof deviceInfoData.pushToken, ")");
      console.log("  - serialNumber (EMAIL):", deviceInfoData.serialNumber, "(typ:", typeof deviceInfoData.serialNumber, ")");
      console.log("  - userId:", deviceInfoData.userId, "(typ:", typeof deviceInfoData.userId, ")");
      console.log("  - cafeId:", deviceInfoData.cafeId, "(typ:", typeof deviceInfoData.cafeId, ")");
      console.log("  - emailId:", deviceInfoData.emailId, "(typ:", typeof deviceInfoData.emailId, ")");
      console.log("  - fullId:", deviceInfoData.fullId, "(typ:", typeof deviceInfoData.fullId, ")");
      console.log("  - wixid:", deviceInfoData.wixid, "(typ:", typeof deviceInfoData.wixid, ")");
      console.log("  - anonymousId:", deviceInfoData.anonymousId, "(typ:", typeof deviceInfoData.anonymousId, ")");
      console.log("  - emailId:", deviceInfoData.emailId, "(typ:", typeof deviceInfoData.emailId, ")");

      // Krok 1: Zápis do Datastore (projekt vernostkarty)
      try {
        // Pokud záznam existuje, logujeme update, jinak create
        const operationType = existingDevices.length > 0 ? 'aktualizoval' : 'vytvořil';
        await datastore.save({ key: deviceInfoKey, data: deviceInfoData });
        console.log(`✅ WEBHOOK: Úspěšně ${operationType} záznam pro ${deviceLibraryIdentifier} v Datastore.`);
        console.log(`✅ WEBHOOK: Použitý Datastore klíč:`, deviceInfoKey);
        
        // Zkontrolujeme, zda existují duplicity s jiným deviceLibraryIdentifier, ale stejným emailId
        if (emailId) {
          const duplicateQuery = datastore.createQuery('userdeviceinfo')
            .filter('emailId', '=', emailId)
            .filter('deviceLibraryIdentifier', '!=', deviceLibraryIdentifier);
          
          const [duplicates] = await datastore.runQuery(duplicateQuery);
          
          if (duplicates.length > 0) {
            console.log(`⚠️ WEBHOOK: Detekováno ${duplicates.length} dalších zařízení pro emailId=${emailId}`);  
            duplicates.forEach((dupe, i) => {
              console.log(`  ${i+1}. deviceLibraryIdentifier: ${dupe.deviceLibraryIdentifier}, serialNumber: ${dupe.serialNumber}`);
            });
          }
        }
      } catch (datastoreError) {
        console.error(`❌ WEBHOOK: Chyba při ukládání do Datastore:`, datastoreError);
        throw datastoreError;
      }

      // Krok 2: NOVÁ LOGIKA - Zápis do Firestore users/{fullId}/emails/{serialNumber}
      try {
        console.log(`📦 WEBHOOK: Zapísovám pushToken a deviceLibraryIdentifier do Firestore`);
        console.log(`📦 WEBHOOK: Cesta: users/${fullId}/emails/${emailId}`);
        
        // Zápis do správné cesty v Firestore
        const userEmailRef = firestoreDb.doc(`users/${fullId}/emails/${emailId}`);
        
        // Připravíme data pro zápis (pouze klíčové údaje pro Apple Wallet)
        const firestoreData = {
          pushToken,
          deviceLibraryIdentifier,
          serialNumber: emailId, // Email jako serialNumber
          passTypeIdentifier,
          dateUpdated: new Date().toISOString(),
          // Zachováme existující data pokud existují
          ...((await userEmailRef.get()).exists ? {} : { dateCreated: new Date().toISOString() })
        };
        
        // Merge s existujícími daty (nenahrazujeme uživatelská data)
        await userEmailRef.set(firestoreData, { merge: true });
        
        console.log(`✅ WEBHOOK: Úspěšně zapsáno do Firestore users/${fullId}/emails/${emailId}`);
        console.log(`📋 WEBHOOK: Zapsaná data:`, JSON.stringify(firestoreData, null, 2));
        
        // Zachováme i starý zápis pro kompatibilitu
        const logRef = firestoreDb.collection('userdeviceinfo').doc(deviceLibraryIdentifier);
        await logRef.set(deviceInfoData);
        console.log(`✅ WEBHOOK: Také zapsáno do userdeviceinfo pro kompatibilitu`);
        
      } catch (dbError) {
        console.error(`❌ WEBHOOK: Chyba při zápisu do Firestore:`, dbError);
      }

      // Krok 3: Pokročilý zápis ke konkrétnímu uživateli
      try {
        // Normalizace všech ID v deviceInfoData (odstranění prefixu "ID=" pokud existuje)
        for (const idField of ['userId', 'emailId', 'serialNumber']) {
          if (deviceInfoData[idField] && typeof deviceInfoData[idField] === 'string' && deviceInfoData[idField].startsWith('ID=')) {
            const originalValue = deviceInfoData[idField];
            deviceInfoData[idField] = deviceInfoData[idField].substring(3);
            console.log(`🔍 WEBHOOK: Normalizováno ${idField} z ${originalValue} na ${deviceInfoData[idField]}`);
          }
        }
        
        const { userId, cafeId, fullId } = deviceInfoData;
        if (!userId || !cafeId) {
          throw new Error('Chybí userId nebo cafeId pro pokročilý zápis.');
        }

        // 1. Získání e-mailu (používáme shortCafeId)
        const shortCafeId = cafeId && cafeId.length > 12 ? cafeId.slice(-12) : cafeId;
        // Normalizace userId (odstranění prefixu "ID=" pokud existuje)
        let normalizedUserId = userId;
        if (normalizedUserId && normalizedUserId.startsWith('ID=')) {
          normalizedUserId = normalizedUserId.substring(3);
          console.log(`🔍 WEBHOOK: Normalizován userId z ${userId} na ${normalizedUserId}`);
        }
        const userEmail = normalizedUserId || userId; // Použij normalizované ID, pokud je dostupné
        
        console.log(`📋 WEBHOOK: Pokročilý zápis pro uživatele: ${userEmail}, kavárna: ${shortCafeId}`);
        
        // 2. Uložení do uživatelského dokumentu
        const userDocPath = `users/${shortCafeId}/emails/${userEmail}`;
        console.log(`📋 WEBHOOK: Ukládám do cesty: ${userDocPath}`);
        
        // Nejprve ověříme, jestli dokument existuje a pokud ano, zachováme existující data
        const finalDocRef = firestoreDb.doc(userDocPath);
        const existingDoc = await finalDocRef.get();
        
        const deviceDataToWrite = {
          deviceLibraryIdentifier: deviceInfoData.deviceLibraryIdentifier,
          pushToken: deviceInfoData.pushToken,
          timestamp: new Date().toISOString(),
          emailId: deviceInfoData.emailId,  
          serialNumber: deviceInfoData.serialNumber 
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

  // 3. Zjištění, které karty se změnily (po push notifikaci)
  if (req.method === 'GET' && req.path.includes('/registrations/')) {
    const passTypeIdentifier = pathParts[5];
    const lastUpdated = req.headers['if-modified-since'];

    console.log(`Device ${deviceLibraryIdentifier} asks for updates for ${passTypeIdentifier} since ${lastUpdated}.`);
    console.log(`🔍 DEBUG: If-Modified-Since header format: ${lastUpdated}`);
    
    // Pokud chybí If-Modified-Since, použijeme konzervativní přístup a vrátíme všechny karty
    // Toto je důležité pro první dotaz zařízení po instalaci passu
    const forceUpdate = !lastUpdated;

    try {
      const query = datastore.createQuery('userdeviceinfo')
        .filter('deviceLibraryIdentifier', '=', deviceLibraryIdentifier);

      const [deviceInfos] = await datastore.runQuery(query);

      if (deviceInfos.length === 0) {
        console.log(`No registrations found for device ${deviceLibraryIdentifier}.`);
        return res.status(204).send();
      }

      const updatedSerialNumbers = [];
      // Správné parsování If-Modified-Since hlavičky podle RFC 7232
      // Formát může být např. "Wed, 21 Oct 2015 07:28:00 GMT"
      let lastUpdatedTimestamp = 0;
      if (lastUpdated) {
        try {
          lastUpdatedTimestamp = new Date(lastUpdated).getTime();
          console.log(`🔍 DEBUG: Parsed lastUpdatedTimestamp: ${lastUpdatedTimestamp}, ISO date: ${new Date(lastUpdatedTimestamp).toISOString()}`);
        } catch (parseError) {
          console.error(`❌ Error parsing If-Modified-Since header: ${parseError.message}`);
          lastUpdatedTimestamp = 0;
        }
      } else {
        console.log(`⚠️ WARNING: No If-Modified-Since header provided, will return all passes`);
      }
      
      let latestTimestamp = lastUpdatedTimestamp || 0;

      console.log(`📋 DEBUG: Device infos found:`, JSON.stringify(deviceInfos.map(info => ({
        serialNumber: info.serialNumber,
        type: typeof info.serialNumber
      })), null, 2));
      
      // Vytvoříme pole klíčů pro všechny karty registrované na tomto zařízení
      const cardKeys = [];
      for (const info of deviceInfos) {
        if (!info.serialNumber) {
          console.log(`⚠️ WARNING: Device info missing serialNumber, skipping`);
          continue;
        }
        
        try {
          // Zkusíme nejprve převést na číslo, pokud je to možné
          if (!isNaN(parseInt(info.serialNumber))) {
            cardKeys.push(datastore.key(['cards', datastore.int(info.serialNumber)]));
          } else {
            // Pokud to není číslo, hledáme podle userId nebo anonymousId
            console.log(`🔍 DEBUG: Non-numeric serialNumber: ${info.serialNumber}, will query separately`);
          }
        } catch (keyError) {
          console.error(`❌ Error creating key for serialNumber ${info.serialNumber}: ${keyError.message}`);
        }
      }

      // Načteme všechny karty najednou pro efektivitu (numerické klíče)
      let cards = [];
      if (cardKeys.length > 0) {
        [cards] = await datastore.get(cardKeys);
        console.log(`📋 DEBUG: Retrieved ${cards.length} cards by numeric keys`);
      }
      
      // Pro všechny serialNumbers hledáme podle všech možných identifikátorů
      for (const info of deviceInfos) {
        if (!info.serialNumber) {
          continue; // Přeskočíme prázdné serialNumbers
        }
        
        // Normalizace serialNumber - odstranění prefixu "ID=" pokud existuje
        let normalizedSerialNumber = info.serialNumber;
        if (normalizedSerialNumber && normalizedSerialNumber.startsWith('ID=')) {
          normalizedSerialNumber = normalizedSerialNumber.substring(3);
          console.log(`🔍 DEBUG: Normalizován serialNumber z ${info.serialNumber} na ${normalizedSerialNumber}`);
          // Aktualizujeme info.serialNumber pro další použití v tomto cyklu
          info.serialNumber = normalizedSerialNumber;
        }
        
        console.log(`🔍 DEBUG: Hledám kartu pro serialNumber: ${info.serialNumber}`);
        console.log(`🔍 DEBUG: Info obsahuje emailId: ${info.emailId || 'není k dispozici'}`);
        
        // 0. NOVÉ: Prioritně hledáme podle emailId, pokud je k dispozici
        if (info.emailId) {
          try {
            // Normalizace emailId - odstranění prefixu "ID=" pokud existuje
            let normalizedEmailId = info.emailId;
            if (normalizedEmailId && normalizedEmailId.startsWith('ID=')) {
              normalizedEmailId = normalizedEmailId.substring(3);
              console.log(`🔍 DEBUG: Normalizován emailId z ${info.emailId} na ${normalizedEmailId}`);
            }
            
            // Nejprve zkusíme najít kartu podle emailId v cards kolekci
            const emailIdQuery = datastore.createQuery('cards')
              .filter('anonymousId', '=', normalizedEmailId);
            const [emailIdResults] = await datastore.runQuery(emailIdQuery);
            
            console.log(`🔍 DEBUG: Found ${emailIdResults.length} cards by emailId (anonymousId): ${normalizedEmailId}`);
            
            if (emailIdResults.length > 0) {
              console.log(`✅ DEBUG: Prioritně použita karta nalezená podle emailId: ${normalizedEmailId}`);
              cards.push(emailIdResults[0]);
              continue;
            }
            
            // Zkusíme najít kartu podle emailId jako userId
            const emailAsUserIdQuery = datastore.createQuery('cards')
              .filter('userId', '=', normalizedEmailId);
            const [emailAsUserIdResults] = await datastore.runQuery(emailAsUserIdQuery);
            
            console.log(`🔍 DEBUG: Found ${emailAsUserIdResults.length} cards by emailId (userId): ${normalizedEmailId}`);
            
            if (emailAsUserIdResults.length > 0) {
              console.log(`✅ DEBUG: Prioritně použita karta nalezená podle emailId jako userId: ${normalizedEmailId}`);
              cards.push(emailAsUserIdResults[0]);
              continue;
            }

            // Pokud jsme nenalezli kartu podle normalizedEmailId, zkusme hledat i s prefixem "ID="
            if (!normalizedEmailId.startsWith('ID=')) {
              const prefixedEmailId = `ID=${normalizedEmailId}`;
              console.log(`🔍 DEBUG: Zkouším hledat i s prefixem: ${prefixedEmailId}`);
              
              // Zkusme najít kartu podle prefixedEmailId jako anonymousId
              const prefixedEmailIdQuery = datastore.createQuery('cards')
                .filter('anonymousId', '=', prefixedEmailId);
              const [prefixedEmailIdResults] = await datastore.runQuery(prefixedEmailIdQuery);
              
              console.log(`🔍 DEBUG: Found ${prefixedEmailIdResults.length} cards by prefixed emailId (anonymousId): ${prefixedEmailId}`);
              
              if (prefixedEmailIdResults.length > 0) {
                console.log(`✅ DEBUG: Použita karta nalezená podle prefixedEmailId: ${prefixedEmailId}`);
                cards.push(prefixedEmailIdResults[0]);
                continue;
              }
              
              // Zkusme najít kartu podle prefixedEmailId jako userId
              const prefixedEmailAsUserIdQuery = datastore.createQuery('cards')
                .filter('userId', '=', prefixedEmailId);
              const [prefixedEmailAsUserIdResults] = await datastore.runQuery(prefixedEmailAsUserIdQuery);
              
              console.log(`🔍 DEBUG: Found ${prefixedEmailAsUserIdResults.length} cards by prefixed emailId (userId): ${prefixedEmailId}`);
              
              if (prefixedEmailAsUserIdResults.length > 0) {
                console.log(`✅ DEBUG: Použita karta nalezená podle prefixedEmailId jako userId: ${prefixedEmailId}`);
                cards.push(prefixedEmailAsUserIdResults[0]);
                continue;
              }
            }
          } catch (err) {
            console.error(`❌ Error looking up card by emailId: ${err.message}`);
          }
        }
        
        // 1. Zkusíme najít kartu přímo podle ID (pokud je to číslo)
        if (!isNaN(parseInt(info.serialNumber))) {
          try {
            const cardKey = datastore.key(['cards', datastore.int(info.serialNumber)]);
            const [cardById] = await datastore.get(cardKey);
            
            if (cardById) {
              console.log(`🔍 DEBUG: Found card by numeric ID: ${info.serialNumber}`);
              cards.push(cardById);
              continue;
            } else {
              console.log(`🔍 DEBUG: No card found by numeric ID: ${info.serialNumber}`);
            }
          } catch (err) {
            console.error(`❌ Error looking up card by ID: ${err.message}`);
          }
        }
        
        // 2. Hledání podle userId
        try {
          const userIdQuery = datastore.createQuery('cards')
            .filter('userId', '=', info.serialNumber);
          const [userIdResults] = await datastore.runQuery(userIdQuery);
          
          console.log(`🔍 DEBUG: Found ${userIdResults.length} cards by userId: ${info.serialNumber}`);
          
          if (userIdResults.length > 0) {
            cards.push(userIdResults[0]);
            continue;
          }
        } catch (err) {
          console.error(`❌ Error looking up card by userId: ${err.message}`);
        }
        
        // 3. Hledání podle anonymousId
        try {
          const anonymousIdQuery = datastore.createQuery('cards')
            .filter('anonymousId', '=', info.serialNumber);
          const [anonymousIdResults] = await datastore.runQuery(anonymousIdQuery);
          
          console.log(`🔍 DEBUG: Found ${anonymousIdResults.length} cards by anonymousId: ${info.serialNumber}`);
          
          if (anonymousIdResults.length > 0) {
            cards.push(anonymousIdResults[0]);
            continue;
          }
        } catch (err) {
          console.error(`❌ Error looking up card by anonymousId: ${err.message}`);
        }
        
        // 4. Hledání přímo v kolekci users
        try {
          // Zkusíme najít přímo v users kolekci
          const userQuery = datastore.createQuery('users')
            .filter('__key__', '=', datastore.key(['users', info.serialNumber]));
          const [userResults] = await datastore.runQuery(userQuery);
          
          console.log(`🔍 DEBUG: Found ${userResults.length} users by key: ${info.serialNumber}`);
          
          if (userResults.length > 0) {
            // Vytvoříme virtuální kartu z uživatele
            const user = userResults[0];
            const virtualCard = {
              userId: info.serialNumber,
              dateUpdated: user.dateUpdated || new Date().toISOString(),
              // Přidáme další potřebné vlastnosti z uživatele
              stampCount: user.stampCount,
              level1_status: user.level1_status,
              level2_status: user.level2_status,
              level3_status: user.level3_status
            };
            cards.push(virtualCard);
            console.log(`🔍 DEBUG: Created virtual card from user: ${info.serialNumber}`);
            continue;
          }
        } catch (err) {
          console.error(`❌ Error looking up user: ${err.message}`);
        }
        
        console.log(`⚠️ WARNING: No card or user found for serialNumber ${info.serialNumber} after all lookup attempts`);
      }
      
      console.log(`📋 DEBUG: Total cards found: ${cards.length}`);
      
      // Vytvoříme mapu karet pro snadné vyhledávání - používáme jak ID, tak userId a anonymousId
      const cardsMap = new Map();
      
      for (const card of cards) {
        // Přidáme kartu pod všemi možnými identifikátory
        if (card[datastore.KEY]) {
          cardsMap.set(String(card[datastore.KEY].id), card);
        }
        if (card.userId) {
          cardsMap.set(card.userId, card);
        }
        if (card.anonymousId) {
          cardsMap.set(card.anonymousId, card);
        }
      }

      for (const info of deviceInfos) {
        if (!info.serialNumber) continue;
        
        // NOVÁ LOGIKA: Hledání podle emailu (stejně jako v GET passes)
        let card = null;
        
        console.log(`🔍 DEBUG: Checking card for serialNumber: ${info.serialNumber}`);
        
        // Hledáme podle emailu (serialNumber je nyní email)
        if (info.serialNumber.includes('@')) {
          try {
            const emailQuery = datastore.createQuery('cards')
              .filter('email', '=', info.serialNumber)
              .limit(1);
            
            const [emailResults] = await datastore.runQuery(emailQuery);
            
            if (emailResults.length > 0) {
              card = emailResults[0];
              console.log(`✅ DEBUG: Nalezena karta podle emailu: ${info.serialNumber}`);
            } else {
              console.log(`⚠️ DEBUG: Karta podle emailu nenalezena: ${info.serialNumber}`);
            }
          } catch (err) {
            console.error(`❌ Error looking up card by email: ${err.message}`);
          }
        }
        
        // Fallback na starou logiku, pokud email selhá
        if (!card) {
          card = cardsMap.get(info.serialNumber);
          if (card) {
            console.log(`✅ DEBUG: Nalezena karta podle starého identifikátoru: ${info.serialNumber}`);
          }
        }
        
        console.log(`🔍 DEBUG: Card found: ${card ? 'YES' : 'NO'}`);
        
        // Pokud karta existuje a má pole dateUpdated
        if (card) {
          console.log(`📅 DEBUG: Card dateUpdated: ${card.dateUpdated || 'undefined'}`);
          
          // Pokud karta nemá dateUpdated, považujeme ji za změněnou (konzervativní přístup)
          if (!card.dateUpdated) {
            console.log(`⚠️ WARNING: Card ${info.serialNumber} has no dateUpdated field, considering it as updated`);
            updatedSerialNumbers.push(info.serialNumber);
            continue;
          }
          
          try {
            const cardModifiedTimestamp = new Date(card.dateUpdated).getTime();
            console.log(`🔍 DEBUG: Card modified timestamp: ${cardModifiedTimestamp}, ISO date: ${new Date(cardModifiedTimestamp).toISOString()}`);
            console.log(`🔍 DEBUG: Last updated timestamp: ${lastUpdatedTimestamp}, ISO date: ${new Date(lastUpdatedTimestamp).toISOString()}`);
            console.log(`🔍 DEBUG: Is card modified after last update? ${cardModifiedTimestamp > lastUpdatedTimestamp}`);
            
            // Porovnáme čas modifikace karty s časem posledního dotazu od zařízení
            // Pokud forceUpdate je true (chybí If-Modified-Since), vrátíme všechny karty
            if (forceUpdate || cardModifiedTimestamp > lastUpdatedTimestamp) {
              console.log(`✅ Card ${info.serialNumber} ${forceUpdate ? 'forced update' : 'was modified after last update'}, adding to updated list`);
              updatedSerialNumbers.push(info.serialNumber);
              if (cardModifiedTimestamp > latestTimestamp) {
                latestTimestamp = cardModifiedTimestamp;
              }
            } else {
              console.log(`ℹ️ Card ${info.serialNumber} was not modified since last update`);
            }
          } catch (dateError) {
            console.error(`❌ Error parsing dateUpdated for card ${info.serialNumber}: ${dateError.message}`);
            // Při chybě parsování data považujeme kartu za změněnou (konzervativní přístup)
            updatedSerialNumbers.push(info.serialNumber);
          }
        } else {
          console.log(`⚠️ WARNING: No card found for serialNumber ${info.serialNumber}`);
        }
      }

      // NOVÁ LOGIKA: Zápis do Firestore i při GET požadavcích
      // Pro každou nalezenou kartu zapíšeme pushToken a deviceLibraryIdentifier do Firestore
      for (const info of deviceInfos) {
        if (!info.serialNumber) continue;
        
        const card = cardsMap.get(info.serialNumber);
        if (card && card.fullId && info.pushToken) {
          try {
            console.log(`📦 GET WEBHOOK: Zapisuji do Firestore pro serialNumber: ${info.serialNumber}`);
            console.log(`📦 GET WEBHOOK: Cesta: users/${card.fullId}/emails/${info.serialNumber}`);
            
            const userEmailRef = firestoreDb.doc(`users/${card.fullId}/emails/${info.serialNumber}`);
            
            const firestoreData = {
              pushToken: info.pushToken,
              deviceLibraryIdentifier: info.deviceLibraryIdentifier,
              serialNumber: info.serialNumber,
              passTypeIdentifier: passTypeIdentifier,
              dateUpdated: new Date().toISOString(),
              // Zachováme existující data pokud existují
              ...((await userEmailRef.get()).exists ? {} : { dateCreated: new Date().toISOString() })
            };
            
            await userEmailRef.set(firestoreData, { merge: true });
            console.log(`✅ GET WEBHOOK: Úspěšně zapsáno do Firestore users/${card.fullId}/emails/${info.serialNumber}`);
            console.log(`📋 GET WEBHOOK: Zapsaná data:`, JSON.stringify(firestoreData, null, 2));
            
          } catch (firestoreError) {
            console.error(`❌ GET WEBHOOK: Chyba při zápisu do Firestore:`, firestoreError);
          }
        }
      }

      if (updatedSerialNumbers.length > 0) {
        console.log(`Found ${updatedSerialNumbers.length} updated passes for device ${deviceLibraryIdentifier}.`);
        console.log(`📋 DEBUG: Updated serial numbers: ${JSON.stringify(updatedSerialNumbers)}`);
        console.log(`📅 DEBUG: Latest timestamp: ${latestTimestamp}, ISO date: ${new Date(latestTimestamp).toISOString()}`);
        
        // Formátujeme lastUpdated podle RFC 7232 pro kompatibilitu s Apple Wallet
        const response = {
          lastUpdated: new Date(latestTimestamp).toISOString(),
          serialNumbers: updatedSerialNumbers,
        };
        return res.status(200).json(response);
      } else {
        console.log(`No new updates for device ${deviceLibraryIdentifier} since ${lastUpdated}.`);
        return res.status(204).send();
      }

    } catch (error) {
      console.error(`Error getting updates for device ${deviceLibraryIdentifier}:`, error);
      return res.status(500).send('Failed to get updates.');
    }
  }

  // 4. Zpracování odregistrace zařízení
  if (req.method === 'DELETE') {
    console.log(`Device ${deviceLibraryIdentifier} unregistered for card ${serialNumber}. Logic to be implemented.`);
    // V budoucnu zde bude logika pro odstranění tokenu z Datastore
    return res.status(200).send('Device unregistered.');
  }

  // 5. Zpracování žádosti o nejnovější verzi passu - NOVÁ LOGIKA
  if (req.method === 'GET' && req.path.includes('/passes/')) {
    try {
      console.log(`🔄 Request for latest version of pass ${serialNumber}.`);

      // Normalizace serialNumber - odstranění prefixu "ID=" pokud existuje
      let normalizedSerialNumber = serialNumber;
      if (normalizedSerialNumber && normalizedSerialNumber.startsWith('ID=')) {
        normalizedSerialNumber = normalizedSerialNumber.substring(3);
        console.log(`🔍 WEBHOOK: Normalizován serialNumber z ${serialNumber} na ${normalizedSerialNumber}`);
        serialNumber = normalizedSerialNumber;
      }
      
      console.log(`📧 NOVÁ LOGIKA: serialNumber je nyní email uživatele: ${serialNumber}`);

      // NOVÁ LOGIKA: Najít kartu podle emailu a získat fullId pro Firestore
      let card = null;
      let fullId = null;
      
      // Krok 1: Najít kartu podle emailu (serialNumber) v Datastore
      console.log(`🔍 WEBHOOK: Hledám kartu podle emailu: ${serialNumber}`);
      
      if (serialNumber.includes('@')) {
        // Hledáme podle emailu
        try {
          const emailQuery = datastore.createQuery('cards')
            .filter('email', '=', serialNumber)
            .limit(1);
          
          const [emailResults] = await datastore.runQuery(emailQuery);
          
          if (emailResults.length > 0) {
            card = emailResults[0];
            fullId = card.fullId || card.wixid;
            console.log(`✅ WEBHOOK: Nalezena karta podle emailu, fullId: ${fullId}`);
          } else {
            console.log(`⚠️ WEBHOOK: Karta podle emailu nenalezena, zkouším fallback`);
          }
        } catch (err) {
          console.error(`❌ Error looking up card by email: ${err.message}`);
        }
      }
      
      // Fallback: Hledání podle starých identifikátorů (pro kompatibilitu)
      if (!card) {
        console.log(`🔍 WEBHOOK: Fallback - hledám podle starých identifikátorů`);
        
        try {
          // Zkusíme userId
          const userIdQuery = datastore.createQuery('cards')
            .filter('userId', '=', serialNumber);
          const [userIdResults] = await datastore.runQuery(userIdQuery);
          
          if (userIdResults.length > 0) {
            card = userIdResults[0];
            fullId = card.fullId || card.wixid;
            console.log(`✅ WEBHOOK: Fallback - nalezena karta podle userId, fullId: ${fullId}`);
          }
        } catch (err) {
          console.error(`❌ Error in fallback userId lookup: ${err.message}`);
        }
      }
      
      // Fallback: anonymousId
      if (!card) {
        try {
          const anonymousIdQuery = datastore.createQuery('cards')
            .filter('anonymousId', '=', serialNumber);
          const [anonymousIdResults] = await datastore.runQuery(anonymousIdQuery);
          
          if (anonymousIdResults.length > 0) {
            card = anonymousIdResults[0];
            fullId = card.fullId || card.wixid;
            console.log(`✅ WEBHOOK: Fallback - nalezena karta podle anonymousId, fullId: ${fullId}`);
          }
        } catch (err) {
          console.error(`❌ Error in fallback anonymousId lookup: ${err.message}`);
        }
      }
      
      // Kontrola, že máme kartu a fullId
      if (!card || !fullId) {
        console.error(`❌ WEBHOOK: Karta nebo fullId nenalezeno pro serialNumber: ${serialNumber}`);
        return res.status(404).json({ error: 'Pass not found' });
      }
      
      console.log(`✅ WEBHOOK: Karta nalezena, fullId: ${fullId}, serialNumber: ${serialNumber}`);
      
      // NOVÁ LOGIKA: Načíst data z Firestore users/{fullId}/emails/{serialNumber}
      console.log(`📦 WEBHOOK: Načítám data z Firestore: users/${fullId}/emails/${serialNumber}`);
      
      let passUserData = null;
      try {
        const userDocRef = firestoreDb.doc(`users/${fullId}/emails/${serialNumber}`);
        const userDoc = await userDocRef.get();
        
        if (userDoc.exists) {
          passUserData = userDoc.data();
          console.log(`✅ WEBHOOK: Data z Firestore načtena úspěšně`);
          console.log(`📋 WEBHOOK: UserData:`, JSON.stringify(passUserData, null, 2));
        } else {
          console.log(`⚠️ WEBHOOK: Dokument v Firestore neexistuje: users/${fullId}/emails/${serialNumber}`);
          // Fallback na data z karty
          passUserData = card;
        }
      } catch (err) {
        console.error(`❌ WEBHOOK: Chyba při načítání z Firestore: ${err.message}`);
        // Fallback na data z karty
        passUserData = card;
      }
      
      // 4. Hledání přímo v kolekci users
      if (!card) {
        try {
          // Zkusíme najít přímo v users kolekci
          const userQuery = datastore.createQuery('users')
            .filter('__key__', '=', datastore.key(['users', serialNumber]));
          const [userResults] = await datastore.runQuery(userQuery);
          
          console.log(`🔍 DEBUG: Found ${userResults.length} users by key: ${serialNumber}`);
          
          if (userResults.length > 0) {
            // Vytvoříme virtuální kartu z uživatele
            const user = userResults[0];
            card = {
              userId: serialNumber,
              dateUpdated: user.dateUpdated || new Date().toISOString(),
              // Přidáme další potřebné vlastnosti z uživatele
              stampCount: user.stampCount,
              level1_status: user.level1_status,
              level2_status: user.level2_status,
              level3_status: user.level3_status,
              // Doplnit další potřebné vlastnosti pro generování passu
              cafeId: user.cafeId || 'original',
              email: user.email,
              wixid: user.wixid || serialNumber,
              anonymousId: user.anonymousId || serialNumber,
              fullId: user.fullId || user.cafeId || 'original'
            };
            console.log(`🔍 DEBUG: Created virtual card from user: ${serialNumber}`);
          }
        } catch (err) {
          console.error(`❌ Error looking up user: ${err.message}`);
        }
      }
      
      if (!card) {
        console.error(`❌ Card ${serialNumber} not found for pass generation after all lookup attempts.`);
        return res.status(404).send('Card not found.');
      }

      console.log(`📋 Found card metadata (selected fields):`, JSON.stringify({
        wixid: card.wixid,
        email: card.email,
        cardType: card.cardType,
        anonymousId: card.anonymousId,
        userId: card.userId,
        cafeId: card.cafeId,
        fullId: card.fullId
      }, null, 2));
      
      console.log(`📋 Complete card object:`, JSON.stringify(card, null, 2));

      // Inicializace sekundární aplikace pro vernostkarty-db pro deployment
      const serviceAccountDb = require('./certificates/vernostkarty-db-service-account.json');
      let dbApp;
      try {
        dbApp = admin.app('dbAdmin');
      } catch (e) {
        dbApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountDb)
        }, 'dbAdmin');
      }
      const firestoreDb = dbApp.firestore();
      
      // Načtení aktuálních dat z Firestore (vernostkarty-db)
      // ZJEDNODUŠENÁ LOGIKA: Přímo jdeme na users/{fullId}/emails/{serialNumber}
      let userData = null;
      const userEmail = serialNumber; // serialNumber je email
      
      console.log(`📋 Direct loading user data from users/${fullId}/emails/${userEmail}`);
      
      try {
        const userDocRef = firestoreDb.collection('users').doc(fullId).collection('emails').doc(userEmail);
        const userDoc = await userDocRef.get();
        
        if (userDoc.exists) {
          userData = userDoc.data();
          console.log(`✅ Successfully loaded user data for ${userEmail}`);
          console.log('📋 Current user data from Firestore:', JSON.stringify(userData, null, 2));
        } else {
          console.log(`⚠️ User document does not exist: users/${fullId}/emails/${userEmail}`);
          // Fallback - pokud přímý přístup selže, můžeme zkusit starší logiku
          console.log('🔄 Fallback: trying to find user via usersid collection...');
          
          const shortCafeId = fullId.slice(-12);
          const usersIdCollection = firestoreDb.collection('usersid').doc(shortCafeId).collection('users');
          const usersIdSnapshot = await usersIdCollection.get();
          
          if (!usersIdSnapshot.empty) {
            const userIdDoc = usersIdSnapshot.docs.find(doc => {
              const userData = doc.data();
              return userData.email === userEmail;
            });
            
            if (userIdDoc) {
              console.log(`✅ Found user via fallback method`);
              // Zkusíme znovu načíst data
              const fallbackUserDoc = await userDocRef.get();
              if (fallbackUserDoc.exists) {
                userData = fallbackUserDoc.data();
              }
            }
          }
        }
      } catch (firestoreError) {
        console.error('❌ ERROR loading user data from Firestore:', firestoreError);
        console.error('❌ Error details:', firestoreError.message, firestoreError.stack);
      }
      
      if (!userData) {
        console.error(`❌ User document not found for fullId: ${fullId}, email: ${userEmail}`);
        return res.status(404).send('User data not found.');
      }
      
      // Sestavení správného QR kódu - použijeme fullId a userEmail
      const shortCafeId = fullId.slice(-12);
      // Pro QR kód potřebujeme anonymousId - můžeme použít userEmail nebo jiný identifikátor
      const qrText = `https://onlineloyaltycards.com/editor/?id=${shortCafeId}/${userEmail}`;
      console.log(`📋 Generated QR code: ${qrText}`);
      
      console.log('📋 Current user data from Firestore:', JSON.stringify(userData, null, 2));
      
      // Aplikace logiky mapování polí podle cardType (stejně jako CAFEHTML)
      const cardType = userData.cardType || card.cardType || 'card-body';
      console.log(`🔍 Processing card type: ${cardType}`);
      
      // Vytvoření payload podle logiky CAFEHTML - POUŽÍVÁ POUZE AKTUÁLNÍ DATA Z FIRESTORE!
      const payload = {
        primaryLabel: "VĚRNOSTNÍ KARTA",
        primaryValue: userData.businessName || '', // OPRAVENO: pouze userData, ne card!
        discountLabel: '',
        discountValue: '',
        headerCenterLabel: '',
        headerCenterValue: '',
        auxiliary: [
          { label: userData.name || '', value: userData.surname || '' }, // Jméno uživatele
          { label: '', value: '' } // Bude nastaveno podle cardType
        ]
      };
      
      console.log('🆕 Generated payload with CURRENT Firestore data:', JSON.stringify(payload, null, 2));
      
      // Mapování polí podle cardType (logika z CAFEHTML)
      switch (cardType) {
        case 'card-body':
          payload.discountLabel = userData.bodyLabel1Input || 'BODY';
          payload.discountValue = userData.bodyValInput || '0';
          payload.auxiliary[1] = {
            label: userData.bodyBottomTopInput || '',
            value: userData.bodyBottomBotInput || ''
          };
          break;
          
        case 'card-razitka':
          payload.auxiliary[1] = {
            label: 'RAZÍTKA',
            value: `${userData.stampValInput || '0'} / ${userData.stampCount || '0'}`
          };
          break;
          
        case 'card-procentni':
          payload.discountLabel = 'SLEVA';
          payload.discountValue = `${userData.level1_sleva || '0'} %`;
          payload.headerCenterLabel = 'STATUS';
          payload.headerCenterValue = userData.level1_status || 'VIP';
          payload.auxiliary[1] = {
            label: 'UŠETŘENO',
            value: '' // Prázdná hodnota podle CAFEHTML
          };
          break;
          
        default:
          console.warn(`⚠️ Unknown cardType: ${cardType}, using default mapping`);
          break;
      }
      
      console.log('📋 Generated payload:', JSON.stringify(payload, null, 2));
      
      // KROK 1: Načtení cest k certifikátům z 'cardzapier/{fullId}'
      if (!fullId) {
        throw new Error('fullId is missing, cannot fetch certificate paths.');
      }
      console.log(`⚙️ Fetching certificate paths from 'cardzapier/${fullId}'...`);
      const zapierDocRef = firestoreDb.collection('cardzapier').doc(fullId);
      const zapierDoc = await zapierDocRef.get();

      if (!zapierDoc.exists) {
        throw new Error(`Certificate paths not found in 'cardzapier/${fullId}'`);
      }
      const zapierData = zapierDoc.data();
      const pemPath = zapierData.pempath;
      const keyPath = zapierData.keypath;
      const dynamicPassTypeIdentifier = zapierData.passTypeIdentifier;

      // VERIFIKACE: Logování cest načtených z databáze
      console.log(`VERIFICATION: Loaded pempath from cardzapier: ${pemPath}`);
      console.log(`VERIFICATION: Loaded keypath from cardzapier: ${keyPath}`);
      console.log(`VERIFICATION: Loaded passTypeIdentifier from cardzapier: ${dynamicPassTypeIdentifier}`);

      if (!pemPath || !keyPath) {
        throw new Error(`pempath or keypath is missing in 'cardzapier/${fullId}'`);
      }
      if (!dynamicPassTypeIdentifier) {
        throw new Error(`passTypeIdentifier is missing in 'cardzapier/${fullId}'`);
      }

      // KROK 2: Dynamické načtení certifikátů pomocí nové helper funkce
      console.log(`🔐 Loading certificates from GCS paths: PEM='${pemPath}', KEY='${keyPath}'`);
      const certificates = await certificateHelper.getAppleCertificateBuffers(pemPath, keyPath);
      console.log('✅ Certificates loaded successfully.');
      
      // DEBUG: Zobrazíme, co přesně vrací funkce getAppleCertificateBuffers
      console.log('🔍 DEBUG: certificates object:', {
        hasWwdr: !!certificates.wwdr,
        hasPem: !!certificates.pem,
        hasKey: !!certificates.key,
        wwdrLength: certificates.wwdr ? certificates.wwdr.length : 'undefined',
        pemLength: certificates.pem ? certificates.pem.length : 'undefined',
        keyLength: certificates.key ? certificates.key.length : 'undefined',
        allKeys: Object.keys(certificates)
      });

      // KROK 3: Generování PKPass s dynamicky načtenými certifikáty
      console.log("🎫 Generating PKPass directly in webhook...");
      const pass = await PKPass.from({
          model: './myFirstModel.pass',
          certificates: {
            wwdr: certificates.wwdr,
            signerCert: certificates.pem,
            signerKey: certificates.key
            // signerKeyPassphrase vynechán - klíč nemá heslo
          }
        },
        {
          authenticationToken: "a7d8g9h2j4k5l6m7n8b9v0c1x2z3",
          webServiceURL: "https://applewalletwebhook-2sun3frzja-uc.a.run.app",
          serialNumber: serialNumber, // Použij skutečný serialNumber (email)
          description: "Aktualizovaná věrnostní karta",
          foregroundColor: userData.textColor || '#000000',
          backgroundColor: userData.cardColor || '#ffffff',
          labelColor: userData.textColor || '#000000',
          passTypeIdentifier: dynamicPassTypeIdentifier  // Dynamicky načten z Firestore
        });
      
      console.log('📋 PKPass object created successfully');
      console.log('🔍 DEBUG: Webhook stopped here after PKPass creation.');
      
      // Přidání obrázků (logoURL, stripImageURL) - stejně jako v createPass
      console.log('🖼️ Adding images from userData...');
      
      if (userData.logoURL) {
        try {
          console.log("📥 Downloading logo from:", userData.logoURL);
          const respLogo = await axios.get(userData.logoURL, { responseType: 'arraybuffer' });
          const bufferLogo = Buffer.from(respLogo.data);
          pass.addBuffer("logo.png", bufferLogo);
          pass.addBuffer("logo@2x.png", bufferLogo);
          console.log("✅ Logo added successfully");
        } catch (err) {
          console.log("⚠️ Logo download failed:", err.message);
        }
      }
      
      if (userData.stripImageURL) {
        try {
          console.log("📥 Downloading strip image from:", userData.stripImageURL);
          const respStrip = await axios.get(userData.stripImageURL, { responseType: 'arraybuffer' });
          const bufferStrip = Buffer.from(respStrip.data);
          pass.addBuffer("strip.png", bufferStrip);
          pass.addBuffer("strip@2x.png", bufferStrip);
          console.log("✅ Strip image added successfully");
        } catch (err) {
          console.log("⚠️ Strip image download failed:", err.message);
        }
      }
      
      if (userData.thumbnailURL) {
        try {
          console.log("📥 Downloading thumbnail from:", userData.thumbnailURL);
          const respThumbnail = await axios.get(userData.thumbnailURL, { responseType: 'arraybuffer' });
          const bufferThumbnail = Buffer.from(respThumbnail.data);
          pass.addBuffer("thumbnail.png", bufferThumbnail);
          pass.addBuffer("thumbnail@2x.png", bufferThumbnail);
          console.log("✅ Thumbnail added successfully");
        } catch (err) {
          console.log("⚠️ Thumbnail download failed:", err.message);
        }
      }
      
      // Přidání polí podle vygenerovaného payload
      console.log('📝 Adding fields from generated payload...');
      
      // Header fields (vpravo nahoře - discount, uprostřed - status)
      if (payload.discountLabel || payload.discountValue) {
        pass.headerFields.push({
          key: "discountLevel",
          label: payload.discountLabel || "",
          value: payload.discountValue || ""
        });
        console.log(`✅ Added headerField (discount): ${payload.discountValue}`);
      }
      
      if (payload.headerCenterLabel || payload.headerCenterValue) {
        pass.headerFields.push({
          key: "center",
          label: payload.headerCenterLabel || "",
          value: payload.headerCenterValue || ""
        });
        console.log(`✅ Added headerField (center): ${payload.headerCenterValue}`);
      }
      
      // Auxiliary fields (pole pod pruhem)
      if (Array.isArray(payload.auxiliary)) {
        console.log('Processing auxiliary fields:', JSON.stringify(payload.auxiliary));
        payload.auxiliary.forEach((aux, idx) => {
          pass.auxiliaryFields.push({
            key: "auxiliary" + idx,
            label: aux.label || "",
            value: aux.value || ""
          });
          console.log(`✅ Added auxiliaryField ${idx}: ${aux.label} = ${aux.value}`);
        });
      }
      
      // QR kód
      if (qrText) {
        console.log('🔲 Adding QR code:', qrText);
        pass.setBarcodes({
          message: qrText,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1"
        });
        console.log('✅ QR code added successfully');
      }
      
      // Odstranění headerFields pro storeCard (Apple je zakazuje)
      console.log('🔧 Removing forbidden headerFields for storeCard...');
      if (pass.props && pass.props.storeCard && pass.props.storeCard.headerFields) {
        delete pass.props.storeCard.headerFields;
        console.log('✅ headerFields removed from storeCard');
      }
      
      // NOVÁ LOGIKA: Zápis do Firestore při stažení passu
      // Pokud máme deviceLibraryIdentifier z userdeviceinfo, zapíšeme pushToken a deviceLibraryIdentifier
      try {
        console.log(`📦 PASS DOWNLOAD: Hledám deviceLibraryIdentifier pro serialNumber: ${serialNumber}`);
        
        // Najdeme deviceLibraryIdentifier z userdeviceinfo podle serialNumber
        const deviceQuery = datastore.createQuery('userdeviceinfo')
          .filter('serialNumber', '=', serialNumber)
          .limit(1);
        
        const [deviceResults] = await datastore.runQuery(deviceQuery);
        
        if (deviceResults.length > 0) {
          const deviceInfo = deviceResults[0];
          console.log(`📦 PASS DOWNLOAD: Nalezen deviceLibraryIdentifier: ${deviceInfo.deviceLibraryIdentifier}`);
          console.log(`📦 PASS DOWNLOAD: Zapisuji do Firestore users/${fullId}/emails/${serialNumber}`);
          
          const userEmailRef = firestoreDb.doc(`users/${fullId}/emails/${serialNumber}`);
          
          const firestoreData = {
            pushToken: deviceInfo.pushToken,
            deviceLibraryIdentifier: deviceInfo.deviceLibraryIdentifier,
            serialNumber: serialNumber,
            passTypeIdentifier: passTypeIdentifier,
            dateUpdated: new Date().toISOString(),
            // Zachováme existující data pokud existují
            ...((await userEmailRef.get()).exists ? {} : { dateCreated: new Date().toISOString() })
          };
          
          await userEmailRef.set(firestoreData, { merge: true });
          console.log(`✅ PASS DOWNLOAD: Úspěšně zapsáno do Firestore users/${fullId}/emails/${serialNumber}`);
          console.log(`📋 PASS DOWNLOAD: Zapsaná data:`, JSON.stringify(firestoreData, null, 2));
          
        } else {
          console.log(`⚠️ PASS DOWNLOAD: Nenalezen deviceLibraryIdentifier pro serialNumber: ${serialNumber}`);
        }
        
      } catch (firestoreError) {
        console.error(`❌ PASS DOWNLOAD: Chyba při zápisu do Firestore:`, firestoreError);
      }

      // Generování finálního bufferu
      console.log('🔄 Generating final pass buffer...');
      const passBuffer = await pass.getAsBuffer();
      console.log(`✅ Pass generated directly, size: ${passBuffer.length} bytes`);
      
      console.log(`✅ Pass generated successfully, size: ${passBuffer.length} bytes`);
      
      // Odeslání odpovědi
      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', 'attachment; filename="pass.pkpass"');
      return res.status(200).send(passBuffer);

    } catch (error) {
      console.error(`❌ Failed to generate updated pass for ${serialNumber}:`, error);
      return res.status(500).send('Failed to generate pass.');
    }
  }

  // Ostatní požadavky
  console.log("Unhandled request type. Path:", req.path);
  res.status(200).send('Request received.');
});
