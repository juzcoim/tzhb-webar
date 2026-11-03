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
const { exec } = require('child_process');
const { generateCertificates, getLocalIpAddresses } = require('./generate-cert');
const { syncCurriculum } = require('./sync-curriculum');

const PORT = process.env.PORT || 8443;
const ROOT_DIR = path.resolve(__dirname, '..');
const TARGETS_FILE = path.join(ROOT_DIR, 'assets', 'targets', 'targets.mind');
const CURRICULUM_FILE = path.join(ROOT_DIR, 'assets', 'data', 'curriculum.json');
const PLATES_DIR = path.join(ROOT_DIR, 'assets', 'plates');
const VIDEOS_DIR = path.join(ROOT_DIR, 'assets', 'videos');

// Helper to parse JSON body up to 150MB
function parseJsonBody(req, callback) {
  const chunks = [];
  let byteLength = 0;
  const maxBytes = 150 * 1024 * 1024; // 150MB

  req.on('data', chunk => {
    byteLength += chunk.length;
    if (byteLength > maxBytes) {
      req.destroy();
      return callback(new Error('Payload exceeds 150MB limit'));
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      const data = raw ? JSON.parse(raw) : {};
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  });

  req.on('error', err => callback(err));
}

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

  // ==========================================================================
  // ADMIN PORTAL REST API ENDPOINTS
  // ==========================================================================

  // 1. GET /api/curriculum
  if (pathname === '/api/curriculum' && req.method === 'GET') {
    if (!fs.existsSync(CURRICULUM_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([]));
    }
    const data = fs.readFileSync(CURRICULUM_FILE, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(data);
  }

  // 2. POST /api/upload-plate
  if (pathname === '/api/upload-plate' && req.method === 'POST') {
    parseJsonBody(req, (err, payload) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }

      try {
        const {
          title,
          chapter,
          chapterId,
          lesson,
          arabic,
          description,
          topics,
          imageFileName,
          imageBase64,
          videoFileName,
          videoBase64
        } = payload;

        if (!title || !imageBase64 || !videoBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Title, plate image, and master video are required.' }));
        }

        // Clean & generate filenames
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const cleanImgName = imageFileName ? path.basename(imageFileName).replace(/\s+/g, '-') : `${slug}.png`;
        const cleanVidName = videoFileName ? path.basename(videoFileName).replace(/\s+/g, '-') : `${slug}.mp4`;

        // Save image to assets/plates/
        const imgBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const imgPath = path.join(PLATES_DIR, cleanImgName);
        fs.writeFileSync(imgPath, imgBuffer);

        // Save video to assets/videos/
        const vidBuffer = Buffer.from(videoBase64.replace(/^data:video\/\w+;base64,/, ''), 'base64');
        const vidPath = path.join(VIDEOS_DIR, cleanVidName);
        fs.writeFileSync(vidPath, vidBuffer);

        // Update curriculum.json
        let curriculum = [];
        if (fs.existsSync(CURRICULUM_FILE)) {
          curriculum = JSON.parse(fs.readFileSync(CURRICULUM_FILE, 'utf8'));
        }

        const newIndex = curriculum.length;
        const plateId = `plate-${String(newIndex + 1).padStart(2, '0')}`;
        const videoId = `video-${slug}`;

        const newPlate = {
          index: newIndex,
          id: plateId,
          title: title.trim(),
          chapter: (chapter || 'Chapter I: Foundations').trim(),
          chapterId: (chapterId || 'ch1').trim(),
          lesson: (lesson || `Master Lesson ${newIndex + 1}.1`).trim(),
          arabic: (arabic || '').trim(),
          description: (description || '').trim(),
          topics: Array.isArray(topics) ? topics : (topics ? topics.split(',').map(t => t.trim()) : []),
          imageFile: cleanImgName,
          vectorFile: null,
          videoFile: cleanVidName,
          videoId: videoId
        };

        curriculum.push(newPlate);
        fs.writeFileSync(CURRICULUM_FILE, JSON.stringify(curriculum, null, 2), 'utf8');

        // Automatically sync static index.html and portal.html
        syncCurriculum();

        console.log(`✨ Added new curriculum plate: "${title}" (Index: ${newIndex})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, plate: newPlate, totalPlates: curriculum.length }));
      } catch (e) {
        console.error('Error saving new plate:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. DELETE /api/plates/:index
  if (pathname.startsWith('/api/plates/') && req.method === 'DELETE') {
    const targetIdx = parseInt(pathname.split('/').pop(), 10);
    if (isNaN(targetIdx)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid plate index' }));
    }

    try {
      let curriculum = [];
      if (fs.existsSync(CURRICULUM_FILE)) {
        curriculum = JSON.parse(fs.readFileSync(CURRICULUM_FILE, 'utf8'));
      }

      if (targetIdx < 0 || targetIdx >= curriculum.length) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Plate index not found' }));
      }

      const removed = curriculum.splice(targetIdx, 1);
      // Re-index remaining plates
      curriculum.forEach((p, idx) => {
        p.index = idx;
      });

      fs.writeFileSync(CURRICULUM_FILE, JSON.stringify(curriculum, null, 2), 'utf8');
      syncCurriculum();

      console.log(`🗑️ Removed plate index ${targetIdx}: ${removed[0].title}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, removed: removed[0], remainingCount: curriculum.length }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 4. POST /api/recompile (runs scripts/compile-targets.js)
  if (pathname === '/api/recompile' && req.method === 'POST') {
    console.log('⚙️ Triggering MindAR target compilation from Admin Portal...');
    exec('npm run compile:targets', { cwd: ROOT_DIR, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Compilation failed:', stderr || err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message, log: stderr || stdout }));
      }

      const targetSize = fs.existsSync(TARGETS_FILE) ? fs.statSync(TARGETS_FILE).size : 0;
      console.log(`✅ Compilation succeeded! targets.mind size: ${(targetSize / 1024).toFixed(1)} KB`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        bytes: targetSize,
        log: stdout
      }));
    });
    return;
  }

  // 5. POST /api/publish (commits & pushes to GitHub Pages)
  if (pathname === '/api/publish' && req.method === 'POST') {
    console.log('🚀 Publishing updates to GitHub Pages...');
    const cmd = 'git add . && git commit -m "feat(curriculum): update plates and targets via admin portal" && git push origin main';
    exec(cmd, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
      if (err) {
        // If git commit had nothing to commit, stdout might say "nothing to commit"
        if (stdout && stdout.includes('nothing to commit')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, message: 'Already up to date on GitHub Pages!' }));
        }
        console.error('Git push failed:', stderr || err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message, log: stderr || stdout }));
      }

      console.log('✅ Successfully published to GitHub Pages!');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, log: stdout }));
    });
    return;
  }

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

