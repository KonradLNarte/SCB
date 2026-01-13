// SCB API Edge Function with mTLS Authentication
// Connects to SCB's SokPaVar API for workplace and company data

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariabelFilter {
  Variabel: string;
  Operator: string;
  Varde1: string;
  Varde2?: string;
}

interface KategoriFilter {
  Kategori: string;
  Kod: string[];
  Branschniva?: number;
}

interface SCBRequest {
  organisationsnummer?: string;
  endpoint?: "count" | "fetch" | "categories" | "variables";
  arbetsstalleStatus?: string;
  variabler?: VariabelFilter[];
  kategorier?: KategoriFilter[];
}

interface SCBResponse {
  success: boolean;
  count?: number;
  data?: unknown;
  error?: string;
  logs?: string[];
}

const BASE_URL = "https://privateapi.scb.se/nv0101/v1/sokpavar";

serve(async (req: Request) => {
  const logs: string[] = [];

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    logs.push(`[${new Date().toISOString()}] Request received`);

    // Load certificates from environment
    const certPem = Deno.env.get("SCB_API_CERTIFICATE_PEM");
    const keyPem = Deno.env.get("SCB_API_CERTIFICATE_KEY");

    logs.push(`Certificate present: ${!!certPem}`);
    logs.push(`Key present: ${!!keyPem}`);

    if (!certPem || !keyPem) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing certificate configuration",
          logs,
        } as SCBResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    let request: SCBRequest = {};
    if (req.method === "POST") {
      try {
        request = await req.json();
      } catch {
        logs.push("No JSON body provided, using defaults");
      }
    }

    const orgNr = request.organisationsnummer || "5560743089";
    const endpoint = request.endpoint || "fetch";
    logs.push(`Endpoint: ${endpoint}, OrgNr: ${orgNr}`);

    // Helper function to make mTLS requests
    async function makeScbRequest(path: string, method: string, body?: unknown): Promise<unknown> {
      const url = new URL(`${BASE_URL}${path}`);
      logs.push(`Connecting to: ${url.toString()}`);

      const conn = await Deno.connectTls({
        hostname: url.hostname,
        port: 443,
        certChain: certPem!,
        privateKey: keyPem!,
      });

      logs.push("TLS connection established");

      const bodyStr = body ? JSON.stringify(body) : "";
      const httpRequest = [
        `${method} ${url.pathname}${url.search} HTTP/1.1`,
        `Host: ${url.hostname}`,
        "Connection: close",
        "Accept: application/json",
        "Content-Type: application/json; charset=utf-8",
        body ? `Content-Length: ${new TextEncoder().encode(bodyStr).length}` : "",
        "",
        bodyStr,
      ].filter(Boolean).join("\r\n") + "\r\n";

      await conn.write(new TextEncoder().encode(httpRequest));
      logs.push(`${method} request sent`);

      // Read response
      const buffer = new Uint8Array(65536);
      let responseData = "";
      while (true) {
        const bytesRead = await conn.read(buffer);
        if (bytesRead === null) break;
        responseData += new TextDecoder().decode(buffer.subarray(0, bytesRead));
      }
      conn.close();

      // Parse HTTP response
      const [headers, ...bodyParts] = responseData.split("\r\n\r\n");
      const responseBody = bodyParts.join("\r\n\r\n");
      const statusLine = headers.split("\r\n")[0];
      logs.push(`Response: ${statusLine}`);

      // Handle chunked encoding
      let jsonBody = responseBody;
      if (headers.toLowerCase().includes("transfer-encoding: chunked")) {
        // Simple chunked decoding
        const chunks: string[] = [];
        const lines = responseBody.split("\r\n");
        for (let i = 0; i < lines.length; i += 2) {
          const size = parseInt(lines[i], 16);
          if (size === 0) break;
          if (lines[i + 1]) chunks.push(lines[i + 1]);
        }
        jsonBody = chunks.join("");
      }

      try {
        return JSON.parse(jsonBody);
      } catch {
        logs.push(`Raw response: ${jsonBody.substring(0, 500)}`);
        throw new Error(`Failed to parse JSON response`);
      }
    }

    let result: unknown;

    switch (endpoint) {
      case "categories": {
        // Get purchased categories
        result = await makeScbRequest("/api/Ae/KoptaKategorier", "GET");
        break;
      }

      case "variables": {
        // Get purchased variables
        result = await makeScbRequest("/api/Ae/KoptaVariabler", "GET");
        break;
      }

      case "count": {
        // Count workplaces
        const countBody = {
          "Arbetsställestatus": request.arbetsstalleStatus || "1",
          "variabler": request.variabler || [
            {
              "Variabel": "OrgNr (10 siffror)",
              "Operator": "ArLikaMed",
              "Varde1": orgNr,
              "Varde2": "",
            },
          ],
          "Kategorier": request.kategorier || [],
        };
        result = await makeScbRequest("/api/Ae/RaknaArbetsstallen", "POST", countBody);
        break;
      }

      case "fetch":
      default: {
        // Fetch workplace data
        const fetchBody = {
          "Arbetsställestatus": request.arbetsstalleStatus || "1",
          "variabler": request.variabler || [
            {
              "Variabel": "OrgNr (10 siffror)",
              "Operator": "ArLikaMed",
              "Varde1": orgNr,
              "Varde2": "",
            },
          ],
          "Kategorier": request.kategorier || [],
        };
        result = await makeScbRequest("/api/Ae/HamtaArbetsstallen", "POST", fetchBody);
        break;
      }
    }

    logs.push("Request completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        logs,
      } as SCBResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logs.push(`ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        logs,
      } as SCBResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

console.log("SCB API Edge Function is running!");
