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
    isProcessing: false
  };

  // DOM Elements
  const dom = {
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
    setTimeout(() => dom.toast.classList.remove('show'), 4000);
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
      const res = await fetch(`./api/plates/${index}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      showToast(`Deleted "${title}" successfully.`);
      await loadCurriculum();
      
      // Prompt user to recompile
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
        const res = await fetch('./api/upload-plate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload plate');

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
        showToast(`Upload failed: ${err.message}`, true);
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
      const res = await fetch('./api/recompile', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Compilation failed');

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
      const res = await fetch('./api/publish', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deployment failed');

      log('Deployment SUCCESS: Live GitHub Pages repository updated!');
      showToast('Successfully published to GitHub Pages!');
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
    setupDropzones();
    setupForm();
    loadCurriculum();
  });

})();
