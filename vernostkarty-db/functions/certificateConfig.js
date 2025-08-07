/**
 * Centrální konfigurace certifikátů pro oba projekty (vernostkarty i vernostkarty-db)
 * Tento soubor definuje, kde se nacházejí certifikáty pro různé cafeId
 * 
 * DŮLEŽITÉ: Tento soubor je zdrojem pravdy pro cesty k certifikátům
 * Změna zde se projeví ve všech funkcích napříč projekty
 */

const CERTIFICATE_CONFIG = {
  // Výchozí (original) certifikáty
  default: {
    cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
    p12Path: 'original/apple-wallet/certificates.p12',
    wwdrPath: 'original/apple-wallet/AppleWWDRCAG4.pem',
    pemCertPath: 'original/apple-wallet/passCert.pem',
    pemKeyPath: 'original/apple-wallet/privatekey.key',
    description: 'Original certifikáty pro všechny kavárny'
  },
  
  // Budoucí certifikáty pro konkrétní kavárny
  // Příklad:
  // '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029': {
  //   cafeId: '1cf87e2e-e29a-4734-9e9a-ffa03fbd8029',
  //   p12Path: 'cafe1/apple-wallet/certificates.p12',
  //   wwdrPath: 'cafe1/apple-wallet/AppleWWDRCAG4.pem',
  //   pemCertPath: 'cafe1/apple-wallet/passCert.pem',
  //   pemKeyPath: 'cafe1/apple-wallet/privatekey.key',
  //   description: 'Specifické certifikáty pro kavárnu XYZ'
  // }
};

/**
 * Načte cesty k certifikátům podle cafeId
 * @param {string} cafeId - ID kavárny
 * @returns {Object} Objekt s cestami k certifikátům
 */
function getCertificatePathsByCafeId(cafeId) {
  console.log(`🔍 Načítám cesty k certifikátům pro cafeId: ${cafeId} z centrální konfigurace`);
  
  // Pokud existuje specifická konfigurace pro toto cafeId, použij ji
  if (CERTIFICATE_CONFIG[cafeId]) {
    console.log(`✅ Nalezena specifická konfigurace pro cafeId: ${cafeId}`);
    return CERTIFICATE_CONFIG[cafeId];
  }
  
  // Jinak použij výchozí konfiguraci
  console.log(`✅ Používám výchozí konfiguraci pro cafeId: ${cafeId}`);
  return CERTIFICATE_CONFIG.default;
}

/**
 * Přidá nebo aktualizuje konfiguraci certifikátů pro konkrétní cafeId
 * @param {string} cafeId - ID kavárny
 * @param {Object} config - Konfigurace certifikátů
 */
function setCertificateConfig(cafeId, config) {
  console.log(`🔧 Aktualizuji konfiguraci certifikátů pro cafeId: ${cafeId}`);
  CERTIFICATE_CONFIG[cafeId] = {
    cafeId,
    ...config,
    updatedAt: new Date().toISOString()
  };
  console.log(`✅ Konfigurace pro cafeId ${cafeId} aktualizována`);
}

/**
 * Vypíše všechny dostupné konfigurace certifikátů
 */
function listAllConfigurations() {
  console.log('📋 Všechny dostupné konfigurace certifikátů:');
  Object.keys(CERTIFICATE_CONFIG).forEach(key => {
    const config = CERTIFICATE_CONFIG[key];
    console.log(`  - ${key}: ${config.description || 'Bez popisu'}`);
    console.log(`    Cesty: ${config.p12Path}, ${config.pemCertPath}, ${config.pemKeyPath}, ${config.wwdrPath}`);
  });
}

module.exports = {
  getCertificatePathsByCafeId,
  setCertificateConfig,
  listAllConfigurations,
  CERTIFICATE_CONFIG
};
