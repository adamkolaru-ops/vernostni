const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

exports.createCard = (req, res) => {
  cors(req, res, async () => {
    try {
      // Správné pořadí: nejprve inicializovat, potom používat.
      if (admin.apps.length === 0) {
        admin.initializeApp();
      }
      const db = admin.firestore();
      const data = req.body;

      await db.collection("cardsTest").add({
        test: data.test || "default test",
        created: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send({ message: "OK" });
    } catch (error) {
      console.error("🔥 Chyba:", error);
      res.status(500).send({ message: "Chyba", error: error.message });
    }
  });
};
