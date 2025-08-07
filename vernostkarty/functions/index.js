// index.js - KOMPLETNĚ OPRAVENÁ VERZE S DETAILNÍM LOGOVÁNÍM

const functions = require("firebase-functions");
const { PKPass } = require("passkit-generator");
const admin = require("firebase-admin");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const { Datastore } = require('@google-cloud/datastore');
const path = require("path");
const certificateHelper = require('./certificateHelperV2');
const { auditUserDeviceInfo } = require('./auditUserDeviceInfo');
const { detailedAudit } = require('./detailedAudit');
const { cleanupUserDeviceInfo } = require('./cleanupUserDeviceInfo');
const datastore = new Datastore();

// Inicializace Firebase Admin pro deployment
admin.initializeApp({
  credential: admin.credential.cert(require("./certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json")),
  storageBucket: "vernostkarty.appspot.com"
});

const db = admin.firestore();
const storageRef = admin.storage().bucket();

// Pomocná funkce: převod HEX → RGB
function hexToRgb(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? "rgb(" + parseInt(result[1], 16) + ", " + parseInt(result[2], 16) + ", " + parseInt(result[3], 16) + ")"
    : null;
}

// =========================
// Funkce createPass – KOMPLETNĚ OPRAVENÁ S DETAILNÍM LOGOVÁNÍM
// =========================
exports.createPass = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    console.log("🚀 createPass started");
    
    if (req.method !== 'POST') {
      console.log("❌ Invalid method:", req.method);
      return res.status(405).send('Method Not Allowed');
    }

    try {
      // 1) DETAILNÍ LOGOVÁNÍ PŘÍCHOZÍHO PAYLOADU
      console.log("📥 Raw request body:", JSON.stringify(req.body, null, 2));
      
      const body = req.body;
      
      // Validace povinných polí podle CAFEHTML.txt struktury
      const requiredFields = ['cardType', 'cafeId', 'userId'];
      for (const field of requiredFields) {
        if (!body[field]) {
          console.log(`❌ Missing required field: ${field}`);
          return res.status(400).json({
            result: "FAILED",
            explanation: `Missing required field: ${field}`
          });
        }
      }
      
      console.log("✅ Required fields validation passed");
      console.log("📋 Card type:", body.cardType);
      console.log("🏪 Cafe ID:", body.cafeId);
      console.log("👤 User ID:", body.userId);
      
      // 2) MAPOVÁNÍ POLÍ Z CAFEHTML.TXT STRUKTURY - ROZŠÍŘENO O VŠECHNY IDENTIFIKÁTORY
      const passData = {
        // Základní identifikátory - přímé mapování z CAFEHTML.txt
        cardType: body.cardType,
        cafeId: body.cafeId,
        fullId: body.fullId,
        wixid: body.wixid,
        userId: body.userId,
        anonymousId: body.anonymousId,
        serialNumber: body.email, // NOVÉ: Email jako serialNumber
        email: body.email, // NOVÉ: Email uživatele
        qrText: body.qrText,
        
        // Design
        cardColor: body.cardColor || '#ffffff',
        textColor: body.textColor || '#000000',
        logoURL: body.logoURL || '',
        stripImageURL: body.stripImageURL || '',
        thumbnailURL: body.thumbnailURL || '',
        
        // Pole pro pass
        primaryLabel: body.primaryLabel || 'VĚRNOSTNÍ KARTA',
        primaryValue: body.primaryValue || '',
        discountLabel: body.discountLabel || '',
        discountValue: body.discountValue || '',
        headerCenterLabel: body.headerCenterLabel || '',
        headerCenterValue: body.headerCenterValue || '',
        
        // Auxiliary pole (z CAFEHTML.txt)
        auxiliary: body.auxiliary || []
      };
      
      console.log("🔄 Mapped pass data:", JSON.stringify(passData, null, 2));
      console.log("🔍 CRITICAL: RAW BODY z CAFEHTML.txt:", JSON.stringify(body, null, 2));
      console.log("🔍 CRITICAL: Všechny identifikátory z body:");
      console.log("  - cafeId:", body.cafeId, "(typ:", typeof body.cafeId, ")");
      console.log("  - fullId:", body.fullId, "(typ:", typeof body.fullId, ")");
      console.log("  - serialNumber:", body.serialNumber, "(typ:", typeof body.serialNumber, ")");
      console.log("  - email:", body.email, "(typ:", typeof body.email, ")");
      console.log("  - wixid:", body.wixid, "(typ:", typeof body.wixid, ")");
      console.log("  - userId:", body.userId, "(typ:", typeof body.userId, ")");
      console.log("  - anonymousId:", body.anonymousId, "(typ:", typeof body.anonymousId, ")");
      console.log("🔍 CRITICAL: Všechny identifikátory v passData:");
      console.log("  - cafeId:", passData.cafeId, "(typ:", typeof passData.cafeId, ")");
      console.log("  - fullId:", passData.fullId, "(typ:", typeof passData.fullId, ")");
      console.log("  - wixid:", passData.wixid, "(typ:", typeof passData.wixid, ")");
      console.log("  - userId:", passData.userId, "(typ:", typeof passData.userId, ")");
      console.log("  - anonymousId:", passData.anonymousId, "(typ:", typeof passData.anonymousId, ")");
      
      // 3) ULOŽENÍ DO DATASTORE
      console.log("💾 Saving to Datastore...");
      const kind = 'cards';
      const cardKey = datastore.key(kind);
      
      const cardData = {
        ...passData,
        passStatus: "creating",
        passDownloadUrl: "",
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString()
      };
      console.log("🔍 CRITICAL: cardData before save:", JSON.stringify(cardData, null, 2));
      
      await datastore.save({ key: cardKey, data: cardData });
      console.log("✅ Saved to Datastore with ID:", cardKey.id);
      
      // 4) KONTROLA ŠABLONY PASS.JSON
      console.log("📄 Checking pass template...");
      const templatePath = "./myFirstModel.pass";
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Pass template not found at: ${templatePath}`);
      }
      console.log("✅ Pass template found");
      
      // 5) DYNAMICKÉ NAČÍTÁNÍ CERTIFIKÁTŮ A PASSTYPEIDENTIFIER Z FIRESTORE
      console.log("VERIFICATION: Checking for certificate paths in request body...");
      console.log(`VERIFICATION: Received pempath from CAFEHTML: ${body.pempath}`);
      console.log(`VERIFICATION: Received keypath from CAFEHTML: ${body.keypath}`);
      console.log(`VERIFICATION: Received passTypeIdentifier from CAFEHTML: ${body.passTypeIdentifier}`);
      
      // Získání fullId pro načtení z Firestore
      const fullId = body.fullId || body.cafeId || body.wixid;
      if (!fullId) {
        console.error('❌ CRITICAL: fullId, cafeId ani wixid nejsou k dispozici v požadavku.');
        throw new Error('Missing fullId/cafeId/wixid in request body');
      }
      
      console.log(`⚙️ Fetching certificate paths and passTypeIdentifier from 'cardzapier/${fullId}'...`);
      
      // Inicializace Firestore pro vernostkarty-db
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
      
      // Načtení dat z Firestore
      const zapierDocRef = firestoreDb.collection('cardzapier').doc(fullId);
      const zapierDoc = await zapierDocRef.get();
      
      if (!zapierDoc.exists) {
        console.error(`❌ CRITICAL: Certificate paths not found in 'cardzapier/${fullId}'`);
        throw new Error(`Certificate paths not found in 'cardzapier/${fullId}'`);
      }
      
      const zapierData = zapierDoc.data();
      const pemPath = zapierData.pempath || body.pempath;
      const keyPath = zapierData.keypath || body.keypath;
      const passTypeIdentifier = zapierData.passTypeIdentifier || body.passTypeIdentifier || 'pass.pass.com.example.vernostkarty';
      
      // VERIFIKACE: Logování cest načtených z databáze
      console.log(`VERIFICATION: Loaded pempath from cardzapier: ${pemPath}`);
      console.log(`VERIFICATION: Loaded keypath from cardzapier: ${keyPath}`);
      console.log(`VERIFICATION: Loaded passTypeIdentifier from cardzapier: ${passTypeIdentifier}`);
      
      console.log(`✅ Using passTypeIdentifier: ${passTypeIdentifier}`);

      if (!pemPath || !keyPath) {
        console.error('❌ CRITICAL: Certificate paths (pempath or keypath) are missing in the request body.');
        // Vracíme status 400 Bad Request, protože klient poslal neúplná data
        return res.status(400).json({ error: 'Certificate paths (pempath or keypath) are missing in the request body.' });
      }
      
      console.log(`🔐 Using final GCS paths for download: PEM='${pemPath}', KEY='${keyPath}'`);

      const certificates = await certificateHelper.getAppleCertificateBuffers(pemPath, keyPath);
      console.log(`✅ Certificate buffers loaded successfully.`);

      // 6) GENEROVÁNÍ PKPASS S DYNAMICKÝMI CERTIFIKÁTY
      console.log("🎫 Generating PKPass...");
      
      const newPass = await PKPass.from({
          model: templatePath,
          certificates: {
            wwdr: certificates.wwdrBuffer,
            signerCert: certificates.signerCert,
            signerKey: certificates.signerKey
          }
        },
        {
          authenticationToken: "a7d8g9h2j4k5l6m7n8b9v0c1x2z3",
          webServiceURL: "https://applewalletwebhook-2sun3frzja-uc.a.run.app",
          serialNumber: passData.serialNumber || passData.email || passData.userId || String(cardKey.id),
          description: "Popis tvého pasu",
          foregroundColor: hexToRgb(passData.textColor || "#000000"),
          labelColor: hexToRgb(passData.textColor || "#000000"),
          backgroundColor: hexToRgb(passData.cardColor || "#FFFFFF"),
          passTypeIdentifier: passTypeIdentifier
        }
      );
      
      console.log("✅ PKPass object created successfully");
      
      // 7) PŘIDÁNÍ OBRÁZKŮ
      console.log("🖼️ Adding images...");
      
      // 6) Přidání loga, stripu a thumbnailu, pokud URL existují (PODLE STARÉHO KÓDU)
      if (passData.logoURL) {
        try {
          console.log("📥 Downloading logo from:", passData.logoURL);
          const respLogo = await axios.get(passData.logoURL, { responseType: 'arraybuffer' });
          const bufferLogo = Buffer.from(respLogo.data, "utf-8");
          newPass.addBuffer("logo.png", bufferLogo);
          newPass.addBuffer("logo@2x.png", bufferLogo);
          console.log("✅ Logo added successfully");
        } catch (err) {
          console.log("⚠️ Logo download failed:", err.message);
        }
      }
      if (passData.stripImageURL) {
        try {
          console.log("📥 Downloading strip image from:", passData.stripImageURL);
          const respStrip = await axios.get(passData.stripImageURL, { responseType: 'arraybuffer' });
          const bufferStrip = Buffer.from(respStrip.data, "utf-8");
          newPass.addBuffer("strip.png", bufferStrip);
          newPass.addBuffer("strip@2x.png", bufferStrip);
          console.log("✅ Strip image added successfully");
        } catch (err) {
          console.log("⚠️ Strip image download failed:", err.message);
        }
      }
      if (passData.thumbnailURL) {
        try {
          console.log("📥 Downloading thumbnail from:", passData.thumbnailURL);
          const respThumbnail = await axios.get(passData.thumbnailURL, { responseType: 'arraybuffer' });
          const bufferThumbnail = Buffer.from(respThumbnail.data, "utf-8");
          newPass.addBuffer("thumbnail.png", bufferThumbnail);
          newPass.addBuffer("thumbnail@2x.png", bufferThumbnail);
          console.log("✅ Thumbnail added successfully");
        } catch (err) {
          console.log("⚠️ Thumbnail download failed:", err.message);
        }
      }
      
      // 8) PŘIDÁNÍ POLÍ - PŘESNÁ KOPIE STARÉHO FUNKČNÍHO INDEX.JS
      console.log("📝 Adding pass fields using EXACT old logic...");
      
      // 7) Přidání primary, header, secondary a auxiliary polí (PODLE STARÉHO KÓDU)
      // POZNÁMKA: primaryFields se zobrazují PŘES STRIP - pokud nechceme text přes strip, musíme je vynechat
      // newPass.primaryFields.push({
      //   key: "primary",
      //   label: passData.primaryLabel || "",
      //   value: passData.primaryValue || ""
      // });
      console.log("✅ Skipping primaryField to avoid text over strip");
      
      // Vlevo (první pole) – může být ponecháno prázdné nebo doplněno podle potřeby
      // Střed (druhé pole)
      if (passData.headerCenterLabel || passData.headerCenterValue) {
        newPass.headerFields.push({
          key: "center",
          label: passData.headerCenterLabel || "",
          value: passData.headerCenterValue || ""
        });
        console.log(`✅ Added headerField (center): ${passData.headerCenterValue}`);
      }
      // Vpravo (třetí pole)
      newPass.headerFields.push({
        key: "discountLevel",
        label: passData.discountLabel || "",
        value: passData.discountValue || ""
      });
      console.log(`✅ Added headerField (discount): ${passData.discountValue}`);
      
      // Secondary fields (pokud jsou v datech)
      if (Array.isArray(passData.secondary)) {
        passData.secondary.forEach((sec, idx) => {
          newPass.secondaryFields.push({
            key: "secondary" + idx,
            label: sec.label || "",
            value: sec.value || ""
          });
          console.log(`✅ Added secondaryField ${idx}`);
        });
      }
      
      // Auxiliary fields (pole pod pruhem)
      if (Array.isArray(passData.auxiliary)) {
        console.log("Processing auxiliary fields:", JSON.stringify(passData.auxiliary));
        passData.auxiliary.forEach((aux, idx) => {
          newPass.auxiliaryFields.push({
            key: "auxiliary" + idx,
            label: aux.label || "",
            value: aux.value || ""
          });
          console.log(`✅ Added auxiliaryField ${idx}: ${aux.label} = ${aux.value}`);
        });
      }
      
      console.log("✅ All fields added using old logic.");
      
      // 9) QR KÓD
      if (passData.qrText) {
        console.log("🔲 Adding QR code:", passData.qrText);
        newPass.setBarcodes({
          message: passData.qrText,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1"
        });
        console.log("✅ QR code added successfully");
      }
      
      // 10) KRITICKÁ OPRAVA: Odstranění headerFields pro storeCard (Apple je zakazuje)
      console.log("🔧 Removing forbidden headerFields for storeCard...");
      if (newPass.props && newPass.props.storeCard && newPass.props.storeCard.headerFields) {
        delete newPass.props.storeCard.headerFields;
        console.log("✅ headerFields removed from storeCard");
      }
      
      // 11) GENEROVÁNÍ FINÁLNÍHO BUFFERU
      console.log("🔄 Generating final pass buffer...");
      const bufferData = await newPass.getAsBuffer();
      console.log("📏 Final pass buffer size:", bufferData.length, "bytes");
      
      if (bufferData.length === 0) {
        throw new Error("Generated pass buffer is empty");
      }
      
      // 12) ULOŽENÍ DO FIREBASE STORAGE
      console.log("☁️ Uploading to Firebase Storage...");
      const fileName = `passes/${String(cardKey.id)}.pkpass`;
      const passFileRef = storageRef.file(fileName);
      
      await passFileRef.save(bufferData, {
        metadata: {
          contentType: 'application/vnd.apple.pkpass'
        }
      });
      console.log("✅ Uploaded to Firebase Storage:", fileName);
      
      // 13) ZÍSKÁNÍ SIGNED URL
      console.log("🔗 Generating signed URL...");
      const [signedUrl] = await passFileRef.getSignedUrl({
        action: 'read',
        expires: '03-01-2030'
      });
      console.log("✅ Signed URL generated:", signedUrl);
      
      // 13) AKTUALIZACE DATASTORE - MERGE UPDATE (zachová původní identifikátory)
      console.log("💾 Updating Datastore with download URL (merge mode)...");
      
      // Nejprve načteme původní data
      const [existingCard] = await datastore.get(cardKey);
      if (!existingCard) {
        throw new Error("Card not found in Datastore for update");
      }
      
      // Merge - zachováme původní data a přidáme nová pole
      const updatedData = {
        ...existingCard,  // Zachová všechna původní identifikátory
        passDownloadUrl: signedUrl, 
        passStatus: 'uploaded', 
        dateUpdated: new Date().toISOString() 
      };
      
      await datastore.save({
        key: cardKey,
        data: updatedData
      });
      console.log("✅ Datastore updated successfully (identifiers preserved)");
      
      // 14) ÚSPĚŠNÁ ODPOVĚĎ
      const response = {
        status: "Pass was successfully generated",
        result: "SUCCESS",
        cardId: String(cardKey.id),
        downloadUrl: signedUrl
      };
      
      console.log("🎉 SUCCESS! Response:", JSON.stringify(response, null, 2));
      res.status(200).json(response);
      
    } catch (error) {
      console.error("💥 CRITICAL ERROR in createPass:", error);
      console.error("📚 Error stack:", error.stack);
      
      const errorResponse = {
        result: "FAILED",
        explanation: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.log("❌ Error response:", JSON.stringify(errorResponse, null, 2));
      res.status(500).json(errorResponse);
    }
  });
});

// =========================
// Nová funkce createCard
// =========================
const createCardModule = require("./createCard");

// =========================
// Apple Wallet Webhook
// =========================
const appleWalletWebhookModule = require("./appleWalletWebhook");

// =========================
// Test Pass Function
// =========================
const testPassModule = require("./testPass");

exports.createCard = functions.https.onRequest(createCardModule.createCard);
exports.testPass = testPassModule.testPass;
exports.appleWalletWebhook = appleWalletWebhookModule.appleWalletWebhook;
exports.auditUserDeviceInfo = auditUserDeviceInfo;
exports.detailedAudit = detailedAudit;
exports.cleanupUserDeviceInfo = cleanupUserDeviceInfo;

// =========================
// HTTP endpoint pro aktualizaci dateUpdated v kartách
// =========================
exports.updateCardsTimestamp = functions.https.onRequest(async (req, res) => {
  console.log('🔄 updateCardsTimestamp endpoint called');
  
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { deviceLibraryIdentifier, emailId } = req.body;
    
    if (!deviceLibraryIdentifier) {
      return res.status(400).json({ error: 'deviceLibraryIdentifier is required' });
    }
    
    console.log(`📧 Received emailId: ${emailId || 'not provided'}`);
    // emailId není povinné, ale pokud je poskytnuto, použijeme ho pro filtrování karet
    
    console.log(`🔍 Hledám karty pro deviceLibraryIdentifier: ${deviceLibraryIdentifier}`);
    
    // Najít všechny záznamy pro toto zařízení
    const query = datastore.createQuery('userdeviceinfo')
      .filter('deviceLibraryIdentifier', '=', deviceLibraryIdentifier);
    
    const [deviceInfos] = await datastore.runQuery(query);
    console.log(`📋 Nalezeno ${deviceInfos.length} záznamů pro toto zařízení`);
    
    if (deviceInfos.length === 0) {
      return res.status(404).json({ error: 'No cards found for this device' });
    }
    
    // Aktualizovat dateUpdated pro všechny karty tohoto zařízení
    const currentTime = new Date().toISOString();
    let updatedCount = 0;
    
    for (const info of deviceInfos) {
      let serialNumber = info.serialNumber;
      if (serialNumber) {
        console.log(`🔍 Zpracovávám serialNumber: ${serialNumber} (typ: ${typeof serialNumber})`);
        
        // Normalizace emailId - odstranění prefixu "ID=" pokud existuje
        let normalizedEmailId = info.emailId;
        if (normalizedEmailId && normalizedEmailId.startsWith('ID=')) {
          normalizedEmailId = normalizedEmailId.substring(3);
          console.log(`🔍 Normalizován emailId z ${info.emailId} na ${normalizedEmailId}`);
        }
        
        // Pokud máme emailId, zkontrolujeme, zda tento serialNumber odpovídá danému emailId
        if (emailId) {
          // Normalizace emailId parametru - odstranění prefixu "ID=" pokud existuje
          let normalizedParamEmailId = emailId;
          if (normalizedParamEmailId && normalizedParamEmailId.startsWith('ID=')) {
            normalizedParamEmailId = normalizedParamEmailId.substring(3);
            console.log(`🔍 Normalizován parametr emailId z ${emailId} na ${normalizedParamEmailId}`);
          }
          
          // Porovnání emailId s/bez prefixu "ID="
          const emailIdMatches = 
            info.emailId === emailId || 
            normalizedEmailId === normalizedParamEmailId ||
            info.emailId === `ID=${normalizedParamEmailId}` ||
            `ID=${info.emailId}` === emailId;
          
          if (!emailIdMatches) {
            console.log(`⏭️ Přeskakuji serialNumber ${serialNumber}, protože neodpovídá emailId ${emailId}`);
            console.log(`  - info.emailId: ${info.emailId}`);
            console.log(`  - normalizedEmailId: ${normalizedEmailId}`);
            console.log(`  - emailId parametr: ${emailId}`);
            console.log(`  - normalizedParamEmailId: ${normalizedParamEmailId}`);
            continue;
          } else {
            console.log(`✅ EmailId odpovídá (s/bez prefixu ID=): ${info.emailId} ~ ${emailId}`);
          }
        }
        
        let card = null;
        let cardKey = null;
        
        // Normalizace serialNumber - odstranění prefixu "ID=" pokud existuje
        let normalizedSerialNumber = serialNumber;
        if (normalizedSerialNumber && normalizedSerialNumber.startsWith('ID=')) {
          normalizedSerialNumber = normalizedSerialNumber.substring(3);
          console.log(`🔍 Normalizován serialNumber z ${serialNumber} na ${normalizedSerialNumber}`);
        }
        
        // Strategie 1: Zkusit najít kartu podle userId (s normalizací)
        try {
          // Nejprve zkusíme bez prefixu
          const userIdQuery = datastore.createQuery('cards')
            .filter('userId', '=', normalizedSerialNumber)
            .limit(1);
          const [userIdResults] = await datastore.runQuery(userIdQuery);
          card = userIdResults[0];
          if (card) {
            console.log(`🔍 Karta nalezena podle userId (bez prefixu): ${normalizedSerialNumber}`);
            cardKey = card[datastore.KEY];
          } else {
            // Pokud nenajdeme bez prefixu, zkusíme s prefixem
            const prefixedSerialNumber = `ID=${normalizedSerialNumber}`;
            const prefixedUserIdQuery = datastore.createQuery('cards')
              .filter('userId', '=', prefixedSerialNumber)
              .limit(1);
            const [prefixedUserIdResults] = await datastore.runQuery(prefixedUserIdQuery);
            card = prefixedUserIdResults[0];
            if (card) {
              console.log(`🔍 Karta nalezena podle userId (s prefixem): ${prefixedSerialNumber}`);
              cardKey = card[datastore.KEY];
            }
          }
        } catch (err) {
          console.error(`Chyba při hledání podle userId: ${err.message}`);
        }
        
        // Strategie 2: Zkusit najít kartu podle anonymousId (s normalizací)
        if (!card) {
          try {
            // Nejprve zkusíme bez prefixu
            const anonymousIdQuery = datastore.createQuery('cards')
              .filter('anonymousId', '=', normalizedSerialNumber)
              .limit(1);
            const [anonymousIdResults] = await datastore.runQuery(anonymousIdQuery);
            card = anonymousIdResults[0];
            if (card) {
              console.log(`🔍 Karta nalezena podle anonymousId (bez prefixu): ${normalizedSerialNumber}`);
              cardKey = card[datastore.KEY];
            } else {
              // Pokud nenajdeme bez prefixu, zkusíme s prefixem
              const prefixedSerialNumber = `ID=${normalizedSerialNumber}`;
              const prefixedAnonymousIdQuery = datastore.createQuery('cards')
                .filter('anonymousId', '=', prefixedSerialNumber)
                .limit(1);
              const [prefixedAnonymousIdResults] = await datastore.runQuery(prefixedAnonymousIdQuery);
              card = prefixedAnonymousIdResults[0];
              if (card) {
                console.log(`🔍 Karta nalezena podle anonymousId (s prefixem): ${prefixedSerialNumber}`);
                cardKey = card[datastore.KEY];
              }
            }
          } catch (err) {
            console.error(`Chyba při hledání podle anonymousId: ${err.message}`);
          }
        }
        
        // Strategie 3: Fallback na numerické ID (původní způsob)
        if (!card && !isNaN(parseInt(serialNumber))) {
          try {
            cardKey = datastore.key(['cards', datastore.int(serialNumber)]);
            const [legacyCard] = await datastore.get(cardKey);
            card = legacyCard;
            if (card) {
              console.log(`🔍 Karta nalezena podle numerického ID: ${serialNumber}`);
            }
          } catch (err) {
            console.error(`Chyba při hledání podle numerického ID: ${err.message}`);
          }
        }
        
        if (card && cardKey) {
          const updatedCard = {
            ...card,
            dateUpdated: currentTime
          };
          updatedCount++;
          console.log(`✅ Aktualizuji dateUpdated pro kartu ${serialNumber}`);
          await datastore.save({ key: cardKey, data: updatedCard });
        } else {
          console.log(`❌ Karta s identifikátorem ${serialNumber} nebyla nalezena žádnou strategií.`);
        }
      }
    }
    
    const response = {
      success: true,
      message: `Updated ${updatedCount} cards`,
      timestamp: currentTime,
      deviceLibraryIdentifier: deviceLibraryIdentifier
    };
    
    console.log(`🎉 Úspěšně aktualizováno ${updatedCount} karet`);
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chyba při aktualizaci karet:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Nová funkce pro generování aktualizovaných passů s daty z Firestore
exports.generateUpdatedPass = functions.https.onRequest(async (req, res) => {
  try {
    console.log('🔄 generateUpdatedPass endpoint called');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { serialNumber, wixid, email } = req.body;
    
    if (!serialNumber || !wixid || !email) {
      return res.status(400).json({ 
        error: 'Missing required parameters: serialNumber, wixid, email' 
      });
    }
    
    // 1. Inicializace sekundární aplikace pro vernostkarty-db
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
    
    // 2. Načtení aktuálních dat z Firestore (vernostkarty-db)
    console.log(`📋 Loading current data from Firestore: users/${wixid}/emails/${email}`);
    const userDocRef = firestoreDb.collection('users').doc(wixid).collection('emails').doc(email);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ User document not found: users/${wixid}/emails/${email}`);
      return res.status(404).json({ error: 'User data not found' });
    }
    
    const userData = userDoc.data();
    console.log('📋 Current user data from Firestore:', JSON.stringify(userData, null, 2));
    
    // 3. Načtení původní karty z Datastore pro základní metadata
    const cardKey = datastore.key(['cards', datastore.int(serialNumber)]);
    const [originalCard] = await datastore.get(cardKey);
    
    if (!originalCard) {
      console.error(`❌ Original card not found in Datastore: ${serialNumber}`);
      return res.status(404).json({ error: 'Original card not found' });
    }
    
    console.log('📋 Original card metadata:', JSON.stringify(originalCard, null, 2));
    
    // 4. Aplikace logiky mapování polí podle cardType (stejně jako CAFEHTML)
    const cardType = userData.cardType || originalCard.cardType || 'card-body';
    console.log(`🔍 Processing card type: ${cardType}`);
    
    // Vytvoření payload podle logiky CAFEHTML
    const payload = {
      primaryLabel: "VĚRNOSTNÍ KARTA",
      primaryValue: originalCard.businessName || '',
      discountLabel: '',
      discountValue: '',
      headerCenterLabel: '',
      headerCenterValue: '',
      auxiliary: [
        { label: userData.name || '', value: userData.surname || '' }, // Jméno uživatele
        { label: '', value: '' } // Bude nastaveno podle cardType
      ]
    };
    
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
    
    // 5. Dynamické načítání certifikátů podle cafeId
    console.log(`🔐 Loading certificates for cafeId: ${originalCard.cafeId}...`);
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(originalCard.cafeId);
    console.log(`✅ Certificates loaded from: ${certificates.p12Path}, ${certificates.wwdrPath}`);
    
    // 6. Generování PKPass s dynamickými certifikáty
    console.log("🎫 Generating PKPass with current data...");
    
    const newPass = await PKPass.from(
      {
        model: "./myFirstModel.pass",
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
        serialNumber: String(serialNumber),
        description: "Aktualizovaná věrnostní karta",
        foregroundColor: originalCard.design?.contentColor || "#000000",
        backgroundColor: originalCard.design?.backgroundColor || "#ffffff",
        labelColor: originalCard.design?.headerColor || "#000000"
      }
    );
    
    // 6. Přidání polí podle cardType (logika z createPass)
    console.log("📝 Adding fields based on cardType...");
    
    // Primary field
    if (payload.primaryLabel && payload.primaryValue) {
      newPass.storeCard().primaryFields.add('primary', payload.primaryLabel, payload.primaryValue);
    }
    
    // Secondary fields (discount a header center)
    if (payload.discountLabel && payload.discountValue) {
      newPass.storeCard().secondaryFields.add('discount', payload.discountLabel, payload.discountValue);
    }
    
    if (payload.headerCenterLabel && payload.headerCenterValue) {
      newPass.storeCard().secondaryFields.add('headerCenter', payload.headerCenterLabel, payload.headerCenterValue);
    }
    
    // Auxiliary fields
    payload.auxiliary.forEach((aux, index) => {
      if (aux.label || aux.value) {
        newPass.storeCard().auxiliaryFields.add(`aux${index}`, aux.label, aux.value);
      }
    });
    
    // QR kód
    const qrText = originalCard.qrText || `https://onlineloyaltycards.com/editor/?id=${wixid}/${userData.anonymousId || email}`;
    newPass.barcode(qrText, 'PKBarcodeFormatQR');
    
    // 7. Generování finálního .pkpass souboru
    console.log("🔄 Generating final .pkpass file...");
    const passBuffer = await newPass.generate();
    
    console.log(`✅ Generated updated pass for ${serialNumber} with ${passBuffer.length} bytes`);
    
    // 8. Odeslání odpovědi
    res.set('Content-Type', 'application/vnd.apple.pkpass');
    res.set('Last-Modified', new Date().toUTCString());
    return res.status(200).send(passBuffer);
    
  } catch (error) {
    console.error('❌ Error generating updated pass:', error);
    res.status(500).json({ 
      error: 'Failed to generate updated pass', 
      message: error.message 
    });
  }
});