/**
 * Cloudflare Worker for SIYATECH Contact API (siyatech.tech/api/contact)
 * 100% Free, Runs on Cloudflare Edge with 0ms Cold Start
 * Keeps Web3Forms Key Encrypted in Cloudflare Secrets (NEVER Exposed in HTML)
 * 
 * Setup:
 * 1. Cloudflare Dashboard -> Workers & Pages -> Create Worker
 * 2. Paste this code.
 * 3. In Settings -> Variables -> Add Secret: WEB3FORMS_ACCESS_KEY = 31f6a48d-386e-4388-aea0-a8e348b3567b
 * 4. Add Route: siyatech.tech/api/contact
 */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "https://siyatech.tech",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const data = await request.json();

      // Check Honeypot
      if (data.botcheck) {
        return new Response(JSON.stringify({ success: true, message: "Acknowledged" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // Inject Secret Server-Side Access Key from Cloudflare Secrets
      data.access_key = env.WEB3FORMS_ACCESS_KEY || "31f6a48d-386e-4388-aea0-a8e348b3567b";

      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.text();
      return new Response(result, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "https://siyatech.tech"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: "Relay error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
