const { Datastore } = require('@google-cloud/datastore');
const admin = require('firebase-admin');

// Lazy initialization - inicializace až při prvním volání funkce
let datastore = null;
let db = null;

function initializeServices() {
  if (!datastore) {
    // Použijeme defaultní kredenciály (funguje jak lokálně s gcloud auth, tak v Cloud Functions)
    datastore = new Datastore({ projectId: 'vernostkarty-db' });
  }
  
  if (!db) {
    // Inicializace Firebase Admin pouze pokud ještě není inicializován
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    db = admin.firestore();
  }
}

/**
 * Cloud Function pro přiřazení certifikátu k účtu
 * Najde první volný záznam v tabulce certificates a přiřadí ho k fullId
 */
async function assignCertificate(req, res) {
  // CORS headers - enhanced for WIX frontend
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  try {
    // Inicializace služeb při prvním volání
    initializeServices();
    
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
    const existingQuery = datastore.createQuery('certificates')
      .filter('fullId', '=', fullId);
    
    const [existingResults] = await existingQuery.run();
    
    if (existingResults.length > 0) {
      const existingCertificate = existingResults[0];
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

    // 1. Najít první volný záznam v tabulce certificates (fullId == null)
    const query = datastore.createQuery('certificates')
      .filter('fullId', '=', null)
      .order('name')
      .limit(1);

    const [results] = await query.run();

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
}

module.exports = { assignCertificate };
