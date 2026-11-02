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
    plates: [
      {
        index: 0,
        id: 'plate-01',
        title: 'Plate I: The Eightfold Shamsa',
        chapter: 'Chapter I: Radial Geometry & Groundwork',
        lesson: 'Master Lesson 1.1',
        arabic: 'شمسه هشت‌پر',
        description: 'Octagonal star division, radiating 32-ray corona, and ground gesso preparation for shell gold gilding.',
        videoId: 'video-shamsa'
      },
      {
        index: 1,
        id: 'plate-02',
        title: 'Plate II: The Biomorphic Islimi',
        chapter: 'Chapter II: Foliation & Arabesque',
        lesson: 'Master Lesson 2.1',
        arabic: 'اسلیمی و گل‌های خطایی',
        description: 'Logarithmic golden spirals, Rumi split palmettes, and executing delicate tahrir black ink contouring.',
        videoId: 'video-islimi'
      },
      {
        index: 2,
        id: 'plate-03',
        title: 'Plate III: Zarkari Masterwork',
        chapter: 'Chapter III: Gilding & Illumination',
        lesson: 'Master Lesson 3.1',
        arabic: 'زرکاری و لاجورد',
        description: 'Agate burnishing for mirror gloss gold finish and genuine Afghan lapis lazuli pigment application.',
        videoId: 'video-zarkari'
      }
    ]
  };

  // DOM Elements
  const dom = {
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

      // Update all video elements audio state
      state.plates.forEach(plate => {
        const video = document.getElementById(plate.videoId);
        if (video) {
          video.muted = !state.isAudioEnabled;
        }
      });

      if (state.isAudioEnabled) {
        dom.soundText.textContent = 'Audio Enabled';
        dom.soundCard.style.background = 'linear-gradient(135deg, #55EFC4 0%, #00B894 100%)';
        dom.soundCard.style.color = '#090B0E';
        playChime();
      } else {
        dom.soundText.textContent = 'Enable Audio';
        dom.soundCard.style.background = 'var(--gold-gradient)';
        dom.soundCard.style.color = 'var(--bg-obsidian)';
      }
    });
  }

  /**
   * Handler when a MindAR image target is detected
   */
  function onTargetFound(targetIndex) {
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

    // 3. Play Chime
    playChime();

    // 4. Play Corresponding Video Overlay
    const video = document.getElementById(plate.videoId);
    if (video) {
      video.muted = !state.isAudioEnabled;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn(`Autoplay blocked on ${plate.videoId}:`, err);
        });
      }
    }
  }

  /**
   * Handler when MindAR loses image tracking
   */
  function onTargetLost(targetIndex) {
    if (state.currentTargetIndex === targetIndex) {
      state.currentTargetIndex = null;
      state.isTargetLocked = false;
    }

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

  /**
   * Register custom A-Frame tracking component for MindAR targets
   */
  function registerAFrameTracking() {
    if (typeof AFRAME === 'undefined') {
      console.warn('AFRAME not loaded yet, waiting...');
      setTimeout(registerAFrameTracking, 100);
      return;
    }

    if (!AFRAME.components['tazheeb-target-listener']) {
      AFRAME.registerComponent('tazheeb-target-listener', {
        init: function () {
          const el = this.el;
          const targetIndex = parseInt(el.getAttribute('data-target-index') || '0', 10);

          el.addEventListener('targetFound', () => {
            console.log(`[Tazheeb AR] targetFound: index ${targetIndex}`);
            onTargetFound(targetIndex);
          });

          el.addEventListener('targetLost', () => {
            console.log(`[Tazheeb AR] targetLost: index ${targetIndex}`);
            onTargetLost(targetIndex);
          });
        }
      });
    }
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
      // Permission API if available
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then(res => {
          if (res.state === 'denied') {
            showCameraModal('Camera Permission Blocked', 'Camera access was previously denied in your browser settings. Please allow camera permissions to experience interactive AR plates.');
          }
        }).catch(() => {});
      }
    } else {
      // Non-HTTPS or unsupported environment
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

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    registerAFrameTracking();
    setupSoundActivation();
    setupErrorHandling();
  });

})();

