const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const admin = require('firebase-admin');
const { Datastore } = require('@google-cloud/datastore');

const topicName = 'card-created';

/**
 * Funkce na pozadí, která naslouchá Pub/Sub tématu 'card-created'.
 * Zpracuje zprávu, načte data z Datastore a uloží je do Firestore.
 */
exports.syncCardToFirestore = onMessagePublished(topicName, async (event) => {
  // Líná inicializace, aby se zabránilo problémům se startem kontejneru
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  const firestore = admin.firestore();
  const datastore = new Datastore();

  try {
    // Zpráva je v base64, musíme ji dekódovat.
        // U v2 triggeru jsou data v event.data.message
    const message = event.data.message;
    const messageBody = message.data ? Buffer.from(message.data, 'base64').toString() : null;
    if (!messageBody) {
        console.error('Prázdná zpráva v Pub/Sub.');
        return; // Ukončení funkce
    }

    const { cardId } = JSON.parse(messageBody);
    if (!cardId) {
      console.error('Chybějící cardId ve zprávě z Pub/Sub.');
      return; // Ukončení funkce
    }

    console.log(`Přijata zpráva pro synchronizaci karty s ID: ${cardId}`);

    const datastoreKey = datastore.key(['cards', parseInt(cardId, 10)]);
    const [cardData] = await datastore.get(datastoreKey);

    if (!cardData) {
      console.error(`Karta s ID ${cardId} nebyla nalezena v Datastore.`);
      return; // Ukončení funkce, zprávu nebudeme znovu zpracovávat
    }

    // Uložíme data do Firestore s použitím stejného ID
    const firestoreDocRef = firestore.collection('cards').doc(String(cardId));
    await firestoreDocRef.set(cardData, { merge: true });

    console.log(`Karta ${cardId} byla úspěšně synchronizována do Firestore.`);
    return;

  } catch (error) {
    console.error('Chyba při synchronizaci karty:', error);
    // I v případě chyby vracíme úspěch, aby se Pub/Sub nepokoušel zprávu posílat znovu
    // a nezpůsobil nekonečnou smyčku.
    return;
  }
});
