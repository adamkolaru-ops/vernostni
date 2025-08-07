const { Datastore } = require('@google-cloud/datastore');

// Inicializace Datastore
const datastore = new Datastore({ projectId: 'vernostkarty-db' });

async function testCertificatesTable() {
  console.log('🔍 Kontrola tabulky certificates...');
  
  try {
    // Načtení všech záznamů z tabulky certificates
    const query = datastore.createQuery('certificates').order('name');
    const [certificates] = await datastore.runQuery(query);
    
    console.log(`📋 Nalezeno ${certificates.length} záznamů v tabulce certificates:`);
    
    let availableCount = 0;
    let assignedCount = 0;
    
    certificates.forEach((cert, index) => {
      console.log(`\n🔐 Záznam ${index + 1}:`);
      console.log(`  - name: ${cert.name}`);
      console.log(`  - fullId: ${cert.fullId || 'null (VOLNÝ)'}`);
      console.log(`  - passTypeIdentifier: ${cert.passTypeIdentifier || 'CHYBÍ'}`);
      console.log(`  - keypath: ${cert.keypath || 'CHYBÍ'}`);
      console.log(`  - pempath: ${cert.pempath || 'CHYBÍ'}`);
      
      if (cert.fullId === null || cert.fullId === undefined) {
        availableCount++;
      } else {
        assignedCount++;
      }
    });
    
    console.log(`\n📊 STATISTIKY:`);
    console.log(`  - Celkem záznamů: ${certificates.length}`);
    console.log(`  - Volných certifikátů: ${availableCount}`);
    console.log(`  - Přiřazených certifikátů: ${assignedCount}`);
    
    if (availableCount === 0) {
      console.log(`\n⚠️  VAROVÁNÍ: Žádné volné certifikáty! assignCertificate funkce nebude moci přiřadit žádný certifikát.`);
    } else {
      console.log(`\n✅ OK: Máme ${availableCount} volných certifikátů pro přiřazení.`);
    }
    
  } catch (error) {
    console.error('❌ Chyba při kontrole tabulky certificates:', error);
  }
}

// Spuštění testu
testCertificatesTable();
