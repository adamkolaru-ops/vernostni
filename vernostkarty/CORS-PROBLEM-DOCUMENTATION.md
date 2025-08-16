# Dokumentace CORS problému v Firebase Cloud Functions

## Problém

Při vývoji Firebase Cloud Functions (zejména 2. generace) a jejich volání z webových aplikací často dochází k problémům s CORS (Cross-Origin Resource Sharing) a autentizací, které se projevují následujícími chybami:

```
Access to fetch at 'https://us-central1-vernostkarty-db.cloudfunctions.net/funkce' from origin 'https://www.example.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

nebo

```
Failed to load resource: the server responded with a status of 403 (Forbidden)
```

Tyto chyby jsou způsobeny dvěma hlavními faktory:

1. **Chybějící CORS hlavičky** - Cloud Function neposílá správné CORS hlavičky, které by povolily přístup z jiných domén
2. **Chybějící veřejný přístup** - Cloud Functions 2. generace (Cloud Run) vyžadují explicitní povolení neautentizovaných přístupů

## Detailní analýza problému

### 1. CORS hlavičky

CORS (Cross-Origin Resource Sharing) je bezpečnostní mechanismus prohlížečů, který omezuje HTTP požadavky iniciované z jiných domén. Když webová stránka na doméně A chce volat API na doméně B, prohlížeč nejprve pošle tzv. "preflight" požadavek metodou OPTIONS, aby zjistil, zda je takový přístup povolen.

Server musí odpovědět s příslušnými CORS hlavičkami:
- `Access-Control-Allow-Origin`: Které domény mohou přistupovat k API
- `Access-Control-Allow-Methods`: Které HTTP metody jsou povoleny
- `Access-Control-Allow-Headers`: Které HTTP hlavičky jsou povoleny

### 2. Veřejný přístup k Cloud Functions 2. generace

Firebase Cloud Functions 2. generace jsou postaveny na Google Cloud Run a mají **defaultně zakázaný neautentizovaný přístup**. To znamená, že i když správně nastavíte CORS hlavičky, funkce bude stále vracet 403 Forbidden, pokud explicitně nepovolíte veřejný přístup.

## Řešení

### Správná implementace Cloud Function s CORS podporou

```javascript
const functions = require('firebase-functions');
const { onRequest } = require("firebase-functions/v2/https");

// Správná implementace pro Cloud Functions 2. generace
exports.mojeCloudFunkce = onRequest({ 
  cors: true,                // Povolí základní CORS hlavičky
  cpu: 0.5,                  // Nastavení výkonu
  invoker: 'public'          // KLÍČOVÉ: Povolí veřejný přístup bez autentizace
}, async (req, res) => {
  
  // Explicitní CORS hlavičky pro větší kontrolu
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.set('Access-Control-Max-Age', '3600');

  // Zpracování preflight požadavků
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }
  
  // Vlastní logika funkce
  try {
    // Implementace funkce...
    res.status(200).json({ success: true, data: "Výsledek" });
  } catch (error) {
    console.error('Chyba:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Klíčové body řešení

1. **Parametr `invoker: 'public'`** - Nejdůležitější parametr pro Cloud Functions 2. generace, který povolí neautentizované přístupy. Bez tohoto parametru bude funkce vracet 403 Forbidden i přes správné CORS hlavičky.

2. **Explicitní CORS hlavičky** - I když parametr `cors: true` přidá základní CORS hlavičky, je dobrou praxí přidat je explicitně pro větší kontrolu.

3. **Zpracování OPTIONS požadavků** - Prohlížeče před skutečným požadavkem posílají preflight požadavek metodou OPTIONS, který musí být správně zpracován.

## Příklady problémů a jejich řešení

### Příklad 1: assignCertificate

**Problém**: Funkce `assignCertificate` nefungovala při volání z WIX frontendu, vracela CORS chybu.

**Řešení**: Přidání parametru `invoker: 'public'` do definice funkce:

```javascript
exports.assignCertificate = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
  // Implementace...
});
```

### Příklad 2: createGoogleWalletTemplate

**Problém**: Funkce `createGoogleWalletTemplate` nefungovala při volání z HTML formuláře, vracela 403 Forbidden.

**Řešení**: Přidání parametru `invoker: 'public'` do definice funkce:

```javascript
// PŘED (nefunkční):
exports.createGoogleWalletTemplate = onRequest({ cors: true, cpu: 0.5 }, async (req, res) => {

// PO (funkční):
exports.createGoogleWalletTemplate = onRequest({ cors: true, cpu: 0.5, invoker: 'public' }, async (req, res) => {
```

## Bezpečnostní poznámky

Parametr `invoker: 'public'` umožňuje volání funkce bez autentizace, což může představovat bezpečnostní riziko. Pro citlivé operace zvažte následující:

1. **Implementujte vlastní autentizaci** - Ověřte identitu volajícího pomocí tokenů, API klíčů nebo jiných metod
2. **Omezte přístup podle IP adresy** - Pokud je to možné
3. **Implementujte rate limiting** - Omezte počet požadavků z jedné IP adresy
4. **Logujte všechny přístupy** - Pro případnou forenzní analýzu

## Shrnutí

Pro správné fungování Firebase Cloud Functions 2. generace (Cloud Run) s webovými aplikacemi je nutné:

1. Přidat parametr `invoker: 'public'` do definice funkce
2. Implementovat správné CORS hlavičky
3. Zpracovat preflight požadavky (OPTIONS)
4. Nasadit funkci pomocí `firebase deploy`

Dodržením těchto kroků předejdete CORS a autentizačním problémům při volání Cloud Functions z webových aplikací.
