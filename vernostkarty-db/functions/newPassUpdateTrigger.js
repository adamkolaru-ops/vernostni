const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const apn = require("@parse/node-apn");
const path = require("path");
const fs = require("fs");
const https = require("https");

// --- Konfigurace ---
const options = {
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'passCert.pem')),
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'privatekey.key')),
  production: true
};

const apnProvider = new apn.Provider(options);

// Pass Type Identifier natvrdo
const passTypeIdentifier = "pass.pass.com.example.vernostkarty2";

exports.notifyDeviceOnPassUpdate = onDocumentUpdated("users/{cafeId}/emails/{emailId}", async (event) => {
  logger.info("--- APN TRIGGER SPUŠTĚN (simplified version) ---");

  if (!event.data || !event.data.after) {
    logger.log("Žádná data po změně, končím.");
    return;
  }

  const data = event.data.after.data();
  const pushToken = data.pushToken;
  const deviceLibraryIdentifier = data.deviceLibraryIdentifier;
  const { cafeId, emailId } = event.params;

  if (!pushToken) {
    logger.log(`Dokument ${emailId} byl aktualizován, ale chybí pushToken.`);
    return;
  }

  logger.info(`Trigger spuštěn pro cafeId: ${cafeId}, email: ${emailId}`);
  logger.info(`DeviceLibraryIdentifier: ${deviceLibraryIdentifier}, pushToken: ${pushToken}`);

  try {
    // KROK 1: Aktualizovat dateUpdated v kartách přes HTTP volání
    if (deviceLibraryIdentifier) {
      logger.info(`Volám HTTP endpoint pro aktualizaci karet pro deviceLibraryIdentifier: ${deviceLibraryIdentifier}`);
      
      try {
        const postData = JSON.stringify({
          deviceLibraryIdentifier: deviceLibraryIdentifier
        });
        
        const options = {
          hostname: 'updatecardstimestamp-2sun3frzja-uc.a.run.app',
          port: 443,
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const updateResponse = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                resolve(response);
              } catch (e) {
                resolve({ message: data });
              }
            });
          });
          
          req.on('error', (e) => {
            reject(e);
          });
          
          req.write(postData);
          req.end();
        });
        
        logger.info(`Karty aktualizovány: ${updateResponse.message || 'OK'}`);
      } catch (updateError) {
        logger.error('Chyba při aktualizaci karet:', updateError.message);
        // Pokračujeme dál i při chybě aktualizace
      }
    }
    
    // KROK 2: Odeslat APN notifikaci
    logger.info(`Odesílám notifikaci na token: ${pushToken} s topic: ${passTypeIdentifier}`);
    
    const notification = new apn.Notification();
    notification.topic = passTypeIdentifier;
    
    const result = await apnProvider.send(notification, pushToken);
    
    if (result.sent.length > 0) {
      logger.info("APN notifikace úspěšně odeslána.");
    }
    if (result.failed.length > 0) {
      logger.error("Chyba při odesílání APN notifikace:", JSON.stringify(result.failed, null, 2));
    }
    
  } catch (err) {
    logger.error("Fatální chyba při zpracování triggeru:", err);
  }
});
