const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const apn = require("@parse/node-apn");
const path = require("path");
const fs = require("fs");
const https = require("https");
const admin = require('firebase-admin');
const certificateHelper = require('./certificateHelperSimple');

const db = admin.firestore();

// Pass Type Identifier
// passTypeIdentifier se nyní načítá dynamicky z Firestore v notifyDeviceOnPassUpdate

exports.notifyDeviceOnPassUpdate = onDocumentUpdated("users/{fullId}/emails/{emailId}", async (event) => {
  logger.info("--- APN TRIGGER SPUŠTĚN (simplified version) ---");
  logger.info(`🔍 Trigger path: users/${event.params.fullId}/emails/${event.params.emailId}`);
  logger.info(`🔍 fullId: ${event.params.fullId}, emailId: ${event.params.emailId}`);
  
  // Logování všech parametrů triggeru
  logger.info('📋 Trigger params:', event.params);
  
  if (!event.data || !event.data.after) {
    logger.log("Žádná data po změně, končím.");
    return;
  }
  
  // Logování dat před a po změně
  const beforeData = event.data.before ? event.data.before.data() : null;
  const afterData = event.data.after.data();
  
  logger.info('📋 Data před změnou:', beforeData ? JSON.stringify(beforeData) : 'žádná');
  logger.info('📋 Data po změně:', JSON.stringify(afterData));
  
  // Kontrola, zda došlo ke změně relevantních polí
  const relevantFields = ['stampCount', 'level1_status', 'level1_sleva', 'level1_zustatek', 
                          'level2_status', 'level2_sleva', 'level2_zustatek',
                          'level3_status', 'level3_sleva', 'level3_zustatek',
                          'cardType', 'bodyValInput', 'bodyLabel1Input', 'bodyBottomTopInput', 
                          'bodyBottomBotInput', 'bodyKonverze', 'stampValInput',
                          // Přidání dalších důležitých polí (bez dateUpdated - technické pole)
                          'lastUpdated', 'name', 'surname', 'phone', 'email',
                          'pushToken', 'deviceLibraryIdentifier', 'serialNumber'];
  
  let hasRelevantChanges = false;
  if (beforeData) {
    for (const field of relevantFields) {
      if (beforeData[field] !== afterData[field]) {
        logger.info(`🔄 Změna v poli ${field}: ${beforeData[field]} -> ${afterData[field]}`);
        hasRelevantChanges = true;
      }
    }
  } else {
    // Pokud nemáme předchozí data, předpokládáme, že jde o nový dokument
    hasRelevantChanges = true;
  }
  
  if (!hasRelevantChanges) {
    logger.info('❌ Žádné relevantní změny, které by vyžadovaly notifikaci. Končím.');
    return;
  }

  const data = event.data.after.data();
  const { fullId, emailId: originalEmailId } = event.params;
  
  // Extrahujeme cafeId z fullId (posledních 12 znaků)
  const cafeId = fullId.slice(-12);
  
  // Normalizace emailId - odstranění prefixu "ID=" pokud existuje
  let emailId = originalEmailId;
  if (emailId && emailId.startsWith('ID=')) {
    emailId = emailId.substring(3);
    logger.info(`🔍 DEBUG: Normalizován emailId z ${originalEmailId} na ${emailId}`);
  }
  
  // Získáme data přímo z Firestore dokumentu (bez passTypeIdentifier - ten se načítá z cardzapier)
  let pushToken = data.pushToken;
  let deviceLibraryIdentifier = data.deviceLibraryIdentifier;
  let serialNumber = data.serialNumber || emailId; // serialNumber je email
  
  logger.info(`📋 Data z Firestore dokumentu:`);
  logger.info(`  - pushToken: ${pushToken || 'CHYBÍ'}`);
  logger.info(`  - deviceLibraryIdentifier: ${deviceLibraryIdentifier || 'CHYBÍ'}`);
  logger.info(`  - serialNumber: ${serialNumber || 'CHYBÍ'}`);
  logger.info(`  - emailId: ${emailId}`);
  
  // OPRAVA: passTypeIdentifier se VŽDY načítá z cardzapier/{fullId}, ne z user dokumentu
  let passTypeIdentifier = null;
  logger.info(`🔍 Načítám passTypeIdentifier z cardzapier podle fullId: ${fullId}`);
  try {
    const docRef = db.collection('cardzapier').doc(fullId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      logger.error(`❌ CRITICAL: Dokument s ID ${fullId} nebyl nalezen v kolekci cardzapier. Notifikace se neodesílá.`);
      return;
    }
    
    const cardData = docSnap.data();
    passTypeIdentifier = cardData.passTypeIdentifier;
    
    if (!passTypeIdentifier) {
      logger.error(`❌ CRITICAL: V dokumentu ${fullId} chybí passTypeIdentifier. Notifikace se neodesílá.`);
      return;
    }
    
    logger.info(`✅ Načten passTypeIdentifier z cardzapier: ${passTypeIdentifier}`);
  } catch (error) {
    logger.error(`❌ Chyba při načítání passTypeIdentifier z cardzapier:`, error);
    return;
  }

  if (!pushToken) {
    logger.log(`Dokument ${emailId} byl aktualizován, ale chybí pushToken.`);
    return;
  }

  if (!deviceLibraryIdentifier) {
    logger.log(`Dokument ${emailId} byl aktualizován, ale chybí deviceLibraryIdentifier.`);
    return;
  }

  logger.info(`🔍 DEBUG: Zpracovávám aktualizaci pro emailId: ${emailId}, deviceLibraryIdentifier: ${deviceLibraryIdentifier}`);

  logger.info(`Trigger spuštěn pro cafeId: ${cafeId}, email: ${emailId}`);
  logger.info(`DeviceLibraryIdentifier: ${deviceLibraryIdentifier}, pushToken: ${pushToken}`);

  try {
    // OPRAVA: Neaktualizujeme všechny karty přes updateCardsTimestamp, ale posíláme notifikaci pouze pro konkrétní email/pass
    logger.info(`🔔 Připravuji APN notifikaci pro konkrétní email/pass: ${emailId}`);
    logger.info(`📋 Data pro notifikaci:`);
    logger.info(`  - fullId: ${fullId}`);
    logger.info(`  - emailId: ${emailId}`);
    logger.info(`  - serialNumber: ${serialNumber}`);
    logger.info(`  - deviceLibraryIdentifier: ${deviceLibraryIdentifier}`);
    logger.info(`  - pushToken: ${pushToken}`);
    logger.info(`  - passTypeIdentifier: ${passTypeIdentifier || 'bude načten z cardzapier'}`);
    
    // Neaktualizujeme všechny karty, ale posíláme notifikaci pouze pro tento konkrétní email/pass
    
    // KROK 2: Inicializace APN provideru s lokálními certifikáty (pro nasazení)
    logger.info(`🔐 Initializing APN provider for cafeId: ${cafeId}`);
    
    // KROK 2: Dynamické načítání certifikátů z Cloud Storage
    // Normalizace cafeId - odstranění prefixu "ID=" pokud existuje
    let normalizedCafeId = cafeId;
    if (normalizedCafeId && normalizedCafeId.startsWith('ID=')) {
      normalizedCafeId = normalizedCafeId.substring(3);
      logger.info(`🔍 DEBUG: Normalizován cafeId z ${cafeId} na ${normalizedCafeId}`);
    }
    
    // passTypeIdentifier je již načten výše z cardzapier/{fullId}

    // Použití getAppleCertificatesByCafeId místo getAppleCertificateBuffers
    // Tato funkce má fallback na lokální certifikáty a nepotřebuje cesty pempath a keypath
    logger.info(`Načítám certifikáty pomocí getAppleCertificatesByCafeId pro cafeId: ${cafeId}`);
    const certificates = await certificateHelper.getAppleCertificatesByCafeId(cafeId);

    const options = {
      cert: certificates.signerCert, // Buffer s PEM certifikátem
      key: certificates.signerKey,   // Buffer s privátním klíčem
      production: true
    };
    
    const apnProvider = new apn.Provider(options);
    
    // KROK 3: Odeslat APN notifikaci
    logger.info(`📱 Odesílám notifikaci - DeviceLibraryIdentifier: ${deviceLibraryIdentifier}, EmailId: ${emailId}, Token: ${pushToken}, Topic: ${passTypeIdentifier}`);
    logger.info(`📱 SerialNumber: ${serialNumber || 'není k dispozici'}`);
    
    const notification = new apn.Notification();
    notification.topic = passTypeIdentifier;
    
    const result = await apnProvider.send(notification, pushToken);
    
    if (result.sent.length > 0) {
      logger.info(`✅ APN notifikace úspěšně odeslána pro DeviceLibraryIdentifier: ${deviceLibraryIdentifier}, EmailId: ${emailId}`);
    }
    if (result.failed.length > 0) {
      logger.error(`❌ Chyba při odesílání APN notifikace pro DeviceLibraryIdentifier: ${deviceLibraryIdentifier}:`, JSON.stringify(result.failed, null, 2));
    }
    
  } catch (err) {
    logger.error("Fatální chyba při zpracování triggeru:", err);
  }
});
