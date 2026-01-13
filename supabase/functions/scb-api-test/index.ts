// SCB API Test Edge Function with mTLS Authentication
// This function tests the connection to SCB's private API using client certificates

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// CORS headers for local testing
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SCBRequest {
  organisationsnummer?: string;
}

interface SCBResponse {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}

/**
 * Convert base64-encoded PFX to PEM format
 * Note: Deno doesn't have built-in PFX parsing, so we need PEM format
 */
async function convertPfxToPem(pfxBase64: string, password: string): Promise<{ cert: string; key: string }> {
  // This is a placeholder - in production, you would either:
  // 1. Pre-convert the PFX to PEM format using OpenSSL
  // 2. Use a library that can parse PFX in Deno
  // 3. Use an external service to convert

  throw new Error("PFX to PEM conversion not yet implemented. Please provide PEM format certificates.");
}

/**
 * Main handler for SCB API requests
 */
serve(async (req: Request) => {
  const logs: string[] = [];

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    logs.push(`[${new Date().toISOString()}] Request received: ${req.method} ${req.url}`);

    // Load secrets from environment
    const certBase64 = Deno.env.get("SCB_API_CERTIFICATE");
    const certPassword = Deno.env.get("SCB_API_CERTIFICATE_PASSWORD");
    const baseUrl = Deno.env.get("SCB_API_BASE_URL") || "https://privateapi.scb.se/nv0101/v1/sokpavar/";

    // Alternative: PEM format (recommended for Deno)
    const certPem = Deno.env.get("SCB_API_CERTIFICATE_PEM");
    const keyPem = Deno.env.get("SCB_API_CERTIFICATE_KEY");

    logs.push(`Certificate (base64) present: ${!!certBase64} (${certBase64?.length || 0} chars)`);
    logs.push(`Certificate (PEM) present: ${!!certPem} (${certPem?.length || 0} chars)`);
    logs.push(`Key (PEM) present: ${!!keyPem} (${keyPem?.length || 0} chars)`);
    logs.push(`Password present: ${!!certPassword}`);
    logs.push(`Base URL: ${baseUrl}`);

    // Parse request body
    let organisationsnummer = "5560743089"; // Default: Volvo
    if (req.method === "POST") {
      try {
        const body: SCBRequest = await req.json();
        if (body.organisationsnummer) {
          organisationsnummer = body.organisationsnummer;
        }
      } catch (e) {
        logs.push(`Failed to parse request body: ${e.message}`);
      }
    }

    logs.push(`Looking up organisation: ${organisationsnummer}`);

    // Check which certificate format we have
    if (!certPem && !certBase64) {
      logs.push("ERROR: No certificate found in environment variables");
      logs.push("Expected either SCB_API_CERTIFICATE (base64 PFX) or SCB_API_CERTIFICATE_PEM");

      return new Response(
        JSON.stringify({
          success: false,
          error: "No certificate configured. Please set SCB_API_CERTIFICATE or SCB_API_CERTIFICATE_PEM",
          logs,
        } as SCBResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Approach 1: Use PEM format (recommended for Deno)
    if (certPem && keyPem) {
      logs.push("Using PEM format certificates");

      try {
        // Build the API URL
        const apiUrl = `${baseUrl}api/ae/sok?organisationsnummer=${organisationsnummer}`;
        logs.push(`API URL: ${apiUrl}`);

        // Create a custom TLS client
        logs.push("Creating TLS connection with client certificate...");

        // Note: Deno.connectTls supports client certificates
        const url = new URL(apiUrl);
        const conn = await Deno.connectTls({
          hostname: url.hostname,
          port: 443,
          certChain: certPem,
          privateKey: keyPem,
        });

        logs.push("TLS connection established");

        // Send HTTP request over the TLS connection
        const httpRequest = `GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nConnection: close\r\nAccept: application/json\r\n\r\n`;
        const encoder = new TextEncoder();
        await conn.write(encoder.encode(httpRequest));

        logs.push("HTTP request sent");

        // Read response
        const decoder = new TextDecoder();
        const buffer = new Uint8Array(8192);
        let responseData = "";

        while (true) {
          const bytesRead = await conn.read(buffer);
          if (bytesRead === null) break;
          responseData += decoder.decode(buffer.subarray(0, bytesRead));
        }

        conn.close();
        logs.push(`Response received: ${responseData.length} bytes`);

        // Parse HTTP response
        const [headers, ...bodyParts] = responseData.split("\r\n\r\n");
        const body = bodyParts.join("\r\n\r\n");

        logs.push(`Response headers: ${headers.split("\r\n")[0]}`);
        logs.push(`Response body length: ${body.length}`);

        // Try to parse as JSON
        let responseJson;
        try {
          responseJson = JSON.parse(body);
          logs.push("Response successfully parsed as JSON");
        } catch (e) {
          logs.push(`Failed to parse response as JSON: ${e.message}`);
          logs.push(`Raw body (first 500 chars): ${body.substring(0, 500)}`);
          responseJson = { raw: body };
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: responseJson,
            logs,
          } as SCBResponse),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      } catch (error) {
        logs.push(`ERROR in TLS connection: ${error.message}`);
        logs.push(`Error stack: ${error.stack}`);

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            logs,
          } as SCBResponse),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Approach 2: Convert PFX to PEM (if only base64 PFX is provided)
    if (certBase64 && !certPem) {
      logs.push("Attempting to use PFX format (conversion needed)");
      logs.push("ERROR: PFX format requires conversion to PEM");
      logs.push("Please convert your certificate using:");
      logs.push("  openssl pkcs12 -in cert.pfx -clcerts -nokeys -out cert.pem");
      logs.push("  openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem");
      logs.push("Then set SCB_API_CERTIFICATE_PEM and SCB_API_CERTIFICATE_KEY");

      return new Response(
        JSON.stringify({
          success: false,
          error: "PFX format not supported. Please provide PEM format certificates.",
          logs,
        } as SCBResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    logs.push(`FATAL ERROR: ${error.message}`);
    logs.push(`Stack trace: ${error.stack}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        logs,
      } as SCBResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

console.log("SCB API Test function is running!");
