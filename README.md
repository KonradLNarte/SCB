# SCB API Integration - Proof of Concept

En testapplikation för att verifiera mTLS-anslutning till SCB:s (Statistiska Centralbyrån) företags-API från en Deno Edge Function.

## 📋 Översikt

Detta projekt demonstrerar hur man kan anropa SCB:s privata API med mTLS-autentisering (Mutual TLS) från en Supabase Edge Function. API:et tillhandahåller företagsinformation baserat på organisationsnummer.

### API-specifikation
- **Bas-URL**: `https://privateapi.scb.se/nv0101/v1/sokpavar/`
- **Autentisering**: mTLS med klientcertifikat (.pfx/.p12-format)
- **Exempel-endpoint**: `/api/ae/sok?organisationsnummer=5560743089` (Volvo)

## 🏗️ Projektstruktur

```
SCB/
├── supabase/
│   └── functions/
│       └── scb-api-test/
│           └── index.ts          # Edge Function med mTLS-logik
├── public/
│   └── index.html                # Test-UI
├── scripts/
│   └── convert-cert.sh           # Hjälpscript för certifikatkonvertering
├── deno.json                     # Deno-konfiguration
├── .env.example                  # Exempel på miljövariabler
├── .gitignore                    # Ignorera känsliga filer
└── README.md                     # Denna fil
```

## 🚀 Snabbstart

### 1. Förbered certifikat

