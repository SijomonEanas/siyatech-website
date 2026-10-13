/**
 * SIYATECH Enterprise Secure Contact API Proxy
 * Server-Side Forwarder: Hides Web3Forms Access Key 100% from Client-Side DevTools / Inspect
 * Zero-Dependency: Runs on vanilla Node.js using built-in https & http modules
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

// Load secret access key from .env or environment variable
let ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;
if (!ACCESS_KEY) {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/WEB3FORMS_ACCESS_KEY\s*=\s*([^\r\n]+)/);
      if (match) ACCESS_KEY = match[1].trim();
    }
  } catch (err) {}
}

// Fallback to existing configured key if env file not yet created
if (!ACCESS_KEY) {
  ACCESS_KEY = '31f6a48d-386e-4388-aea0-a8e348b3567b';
}

// In-Memory IP Rate Limiting (Server-Side Protection)
const ipRequests = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_IP = 5;

function isRateLimited(ip) {
  const now = Date.now();
  let timestamps = ipRequests.get(ip) || [];
  timestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_IP) {
    return true;
  }
  timestamps.push(now);
  ipRequests.set(ip, timestamps);
  return false;
}

const server = http.createServer((req, res) => {
  // CORS Headers
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://siyatech.tech', 'https://www.siyatech.tech', 'http://127.0.0.1:8089', 'http://localhost:8089'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://siyatech.tech');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || (req.url !== '/api/contact' && req.url !== '/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
    return;
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Rate limit exceeded. Please wait a few minutes before resubmitting.'
    }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 50000) { // 50KB limit to prevent payload flooding
      req.destroy();
    }
  });

  req.on('end', () => {
    try {
      let parsed = {};
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        parsed = JSON.parse(body);
      } else {
        const params = new URLSearchParams(body);
        for (const [key, value] of params.entries()) {
          parsed[key] = value;
        }
      }

      // Check Honeypot
      if (parsed.botcheck && parsed.botcheck !== 'false' && parsed.botcheck !== false) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Inquiry received' }));
        return;
      }

      // Inject Secret Server-Side Access Key
      parsed.access_key = ACCESS_KEY;
      parsed.subject = parsed.subject || 'New Infrastructure Consultation Request - SIYATECH';
      parsed.from_name = parsed.from_name || 'SIYATECH Secure Portal';

      const postData = JSON.stringify(parsed);

      const forwardReq = https.request('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (forwardRes) => {
        let responseData = '';
        forwardRes.on('data', d => responseData += d);
        forwardRes.on('end', () => {
          res.writeHead(forwardRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(responseData);
        });
      });

      forwardReq.on('error', (err) => {
        console.error('Error forwarding to Web3Forms:', err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Transmission relay failed' }));
      });

      forwardReq.write(postData);
      forwardReq.end();

    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid payload encoding' }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SIYATECH SECURE PROXY] Listening on http://127.0.0.1:${PORT}`);
  console.log(`Access Key Protected Server-Side: YES`);
});
