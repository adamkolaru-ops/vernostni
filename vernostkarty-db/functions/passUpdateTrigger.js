const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const apn = require("node-apn");
const path = require("path");
const fs = require("fs");

// --- Konfigurace --- 
// Načtení cesty k certifikátům
const certPath = path.join(__dirname, 'certificates', 'passCert.pem');
const keyPath = path.join(__dirname, 'certificates', 'privatekey.key');

// Zde doplňte heslo k vašemu privátnímu klíči, pokud nějaké má.
// Pokud heslo nemá, nechte prázdné: ''
const keyPassword = ''; 

// Zkontrolujeme, zda certifikáty existují, než budeme pokračovat
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  logger.error("Chyba: Certifikát (passCert.pem) nebo klíč (privatekey.key) nebyl nalezen v adresáři 'functions/certificates'.");
  logger.error("Ujistěte se, že jste soubory zkopírovali do projektu 'vernostkarty-db'.");
} else {
    logger.info("Certifikát a klíč úspěšně nalezeny.");
}

// Nastavení APN providera
const apnProvider = new apn.Provider({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath),
  passphrase: keyPassword,
  production: false // true pro produkční prostředí, false pro vývoj (sandbox)
});

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

  logger.info(`Detekována změna pro uživatele ${event.params.emailId}. Pokouším se odeslat notifikaci na token: ${pushToken}`);

  // Vytvoříme prázdnou notifikaci. To je signál pro Wallet, aby si stáhla nová data.
  const notification = new apn.Notification();
  
  // Důležité: 'topic' musí být přesně váš passTypeIdentifier
  notification.topic = "pass.pass.com.example.vernostkarty2";

  try {
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
