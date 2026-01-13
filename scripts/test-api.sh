#!/bin/bash
# Quick test script for SCB API Edge Function

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
API_URL="${1:-http://localhost:54321/functions/v1/scb-api-test}"
ORG_NUMMER="${2:-5560743089}"

echo -e "${GREEN}Testing SCB API Edge Function${NC}"
echo -e "API URL: ${YELLOW}$API_URL${NC}"
echo -e "Organisation: ${YELLOW}$ORG_NUMMER${NC}"
echo ""

# Make the request
echo -e "${YELLOW}Sending request...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"organisationsnummer\": \"$ORG_NUMMER\"}")

echo ""
echo -e "${GREEN}Response:${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""

# Check if successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Test successful!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Test failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Invalid response${NC}"
    exit 1
fi
