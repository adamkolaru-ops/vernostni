const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp({
  credential: admin.credential.cert(
    require("./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json")
  )
});

const db = admin.firestore();

exports.createPass = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  try {
    const data = req.body;
    const docRef = await db.collection("passes").add({
      ...data,
      created: admin.firestore.FieldValue.serverTimestamp()
    });
    const downloadUrl = `https://onlineloyaltycards.com/card-maker/?id=${docRef.id}`;
    return res.status(200).json({ success: true, downloadUrl });
  } catch (err) {
    console.error("createPass error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.verifyId = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const prefix = req.body.prefix;
  if (!prefix || prefix.length !== 8) {
    return res.status(400).json({ success: false, error: "prefix musí mít 8 znaků" });
  }
  try {
    const snap = await db.collection("cardzapier")
      .where("wixid", ">=", prefix)
      .where("wixid", "<=", prefix + "\uf8ff")
      .limit(1)
      .get();
    if (snap.empty) {
      return res.json({ success: false });
    }
    const fullId = snap.docs[0].data().wixid;
    return res.json({ success: true, fullId });
  } catch (err) {
    console.error("verifyId error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.addTestInfo = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const id = req.body.id;
  if (!id || id.length < 8) {
    return res.status(400).json({ success: false, error: "Neplatné ID" });
  }
  try {
    await db.doc(`cardzapier/${id}`).update({ testinfo: "pridano" });
    return res.json({ success: true });
  } catch (err) {
    console.error("addTestInfo error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.createBusinessRecord = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { businessName, businessID } = req.body;

  if (!businessName || !businessID) {
    return res.status(400).json({ success: false, error: "Missing businessName or businessID" });
  }

  try {
    const docRef = await db.collection("cardzapier").add({
      businessName: businessName,
      businessID: businessID,
      createdAt: new Date().toISOString(),
    });
    return res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error("createBusinessRecord error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.updateUserData = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const { id, data } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "Missing ID" });
  }
  try {
    await db.collection("cardzapier").doc(id).set(data, { merge: true });
    return res.json({ success: true });
  } catch (err) {
    console.error("updateUserData error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.getBusinessName = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const fullId = req.query.fullId;
  if (!fullId) {
    return res.status(400).json({ success: false, error: 'Chybí fullId' });
  }
  try {
    const docSnap = await db.doc(`cardzapier/${fullId}`).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: 'Dokument nenalezen' });
    }
    return res.json({ success: true, name: docSnap.data().businessNameInput || '' });
  } catch (e) {
    console.error('getBusinessName error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

exports.getCardData = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const fullId = req.query.fullId;
  if (!fullId) {
    return res.status(400).json({ success: false, error: 'Chybí fullId' });
  }
  try {
    const docSnap = await db.doc(`cardzapier/${fullId}`).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: 'Dokument nenalezen' });
    }
    return res.json({ success: true, data: docSnap.data() });
  } catch (e) {
    console.error('getCardData error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

exports.getCafeSettings = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const cafeId = req.query.id;
  if (!cafeId || cafeId.length !== 12) {
    return res.status(400).json({ success: false, error: 'Invalid or missing cafeId' });
  }
  try {
    const snapshot = await db.collection('cardzapier').get();
    let settings = null;
    let matchedFullId = null;
    snapshot.forEach(doc => {
      if (doc.id.slice(-12) === cafeId) {
        matchedFullId = doc.id;
        settings = doc.data();
      }
    });
    if (!settings) {
      return res.status(404).json({ success: false, error: 'Settings not found' });
    }
    const keys = [
      'level1_status','level1_sleva','level1_zustatek',
      'level2_status','level2_sleva','level2_zustatek',
      'level3_status','level3_sleva','level3_zustatek',
      'stampCount','StampCount'
    ];
    keys.forEach(key => {
      if (typeof settings[key] === 'undefined') settings[key] = '';
    });
    return res.json({ success: true, id: matchedFullId, settings });
  } catch (err) {
    console.error('getCafeSettings error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.ensureUser = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const fullId = req.body.fullId;
  if (!fullId) {
    return res.status(400).json({ success: false, error: 'Missing fullId' });
  }
  try {
    const userRef = db.collection('users').doc(fullId);
    const docSnap = await userRef.get();
    if (!docSnap.exists) {
      await userRef.set({ created: admin.firestore.FieldValue.serverTimestamp() });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('ensureUser error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.getCafeUser = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const { cafeId, email } = req.body;
  if (!cafeId || !email) {
    return res.status(400).json({ success: false, error: 'Missing cafeId or email' });
  }
  try {
    const userRef = db.collection('users')
      .doc(cafeId)
      .collection('emails')
      .doc(email);
    const docSnap = await userRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({ success: true, data: docSnap.data() });
  } catch (err) {
    console.error('getCafeUser error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.saveCafeUser = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const { cafeId, email } = req.body;
  if (!cafeId || !email) {
    return res.status(400).json({ success: false, error: 'Missing cafeId or email' });
  }
  try {
    const userRef = db.collection('users').doc(cafeId).collection('emails').doc(email);
    const docSnap = await userRef.get();
    if (docSnap.exists) {
      return res.status(400).json({ success: false, error: 'Email již registrován pod touto kavárnou' });
    }
    const userData = { ...req.body };
    userData.created = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(userData);
    return res.json({ success: true });
  } catch (err) {
    console.error('saveCafeUser error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.saveUserById = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  let { cafeId, userId, email, wixid } = req.body;
  if (!cafeId || !userId || !email || !wixid) {
    return res.status(400).json({ success: false, error: 'Chybí cafeId, userId, wixid nebo email' });
  }
  if (cafeId.length > 12) {
    cafeId = cafeId.slice(-12);
  }
  try {
    const userRef = db.collection('users').doc(cafeId).collection('users').doc(userId);
    await userRef.set({ email: email, wixid: wixid });
    return res.json({ success: true, message: 'Uživatel úspěšně uložen.' });
  } catch (err) {
    console.error('saveUserById error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.storageTest = onObjectFinalized({ region: 'us-central1', cpu: 0.5 }, async event => {
  const object = event.data;
  const path = object.name || '';
  if (!path.startsWith('cardzapier/')) return;
  const [, cardID, ...rest] = path.split('/');
  const fileName = rest.join('/');
  const bucket = object.bucket;
  const token = object.metadata && object.metadata.firebaseStorageDownloadTokens;
  const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
  const url = token ? `${baseUrl}&token=${token}` : baseUrl;
  try {
    await db.doc(`cardzapier/${cardID}`).set(
      { [`${fileName}URL`]: url },
      { merge: true }
    );
  } catch (err) {
    console.error('storageTest Firestore write error:', err);
  }
});

exports.saveUserToUsersId = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  let { cafeId, userId, email, wixid } = req.body;
  if (!cafeId || !userId || !email || !wixid) {
    return res.status(400).json({ success: false, error: 'Chybí cafeId, userId, wixid nebo email' });
  }
  if (cafeId.length > 12) {
    cafeId = cafeId.slice(-12);
  }
  try {
    const userRef = db.collection('usersid').doc(cafeId).collection('users').doc(userId);
    await userRef.set({ email: email, wixid: wixid });
    return res.json({ success: true, message: 'Uživatel úspěšně uložen do usersid.' });
  } catch (err) {
    console.error('saveUserToUsersId error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.getUserDataForEditor = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const { cafeId, userId } = req.query;
  if (!cafeId || !userId) {
    return res.status(400).json({ success: false, error: 'Chybí cafeId nebo userId' });
  }

  try {
    // Krok 1: Získání emailu a wixid z 'usersid'
    const userRefStep1 = db.collection('usersid').doc(cafeId).collection('users').doc(userId);
    const userDocStep1 = await userRefStep1.get();

    if (!userDocStep1.exists) {
      return res.status(404).json({ success: false, error: 'Uživatel nenalezen v usersid.' });
    }
    const { email, wixid } = userDocStep1.data();

    if (!email || !wixid) {
        return res.status(404).json({ success: false, error: 'V záznamu chybí email nebo wixid.' });
    }

    // Krok 2: Získání kompletních dat z 'users'
    const userRefStep2 = db.collection('users').doc(wixid).collection('emails').doc(email);
    const userDocStep2 = await userRefStep2.get();

    if (!userDocStep2.exists) {
        // Zkusíme najít uživatele i pod jiným formátem, pokud by byl problém s lomítkem
        const alternativeEmail = email.replace(/\//g, '_');
        const alternativeUserRef = db.collection('users').doc(wixid).collection('emails').doc(alternativeEmail);
        const alternativeUserDoc = await alternativeUserRef.get();
        if (!alternativeUserDoc.exists) {
            return res.status(404).json({ success: false, error: `Hlavní záznam uživatele nenalezen pro email: ${email}` });
        }
        const finalUserData = {
            email: email,
            wixid: wixid,
            ...alternativeUserDoc.data()
        };
        return res.json({ success: true, data: finalUserData });
    }
    
    const finalUserData = {
        email: email,
        wixid: wixid,
        ...userDocStep2.data()
    };

    res.json({ success: true, data: finalUserData });

  } catch (err) {
    console.error('getUserDataForEditor error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.updateUserDataFromEditor = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { wixid, email, updatedData } = req.body;
    
    // Debug log pro diagnostiku
    console.log('📋 updateUserDataFromEditor payload:', JSON.stringify(req.body, null, 2));
    
    if (!wixid || !email || !updatedData) {
        console.log('❌ Chybějící data - wixid:', !!wixid, 'email:', !!email, 'updatedData:', !!updatedData);
        return res.status(400).json({ success: false, error: 'Chybí wixid, email nebo data pro aktualizaci.' });
    }

    try {
        const userRef = db.collection('users').doc(wixid).collection('emails').doc(email);
        
        // Přijímáme všechna data z updatedData objektu + přidáváme všechna chybějící pole
        const allowedUpdates = {
            // Původní pole
            stampCount: updatedData.stampCount,
            level1_status: updatedData.level1_status,
            level1_sleva: updatedData.level1_sleva,
            level1_zustatek: updatedData.level1_zustatek,
            level2_status: updatedData.level2_status,
            level2_sleva: updatedData.level2_sleva,
            level2_zustatek: updatedData.level2_zustatek,
            level3_status: updatedData.level3_status,
            level3_sleva: updatedData.level3_sleva,
            level3_zustatek: updatedData.level3_zustatek,
            // DŮLEŽITÉ: Přidáváme cardType a další chybějící pole z editoru
            cardType: updatedData.cardType,
            bodyValInput: updatedData.bodyValInput,
            bodyLabel1Input: updatedData.bodyLabel1Input,
            bodyBottomTopInput: updatedData.bodyBottomTopInput,
            bodyBottomBotInput: updatedData.bodyBottomBotInput,
            bodyKonverze: updatedData.bodyKonverze,
            stampValInput: updatedData.stampValInput,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('🔄 Allowed updates object:', allowedUpdates);

        const cleanUpdates = Object.fromEntries(Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined));

        if (Object.keys(cleanUpdates).length === 0) {
            return res.status(400).json({ success: false, error: 'Žádná platná data k aktualizaci.' });
        }

        await userRef.set(cleanUpdates, { merge: true });

        res.json({ success: true, message: 'Data uživatele úspěšně aktualizována.' });

    } catch (err) {
        console.error('updateUserDataFromEditor error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

exports.verifyStaffPassword = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    let { wixid, cafeId, password } = req.body;
    if ((!wixid && !cafeId) || !password) {
        return res.status(400).json({ success: false, error: 'Chybí wixid/cafeId nebo heslo.' });
    }

    try {
        if (!wixid) {
            const snapshot = await db.collection('cardzapier').where('wixid', '>=', cafeId).where('wixid', '<=', cafeId + '\uf8ff').limit(1).get();
            if (snapshot.empty) {
                return res.status(404).json({ success: false, error: 'Profil podniku s daným cafeId nebyl nalezen.' });
            }
            wixid = snapshot.docs[0].id;
        }

        const docRef = db.collection("cardzapier").doc(wixid);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Profil podniku nebyl nalezen.' });
        }

        const data = doc.data();
        const storedPasswordHash = data.staffPasswordHash;

        if (!storedPasswordHash) {
            return res.status(400).json({ success: false, error: 'V tomto profilu není nastaveno žádné heslo pro obsluhu.' });
        }

        const inputPasswordHash = crypto.createHash('sha256').update(password).digest('hex');

        if (inputPasswordHash === storedPasswordHash) {
            const sessionToken = crypto.createHash('sha256').update(storedPasswordHash + 'SECRET_SESSION_SALT').digest('hex');
            return res.json({ success: true, token: sessionToken });
        } else {
            return res.status(401).json({ success: false, error: 'Nesprávné heslo.' });
        }

    } catch (err) {
        console.error("verifyStaffPassword error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

exports.verifySessionToken = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { wixid, token } = req.body;

  if (!wixid || !token) {
    return res.status(400).json({ success: false, error: 'Chybí wixid nebo token.' });
  }

  try {
    const docRef = db.collection("cardzapier").doc(wixid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Profil podniku nebyl nalezen.' });
    }

    const data = doc.data();
    const storedPasswordHash = data.staffPasswordHash;

    if (!storedPasswordHash) {
      return res.status(400).json({ success: false, error: 'V tomto profilu není nastaveno žádné heslo pro obsluhu.' });
    }

    const expectedToken = crypto.createHash('sha256').update(storedPasswordHash + 'SECRET_SESSION_SALT').digest('hex');

    if (token === expectedToken) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, error: 'Neplatný nebo expirovaný token.' });
    }

  } catch (err) {
    console.error("verifySessionToken error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Načtení a export triggeru pro aktualizaci passu
Object.assign(exports, require('./newPassUpdateTrigger'));