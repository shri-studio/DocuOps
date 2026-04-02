// /api/proxy.js — Vercel serverless CORS proxy for DocuOps Bulk Downloader
// Place this file at: api/proxy.js in your project root
// Deploy to Vercel — it will be available at: https://docu-ops.vercel.app/api/proxy?url=...

export default async function handler(req, res) {
  // Allow CORS from any origin (this IS the proxy — its whole job)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  // Basic URL validation — must be http/https
  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL: ' + targetUrl });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        // Forward a realistic User-Agent so servers don't block bot requests
        'User-Agent': 'Mozilla/5.0 (compatible; DocuOps-Proxy/1.0)',
        'Accept': '*/*',
      },
      // Vercel functions have a 10s default — use a generous timeout
      signal: AbortSignal.timeout(25000),
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream the response body directly
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(response.status).send(buffer);

  } catch (err) {
    return res.status(502).json({
      error: 'Proxy fetch failed',
      message: err.message,
      url: targetUrl,
    });
  }
}
