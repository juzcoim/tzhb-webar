/**
 * assets/js/app.js
 * 
 * Tazheeb WebAR Scanner Controller
 * Powers MindAR v1.2.5 & A-Frame image tracking, audio/video orchestration,
 * gold HUD telemetry, and mobile permissions lifecycle.
 */

(function () {
  'use strict';

  // State Management
  const state = {
    isAudioEnabled: false,
    currentTargetIndex: null,
    isTargetLocked: false,
    mediaPrimed: false,
    plates: [
      {
            "index": 0,
            "id": "plate-01",
            "title": "Plate I: The Eightfold Shamsa",
            "chapter": "Chapter I: Radial Geometry & Groundwork",
            "lesson": "Master Lesson 1.1",
            "arabic": "شمسه هشت‌پر و هندسه دایره",
            "description": "Constructing the foundational octagram star grid using compass division. Covers parchment preparation, ground gesso layering, and burnishing geometry for 32-ray radial burst coronas.",
            "videoId": "video-shamsa"
      },
      {
            "index": 1,
            "id": "plate-02",
            "title": "Plate II: The Biomorphic Islimi",
            "chapter": "Chapter II: Foliation & Arabesque",
            "lesson": "Master Lesson 2.1",
            "arabic": "اسلیمی ساده، ماری و گل‌های خطایی",
            "description": "Drafting harmonic logarithmic golden spirals with constant curvature. Demonstrates executing Rumi split-leaf palmettes and razor-sharp black ink tahrir contours with a sable brush.",
            "videoId": "video-islimi"
      },
      {
            "index": 2,
            "id": "plate-03",
            "title": "Plate III: Zarkari Masterwork",
            "chapter": "Chapter III: Gilding & Illumination",
            "lesson": "Master Lesson 3.1",
            "arabic": "زرکاری، سرلوح و رنگ‌گذاری لاجورد",
            "description": "The grand illuminated manuscript sarlowh (frontispiece). Applying shell gold (morakkab), agate dog-tooth burnishing for mirror gloss reflections, and grinding pure lapis lazuli mineral pigment.",
            "videoId": "video-zarkari"
      },
      {
            "index": 3,
            "id": "plate-04",
            "title": "Plate IV: Charpar Floral Motif",
            "chapter": "Chapter IV: Floral Geometry & Cornerpieces",
            "lesson": "Master Lesson 4.1",
            "arabic": "طرح چهارپر و حاشیه",
            "description": "Four-petal symmetrical motif (charpar) construction, axial corner quadrant ornamentation, and precision gold illumination techniques.",
            "videoId": "video-charpar"
      },
      {
            "index": 4,
            "id": "plate-05",
            "title": "plate-05-panjpar",
            "chapter": "Khatai - Gul - Gul e reez",
            "lesson": "13",
            "arabic": "پنج پر",
            "description": "start with coloured guidline circles and then finish with black pencil outines.",
            "videoId": "video-plate-05-panjpar"
      }
]
  };

  // DOM Elements cache
  let dom = {};

  function initDom() {
    dom = {
      viewfinder: document.getElementById('viewfinder'),
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text'),
      targetCard: document.getElementById('target-info-card'),
      targetLesson: document.getElementById('target-lesson-pill'),
      targetTitle: document.getElementById('target-plate-title'),
      targetDesc: document.getElementById('target-description'),
      soundCard: document.getElementById('sound-trigger-card'),
      soundText: document.getElementById('sound-toggle-text'),
      soundIcon: document.getElementById('sound-toggle-icon'),
      cameraModal: document.getElementById('camera-permission-modal'),
      audioChime: document.getElementById('audio-chime')
    };
  }

  /**
   * Prime mobile media engine on first user touch/click.
   * Required for iOS Safari to allow WebGL video textures and WebAudio playback.
   */
  function primeMobileMedia() {
    if (state.mediaPrimed) return;
    state.mediaPrimed = true;
    console.log('[Tazheeb AR] Mobile media context primed via user gesture.');

    state.plates.forEach(plate => {
      const video = document.getElementById(plate.videoId);
      if (video) {
        video.muted = !state.isAudioEnabled;
        video.playsInline = true;
        const p = video.play();
        if (p !== undefined) {
          p.then(() => {
            if (state.currentTargetIndex !== plate.index) {
              video.pause();
              video.currentTime = 0;
            }
          }).catch(() => {});
        }
      }
    });

    if (dom.audioChime) {
      dom.audioChime.play().then(() => {
        dom.audioChime.pause();
        dom.audioChime.currentTime = 0;
      }).catch(() => {});
    }
  }

  /**
   * Play audio chime on target lock
   */
  function playChime() {
    if (dom.audioChime && state.isAudioEnabled) {
      dom.audioChime.currentTime = 0;
      dom.audioChime.play().catch(() => {});
    }
  }

  /**
   * Sound activation toggle
   */
  function setupSoundActivation() {
    if (!dom.soundCard) return;

    dom.soundCard.addEventListener('click', () => {
      state.isAudioEnabled = !state.isAudioEnabled;
      primeMobileMedia();

      // Update all video elements audio state
      state.plates.forEach(plate => {
        const video = document.getElementById(plate.videoId);
        if (video) {
          video.muted = !state.isAudioEnabled;
        }
      });

      if (state.isAudioEnabled) {
        dom.soundText.textContent = 'Audio Commentary Active';
        dom.soundCard.style.background = 'linear-gradient(135deg, #55EFC4 0%, #00B894 100%)';
        dom.soundCard.style.color = '#090B0E';
        playChime();
      } else {
        dom.soundText.textContent = 'Enable Master Audio';
        dom.soundCard.style.background = 'var(--gold-gradient)';
        dom.soundCard.style.color = 'var(--bg-obsidian)';
      }
    });
  }

  // Debounce Grace Window for Target Tracking (prevents flickering during minor hand motion)
  let lostDebounceTimer = null;
  const GRACE_PERIOD_MS = 1400; // 1.4-second grace window before pausing AR content

  /**
   * Handler when a MindAR image target is detected
   */
  function onTargetFound(targetIndex) {
    // 1. If there is a pending teardown timer from a momentary jitter, cancel it immediately!
    if (lostDebounceTimer) {
      clearTimeout(lostDebounceTimer);
      lostDebounceTimer = null;
    }

    // 2. If already locked onto this exact target, DO NOT re-initialize, re-chime, or restart video!
    if (state.isTargetLocked && state.currentTargetIndex === targetIndex) {
      const plate = state.plates[targetIndex];
      if (plate) {
        const video = document.getElementById(plate.videoId);
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }
      return;
    }

    // 3. If switching from another active target, pause the previous one cleanly
    if (state.currentTargetIndex !== null && state.currentTargetIndex !== targetIndex) {
      const prevPlate = state.plates[state.currentTargetIndex];
      if (prevPlate) {
        const prevVideo = document.getElementById(prevPlate.videoId);
        if (prevVideo) prevVideo.pause();
      }
    }

    console.log(`[Tazheeb AR] Target locked: index ${targetIndex}`);
    state.currentTargetIndex = targetIndex;
    state.isTargetLocked = true;
    const plate = state.plates[targetIndex] || state.plates[0];

    // 1. Update HUD Reticle to Locked State
    if (dom.viewfinder) {
      dom.viewfinder.classList.add('target-locked');
    }

    if (dom.statusDot) {
      dom.statusDot.classList.add('locked');
    }

    if (dom.statusText) {
      dom.statusText.textContent = `TARGET LOCKED: PLATE 0${targetIndex + 1}`;
    }

    // 2. Display Target Telemetry Info Card
    if (dom.targetCard) {
      dom.targetLesson.textContent = plate.lesson;
      dom.targetTitle.textContent = `${plate.title} (${plate.arabic})`;
      dom.targetDesc.textContent = plate.description;
      dom.targetCard.classList.add('visible');
    }

    // 3. Play Chime once on initial target acquisition
    playChime();

    // 4. Play Corresponding Video Overlay smoothly (never reset currentTime)
    const video = document.getElementById(plate.videoId);
    if (video) {
      video.muted = !state.isAudioEnabled;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn(`Autoplay with audio blocked on ${plate.videoId}, falling back to muted:`, err);
          video.muted = true;
          video.play().catch(e => console.error('Muted autoplay also blocked:', e));
        });
      }
    }
  }

  /**
   * Handler when MindAR loses image tracking.
   * Debounced with a grace window so quick movements or tilt don't flicker.
   */
  function onTargetLost(targetIndex) {
    // If not the current target, ignore
    if (state.currentTargetIndex !== targetIndex) return;

    if (lostDebounceTimer) {
      clearTimeout(lostDebounceTimer);
    }

    // Wait for the grace period before tearing down AR state
    lostDebounceTimer = setTimeout(() => {
      if (state.currentTargetIndex === targetIndex) {
        console.log(`[Tazheeb AR] Target genuinely lost after grace window: index ${targetIndex}`);
        state.currentTargetIndex = null;
        state.isTargetLocked = false;

        // 1. Revert Viewfinder to Scanning State
        if (dom.viewfinder) {
          dom.viewfinder.classList.remove('target-locked');
        }

        if (dom.statusDot) {
          dom.statusDot.classList.remove('locked');
        }

        if (dom.statusText) {
          dom.statusText.textContent = 'SCANNING PRINTED PAGE...';
        }

        // 2. Hide Target Info Card
        if (dom.targetCard) {
          dom.targetCard.classList.remove('visible');
        }

        // 3. Pause Video Overlay
        const plate = state.plates[targetIndex];
        if (plate) {
          const video = document.getElementById(plate.videoId);
          if (video) {
            video.pause();
          }
        }
      }
      lostDebounceTimer = null;
    }, GRACE_PERIOD_MS);
  }

  /**
   * Bind event listeners directly to all MindAR target entities.
   * Direct DOM event binding bypasses any component lifecycle races.
   */
  function bindTargetListeners() {
    const targetEntities = document.querySelectorAll('[mindar-image-target]');
    console.log(`[Tazheeb AR] Binding tracking listeners to ${targetEntities.length} entities.`);

    targetEntities.forEach((el, defaultIdx) => {
      if (el._tazheebBound) return;
      el._tazheebBound = true;

      // Determine target index
      let targetIndex = defaultIdx;
      const dataAttr = el.getAttribute('data-target-index');
      if (dataAttr !== null && dataAttr !== '') {
        targetIndex = parseInt(dataAttr, 10);
      } else {
        const mindarAttr = el.getAttribute('mindar-image-target') || '';
        const match = mindarAttr.match(/targetIndex:\s*(\d+)/);
        if (match) targetIndex = parseInt(match[1], 10);
      }

      el.addEventListener('targetFound', () => onTargetFound(targetIndex));
      el.addEventListener('targetLost', () => onTargetLost(targetIndex));
    });
  }

  /**
   * Error Handling & Camera Permission Diagnostics
   */
  function setupErrorHandling() {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('arError', (event) => {
        console.error('[Tazheeb AR] arError event:', event.detail);
        showCameraModal('WebAR Initialization Error', 'Unable to initialize augmented reality camera tracking. Please ensure camera access is allowed.');
      });

      scene.addEventListener('arReady', () => {
        console.log('[Tazheeb AR] MindAR tracking system ready.');
        if (dom.statusText) {
          dom.statusText.textContent = 'AIM CAMERA AT PRINTED PLATE';
        }
      });
    }

    // Global navigator permission check
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then(res => {
          if (res.state === 'denied') {
            showCameraModal('Camera Permission Blocked', 'Camera access was previously denied in your browser settings. Please allow camera permissions to experience interactive AR plates.');
          }
        }).catch(() => {});
      }
    } else {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showCameraModal('HTTPS Required for Camera', 'Mobile browsers require a secure HTTPS connection to activate WebAR camera scanning. Please use the secure local server link or Archival Portal.');
      }
    }
  }

  function showCameraModal(title, message) {
    if (dom.cameraModal) {
      const titleEl = dom.cameraModal.querySelector('.modal-title');
      const bodyEl = dom.cameraModal.querySelector('.modal-body');
      if (titleEl) titleEl.textContent = title;
      if (bodyEl) bodyEl.textContent = message;
      dom.cameraModal.classList.add('active');
    }
  }

  // Setup Lifecycle Initialization
  function initApp() {
    initDom();
    bindTargetListeners();
    setupSoundActivation();
    setupErrorHandling();

    // Global touch/click listeners to prime mobile media engine
    window.addEventListener('touchstart', primeMobileMedia, { once: true, passive: true });
    window.addEventListener('click', primeMobileMedia, { once: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Also re-verify target bindings when A-Frame scene signals loaded
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl) {
    sceneEl.addEventListener('loaded', () => {
      console.log('[Tazheeb AR] A-Frame scene loaded event received.');
      bindTargetListeners();
    });
  }

})();
