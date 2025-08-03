// appleWalletWebhook.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require('fs');
const axios = require('axios');

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
const { PKPass } = require('passkit-generator');
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

      console.log(`🔍 WEBHOOK: Fetching card with serial number: ${serialNumber}`);
      const cardKey = datastore.key(['cards', datastore.int(serialNumber)]);
      console.log(`🔍 WEBHOOK: Datastore key created:`, cardKey);
      const [card] = await datastore.get(cardKey);

      if (!card) {
        console.error(`❌ WEBHOOK: Card with serial number ${serialNumber} not found.`);
        return res.status(404).send('Card not found.');
      }
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

      console.log("🔍 WEBHOOK: Mapování identifikátorů z karty:");
      console.log("  - card.userId:", card.userId);
      console.log("  - card.anonymousId:", card.anonymousId);
      console.log("  - card.cafeId:", card.cafeId);
      console.log("  - card.fullId:", card.fullId);
      console.log("  - card.wixid:", card.wixid);
      console.log("🔍 WEBHOOK: Finální mapované hodnoty:");
      console.log("  - userId:", userId);
      console.log("  - cafeId:", cafeId);
      console.log("  - fullId:", fullId);
      console.log("  - wixid:", wixid);
      console.log("  - anonymousId:", anonymousId);

      // Vytvoření nového záznamu v kolekci 'userdeviceinfo'
      const deviceInfoKey = datastore.key(['userdeviceinfo', deviceLibraryIdentifier]);
      const deviceInfoData = {
        deviceLibraryIdentifier,
        pushToken,
        serialNumber,
        userId,
        cafeId,
        fullId,
        wixid,
        anonymousId,
        timestamp: new Date().toISOString(),
      };
      console.log("📋 WEBHOOK: Prepared deviceInfoData for Datastore:", JSON.stringify(deviceInfoData, null, 2));
      console.log("🔍 WEBHOOK: Kontrola před zápisem - co skutecně ukládáme:");
      console.log("  - deviceLibraryIdentifier:", deviceInfoData.deviceLibraryIdentifier);
      console.log("  - pushToken:", deviceInfoData.pushToken);
      console.log("  - serialNumber:", deviceInfoData.serialNumber);
      console.log("  - userId:", deviceInfoData.userId, "(typ:", typeof deviceInfoData.userId, ")");
      console.log("  - cafeId:", deviceInfoData.cafeId, "(typ:", typeof deviceInfoData.cafeId, ")");
      console.log("  - fullId:", deviceInfoData.fullId, "(typ:", typeof deviceInfoData.fullId, ")");
      console.log("  - wixid:", deviceInfoData.wixid, "(typ:", typeof deviceInfoData.wixid, ")");
      console.log("  - anonymousId:", deviceInfoData.anonymousId, "(typ:", typeof deviceInfoData.anonymousId, ")");

      // Krok 1: Zápis do Datastore (projekt vernostkarty)
      try {
        await datastore.save({ key: deviceInfoKey, data: deviceInfoData });
        console.log(`✅ WEBHOOK: Successfully saved device info for ${deviceLibraryIdentifier} to Datastore.`);
        console.log(`✅ WEBHOOK: Datastore key used:`, deviceInfoKey);
      } catch (datastoreError) {
        console.error(`❌ WEBHOOK: Failed to save to Datastore:`, datastoreError);
        throw datastoreError;
      }

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
        const { userId, cafeId, fullId } = deviceInfoData;
        if (!userId || !cafeId) {
          throw new Error('Missing userId or cafeId for advanced save.');
        }

        // 1. Získání e-mailu (používáme shortCafeId)
        const shortCafeId = cafeId.slice(-12);
        const emailDocPath = `usersid/${shortCafeId}/users/${userId}`;
        const emailDoc = await firestoreDb.doc(emailDocPath).get();

        if (!emailDoc.exists || !emailDoc.data().email) {
          throw new Error(`Email not found for user ${userId} at ${emailDocPath}`);
        }
        const userEmail = emailDoc.data().email;
        console.log(`Found email ${userEmail} for user ${userId}`);

        // 2. Zápis dat o zařízení k uživateli (používáme wixid pro users kolekci - stejně jako editor)
        const wixidForUsers = wixid || fullId || cafeId; // fallback chain
        console.log(`Using wixid: ${wixidForUsers} for users collection (same as editor)`);
        const finalDocRef = firestoreDb.collection('users').doc(wixidForUsers).collection('emails').doc(userEmail);
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

  // 3. Zjištění, které karty se změnily (po push notifikaci)
  if (req.method === 'GET' && req.path.includes('/registrations/')) {
    const passTypeIdentifier = pathParts[5];
    const lastUpdated = req.headers['if-modified-since'];

    console.log(`Device ${deviceLibraryIdentifier} asks for updates for ${passTypeIdentifier} since ${lastUpdated}.`);

    try {
      const query = datastore.createQuery('userdeviceinfo')
        .filter('deviceLibraryIdentifier', '=', deviceLibraryIdentifier);

      const [deviceInfos] = await datastore.runQuery(query);

      if (deviceInfos.length === 0) {
        console.log(`No registrations found for device ${deviceLibraryIdentifier}.`);
        return res.status(204).send();
      }

      const updatedSerialNumbers = [];
      let latestTimestamp = new Date(lastUpdated || 0).getTime();

      const lastUpdatedTimestamp = lastUpdated ? new Date(lastUpdated).getTime() : 0;

      // Vytvoříme pole klíčů pro všechny karty registrované na tomto zařízení
      const cardKeys = deviceInfos.map(info => datastore.key(['cards', datastore.int(info.serialNumber)]));

      // Načteme všechny karty najednou pro efektivitu
      const [cards] = await datastore.get(cardKeys);

      // Vytvoříme mapu karet pro snadné vyhledávání
      const cardsMap = new Map(cards.map(card => [card[datastore.KEY].id, card]));

      for (const info of deviceInfos) {
        const card = cardsMap.get(info.serialNumber);

        // Pokud karta existuje a má pole dateUpdated
        if (card && card.dateUpdated) {
          const cardModifiedTimestamp = new Date(card.dateUpdated).getTime();

          // Porovnáme čas modifikace karty s časem posledního dotazu od zařízení
          if (cardModifiedTimestamp > lastUpdatedTimestamp) {
            updatedSerialNumbers.push(info.serialNumber);
            if (cardModifiedTimestamp > latestTimestamp) {
              latestTimestamp = cardModifiedTimestamp;
            }
          }
        }
      }

      if (updatedSerialNumbers.length > 0) {
        console.log(`Found ${updatedSerialNumbers.length} updated passes for device ${deviceLibraryIdentifier}.`);
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

  // 5. Zpracování žádosti o nejnovější verzi passu
  if (req.method === 'GET' && req.path.includes('/passes/')) {
    try {
      console.log(`🔄 Request for latest version of pass ${serialNumber}.`);

      // Načtení základních dat karty z Datastore pro identifikátory
      const cardKey = datastore.key(['cards', datastore.int(serialNumber)]);
      const [card] = await datastore.get(cardKey);

      if (!card) {
        console.error(`❌ Card ${serialNumber} not found for pass generation.`);
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

      // Inicializace sekundární aplikace pro vernostkarty-db
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
      let userEmail = card.email;
      let userData = null;
      let anonymousId = null;
      
      // Najdeme anonymousId a email pomocí usersid/{posledních12charakteru}/users/{anonymousId}
      const shortCafeId = card.wixid ? card.wixid.slice(-12) : card.cafeId;
      console.log(`🔍 Looking for user data in usersid/${shortCafeId}/users/`);
      
      // Najdeme všechny uživatele v kolekci a vypíšeme je
      const usersIdCollection = firestoreDb.collection('usersid').doc(shortCafeId).collection('users');
      const usersIdSnapshot = await usersIdCollection.get();
      
      console.log(`🔍 Found ${usersIdSnapshot.docs.length} users in usersid/${shortCafeId}/users/`);
      usersIdSnapshot.docs.forEach((doc, index) => {
        console.log(`🔍 User ${index}: ID=${doc.id}, data=${JSON.stringify(doc.data())}`);
      });
      
      if (!usersIdSnapshot.empty) {
        // Zkusíme najít správný anonymousId (28mg9fl4plus000000000000000000000000000)
        let userIdDoc = usersIdSnapshot.docs.find(doc => doc.id === '28mg9fl4plus000000000000000000000000000');
        if (!userIdDoc) {
          console.log('⚠️ Správný anonymousId nenalezen, použiji první dostupný');
          userIdDoc = usersIdSnapshot.docs[0];
        }
        
        anonymousId = userIdDoc.id;
        const userIdData = userIdDoc.data();
        userEmail = userIdData.email;
        
        console.log(`🔍 Found anonymousId: ${anonymousId}, email: ${userEmail}`);
        
        if (userEmail) {
          try {
            // Načteme data z users/{celé wixid}/emails/{email z usersid}
            console.log(`📋 Loading user data from users/${card.wixid}/emails/${userEmail}`);
            const userDocRef = firestoreDb.collection('users').doc(card.wixid).collection('emails').doc(userEmail);
            console.log('🔍 About to call userDocRef.get()...');
            const userDoc = await userDocRef.get();
            console.log('🔍 userDocRef.get() completed, checking if exists...');
            
            if (userDoc.exists) {
              userData = userDoc.data();
              console.log(`✅ Successfully loaded user data for ${userEmail}`);
              console.log('📋 Current user data from Firestore:', JSON.stringify(userData, null, 2));
            } else {
              console.log(`⚠️ User document does not exist: users/${card.wixid}/emails/${userEmail}`);
            }
          } catch (firestoreError) {
            console.error('❌ ERROR loading user data from Firestore:', firestoreError);
            console.error('❌ Error details:', firestoreError.message, firestoreError.stack);
          }
        }
      }
      
      if (!userData || !anonymousId) {
        console.error(`❌ User document not found for wixid: ${card.wixid}, shortCafeId: ${shortCafeId}`);
        return res.status(404).send('User data not found.');
      }
      
      // Sestavení správného QR kódu
      const qrText = `https://onlineloyaltycards.com/editor/?id=${shortCafeId}/${anonymousId}`;
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
      
      // Generování PKPass přímo v webhook (bez volání createPass endpointu)
      console.log("🎫 Generating PKPass directly in webhook...");
      
      // Definice cest k certifikátům (podle skutečných souborů)
      const certPaths = {
        wwdr: "./certificates/AppleWWDRCAG4.pem",
        signerCert: "./certificates/passCert.pem",
        signerKey: "./certificates/privatekey.key"
      };
      
      console.log('📋 Certificate paths:', JSON.stringify(certPaths, null, 2));
      
      // Vytvoření PKPass objektu (stejně jako v createPass)
      const pass = await PKPass.from({
          model: './myFirstModel.pass',
          certificates: {
            wwdr: fs.readFileSync(certPaths.wwdr),
            signerCert: fs.readFileSync(certPaths.signerCert),
            signerKey: fs.readFileSync(certPaths.signerKey),
            signerKeyPassphrase: "KEcTO078"
          }
        },
        {
          authenticationToken: "a7d8g9h2j4k5l6m7n8b9v0c1x2z3",
          webServiceURL: "https://applewalletwebhook-2sun3frzja-uc.a.run.app",
          serialNumber: String(serialNumber),
          description: "Aktualizovaná věrnostní karta",
          foregroundColor: userData.textColor || '#000000',
          backgroundColor: userData.cardColor || '#ffffff',
          labelColor: userData.textColor || '#000000'
        });
      
      console.log('📋 PKPass object created successfully');
      
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
