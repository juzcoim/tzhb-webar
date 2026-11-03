/**
 * assets/js/admin.js
 * 
 * Tazheeb Curriculum Admin Portal Controller
 * Manages plate uploads, video binding, automatic static HTML sync,
 * MindAR target recompilation, and one-click GitHub Pages deployment.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    curriculum: [],
    uploadedImageBase64: null,
    uploadedImageName: null,
    uploadedVideoBase64: null,
    uploadedVideoName: null,
    isProcessing: false,
    isLocalServer: false
  };

  // DOM Elements
  const dom = {
    envBanner: document.getElementById('env-banner'),
    platesGrid: document.getElementById('plates-grid'),
    telemetryCount: document.getElementById('telemetry-plates-count'),
    telemetrySize: document.getElementById('telemetry-targets-size'),
    addForm: document.getElementById('add-plate-form'),
    btnSubmit: document.getElementById('btn-submit-plate'),
    btnRecompile: document.getElementById('btn-recompile-only'),
    btnPublish: document.getElementById('btn-publish-github'),
    statusMsg: document.getElementById('form-status-msg'),
    consoleLog: document.getElementById('console-log'),
    toast: document.getElementById('admin-toast'),
    toastMsg: document.getElementById('toast-message'),
    toastIcon: document.getElementById('toast-icon'),
    // Dropzone inputs
    inputImage: document.getElementById('input-image'),
    previewImage: document.getElementById('preview-image'),
    dzImage: document.getElementById('dz-image'),
    inputVideo: document.getElementById('input-video'),
    previewVideo: document.getElementById('preview-video'),
    dzVideo: document.getElementById('dz-video'),
    // Form fields
    fieldTitle: document.getElementById('field-title'),
    fieldArabic: document.getElementById('field-arabic'),
    fieldChapter: document.getElementById('field-chapter'),
    fieldLesson: document.getElementById('field-lesson'),
    fieldTopics: document.getElementById('field-topics'),
    fieldDesc: document.getElementById('field-desc')
  };

  /**
   * Append message to interactive terminal console
   */
  function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    dom.consoleLog.textContent += `\n[${timestamp}] ${msg}`;
    dom.consoleLog.scrollTop = dom.consoleLog.scrollHeight;
  }

  /**
   * Display toast notification
   */
  function showToast(message, isError = false) {
    dom.toastIcon.textContent = isError ? '⚠️' : '✅';
    dom.toastMsg.textContent = message;
    dom.toast.classList.add('show');
    setTimeout(() => dom.toast.classList.remove('show'), 4500);
  }

  /**
   * Safe fetch with robust JSON and HTML error response handling
   */
  async function safeFetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();

    // Check if the server returned an HTML error page (e.g. 404 from GitHub Pages)
    if (text.trim().startsWith('<')) {
      if (window.location.hostname.includes('github.io')) {
        throw new Error(
          'Cloud Static Hosting Detected: GitHub Pages cannot run server-side upload APIs. Please run "npm start" on your computer and open https://localhost:8443/admin.html to add plates and compile AR targets.'
        );
      } else {
        throw new Error(`Server returned HTML (${res.status}). Please verify that local server is running on https://localhost:8443.`);
      }
    }

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

  /**
   * Detect whether running on local Node server or static GitHub Pages
   */
  function checkEnvironment() {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || window.location.port === '8443';
    state.isLocalServer = isLocal;

    if (!isLocal) {
      // Cloud Static Notice on GitHub Pages
      dom.envBanner.style.display = 'block';
      dom.envBanner.innerHTML = `
        <div style="background: rgba(230, 126, 34, 0.15); border: 1px solid #E67E22; border-radius: 10px; padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px;">
          <span style="font-size: 26px;">☁️</span>
          <div>
            <div style="font-weight: 700; color: #F39C12; font-size: 15px; margin-bottom: 4px;">Viewing on GitHub Pages (Cloud Static Hosting)</div>
            <div style="font-size: 13px; color: #E2E8F0; line-height: 1.5;">
              GitHub Pages is a static host without a backend to write files or run the MindAR compiler.
              <br>
              👉 To add new plates, upload videos, and compile AR targets, open the Admin Portal on your local computer:
              <br>
              <a href="https://localhost:8443/admin.html" target="_blank" style="display: inline-block; margin-top: 6px; padding: 6px 12px; background: var(--gold-gradient); color: #090B0E; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 12px;">
                Open Local Studio Server: https://localhost:8443/admin.html
              </a>
              <span style="margin-left: 8px; font-size: 12px; color: var(--text-muted);">(Run <code>npm start</code> in your project directory)</span>
            </div>
          </div>
        </div>
      `;
      log('[Notice] Running on static GitHub Pages. File upload & compilation APIs require local server at https://localhost:8443');
    } else {
      // Local Studio Server Active
      dom.envBanner.style.display = 'block';
      dom.envBanner.innerHTML = `
        <div style="background: rgba(0, 184, 148, 0.12); border: 1px solid #00B894; border-radius: 10px; padding: 12px 18px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 18px;">🟢</span>
          <span style="font-size: 13px; color: #55EFC4;">
            <strong>Local Studio Server Active:</strong> Full filesystem access, automated MindAR compiler, and 1-click GitHub deployment are connected.
          </span>
        </div>
      `;
      log('[Ready] Connected to local HTTPS service at https://localhost:8443');
    }
  }

  /**
   * Fetch curriculum registry and render UI
   */
  async function loadCurriculum() {
    try {
      log('Fetching curriculum registry...');
      const res = await fetch('./api/curriculum').catch(() => fetch('./assets/data/curriculum.json'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.curriculum = await res.json();

      dom.telemetryCount.textContent = `${state.curriculum.length} Plates`;
      renderPlatesGrid();
      log(`Loaded ${state.curriculum.length} curriculum plates successfully.`);
    } catch (err) {
      log(`Error loading curriculum: ${err.message}`);
    }
  }

  /**
   * Render plate cards into the grid
   */
  function renderPlatesGrid() {
    dom.platesGrid.innerHTML = '';

    if (state.curriculum.length === 0) {
      dom.platesGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No plates registered yet. Add your first plate above!</div>`;
      return;
    }

    state.curriculum.forEach((plate, idx) => {
      const card = document.createElement('article');
      card.className = 'plate-admin-card';

      const imgSrc = plate.vectorFile ? `./assets/plates/${plate.vectorFile}` : `./assets/plates/${plate.imageFile}`;
      const vidSrc = `./assets/videos/${plate.videoFile}`;

      card.innerHTML = `
        <div class="card-media-preview">
          <span class="target-badge">TARGET ${idx}</span>
          <img src="${imgSrc}" alt="${plate.title}" id="img-preview-${idx}">
          <video src="${vidSrc}" controls playsinline id="vid-preview-${idx}"></video>
        </div>
        <div class="card-body">
          <div class="card-lesson">${plate.chapter.split(':')[0]} • ${plate.lesson}</div>
          <h3 class="card-title">${plate.title}</h3>
          <div class="card-arabic">${plate.arabic || ''}</div>
          <p class="card-desc">${plate.description}</p>
          <div class="card-actions">
            <button class="btn btn-secondary btn-toggle-media" data-idx="${idx}" type="button" style="padding: 4px 10px; font-size: 11px;">
              Toggle Video / Drawing
            </button>
            <button class="btn btn-danger btn-delete-plate" data-idx="${idx}" type="button" style="padding: 4px 10px; font-size: 11px;">
              Delete Plate
            </button>
          </div>
        </div>
      `;

      // Media toggle listener
      const toggleBtn = card.querySelector('.btn-toggle-media');
      const imgEl = card.querySelector(`#img-preview-${idx}`);
      const vidEl = card.querySelector(`#vid-preview-${idx}`);
      toggleBtn.addEventListener('click', () => {
        if (imgEl.style.display === 'none') {
          imgEl.style.display = 'block';
          vidEl.style.display = 'none';
          vidEl.pause();
        } else {
          imgEl.style.display = 'none';
          vidEl.style.display = 'block';
          vidEl.play().catch(() => {});
        }
      });

      // Delete listener
      const deleteBtn = card.querySelector('.btn-delete-plate');
      deleteBtn.addEventListener('click', () => deletePlate(idx, plate.title));

      dom.platesGrid.appendChild(card);
    });
  }

  /**
   * Delete a plate from curriculum
   */
  async function deletePlate(index, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This will re-index target sequence and update WebAR targets.`)) {
      return;
    }

    try {
      log(`Deleting plate ${index}: "${title}"...`);
      await safeFetchJson(`./api/plates/${index}`, { method: 'DELETE' });

      showToast(`Deleted "${title}" successfully.`);
      await loadCurriculum();
      
      log('Curriculum sequence modified. Recompiling MindAR targets.mind...');
      recompileTargets();
    } catch (err) {
      log(`Error deleting plate: ${err.message}`);
      showToast(`Delete failed: ${err.message}`, true);
    }
  }

  /**
   * Configure Drag and Drop media file inputs
   */
  function setupDropzones() {
    // Image Dropzone
    dom.dzImage.addEventListener('dragover', (e) => { e.preventDefault(); dom.dzImage.classList.add('dragover'); });
    dom.dzImage.addEventListener('dragleave', () => dom.dzImage.classList.remove('dragover'));
    dom.dzImage.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.dzImage.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    });
    dom.inputImage.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
    });

    // Video Dropzone
    dom.dzVideo.addEventListener('dragover', (e) => { e.preventDefault(); dom.dzVideo.classList.add('dragover'); });
    dom.dzVideo.addEventListener('dragleave', () => dom.dzVideo.classList.remove('dragover'));
    dom.dzVideo.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.dzVideo.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleVideoFile(e.dataTransfer.files[0]);
    });
    dom.inputVideo.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleVideoFile(e.target.files[0]);
    });
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, or WebP).');
      return;
    }
    state.uploadedImageName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.uploadedImageBase64 = e.target.result;
      dom.previewImage.src = e.target.result;
      dom.previewImage.style.display = 'block';
      log(`Loaded plate image artwork: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsDataURL(file);
  }

  function handleVideoFile(file) {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a valid MP4 video file.');
      return;
    }
    state.uploadedVideoName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.uploadedVideoBase64 = e.target.result;
      dom.previewVideo.src = e.target.result;
      dom.previewVideo.style.display = 'block';
      log(`Loaded master video stream: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handle Plate Form Submission
   */
  async function setupForm() {
    dom.addForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!state.uploadedImageBase64) {
        alert('Please upload a plate drawing illustration.');
        return;
      }
      if (!state.uploadedVideoBase64) {
        alert('Please upload an instructional master video.');
        return;
      }

      setProcessing(true, 'Uploading and saving curriculum plate...');
      log(`Saving new plate: "${dom.fieldTitle.value}"...`);

      const payload = {
        title: dom.fieldTitle.value,
        arabic: dom.fieldArabic.value,
        chapter: dom.fieldChapter.value,
        chapterId: 'ch' + (state.curriculum.length + 1),
        lesson: dom.fieldLesson.value,
        topics: dom.fieldTopics.value,
        description: dom.fieldDesc.value,
        imageFileName: state.uploadedImageName,
        imageBase64: state.uploadedImageBase64,
        videoFileName: state.uploadedVideoName,
        videoBase64: state.uploadedVideoBase64
      };

      try {
        await safeFetchJson('./api/upload-plate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        log(`Saved plate "${payload.title}" successfully! Automatically synced index.html and portal.html.`);
        showToast(`Plate "${payload.title}" created successfully!`);

        // Reset form
        dom.addForm.reset();
        dom.previewImage.style.display = 'none';
        dom.previewVideo.style.display = 'none';
        state.uploadedImageBase64 = null;
        state.uploadedVideoBase64 = null;

        // Reload curriculum
        await loadCurriculum();

        // Automatically trigger MindAR compilation
        setProcessing(true, 'Compiling MindAR target binary...');
        await recompileTargets();

      } catch (err) {
        log(`Upload failed: ${err.message}`);
        showToast(err.message, true);
      } finally {
        setProcessing(false);
      }
    });

    // Recompile only button
    dom.btnRecompile.addEventListener('click', () => recompileTargets());

    // Publish to GitHub Pages
    dom.btnPublish.addEventListener('click', () => publishToGitHub());
  }

  /**
   * Trigger MindAR target compilation
   */
  async function recompileTargets() {
    setProcessing(true, 'Compiling targets.mind binary via computer vision pipeline...');
    log('Starting MindAR target compilation pipeline (executing Gaussian pyramid feature extractor)...');

    try {
      const data = await safeFetchJson('./api/recompile', { method: 'POST' });

      log(`Target compilation SUCCESS! targets.mind: ${(data.bytes / 1024).toFixed(1)} KB`);
      dom.telemetrySize.textContent = `${(data.bytes / 1024).toFixed(1)} KB`;
      showToast('MindAR targets recompiled successfully!');
    } catch (err) {
      log(`Compilation failed: ${err.message}`);
      showToast(`Compilation failed: ${err.message}`, true);
    } finally {
      setProcessing(false);
    }
  }

  /**
   * Publish updates to GitHub Pages
   */
  async function publishToGitHub() {
    setProcessing(true, 'Deploying curriculum updates to GitHub Pages...');
    log('Running: git add . && git commit && git push origin main...');

    try {
      const data = await safeFetchJson('./api/publish', { method: 'POST' });

      if (data && data.warning) {
        log(`[Notice] ${data.message}`);
        showToast(data.message, false);
      } else {
        log('Deployment SUCCESS: Live GitHub Pages repository updated!');
        showToast('Successfully published to GitHub Pages!');
      }
    } catch (err) {
      log(`Deploy error: ${err.message}`);
      showToast(`Deploy failed: ${err.message}`, true);
    } finally {
      setProcessing(false);
    }
  }

  function setProcessing(active, msg = '') {
    state.isProcessing = active;
    dom.btnSubmit.disabled = active;
    dom.btnRecompile.disabled = active;
    dom.btnPublish.disabled = active;
    dom.statusMsg.textContent = msg;
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    checkEnvironment();
    setupDropzones();
    setupForm();
    loadCurriculum();
  });

})();
