/**
 * scripts/lint-check.js
 * 
 * Headless syntax, integrity, and lint checks for HTML, JS, CSS, and SVG files.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalChecks = 0;
let errors = 0;

function check(name, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    errors++;
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

console.log('🔍 Running automated headless syntax and lint verification...\n');

// 1. Validate JavaScript syntax
console.log('📜 Checking JavaScript files syntax:');
const jsFiles = [
  'assets/js/app.js',
  'assets/js/portal.js',
  'scripts/generate-mocks.js',
  'scripts/generate-cert.js',
  'scripts/server.js',
  'scripts/compile-targets.js',
  'scripts/verify-streams.js'
];

jsFiles.forEach(rel => {
  const fullPath = path.join(ROOT_DIR, rel);
  if (fs.existsSync(fullPath)) {
    check(`JS Syntax: ${rel}`, () => {
      const code = fs.readFileSync(fullPath, 'utf8');
      new vm.Script(code, { filename: rel });
    });
  }
});

// 2. Validate HTML files structure & relative paths
console.log('\n📄 Checking HTML documents:');
const htmlFiles = ['index.html', 'portal.html', 'compiler.html'];

htmlFiles.forEach(rel => {
  const fullPath = path.join(ROOT_DIR, rel);
  if (fs.existsSync(fullPath)) {
    check(`HTML Integrity & Relative Paths: ${rel}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // DOCTYPE check
      if (!content.includes('<!DOCTYPE html>')) {
        throw new Error('Missing standard <!DOCTYPE html>');
      }

      // Check for absolute local paths (should use relative ./)
      const forbiddenAbsoluteMatches = content.match(/href="\/[a-zA-Z0-9]/g) || content.match(/src="\/[a-zA-Z0-9]/g);
      if (forbiddenAbsoluteMatches) {
        throw new Error(`Found absolute paths without relative prefix: ${forbiddenAbsoluteMatches.join(', ')}`);
      }

      // Check playsinline on video elements
      if (rel === 'index.html') {
        const videoMatches = content.match(/<video[^>]+>/g) || [];
        videoMatches.forEach(tag => {
          if (!tag.includes('playsinline') || !tag.includes('webkit-playsinline')) {
            throw new Error(`Video tag missing playsinline/webkit-playsinline for iOS Safari: ${tag}`);
          }
        });
      }
    });
  }
});

// 3. Validate CSS balanced braces
console.log('\n🎨 Checking CSS stylesheets:');
const cssFiles = ['assets/css/style.css', 'assets/css/portal.css'];

cssFiles.forEach(rel => {
  const fullPath = path.join(ROOT_DIR, rel);
  if (fs.existsSync(fullPath)) {
    check(`CSS Brace Balance: ${rel}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      let depth = 0;
      for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        if (depth < 0) throw new Error('Unbalanced closing brace } detected');
      }
      if (depth !== 0) throw new Error(`Unclosed opening brace { detected (remaining: ${depth})`);
    });
  }
});

// 4. Validate SVG plates XML structure
console.log('\n📐 Checking SVG plate integrity:');
const svgFiles = [
  'assets/plates/plate-01-shamsa.svg',
  'assets/plates/plate-02-islimi.svg',
  'assets/plates/plate-03-zarkari.svg'
];

svgFiles.forEach(rel => {
  const fullPath = path.join(ROOT_DIR, rel);
  if (fs.existsSync(fullPath)) {
    check(`SVG XML Entity & Tag Integrity: ${rel}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.includes('<svg') || !content.includes('</svg>')) {
        throw new Error('Missing <svg> root element tags');
      }
      // Check for bare unescaped ampersand
      const unescapedAmp = content.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);
      if (unescapedAmp) {
        throw new Error(`Found unescaped '&' at index ${unescapedAmp.index}`);
      }
    });
  }
});

console.log('\n=============================================================');
console.log(`🏁 Lint & Syntax Results: ${totalChecks - errors} Passed, ${errors} Failed`);
console.log('=============================================================\n');

if (errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

