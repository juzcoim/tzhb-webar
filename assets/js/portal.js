/**
 * assets/js/portal.js
 * 
 * Archival Fallback Monograph Portal Controller
 * Provides zero-camera fallback video access, chapter filtering,
 * and high-resolution plate inspection lightbox.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initMediaToggles();
    initLightbox();
  });

  /**
   * Chapter Filter Pills
   */
  function initFilters() {
    const filterPills = document.querySelectorAll('.filter-pill');
    const plateCards = document.querySelectorAll('.plate-card');
    const countEl = document.getElementById('visible-count');

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const filterValue = pill.getAttribute('data-filter');
        let visibleCount = 0;

        plateCards.forEach(card => {
          const cardChapter = card.getAttribute('data-chapter');
          if (filterValue === 'all' || cardChapter === filterValue) {
            card.style.display = 'flex';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        if (countEl) {
          countEl.textContent = `${visibleCount} Plates Displayed`;
        }
      });
    });
  }

  /**
   * Toggle between Video Player and Plate Drawing Preview
   */
  function initMediaToggles() {
    const cards = document.querySelectorAll('.plate-card');

    cards.forEach(card => {
      const btnVideo = card.querySelector('.btn-show-video');
      const btnImage = card.querySelector('.btn-show-image');
      const previewImg = card.querySelector('.plate-image-preview');
      const videoPlayer = card.querySelector('.plate-video-player');

      if (!btnVideo || !btnImage || !previewImg || !videoPlayer) return;

      btnVideo.addEventListener('click', () => {
        btnVideo.classList.add('active');
        btnImage.classList.remove('active');
        previewImg.classList.add('hidden');
        videoPlayer.play().catch(() => {});
      });

      btnImage.addEventListener('click', () => {
        btnImage.classList.add('active');
        btnVideo.classList.remove('active');
        previewImg.classList.remove('hidden');
        videoPlayer.pause();
      });
    });
  }

  /**
   * High-Resolution Lightbox Modal
   */
  function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const zoomTriggers = document.querySelectorAll('.btn-zoom-plate, .plate-image-preview');

    if (!modal || !lightboxImg) return;

    zoomTriggers.forEach(el => {
      el.addEventListener('click', () => {
        const src = el.getAttribute('data-full-src') || el.getAttribute('src');
        if (src) {
          lightboxImg.src = src;
          modal.classList.add('active');
        }
      });
    });

    const closeModal = () => modal.classList.remove('active');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

})();

