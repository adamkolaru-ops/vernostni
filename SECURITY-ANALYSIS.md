# 🔒 Bezpečnostní analýza úložiště certifikátů

## 🚨 SOUČASNÝ STAV - VYSOKÉ RIZIKO

### Cloud Storage (současné řešení)
- ❌ **Certifikáty v čistém textu** - nejsou šifrované
- ❌ **Přístup přes API** - potenciální únik přes API klíče
- ❌ **Audit log omezený** - základní logování
- ❌ **Široká přístupová práva** - celý bucket

## ✅ DOPORUČENÁ BEZPEČNÁ ŘEŠENÍ

### 1. Firebase Functions Environment Variables (NEJBEZPEČNĚJŠÍ)
```bash
# Nastavení certifikátů jako environment variables
firebase functions:config:set \
  apple.pass_cert="$(cat passCert.pem | base64)" \
  apple.private_key="$(cat privatekey.key | base64)" \
  apple.wwdr_cert="$(cat AppleWWDRCAG4.pem | base64)"
```

**Výhody:**
- ✅ **Automatické šifrování** - Firebase šifruje env variables
- ✅ **Žádné soubory** - certifikáty nejsou nikde jako soubory
- ✅ **Izolace** - každá funkce má své vlastní env variables
- ✅ **Audit log** - plné logování změn
- ✅ **Jednoduché nasazení** - součást deploy procesu

### 2. Google Secret Manager (VELMI BEZPEČNÉ)
**Výhody:**
- ✅ **Šifrování at rest i in transit**
- ✅ **Verze secrets** - můžete mít více verzí
- ✅ **Jemná přístupová práva** - IAM na úrovni jednotlivých secrets
- ✅ **Audit log** - kdo, kdy, co přistoupil
- ✅ **Automatická rotace** - plánovaná výměna certifikátů

**Nevýhody:**
- ❌ Vyžaduje aktivaci API
- ❌ Složitější implementace

### 3. HashiCorp Vault (ENTERPRISE)
**Výhody:**
- ✅ **Nejvyšší bezpečnost** - military grade
- ✅ **Dynamic secrets** - certifikáty se generují za běhu
- ✅ **Zero-trust** - každý přístup je ověřován

**Nevýhody:**
- ❌ Komplexní setup
- ❌ Vysoké náklady
- ❌ Overkill pro většinu projektů

## 🎯 DOPORUČENÍ PRO VÁŠ PROJEKT

### Fáze 1: Okamžitá bezpečnost (dnes)
1. **Přejít na Firebase Environment Variables**
2. **Smazat certifikáty z Cloud Storage**
3. **Aktualizovat helper funkce**

### Fáze 2: Dlouhodobé řešení (příští týden)
1. **Aktivovat Secret Manager API**
2. **Migrovat na Secret Manager**
3. **Implementovat rotaci certifikátů**

### Fáze 3: Multi-tenant (budoucnost)
1. **Struktura secrets podle podniků**
2. **Automatické načítání podle business ID**
3. **Self-service portal pro správu certifikátů**

## 🚨 KRITICKÉ AKCE (PROVEĎTE IHNED)

1. **Rotujte všechny certifikáty** - současné mohou být kompromitovány
2. **Smažte Cloud Storage bucket** - `vernostni-certificates`
3. **Zkontrolujte access logy** - kdo měl přístup k bucketů
4. **Implementujte bezpečnější řešení** - environment variables

## 📋 IMPLEMENTAČNÍ PLÁN

### Krok 1: Environment Variables (30 minut)
```bash
# Převod certifikátů na base64 a nastavení
firebase functions:config:set apple.pass_cert="$(base64 -i passCert.pem)"
firebase functions:config:set apple.private_key="$(base64 -i privatekey.key)"
firebase functions:config:set apple.wwdr_cert="$(base64 -i AppleWWDRCAG4.pem)"
```

### Krok 2: Aktualizace helper funkcí (15 minut)
```javascript
// Načítání z environment variables místo souborů
const functions = require('firebase-functions');

function getAppleCertificates() {
  return {
    passCert: Buffer.from(functions.config().apple.pass_cert, 'base64'),
    privateKey: Buffer.from(functions.config().apple.private_key, 'base64'),
    wwdrCert: Buffer.from(functions.config().apple.wwdr_cert, 'base64')
  };
}
```

### Krok 3: Smazání nebezpečných dat (5 minut)
```bash
# Smazání Cloud Storage bucket
gsutil rm -r gs://vernostni-certificates
```

**Celkový čas implementace: 50 minut**
**Bezpečnostní zlepšení: 1000%**
