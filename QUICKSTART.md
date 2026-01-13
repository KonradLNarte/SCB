# Snabbstartsguide - SCB API Test

En steg-för-steg guide för att komma igång snabbt.

## ⚡ Snabbstart (5 minuter)

### Steg 1: Förbered certifikat (2 min)

```bash
# Konvertera ditt SCB-certifikat från PFX till PEM
./scripts/convert-cert.sh ditt-scb-certifikat.pfx

# Detta skapar:
# - ditt-scb-certifikat-cert.pem (certifikatet)
# - ditt-scb-certifikat-key.pem (privata nyckeln)
```

### Steg 2: Konfigurera miljö (1 min)

```bash
# Skapa .env-fil
cp .env.example .env

# Lägg till certifikat i .env
cat >> .env << EOF
SCB_API_CERTIFICATE_PEM="$(cat ditt-scb-certifikat-cert.pem)"
SCB_API_CERTIFICATE_KEY="$(cat ditt-scb-certifikat-key.pem)"
EOF
```

### Steg 3: Installera Supabase CLI (om det behövs) (1 min)

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Eller med npm
npm install -g supabase

# Verifiera installation
supabase --version
```

### Steg 4: Starta lokal miljö (1 min)

```bash
# Initiera Supabase (första gången)
supabase init

# Starta Edge Function
supabase functions serve scb-api-test --env-file .env --no-verify-jwt
```

Du bör se:
```
Serving functions on http://localhost:54321/functions/v1/
  - scb-api-test
```

### Steg 5: Testa API:et

**Alternativ A: Använd test-UI**

1. Öppna `public/index.html` i en webbläsare
2. Uppdatera `API_URL` till: `http://localhost:54321/functions/v1/scb-api-test`
3. Klicka på "Testa SCB API"

**Alternativ B: Använd curl**

```bash
curl -X POST http://localhost:54321/functions/v1/scb-api-test \
  -H "Content-Type: application/json" \
  -d '{"organisationsnummer": "5560743089"}'
```

## 🎯 Förväntad output

Vid lyckat anrop:

```json
{
  "success": true,
  "data": {
    "organisationsnummer": "5560743089",
    "namn": "Volvo Group Sverige AB",
    ...
  },
  "logs": [
    "[timestamp] Request received",
    "Certificate (PEM) present: true",
    "Using PEM format certificates",
    "TLS connection established",
    ...
  ]
}
```

## ❌ Felsökning

### Problem: "No certificate found"

**Kontrollera att .env är korrekt:**

```bash
# Verifiera att certifikatet laddades
cat .env | grep SCB_API_CERTIFICATE_PEM | head -c 100

# Starta om Edge Function med .env
supabase functions serve scb-api-test --env-file .env --no-verify-jwt
```

### Problem: "Connection refused"

**Kontrollera att Edge Function körs:**

```bash
# Kolla att processen körs
ps aux | grep supabase

# Starta om
supabase functions serve scb-api-test --env-file .env --no-verify-jwt
```

### Problem: "TLS connection failed"

**Verifiera certifikatet:**

```bash
# Kontrollera certifikatets giltighet
openssl x509 -in ditt-scb-certifikat-cert.pem -noout -dates

# Testa med curl (om det fungerar är certifikatet OK)
curl --cert ditt-scb-certifikat-cert.pem \
     --key ditt-scb-certifikat-key.pem \
     "https://privateapi.scb.se/nv0101/v1/sokpavar/api/ae/sok?organisationsnummer=5560743089"
```

## 🚀 Deploya till produktion

När lokal testning fungerar:

```bash
# 1. Länka till ditt Supabase-projekt
supabase link --project-ref DITT-PROJEKT-ID

# 2. Sätt secrets
supabase secrets set SCB_API_CERTIFICATE_PEM="$(cat ditt-scb-certifikat-cert.pem)"
supabase secrets set SCB_API_CERTIFICATE_KEY="$(cat ditt-scb-certifikat-key.pem)"

# 3. Deploya
supabase functions deploy scb-api-test

# 4. Testa
curl -X POST https://DITT-PROJEKT.supabase.co/functions/v1/scb-api-test \
  -H "Content-Type: application/json" \
  -d '{"organisationsnummer": "5560743089"}'
```

## 📚 Nästa steg

- Läs [README.md](README.md) för mer detaljerad information
- Implementera error handling i din applikation
- Lägg till caching för att minska API-anrop
- Implementera rate limiting
- Lägg till monitoring och logging

## 💡 Tips

1. **Certifikathantering**: Rotera certifikat regelbundet
2. **Säkerhet**: Använd aldrig certifikat i frontend-kod
3. **Performance**: Överväg att cacha svar från SCB API
4. **Monitoring**: Logga alla API-anrop för felsökning
5. **Testing**: Testa med olika organisationsnummer

## 🆘 Behöver hjälp?

- Kolla [README.md](README.md) för detaljerad dokumentation
- Granska loggarna i Edge Function
- Verifiera certifikatet med OpenSSL
- Kontakta SCB för API-support
