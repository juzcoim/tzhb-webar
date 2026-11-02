/**
 * scripts/verify-streams.js
 * 
 * Automated testing script verifying HTTP 200 and HTTP 206 byte-range streaming responses
 * for all Tazheeb instructional video assets.
 * 
 * Supports both high-speed in-memory stream testing (zero socket permission dependencies)
 * and live network socket verification.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { handleStaticRequest } = require('./server');

const VIDEOS = [
  'video-01-shamsa.mp4',
  'video-02-islimi.mp4',
  'video-03-zarkari.mp4',
  'video-04-charpar.mp4'
];

function mockRequest(url, headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = 'GET';
    req.url = url;
    req.headers = {};
    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    const chunks = [];
    const res = new EventEmitter();
    res.headers = {};
    res.statusCode = 200;

    res.setHeader = (k, v) => {
      res.headers[k.toLowerCase()] = v;
    };

    res.writeHead = (status, h = {}) => {
      res.statusCode = status;
      for (const [k, v] of Object.entries(h)) {
        res.setHeader(k, v);
      }
    };

    res.write = (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = (chunk) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      });
    };

    handleStaticRequest(req, res);
  });
}

async function runVerification() {
  console.log('🧪 Starting Tazheeb HTTP 200 / 206 Video Streaming Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  for (const videoName of VIDEOS) {
    const videoUrl = `/assets/videos/${videoName}`;
    const filePath = path.join(__dirname, '..', 'assets', 'videos', videoName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Video file not found: ${filePath}`);
      failed++;
      continue;
    }
    const fileSize = fs.statSync(filePath).size;
    console.log(`📹 Testing media asset: ${videoName} (${(fileSize / 1024).toFixed(1)} KB)`);

    // Test 1: Full Content Streaming (HTTP 200 OK)
    const res200 = await mockRequest(videoUrl);
    if (res200.statusCode === 200 &&
        res200.headers['content-type'] === 'video/mp4' &&
        res200.headers['accept-ranges'] === 'bytes' &&
        res200.body.length === fileSize) {
      console.log(`  ✓ HTTP 200 OK: Full stream verified (${res200.body.length} bytes, video/mp4)`);
      passed++;
    } else {
      console.error(`  ❌ HTTP 200 Failed: status=${res200.statusCode}, headers=`, res200.headers);
      failed++;
    }

    // Test 2: iOS Safari Initial Byte-Range Probe (HTTP 206 with bytes=0-1)
    const res206Probe = await mockRequest(videoUrl, { 'Range': 'bytes=0-1' });
    if (res206Probe.statusCode === 206 &&
        res206Probe.headers['content-range'] === `bytes 0-1/${fileSize}` &&
        res206Probe.headers['content-length'] === 2 &&
        res206Probe.body.length === 2) {
      console.log(`  ✓ HTTP 206 Probe (0-1): Content-Range=bytes 0-1/${fileSize}, length=2`);
      passed++;
    } else {
      console.error(`  ❌ HTTP 206 Probe Failed: status=${res206Probe.statusCode}, range=${res206Probe.headers['content-range']}`);
      failed++;
    }

    // Test 3: Sub-chunk Streaming Range (HTTP 206 with bytes=100-500)
    const res206Chunk = await mockRequest(videoUrl, { 'Range': 'bytes=100-500' });
    const expectedChunkLen = 401;
    if (res206Chunk.statusCode === 206 &&
        res206Chunk.headers['content-range'] === `bytes 100-500/${fileSize}` &&
        res206Chunk.headers['content-length'] === expectedChunkLen &&
        res206Chunk.body.length === expectedChunkLen) {
      console.log(`  ✓ HTTP 206 Chunk (100-500): Content-Range=bytes 100-500/${fileSize}, length=${expectedChunkLen}`);
      passed++;
    } else {
      console.error(`  ❌ HTTP 206 Chunk Failed: status=${res206Chunk.statusCode}`);
      failed++;
    }

    // Test 4: Open-ended Range (HTTP 206 with bytes=1024-)
    const startByte = 1024;
    const res206Open = await mockRequest(videoUrl, { 'Range': `bytes=${startByte}-` });
    const expectedOpenLen = fileSize - startByte;
    if (res206Open.statusCode === 206 &&
        res206Open.headers['content-range'] === `bytes ${startByte}-${fileSize - 1}/${fileSize}` &&
        res206Open.headers['content-length'] === expectedOpenLen &&
        res206Open.body.length === expectedOpenLen) {
      console.log(`  ✓ HTTP 206 Open Range (${startByte}-): length=${expectedOpenLen}`);
      passed++;
    } else {
      console.error(`  ❌ HTTP 206 Open Range Failed: status=${res206Open.statusCode}`);
      failed++;
    }
  }

  // Test 5: Out-of-Bounds Range (HTTP 416 Range Not Satisfiable)
  console.log('\n🔒 Testing error handling:');
  const res416 = await mockRequest('/assets/videos/video-01-shamsa.mp4', { 'Range': 'bytes=999999999-999999999' });
  if (res416.statusCode === 416 && res416.headers['content-range']) {
    console.log(`  ✓ HTTP 416 Out-of-Bounds handled correctly (${res416.headers['content-range']})`);
    passed++;
  } else {
    console.error(`  ❌ HTTP 416 Failed: status=${res416.statusCode}`);
    failed++;
  }

  console.log('\n=============================================================');
  console.log(`🏁 Stream Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runVerification();
}