SCB tillhandahåller certifikat i `.pfx`-format (PKCS#12), men Deno Edge Functions fungerar bäst med PEM-format. Konvertera ditt certifikat:

```bash
# Kör konverteringsscriptet
./scripts/convert-cert.sh ditt-certifikat.pfx

# Eller manuellt med OpenSSL:
# Extrahera certifikatet
openssl pkcs12 -in cert.pfx -clcerts -nokeys -out cert.pem

# Extrahera privat nyckel (utan lösenord)
openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem
```

Detta skapar två filer:
- `cert.pem` - Klientcertifikatet
- `key.pem` - Den privata nyckeln

**⚠️ VARNING**: Dessa filer innehåller känslig information. Committa ALDRIG dessa till Git!

### 2. Konfigurera miljövariabler

Kopiera `.env.example` till `.env`:

```bash
cp .env.example .env
```

Redigera `.env` och lägg till dina certifikat:

```bash
# Läs in certifikat som text (bevara radbrytningar)
SCB_API_CERTIFICATE_PEM=$(cat cert.pem)
SCB_API_CERTIFICATE_KEY=$(cat key.pem)
SCB_API_CERTIFICATE_PASSWORD=ditt-lösenord  # Om du har kvar lösenord på nyckeln

# Eller om du vill använda base64 (fungerar också):
SCB_API_CERTIFICATE=$(base64 -w 0 cert.pfx)
```

### 3. Kör lokalt med Supabase CLI

```bash
# Installera Supabase CLI (om du inte har det)
npm install -g supabase

# Starta lokal Supabase-miljö
supabase start

# Servera Edge Function
supabase functions serve scb-api-test --env-file .env

# Öppna test-UI i webbläsare
open public/index.html
# (Uppdatera API_URL i index.html till: http://localhost:54321/functions/v1/scb-api-test)
```

### 4. Testa API:et

1. Öppna `public/index.html` i en webbläsare
2. Ange ett organisationsnummer (eller använd standardvärdet: 5560743089 för Volvo)
3. Klicka på "Testa SCB API"
4. Granska svaret och loggarna

## 🔍 Felsökning

### Problem: "No certificate found in environment variables"

**Lösning**: Kontrollera att miljövariablerna är korrekt satta:

```bash
# I Edge Function-terminalen, verifiera att secrets laddas
echo $SCB_API_CERTIFICATE_PEM | head -c 50
```

### Problem: "TLS connection failed"

**Möjliga orsaker**:
1. Certifikatet är i fel format (använd PEM, inte PFX)
2. Certifikatet har gått ut
3. Certifikatet matchar inte det som SCB förväntar sig
4. Nätverksproblem eller brandvägg blockerar anslutningen

**Felsökningssteg**:
1. Verifiera certifikatet:
```bash
# Kontrollera certifikatets giltighet
openssl x509 -in cert.pem -noout -dates
openssl x509 -in cert.pem -noout -subject
```

2. Testa anslutningen med curl:
```bash
curl --cert cert.pem --key key.pem \
     https://privateapi.scb.se/nv0101/v1/sokpavar/api/ae/sok?organisationsnummer=5560743089
```

### Problem: "PFX format not supported"

**Lösning**: Edge Function stödjer endast PEM-format. Konvertera ditt certifikat enligt instruktionerna ovan.

## 📊 Förväntad respons

Vid lyckat anrop returnerar SCB API:et JSON med företagsdata:

```json
{
  "success": true,
  "data": {
    "organisationsnummer": "5560743089",
    "namn": "Volvo Group Sverige AB",
    "adress": {
      "gatuadress": "...",
      "postnummer": "...",
      "postort": "..."
    },
    "juridiskForm": "Aktiebolag",
    "sniKod": "...",
    "antalAnstallda": "...",
    // ... mer data
  },
  "logs": [...]
}
```

## 🔐 Säkerhet

### Viktigt att tänka på:

1. **Certifikathantering**:
   - Committa ALDRIG `.pfx`, `.pem`, `.key` eller `.p12`-filer till Git
   - Använd miljövariabler eller secrets management
   - Rotera certifikat regelbundet

2. **Miljövariabler**:
   - Använd Supabase Secrets för produktion: `supabase secrets set SCB_API_CERTIFICATE_PEM="..."`
   - Lokal utveckling: använd `.env`-fil (finns i `.gitignore`)

3. **API-säkerhet**:
   - mTLS säkerställer att både klient och server autentiseras
   - Endast Edge Function kan anropa SCB API:et (certifikat ligger server-side)
   - Frontend kan inte direkt komma åt certifikaten

## 📦 Deployment till Supabase

### 1. Sätt secrets i Supabase

```bash
# Länka till ditt Supabase-projekt
supabase link --project-ref din-projekt-ref

# Sätt certifikat som secrets (viktigt: använd rätt format)
supabase secrets set SCB_API_CERTIFICATE_PEM="$(cat cert.pem)"
supabase secrets set SCB_API_CERTIFICATE_KEY="$(cat key.pem)"

# Om du behöver lösenord
supabase secrets set SCB_API_CERTIFICATE_PASSWORD="ditt-lösenord"
```

### 2. Deploya Edge Function

```bash
supabase functions deploy scb-api-test
```

### 3. Uppdatera frontend

Uppdatera `API_URL` i `public/index.html`:

```javascript
const API_URL = 'https://ditt-projekt.supabase.co/functions/v1/scb-api-test';
```

### 4. Deploya frontend

Uppladdande av `public/index.html` till:
- Supabase Storage
- Vercel
- Netlify
- Eller vilken hosting som helst

## 🧪 Tekniska detaljer

### mTLS-implementation

Edge Function använder Deno's `connectTls` med client certificates:

```typescript
const conn = await Deno.connectTls({
  hostname: url.hostname,
  port: 443,
  certChain: certPem,      // Klientcertifikat
  privateKey: keyPem,       // Privat nyckel
});
```

### Alternativa ansatser

Om Deno's TLS-stöd inte fungerar, finns alternativ:

1. **Proxy-server**: Kör en Node.js/Go-proxy som hanterar mTLS
2. **Pre-konvertering**: Konvertera certifikat före deployment
3. **External service**: Använd en dedikerad service för mTLS-hantering

## 🔗 Resurser

- [SCB API-dokumentation](https://www.scb.se/vara-tjanster/foretagstjanster/)
- [Deno TLS Documentation](https://deno.land/api?s=Deno.connectTls)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenSSL Certificate Conversion](https://www.openssl.org/docs/man1.1.1/man1/pkcs12.html)

## 📝 Licens

Detta är ett proof-of-concept projekt för intern användning.

## 🤝 Support

Vid problem, kontakta utvecklingsteamet eller skapa ett issue.
