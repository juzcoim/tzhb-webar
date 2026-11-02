/**
 * scripts/server.js
 * 
 * Lightweight, zero-dependency Node.js HTTPS development server for Tazheeb WebAR.
 * Features:
 * - Native HTTPS with self-signed SSL certificate supporting SANs
 * - Full RFC 7233 byte-range streaming (HTTP 206 Partial Content) for iOS Safari <video playsinline>
 * - Accurate MIME types for WebAR assets (video/mp4, .mind binaries, SVG, WAV)
 * - Automatic saving endpoint for compiled targets.mind (/save-targets)
 * - Console network URL and mobile testing instructions
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { generateCertificates, getLocalIpAddresses } = require('./generate-cert');

const PORT = process.env.PORT || 8443;
const ROOT_DIR = path.resolve(__dirname, '..');
const TARGETS_FILE = path.join(ROOT_DIR, 'assets', 'targets', 'targets.mind');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mind': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function handleStaticRequest(req, res) {
  // CORS & Security Headers for WebAR
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle /save-targets POST endpoint (saves compiled .mind binary from compiler tool)
  if (pathname === '/save-targets' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const targetDir = path.dirname(TARGETS_FILE);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(TARGETS_FILE, buffer);
      console.log(`💾 Saved newly compiled targets.mind (${buffer.length} bytes) to ${TARGETS_FILE}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, bytes: buffer.length }));
    });
    return;
  }

  // Map root to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  // Check file existence
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // ------------------------------------------------------------------------
    // RFC 7233 HTTP Byte Range Handling (Crucial for iOS Safari & WebAR Video)
    // ------------------------------------------------------------------------
    const rangeHeader = req.headers.range;

    if (rangeHeader && ext === '.mp4') {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      if (start >= stats.size || end >= stats.size || start > end) {
        res.writeHead(416, {
          'Content-Range': `bytes */${stats.size}`,
          'Content-Type': contentType
        });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      fileStream.pipe(res);
    } else {
      // Standard HTTP 200 OK Stream
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  });
}

function startServer() {
  const { keyPath, certPath } = generateCertificates();
  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  const server = https.createServer(sslOptions, handleStaticRequest);

  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIpAddresses();
    const primaryLanIp = ips.find(ip => ip !== '127.0.0.1') || 'localhost';
    const mobileUrl = `https://${primaryLanIp}:${PORT}/index.html`;

    console.log('\n=============================================================');
    console.log('🕌 TAZHEEB WEBAR DEVELOPMENT SERVER (HTTPS)');
    console.log('=============================================================');
    console.log(`  Local URL:        https://localhost:${PORT}`);
    console.log(`  Local Loopback:   https://127.0.0.1:${PORT}`);
    ips.forEach(ip => {
      if (ip !== '127.0.0.1') {
        console.log(`  LAN Mobile URL:   https://${ip}:${PORT}`);
      }
    });
    console.log('\n  Available Endpoints:');
    console.log(`  • WebAR Scanner:      https://localhost:${PORT}/index.html`);
    console.log(`  • Archival Portal:    https://localhost:${PORT}/portal.html`);
    console.log(`  • Target Compiler:    https://localhost:${PORT}/compiler.html`);
    console.log('\n  📱 Mobile WebAR Testing Instructions:');
    console.log(`  1. Connect your phone to the same Wi-Fi network.`);
    console.log(`  2. Open mobile browser (Safari on iOS / Chrome on Android):`);
    console.log(`     👉 ${mobileUrl}`);
    console.log(`  3. Accept the self-signed certificate warning (first time only).`);
    console.log(`  4. Aim camera at printed curriculum plates (assets/plates/*.png).`);
    console.log(`  • QR Code Link for phone:`);
    console.log(`    https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mobileUrl)}`);
    console.log('=============================================================\n');
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, handleStaticRequest };

