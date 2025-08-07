const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const apn = require("node-apn");
const admin = require('firebase-admin');
const certificateHelper = require('./certificateHelperSimple');

// Zajistíme si přístup k Firestore
const db = admin.firestore();

// Pass Type Identifier
// passTypeIdentifier se nyní načítá dynamicky z Firestore v sendPassUpdateNotification

/**
 * Spustí se při každé aktualizaci dokumentu v kolekci emails.
 * Odešle tichou push notifikaci na zařízení, aby si vyžádalo novou verzi karty.
 */
exports.sendPassUpdateNotification = onDocumentUpdated("users/{cafeId}/emails/{emailId}", async (event) => {
  logger.info("--- FUNKCE SPUŠTĚNA --- Trigger pro sendPassUpdateNotification byl aktivován.");
  // Zkontrolujeme, zda vůbec existují nějaká data po změně
  if (!event.data || !event.data.after) {
    logger.log("Žádná data po změně, končím.");
    return;
  }

  const data = event.data.after.data();
  const pushToken = data.pushToken;

  if (!pushToken) {
    logger.log(`Dokument ${event.params.emailId} byl aktualizován, ale neobsahuje pushToken. Notifikace se neodesílá.`);
    return;
  }

  const { cafeId, emailId } = event.params;
  logger.info(`Detekována změna pro cafeId: ${cafeId}, uživatele: ${emailId}. Pokouším se odeslat notifikaci na token: ${pushToken}`);

  try {
    // Inicializace APN provideru s lokálními certifikáty (pro nasazení)
    logger.info(`🔐 Initializing APN provider for cafeId: ${cafeId}`);
    
    // KROK 1: Načtení dokumentu z cardzapier pro získání cest k certifikátům
    const docRef = db.collection('cardzapier').doc(cafeId); // cafeId je zde fullId
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      logger.error(`❌ CRITICAL: Dokument s ID ${cafeId} nebyl nalezen v kolekci cardzapier. Notifikace se neodesílá.`);
      return;
    }

    const cardData = docSnap.data();
    const pemPath = cardData.pempath;
    const keyPath = cardData.keypath;
    const passTypeIdentifier = cardData.passTypeIdentifier;

    if (!pemPath || !keyPath) {
      logger.error(`❌ CRITICAL: V dokumentu ${cafeId} chybí pempath nebo keypath. Notifikace se neodesílá.`);
      return;
    }
    if (!passTypeIdentifier) {
      logger.error(`❌ CRITICAL: V dokumentu ${cafeId} chybí passTypeIdentifier. Notifikace se neodesílá.`);
      return;
    }

    logger.info(`VERIFICATION: Pro notifikaci se použijí cesty: PEM='${pemPath}', KEY='${keyPath}'`);
    logger.info(`VERIFICATION: Pro notifikaci se použije passTypeIdentifier='${passTypeIdentifier}'`);

    // KROK 2: Načtení samotných certifikátů z Cloud Storage pomocí cest
    const certificates = await certificateHelper.getAppleCertificateBuffers(pemPath, keyPath);

    const apnProvider = new apn.Provider({
      cert: certificates.signerCert, // Buffer s PEM certifikátem
      key: certificates.signerKey,   // Buffer s privátním klíčem
      production: true
    });
    
    // Vytvoříme prázdnou notifikaci. To je signál pro Wallet, aby si stáhla nová data.
    const notification = new apn.Notification();
    
    // Důležité: 'topic' musí být přesně váš passTypeIdentifier
    notification.topic = passTypeIdentifier;

    const result = await apnProvider.send(notification, pushToken);
    
    // Zalogujeme výsledek
    if (result.sent.length > 0) {
      logger.info("Push notifikace úspěšně odeslána:", result.sent);
    } 
    
    if (result.failed.length > 0) {
      logger.error("Chyba při odesílání push notifikace:", JSON.stringify(result.failed, null, 2));
    }

  } catch (err) {
    logger.error("Fatální chyba při odesílání notifikace přes APN:", err);
  }
});
