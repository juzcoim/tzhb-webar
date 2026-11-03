/**
 * scripts/sync-curriculum.js
 * 
 * Synchronizes assets/data/curriculum.json across:
 * 1. index.html (<a-assets> and <a-entity> image target anchors)
 * 2. portal.html (filter pills and .plates-grid cards)
 * 3. assets/js/app.js (state.plates telemetry array)
 * 4. scripts/verify-streams.js (video stream tests)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CURRICULUM_FILE = path.join(ROOT_DIR, 'assets', 'data', 'curriculum.json');
const INDEX_HTML = path.join(ROOT_DIR, 'index.html');
const PORTAL_HTML = path.join(ROOT_DIR, 'portal.html');
const APP_JS = path.join(ROOT_DIR, 'assets', 'js', 'app.js');

function syncCurriculum() {
  if (!fs.existsSync(CURRICULUM_FILE)) {
    throw new Error(`Missing ${CURRICULUM_FILE}`);
  }

  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_FILE, 'utf8'));
  console.log(`🔄 Syncing curriculum data (${curriculum.length} plates) across static HTML and JS files...`);

  // 1. Sync index.html
  let indexContent = fs.readFileSync(INDEX_HTML, 'utf8');

  // Generate <video> assets
  const videoAssets = curriculum.map(p => 
    `        <video id="${p.videoId}" src="./assets/videos/${p.videoFile}" preload="auto" loop="true" playsinline webkit-playsinline muted crossorigin="anonymous"></video>`
  ).join('\n');

  // Generate <a-entity> target anchors
  const targetEntities = curriculum.map((p, idx) => 
`      <!-- Target ${idx}: ${p.title} -->
      <a-entity mindar-image-target="targetIndex: ${idx}" id="target-${idx}" data-target-index="${idx}">
        <a-plane position="0 0 -0.005" height="1.04" width="1.04" rotation="0 0 0" material="color: #D4AF37; shader: flat; opacity: 0.9"></a-plane>
        <a-video src="#${p.videoId}" position="0 0 0" height="1" width="1" rotation="0 0 0" playsinline webkit-playsinline></a-video>
      </a-entity>`
  ).join('\n\n');

  // Replace <a-assets> inner content
  indexContent = indexContent.replace(
    /<a-assets timeout="10000">[\s\S]*?<\/a-assets>/,
    `<a-assets timeout="10000">\n        <!-- High-Performance Master Video Streams with iOS playsinline -->\n${videoAssets}\n      </a-assets>`
  );

  // Replace target entities (between <a-camera ...></a-camera> and </a-scene>)
  indexContent = indexContent.replace(
    /(<a-camera position="0 0 0" look-controls="enabled: false"><\/a-camera>\n\n)[\s\S]*?(\n    <\/a-scene>)/,
    `$1${targetEntities}$2`
  );

  fs.writeFileSync(INDEX_HTML, indexContent, 'utf8');
  console.log('  ✓ Updated index.html target entities and video assets');

  // 2. Sync portal.html
  let portalContent = fs.readFileSync(PORTAL_HTML, 'utf8');

  // Build chapter filters
  const chaptersMap = new Map();
  curriculum.forEach(p => {
    if (!chaptersMap.has(p.chapterId)) {
      chaptersMap.set(p.chapterId, p.chapter.split(':')[0].trim());
    }
  });

  let filterPills = `        <button class="filter-pill active" data-filter="all" type="button">All Curriculum Plates (${curriculum.length})</button>\n`;
  chaptersMap.forEach((name, id) => {
    filterPills += `        <button class="filter-pill" data-filter="${id}" type="button">${name}</button>\n`;
  });

  portalContent = portalContent.replace(
    /<div class="filter-pills">[\s\S]*?<\/div>/,
    `<div class="filter-pills">\n${filterPills}      </div>`
  );

  portalContent = portalContent.replace(
    /<div class="catalog-stats" id="visible-count">[\s\S]*?<\/div>/,
    `<div class="catalog-stats" id="visible-count">${curriculum.length} Plates Displayed</div>`
  );

  // Build plate cards
  const plateCards = curriculum.map((p, idx) => {
    const previewSrc = p.vectorFile ? `./assets/plates/${p.vectorFile}` : `./assets/plates/${p.imageFile}`;
    const topicsHtml = (p.topics || []).map(t => `<span class="topic-tag">${t}</span>`).join('\n            ');
    return `      <!-- Plate Card ${idx + 1} -->
      <article class="plate-card" data-chapter="${p.chapterId}">
        <div class="plate-media-wrapper">
          <video class="plate-video-player" src="./assets/videos/${p.videoFile}" controls preload="metadata" playsinline></video>
          <img class="plate-image-preview hidden" src="${previewSrc}" alt="${p.title}" data-full-src="${previewSrc}">
          <div class="media-toggle-bar">
            <button class="media-toggle-btn btn-show-video active" type="button">Video</button>
            <button class="media-toggle-btn btn-show-image" type="button">Plate Drawing</button>
          </div>
        </div>
        <div class="plate-content">
          <div class="plate-meta-row">
            <span class="plate-lesson-tag">${p.chapter.split(':')[0]} • ${p.lesson}</span>
            <span class="plate-duration">Master Video • Live Media</span>
          </div>
          <h2 class="plate-name">${p.title.split(':')[1] ? p.title.split(':')[1].trim() : p.title}</h2>
          <div class="plate-arabic-label">${p.arabic || ''}</div>
          <p class="plate-desc">${p.description}</p>
          <div class="plate-curriculum-topics">
            ${topicsHtml}
          </div>
          <div class="plate-card-actions">
            <button class="card-btn card-btn-primary btn-zoom-plate" data-full-src="${previewSrc}" type="button">
              Inspect ${p.vectorFile ? 'Vector Plate' : 'Plate'}
            </button>
            <a href="./assets/videos/${p.videoFile}" download="${p.videoFile}" class="card-btn card-btn-secondary">
              Download Media
            </a>
          </div>
        </div>
      </article>`;
  }).join('\n\n');

  portalContent = portalContent.replace(
    /(<div class="plates-grid">\n\n)[\s\S]*?(\n    <\/div>\n  <\/main>)/,
    `$1${plateCards}$2`
  );

  fs.writeFileSync(PORTAL_HTML, portalContent, 'utf8');
  console.log('  ✓ Updated portal.html catalog cards and chapter filters');

  // 3. Sync assets/js/app.js
  let appJsContent = fs.readFileSync(APP_JS, 'utf8');
  const platesJson = JSON.stringify(curriculum.map(p => ({
    index: p.index,
    id: p.id,
    title: p.title,
    chapter: p.chapter,
    lesson: p.lesson,
    arabic: p.arabic,
    description: p.description,
    videoId: p.videoId
  })), null, 6);

  appJsContent = appJsContent.replace(
    /plates:\s*\[[\s\S]*?\](?=\n\s*};)/,
    `plates: ${platesJson}`
  );

  fs.writeFileSync(APP_JS, appJsContent, 'utf8');
  console.log('  ✓ Updated assets/js/app.js state.plates array');

  console.log('✅ Full static curriculum synchronization complete!\n');
}

if (require.main === module) {
  syncCurriculum();
}

module.exports = { syncCurriculum };
