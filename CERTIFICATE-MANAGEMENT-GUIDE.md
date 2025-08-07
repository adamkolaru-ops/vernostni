# Průvodce správou certifikátů pro Apple Wallet

## Přehled systému

Systém dynamické správy certifikátů umožňuje:
- **Dynamické načítání certifikátů** podle `cafeId` z Google Cloud Storage
- **Centralizovanou správu** cest k certifikátům v Google Datastore
- **Multi-tenant architekturu** - různé certifikáty pro různé kavárny
- **Fallback mechanismus** na lokální soubory při selhání

## Architektura

### 1. Úložiště certifikátů
- **Google Cloud Storage bucket**: `vernostni-certificates`
- **Struktura složek**:
  ```
  vernostni-certificates/
  ├── original/apple-wallet/
  │   ├── certificates.p12
  │   └── AppleWWDRCAG4.pem
  └── 000001/
      ├── 0000001_Certifikáty.p12
      └── 0000001_AppleWWDRCAG4.pem
  ```

### 2. Metadata v Datastore
- **Kolekce**: `cardzapier/{cafeId}`
- **Struktura dokumentu**:
  ```json
  {
    "p12Path": "original/apple-wallet/certificates.p12",
    "wwdrPath": "original/apple-wallet/AppleWWDRCAG4.pem",
    "certificateType": "original",
    "updatedAt": "2025-08-03T18:09:00.177Z"
  }
  ```

### 3. Helper funkce
- **Soubor**: `certificateHelperV2.js`
- **Klíčové funkce**:
  - `getCertificatePathsByCafeId(cafeId)` - načte cesty z Datastore
  - `getAppleCertificatesByCafeId(cafeId)` - načte certifikáty z Cloud Storage
  - `getFirebaseCredentials(type)` - načte Firebase credentials

## Refaktorované soubory

### Projekt `vernostkarty`
1. **`index.js`**
   - ✅ Dynamická inicializace Firebase Admin
   - ✅ Dynamické načítání certifikátů v `createPass` podle `cafeId`
   - ✅ Dynamické načítání certifikátů v `generateUpdatedPass` podle `cafeId`

2. **`appleWalletWebhook.js`**
   - ✅ Dynamická inicializace Firebase Admin
   - ✅ Dynamické načítání certifikátů podle `cafeId` z původní karty

### Projekt `vernostkarty-db`
1. **`index.js`**
   - ✅ Dynamická inicializace Firebase Admin

2. **`newPassUpdateTrigger.js`**
   - ✅ Dynamická inicializace APN provider podle `cafeId`
   - ✅ Načítání certifikátů pro push notifikace

3. **`passUpdateTrigger.js`**
   - ✅ Dynamická inicializace APN provider podle `cafeId`
   - ✅ Načítání certifikátů pro push notifikace

## Použití

### Pro existující kavárny (original)
- **CafeId**: `1cf87e2e-e29a-4734-9e9a-ffa03fbd8029`
- **Certifikáty**: automaticky načítány z `original/apple-wallet/`

### Pro nové kavárny
1. **Nahrát certifikáty** do Cloud Storage pod novým prefixem
2. **Vytvořit záznam** v Datastore `cardzapier/{cafeId}` s cestami
3. **Systém automaticky** načte certifikáty podle `cafeId`

## Správa certifikátů

### Přidání nových certifikátů
```javascript
// 1. Nahrát certifikáty do Cloud Storage
await certificateHelper.uploadCertificatesWithPrefix('123456', {
  p12: './path/to/new-cert.p12',
  wwdr: './path/to/AppleWWDRCAG4.pem'
});

// 2. Vytvořit záznam v Datastore
const key = datastore.key(['cardzapier', 'new-cafe-id']);
await datastore.save({
  key: key,
  data: {
    p12Path: '123456/123456_Certifikáty.p12',
    wwdrPath: '123456/123456_AppleWWDRCAG4.pem',
    certificateType: 'custom',
    updatedAt: new Date().toISOString()
  }
});
```

### Rotace certifikátů
1. **Nahrát nové certifikáty** do Cloud Storage
2. **Aktualizovat cesty** v Datastore záznamu
3. **Systém automaticky** začne používat nové certifikáty

## Bezpečnost

### Současný stav
- ✅ Certifikáty uloženy v Google Cloud Storage
- ✅ Přístup přes service account klíče
- ✅ Fallback na lokální soubory

### Doporučení pro produkci
- 🔄 **Google Secret Manager** pro maximální bezpečnost
- 🔄 **Environment variables** ve Functions
- 🔄 **Rotace service account klíčů**

## Testování

```bash
# Test helper funkcí
node test-cert-by-cafeid.js

# Test refaktorovaného kódu
node test-refactored-code.js
```

## Pass Type Identifier
- **Produkční**: `pass.pass.com.example.vernostkarty2`
- Používá se ve všech projektech konzistentně

## Fallback mechanismus
Při selhání načítání z Cloud Storage:
1. **Automatický fallback** na lokální certifikáty
2. **Logování chyb** pro monitoring
3. **Zachování funkčnosti** systému

---

*Dokumentace vytvořena: 2025-08-03*
*Verze systému: v2.0 - Dynamické načítání certifikátů*
