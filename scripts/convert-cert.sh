#!/bin/bash
# Script to convert PFX/P12 certificate to PEM format for Deno Edge Functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}SCB Certificate Converter (PFX → PEM)${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}ERROR: OpenSSL is not installed${NC}"
    echo "Please install OpenSSL first:"
    echo "  - macOS: brew install openssl"
    echo "  - Ubuntu/Debian: sudo apt-get install openssl"
    echo "  - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html"
    exit 1
fi

# Check if PFX file is provided
if [ -z "$1" ]; then
    echo -e "${RED}ERROR: No certificate file specified${NC}"
    echo ""
    echo "Usage: $0 <path-to-certificate.pfx> [output-directory]"
    echo ""
    echo "Example:"
    echo "  $0 scb-cert.pfx"
    echo "  $0 scb-cert.pfx ./certs"
    exit 1
fi

PFX_FILE="$1"
OUTPUT_DIR="${2:-.}"

# Check if file exists
if [ ! -f "$PFX_FILE" ]; then
    echo -e "${RED}ERROR: File not found: $PFX_FILE${NC}"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Get filename without extension
BASENAME=$(basename "$PFX_FILE" .pfx)
BASENAME=$(basename "$BASENAME" .p12)

CERT_FILE="$OUTPUT_DIR/${BASENAME}-cert.pem"
KEY_FILE="$OUTPUT_DIR/${BASENAME}-key.pem"
KEY_ENC_FILE="$OUTPUT_DIR/${BASENAME}-key-encrypted.pem"

echo "Input file: $PFX_FILE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Extract certificate
echo -e "${YELLOW}Step 1/3: Extracting certificate...${NC}"
if openssl pkcs12 -in "$PFX_FILE" -clcerts -nokeys -out "$CERT_FILE"; then
    echo -e "${GREEN}✓ Certificate extracted to: $CERT_FILE${NC}"
else
    echo -e "${RED}✗ Failed to extract certificate${NC}"
    exit 1
fi

echo ""

# Extract private key (without password)
echo -e "${YELLOW}Step 2/3: Extracting private key (unencrypted)...${NC}"
echo "Note: This will create an unencrypted private key for use with Deno."
if openssl pkcs12 -in "$PFX_FILE" -nocerts -nodes -out "$KEY_FILE"; then
    echo -e "${GREEN}✓ Private key extracted to: $KEY_FILE${NC}"
else
    echo -e "${RED}✗ Failed to extract private key${NC}"
    exit 1
fi

echo ""

# Extract encrypted private key (optional, for backup)
echo -e "${YELLOW}Step 3/3: Creating encrypted backup of private key...${NC}"
if openssl pkcs12 -in "$PFX_FILE" -nocerts -out "$KEY_ENC_FILE"; then
    echo -e "${GREEN}✓ Encrypted key backup saved to: $KEY_ENC_FILE${NC}"
else
    echo -e "${YELLOW}⚠ Could not create encrypted backup (non-critical)${NC}"
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Conversion completed successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Verify the certificate
echo -e "${YELLOW}Certificate details:${NC}"
openssl x509 -in "$CERT_FILE" -noout -subject -dates -issuer

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add the following to your .env file:"
echo ""
echo "   SCB_API_CERTIFICATE_PEM=\"\$(cat $CERT_FILE)\""
echo "   SCB_API_CERTIFICATE_KEY=\"\$(cat $KEY_FILE)\""
echo ""
echo "2. For Supabase deployment, set secrets:"
echo ""
echo "   supabase secrets set SCB_API_CERTIFICATE_PEM=\"\$(cat $CERT_FILE)\""
echo "   supabase secrets set SCB_API_CERTIFICATE_KEY=\"\$(cat $KEY_FILE)\""
echo ""
echo -e "${RED}⚠ SECURITY WARNING:${NC}"
echo "   - Keep $KEY_FILE secure and never commit it to Git"
echo "   - The .gitignore file is configured to exclude .pem and .key files"
echo "   - Consider encrypting these files when not in use"
echo ""
