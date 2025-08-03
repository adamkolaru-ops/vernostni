// testPass.js - Jednoduchá funkce pro generování testovací karty podle dokumentace

const functions = require("firebase-functions");
const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");
const cors = require("cors")({ origin: true });

// Pomocná funkce pro převod HEX na RGB
function hexToRgb(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}

const testPassFunction = async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log("🚀 testPass started");

      const templatePath = "./myFirstModel.pass";
      const wwdr = fs.readFileSync(path.resolve(__dirname, "./certificates/wwdr.pem"));
      const signerCert = fs.readFileSync(path.resolve(__dirname, "./certificates/signerCert.pem"));
      const signerKey = fs.readFileSync(path.resolve(__dirname, "./certificates/signerKey.pem"));

      const pass = await PKPass.from({
        model: templatePath,
        certificates: {
          wwdr: wwdr,
          signerCert: signerCert,
          signerKey: {
            key: signerKey,
            passphrase: "vernostkarty"
          }
        }
      }, {
        serialNumber: `test-${Date.now()}`,
        authenticationToken: "a7d8g9h2j4k5l6m7n8b9v0c1x2z3",
        webServiceURL: "https://applewalletwebhook-2sun3frzja-uc.a.run.app",
        backgroundColor: hexToRgb("#000000"),
        foregroundColor: hexToRgb("#FFFFFF"),
        labelColor: hexToRgb("#FFFFFF"),
        logoText: "Testovací Karta"
      });

      // Přidání polí pro test podle dokumentace

      // 1. POLE NAD STRIPEM
      pass.primaryFields.push({
        key: 'memberName',
        label: 'Držitel karty',
        value: 'Jan Novák'
      });

      pass.secondaryFields.push({
        key: 'points',
        label: 'Body',
        value: '150'
      });

      pass.secondaryFields.push({
        key: 'level',
        label: 'Úroveň',
        value: 'Zlatá'
      });

      // 2. POLE POD STRIPEM
      pass.auxiliaryFields.push({
        key: 'website',
        label: 'Webové stránky',
        value: 'www.example.com'
      });

      pass.auxiliaryFields.push({
        key: 'expires',
        label: 'Platnost do',
        value: '12/2025'
      });

      // 3. POLE NA ZADNÍ STRANĚ
      pass.backFields.push({
        key: 'terms',
        label: 'Podmínky použití',
        value: 'Kompletní podmínky naleznete na našich webových stránkách. Slevy nelze kombinovat.'
      });

      pass.setBarcodes({
        message: "https://example.com",
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1"
      });

      const passBuffer = pass.getAsBuffer();
      res.writeHead(200, {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="test.pkpass"'
      });
      res.end(passBuffer);

    } catch (error) {
      console.error("💥 CRITICAL ERROR in testPass:", error);
      res.status(500).send("Error generating pass");
    }
  });
};

exports.testPass = functions.https.onRequest(testPassFunction);
