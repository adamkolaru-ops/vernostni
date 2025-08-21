const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Datastore } = require('@google-cloud/datastore');

// Inicializace Firebase Admin pro deployment
admin.initializeApp({
  credential: admin.credential.cert(require("./certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json")),
  databaseURL: "https://vernostkarty-db-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();
const datastore = new Datastore({ projectId: 'vernostkarty-db' });

const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const crypto = require("crypto");

exports.createPass = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.verifyId = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.addTestInfo = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.createBusinessRecord = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.updateUserData = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.getBusinessName = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.getCardData = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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
    // Zajisti, že vracíme geolokační pole pobočky i když v DB chybí
    const raw = docSnap.data() || {};
    const enriched = {
      ...raw,
      // Podporujeme i snake_case fallbacky pro starší data
      branchAddress: raw.branchAddress || raw.branch_address || '',
      branchLat: (raw.branchLat ?? raw.branch_lat ?? null),
      branchLng: (raw.branchLng ?? raw.branch_lng ?? null),
      branchCity: raw.branchCity || raw.branch_city || '',
      branchPostalCode: raw.branchPostalCode || raw.branch_postal_code || '',
      branchCountry: raw.branchCountry || raw.branch_country || '',
      branchPlaceId: raw.branchPlaceId || raw.branch_place_id || ''
    };
    return res.json({ success: true, data: enriched });
  } catch (e) {
    console.error('getCardData error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

exports.getCafeSettings = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const cafeId = req.query.id;
  if (!cafeId || cafeId.length < 12) {
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
    // Normalizace geolokačních polí pobočky, aby UI dostalo konzistentní klíče
    const s = settings || {};
    const normalized = {
      ...s,
      branchAddress: s.branchAddress || s.branch_address || '',
      branchLat: (s.branchLat ?? s.branch_lat ?? null),
      branchLng: (s.branchLng ?? s.branch_lng ?? null),
      branchCity: s.branchCity || s.branch_city || '',
      branchPostalCode: s.branchPostalCode || s.branch_postal_code || '',
      branchCountry: s.branchCountry || s.branch_country || '',
      branchPlaceId: s.branchPlaceId || s.branch_place_id || ''
    };
    console.log(`✅ getCafeSettings normalized settings:`, JSON.stringify(normalized, null, 2));
    return res.json({ success: true, id: matchedFullId, settings: normalized });
  } catch (err) {
    console.error('getCafeSettings error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.ensureUser = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.getCafeUser = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.saveCafeUser = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.saveUserById = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.saveUserToUsersId = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.getUserDataForEditor = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const { cafeId, userId } = req.query;
  if (!cafeId || !userId) {
    return res.status(400).json({ success: false, error: 'Chybí cafeId nebo userId' });
  }

  try {
    console.log(`getUserDataForEditor: Hledám uživatele s cafeId=${cafeId} a userId=${userId} z URL`);
    
    // Strategie 1: Přesné hledání podle userId z URL
    const userRefExact = db.collection('usersid').doc(cafeId).collection('users').doc(userId);
    const userDocExact = await userRefExact.get();
    
    if (userDocExact.exists) {
      console.log(`getUserDataForEditor: Nalezen přesný záznam pro userId=${userId}`);
      const { email, wixid } = userDocExact.data();
      
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
          anonymousId: userId, // Přidáme anonymousId z URL do výsledku
          ...alternativeUserDoc.data()
        };
        
        return res.json({ success: true, data: finalUserData });
      }
      
      const finalUserData = {
        email: email,
        wixid: wixid,
        anonymousId: userId, // Přidáme anonymousId z URL do výsledku
        ...userDocStep2.data()
      };
      
      return res.json({ success: true, data: finalUserData });
    }
    
    // Strategie 2: Hledání podle anonymousId v celé kolekci
    console.log(`getUserDataForEditor: Přesný záznam nenalezen, hledám podle anonymousId v celé kolekci`);
    const usersRef = db.collection('usersid').doc(cafeId).collection('users');
    const usersSnapshot = await usersRef.where('anonymousId', '==', userId).get();
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      console.log(`getUserDataForEditor: Nalezen záznam podle anonymousId=${userId}`);
      const { email, wixid } = userDoc.data();
      
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
          anonymousId: userId, // Přidáme anonymousId z URL do výsledku
          ...alternativeUserDoc.data()
        };
        
        return res.json({ success: true, data: finalUserData });
      }
      
      const finalUserData = {
        email: email,
        wixid: wixid,
        anonymousId: userId, // Přidáme anonymousId z URL do výsledku
        ...userDocStep2.data()
      };
      
      return res.json({ success: true, data: finalUserData });
    }
    
    // Pokud jsme nenašli uživatele ani jednou strategií
    console.log(`getUserDataForEditor: Uživatel nenalezen ani jednou strategií`);
    return res.status(404).json({ 
      success: false, 
      error: `Uživatel s ID ${userId} nebyl nalezen. Zkontrolujte, zda je ID správné.` 
    });

  } catch (err) {
    console.error('getUserDataForEditor error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

exports.updateUserDataFromEditor = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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
            pempath: updatedData.pempath, // Přidáno
            keypath: updatedData.keypath, // Přidáno
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

        const data = await userRef.get();
        const responseData = { ...data.data() };

        if (data.data().pempath) {
          responseData.pempath = data.data().pempath;
        }
        if (data.data().keypath) {
          responseData.keypath = data.data().keypath;
        }

        res.json({ success: true, settings: responseData });

    } catch (err) {
        console.error('updateUserDataFromEditor error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

exports.verifyStaffPassword = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

exports.verifySessionToken = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
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

// assignCertificate funkce - přiřazení certifikátu k účtu
exports.assignCertificate = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    console.log('🚀 Začínám přiřazování certifikátu...');
    
    const { fullId } = req.body;
    
    if (!fullId) {
      return res.status(400).json({
        success: false,
        error: 'Chybí parametr fullId'
      });
    }

    // Ověření formátu fullId (36 znaků UUID)
    if (!fullId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        error: 'Neplatný formát fullId'
      });
    }

    console.log(`📋 Hledám volný certifikát pro fullId: ${fullId}`);

    // 0. Nejprve zkontrolujeme, zda uživatel už nemá přiřazený certifikát
    // Použijeme alternativní přístup bez indexu - načteme všechny certifikáty a filtrujeme v kódu
    try {
      const allCertificatesQuery = datastore.createQuery('certificates');
      const [allCertificates] = await allCertificatesQuery.run();
      
      // Najdeme existující certifikát pro dané fullId
      const existingCertificate = allCertificates.find(cert => cert.fullId === fullId);
      
      if (existingCertificate) {
        console.log(`🔍 Uživatel s fullId ${fullId} již má přiřazený certifikát: ${existingCertificate.name}`);
        
        // Získat hodnoty z existujícího záznamu
        const keypath = existingCertificate.keypath || null;
        const pempath = existingCertificate.pempath || null;
        const passTypeIdentifier = existingCertificate.passTypeIdentifier || null;
        
        return res.status(200).json({
          success: true,
          certificateName: existingCertificate.name,
          fullId,
          data: {
            keypath,
            pempath,
            passTypeIdentifier
          },
          message: 'Certifikát již byl přiřazen dříve'
        });
      }
      
      console.log(`🆕 Uživatel s fullId ${fullId} nemá ještě přiřazený žádný certifikát`);
      
    } catch (error) {
      console.error('⚠️ Chyba při kontrole existujících certifikátů:', error);
      // Pokračujeme dál, i když se kontrola nezdařila
    }

    // 1. Najít první volný záznam v tabulce certificates (fullId == null)
    // Použijeme alternativní přístup bez indexu - načteme všechny a filtrujeme v kódu
    const allQuery = datastore.createQuery('certificates');
    const [allResults] = await allQuery.run();
    
    // Najdeme první volný certifikát (fullId == null nebo undefined)
    const availableCertificates = allResults.filter(cert => !cert.fullId || cert.fullId === null);
    availableCertificates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    const results = availableCertificates.slice(0, 1);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Žádný volný certifikát nebyl nalezen'
      });
    }

    const certificate = results[0];
    const certificateName = certificate.name;
    
    console.log(`✅ Nalezen volný certifikát: ${certificateName}`);

    // 2. Aktualizovat záznam - nastavit fullId
    const key = datastore.key(['certificates', certificateName]);
    const updatedCertificate = {
      ...certificate,
      fullId: fullId
    };

    await datastore.save({
      key,
      data: updatedCertificate
    });

    console.log(`💾 Certifikát ${certificateName} přiřazen k fullId: ${fullId}`);

    // 3. Získat hodnoty keypath, pempath a passTypeIdentifier z aktualizovaného záznamu
    const keypath = certificate.keypath || null;
    const pempath = certificate.pempath || null;
    const passTypeIdentifier = certificate.passTypeIdentifier || null;

    console.log(`📝 Hodnoty k uložení do Firebase:`, {
      keypath,
      pempath,
      passTypeIdentifier
    });

    // 4. Zapsat hodnoty do Firebase cardzapier/{fullId}
    const cardzapierRef = db.collection('cardzapier').doc(fullId);
    
    // Nejprve zkontrolujeme, zda dokument existuje
    const docSnapshot = await cardzapierRef.get();
    
    const updateData = {};
    if (keypath !== null) updateData.keypath = keypath;
    if (pempath !== null) updateData.pempath = pempath;
    if (passTypeIdentifier !== null) updateData.passTypeIdentifier = passTypeIdentifier;

    if (docSnapshot.exists) {
      // Dokument existuje - aktualizujeme ho
      await cardzapierRef.update(updateData);
      console.log(`🔄 Aktualizován existující dokument cardzapier/${fullId}`);
    } else {
      // Dokument neexistuje - vytvoříme ho
      await cardzapierRef.set(updateData);
      console.log(`📄 Vytvořen nový dokument cardzapier/${fullId}`);
    }

    console.log('🎉 Přiřazení certifikátu dokončeno úspěšně!');

    return res.status(200).json({
      success: true,
      certificateName,
      fullId,
      data: {
        keypath,
        pempath,
        passTypeIdentifier
      }
    });

  } catch (error) {
    console.error('❌ Chyba při přiřazování certifikátu:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Načtení a export triggeru pro aktualizaci passu
Object.assign(exports, require('./newPassUpdateTrigger'));

// Google Wallet Template Creation - with Google API integration
exports.createGoogleWalletTemplate = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const { id, data } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "Missing ID" });
  }
  
  try {
    // 1. Uložit data do Firestore
    console.log(`Saving data to Firestore for ID: ${id}`);
    await db.collection("test-sablona").doc(id).set(data, { merge: true });
    console.log('Data saved to Firestore successfully');
    
    // 2. Vytvořit Google Wallet šablonu
    console.log('Creating Google Wallet template...');
    const googleWalletResult = await createGoogleWalletClass(id, data);
    console.log('Google Wallet template created:', googleWalletResult);
    
    return res.json({ 
      success: true, 
      classId: id,
      googleWalletClass: googleWalletResult
    });
  } catch (err) {
    console.error("createGoogleWalletTemplate error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Google Wallet Pass Creation - with Google API integration
exports.createGoogleWalletPass = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const { classId, objectData } = req.body;
  if (!classId || !objectData) {
    return res.status(400).json({ success: false, error: "Missing classId or objectData" });
  }
  
  try {
    // 1. Uložit data do Firestore (volitelně)
    console.log(`Creating Google Wallet pass for classId: ${classId}`);
    
    // 2. Vytvořit Google Wallet pass
    console.log('Creating Google Wallet pass object...');
    const googleWalletResult = await createGoogleWalletObject(classId, objectData);
    console.log('Google Wallet pass created:', googleWalletResult);
    
     // 3. Vygenerovat Save to Google Wallet URL (saveUrl) pomocí podepsaného JWT
     let saveUrl = null;
     try {
       const fs = require('fs');
       const path = require('path');
       const jwt = require('jsonwebtoken');
       const keyFilePath = path.join(__dirname, './vernostkarty-8dfab1a54234.json');
       const keyJson = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
       const serviceAccountEmail = keyJson.client_email;
       const privateKey = keyJson.private_key;
       
       const now = Math.floor(Date.now() / 1000);
       const claims = {
         iss: serviceAccountEmail,
         aud: 'google',
         typ: 'savetowallet',
         iat: now,
         payload: {
           loyaltyObjects: [ { id: googleWalletResult.id } ]
         }
       };
       const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
       saveUrl = `https://pay.google.com/gp/v/save/${token}`;
     } catch (e) {
       console.error('Failed to generate Save to Google Wallet URL:', e);
     }
    
     return res.json({ 
       success: true, 
       classId: classId,
       objectId: googleWalletResult.id,
       saveUrl,
       googleWalletObject: googleWalletResult
     });
  } catch (err) {
    console.error("createGoogleWalletPass error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper funkce pro vytvoření Google Wallet pasu (objektu)
async function createGoogleWalletObject(classId, objectData) {
  const { GoogleAuth } = require('google-auth-library');
  const path = require('path');
  
  const ISSUER_ID = '3388000000022981331';
  const keyFilePath = path.join(__dirname, './vernostkarty-8dfab1a54234.json');
  
  try {
    // Autentifikace s Google
    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    });
    
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    // Vytvoření objectId z emailu nebo fallback
    const normalize = (s) => (s || '').toString().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const emailSlug = objectData.email ? normalize(objectData.email) : null;
    const fallbackSuffix = `${normalize(classId)}-${Date.now()}`;
    const objectSuffix = objectData.objectSuffix || emailSlug || fallbackSuffix;
    const fullObjectId = `${ISSUER_ID}.${objectSuffix}`;
    const fullClassId = classId.includes('.') ? classId : `${ISSUER_ID}.${classId}`;
    
    // Vytvoření loyalty object pro Google Wallet
    const loyaltyObject = {
      id: fullObjectId,
      classId: fullClassId,
      state: 'ACTIVE'
    };
    
    // accountId/accountName
    const accountName = [objectData.givenName || '', objectData.familyName || ''].join(' ').trim();
    if (objectData.email) loyaltyObject.accountId = String(objectData.email);
    if (accountName) loyaltyObject.accountName = accountName;
    
    // Loyalty points (volitelně)
    const pointsInt = Number.isFinite(Number(objectData.points)) ? parseInt(objectData.points, 10) : null;
    if (!Number.isNaN(pointsInt) && pointsInt !== null) {
      loyaltyObject.loyaltyPoints = {
        label: 'Body',
        balance: { int: pointsInt }
      };
    }
    
    // TextModulesData v objektu - toto je správný způsob pro zobrazení na kartě!
    if (Array.isArray(objectData.textModulesData) && objectData.textModulesData.length) {
      loyaltyObject.textModulesData = objectData.textModulesData
        .map(m => ({
          id: m.id, // např. 'pole1', 'pole2', 'pole3'
          header: m.header, // např. 'Sleva', 'Status', 'Ušetřeno'
          body: m.body // např. '30%', 'VIP', '150 Kč'
        }))
        .filter(p => p.id && p.header && p.body);
    }
    
    // Hero image (strip) pro objekt – pokud je poskytnut, přebije class hero image
    const objectHeroUri = (objectData.heroImage && objectData.heroImage.sourceUri && objectData.heroImage.sourceUri.uri)
      || (objectData.heroImageUrl && String(objectData.heroImageUrl).trim());
    if (objectHeroUri) {
      loyaltyObject.heroImage = { sourceUri: { uri: objectHeroUri } };
    }
    
    // Barcode – pokud je k dispozici
    if (objectData.barcodeValue) {
      loyaltyObject.barcode = {
        type: 'QR_CODE',
        value: String(objectData.barcodeValue),
        alternateText: String(objectData.barcodeValue)
      };
    }
    
    // API volání na Google Wallet
    const https = require('https');
    const apiUrl = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject`;
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(loyaltyObject);
      
      const options = {
        hostname: 'walletobjects.googleapis.com',
        port: 443,
        path: '/walletobjects/v1/loyaltyObject',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`Google API error: ${res.statusCode} - ${responseData}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Google API response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Google API request failed: ${error.message}`));
      });
      
      req.write(postData);
      req.end();
    });
    
  } catch (error) {
    console.error('Google Wallet API error:', error);
    throw new Error(`Failed to create Google Wallet object: ${error.message}`);
  }
}

// Helper funkce pro vytvoření Google Wallet šablony
async function createGoogleWalletClass(classId, templateData) {
  const { GoogleAuth } = require('google-auth-library');
  const path = require('path');
  
  const ISSUER_ID = '3388000000022981331';
  const keyFilePath = path.join(__dirname, './vernostkarty-8dfab1a54234.json');
  
  try {
    // Autentifikace s Google
    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    });
    
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    // Vytvoření loyalty class pro Google Wallet
    const loyaltyClass = {
      id: `${ISSUER_ID}.${classId}`,
      issuerName: templateData.issuerName || 'Vernostní karty',
      programName: templateData.programName || 'Věrnostní program',
      hexBackgroundColor: templateData.hexBackgroundColor || '#4285f4',
      localizedIssuerName: {
        defaultValue: {
          language: 'cs',
          value: templateData.issuerName || 'Vernostní karty'
        }
      },
      localizedProgramName: {
        defaultValue: {
          language: 'cs', 
          value: templateData.programName || 'Věrnostní program'
        }
      },
      reviewStatus: 'UNDER_REVIEW'
    };
    
    // Přidat logo pouze pokud je zadáno
    if (templateData.programLogo && templateData.programLogo.trim() !== '') {
      loyaltyClass.programLogo = {
        sourceUri: {
          uri: templateData.programLogo
        }
      };
    }
    // Hero image (strip) pro šablonu – zobrazí se pod horní hlavičkou
    const classHeroUri = (templateData.heroImage && templateData.heroImage.sourceUri && templateData.heroImage.sourceUri.uri)
      || (templateData.heroImageUrl && templateData.heroImageUrl.trim());
    if (classHeroUri) {
      loyaltyClass.heroImage = { sourceUri: { uri: classHeroUri } };
    }

    // Definice zobrazení na přední straně karty - všechna 3 pole vedle sebe!
    loyaltyClass.classTemplateInfo = {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            threeItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['pole1']" }]
                }
              },
              middleItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['pole2']" }]
                }
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['pole3']" }]
                }
              }
            }
          }
        ]
      }
    };
    
    // API volání na Google Wallet
    const https = require('https');
    const apiUrl = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass`;
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(loyaltyClass);
      
      const options = {
        hostname: 'walletobjects.googleapis.com',
        port: 443,
        path: '/walletobjects/v1/loyaltyClass',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`Google API error: ${res.statusCode} - ${responseData}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Google API response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Google API request failed: ${error.message}`));
      });
      
      req.write(postData);
      req.end();
    });
    
  } catch (error) {
    console.error('Google Wallet API error:', error);
    throw new Error(`Failed to create Google Wallet class: ${error.message}`);
  }
}