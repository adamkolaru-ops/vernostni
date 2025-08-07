const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');

// Inicializace Secret Manager
const client = new SecretManagerServiceClient({
  projectId: 'vernostkarty',
  keyFilename: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json'
});

const projectId = 'vernostkarty';

async function migrateToSecretManager() {
  try {
    console.log('🔒 Začínám migraci certifikátů do Google Secret Manager...');
    
    // Definice všech certifikátů a jejich cest
    const secrets = [
      {
        name: 'apple-wallet-pass-cert',
        file: './vernostkarty/functions/certificates/passCert.pem',
        description: 'Apple Wallet Pass Certificate (PEM format)'
      },
      {
        name: 'apple-wallet-private-key',
        file: './vernostkarty/functions/certificates/privatekey.key',
        description: 'Apple Wallet Private Key'
      },
      {
        name: 'apple-wallet-wwdr-cert',
        file: './vernostkarty/functions/certificates/AppleWWDRCAG4.pem',
        description: 'Apple WWDR Certificate'
      },
      {
        name: 'firebase-vernostkarty-credentials',
        file: './vernostkarty/functions/certificates/vernostkarty-firebase-adminsdk-2j135-d46f086885.json',
        description: 'Firebase Admin SDK credentials for vernostkarty project'
      },
      {
        name: 'firebase-vernostkarty-db-credentials',
        file: './vernostkarty/functions/certificates/vernostkarty-db-service-account.json',
        description: 'Firebase service account credentials for vernostkarty-db project'
      },
      {
        name: 'firebase-vernostkarty-db-admin-credentials',
        file: './vernostkarty-db/functions/certificates/vernostkarty-db-firebase-adminsdk-fbsvc-0585ca91cb.json',
        description: 'Firebase Admin SDK credentials for vernostkarty-db project'
      }
    ];
    
    for (const secret of secrets) {
      console.log(`🔐 Zpracovávám: ${secret.name}`);
      
      // Kontrola existence souboru
      if (!fs.existsSync(secret.file)) {
        console.log(`⚠️  Soubor ${secret.file} neexistuje, přeskakuji...`);
        continue;
      }
      
      try {
        // 1. Vytvoření secret (pokud neexistuje)
        const secretName = `projects/${projectId}/secrets/${secret.name}`;
        
        try {
          await client.createSecret({
            parent: `projects/${projectId}`,
            secretId: secret.name,
            secret: {
              replication: {
                automatic: {},
              },
              labels: {
                type: secret.name.includes('apple') ? 'apple-wallet' : 'firebase',
                environment: 'production'
              }
            },
          });
          console.log(`✅ Secret ${secret.name} vytvořen.`);
        } catch (error) {
          if (error.code === 6) { // ALREADY_EXISTS
            console.log(`ℹ️  Secret ${secret.name} již existuje.`);
          } else {
            throw error;
          }
        }
        
        // 2. Načtení obsahu souboru
        const payload = fs.readFileSync(secret.file);
        
        // 3. Přidání verze secret
        const [version] = await client.addSecretVersion({
          parent: secretName,
          payload: {
            data: payload,
          },
        });
        
        console.log(`✅ Verze ${version.name} přidána pro ${secret.name}`);
        
      } catch (error) {
        console.error(`❌ Chyba při zpracování ${secret.name}:`, error.message);
      }
    }
    
    console.log('🎉 Migrace do Secret Manager dokončena!');
    console.log('📋 Vytvořené secrets:');
    
    // Výpis všech secrets
    const [secrets_list] = await client.listSecrets({
      parent: `projects/${projectId}`,
    });
    
    secrets_list.forEach(secret => {
      if (secret.name.includes('apple-wallet') || secret.name.includes('firebase-vernostkarty')) {
        console.log(`   🔐 ${secret.name.split('/').pop()}`);
      }
    });
    
    console.log('\n🚨 DŮLEŽITÉ BEZPEČNOSTNÍ DOPORUČENÍ:');
    console.log('1. Smažte certifikáty z Cloud Storage bucket');
    console.log('2. Aktualizujte helper funkce na používání Secret Manager');
    console.log('3. Ověřte přístupová práva v IAM');
    console.log('4. Zvažte rotaci všech certifikátů (mohou být kompromitovány)');
    
  } catch (error) {
    console.error('❌ Chyba při migraci:', error);
    process.exit(1);
  }
}

// Spuštění migrace
migrateToSecretManager();
