# Tazheeb WebAR Instructional Companion

[![WebAR](https://img.shields.io/badge/WebAR-MindAR%20v1.2.5-D4AF37.svg)](https://github.com/hiukim/mind-ar-js)
[![A-Frame](https://img.shields.io/badge/3D%20Engine-A--Frame%20v1.5.0-EF2D5E.svg)](https://aframe.io)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A studio-grade WebAR instructional companion web application designed for a traditional **Tazheeb (Islamic manuscript illumination)** printed curriculum. 

When students point their mobile camera at the printed lesson plates, the page locks onto high-contrast geometric feature coordinates and overlays live master instructional video demonstrations with synchronized sound and a museum-quality gold HUD.

---

## 🏛️ Curriculum Structure & Active Plates

| Plate | Chapter & Title | Traditional Motifs | Master Video Lesson |
| :--- | :--- | :--- | :--- |
| **Plate 01** | `Chapter I`: The Eightfold Shamsa | Octagram star, radial geometry, 32-ray burst corona, gesso ground | `Lesson 1.1` • Octagonal division & ground gesso |
| **Plate 02** | `Chapter II`: The Biomorphic Islimi | Logarithmic golden spiral, Rumi split palmettes, Khatai blossoms | `Lesson 2.1` • Constant curvature & sable tahrir contour |
| **Plate 03** | `Chapter III`: Zarkari Masterwork | Mihrab sarlowh arch, diamond toranj medallion, lapis lazuli ground | `Lesson 3.1` • Shell gold burnishing & lapis pigment |

---

## 📁 Architecture & File Layout

```
Taz-AR/
├── index.html                  # Responsive dark/gold WebAR scanner (MindAR v1.2.5 & A-Frame)
├── portal.html                 # Archival zero-camera monograph fallback catalog
├── compiler.html               # Web-based MindAR target compiler tool
├── package.json                # Project scripts, commands, metadata
├── wrangler.toml               # Cloudflare Pages production deployment configuration
├── .certs/                     # Auto-generated SSL certificates with SANs for local HTTPS
├── assets/
│   ├── css/
│   │   ├── style.css           # Studio dark/gold HUD, glassmorphism, responsive notch styling
│   │   └── portal.css          # Archival publication catalog layout
│   ├── js/
│   │   ├── app.js              # Tracking coordinator, video sync, audio unmuting, camera errors
│   │   └── portal.js           # Catalog filters, media toggles, vector lightbox inspector
│   ├── plates/                 # High-contrast geometric curriculum drawings
│   │   ├── plate-01-shamsa.svg & .png (1024x1024)
│   │   ├── plate-02-islimi.svg & .png (1024x1024)
│   │   └── plate-03-zarkari.svg & .png (1024x1024)
│   ├── videos/                 # H.264/AAC MP4 master instructional video streams
│   │   ├── video-01-shamsa.mp4
│   │   ├── video-02-islimi.mp4
│   │   └── video-03-zarkari.mp4
│   ├── audio/
│   │   └── chime.wav           # 528Hz golden harmonic meditation chime
│   ├── icons/                  # Golden SVG HUD reticles, audio pills, book emblems
│   └── targets/                # MindAR compiled binary targets
│       └── targets.mind
├── scripts/
│   ├── generate-mocks.js       # Generates SVG/PNG plates, videos, and audio
│   ├── generate-cert.js        # Self-signed SSL certificate generator with SANs
│   ├── server.js               # Lightweight HTTPS dev server with HTTP 206 partial streaming
│   ├── verify-streams.js       # HTTP 200/206 byte-range streaming test suite
│   ├── lint-check.js           # Headless syntax, relative paths, and markup linter
│   └── compile-targets.js      # MindAR compilation pipeline
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Pages automated deployment workflow
```

---

## 🚀 Quick Start

### 1. Generate Mock Assets (Plates & Video Streams)
```bash
npm run generate:mocks
```

### 2. Run Test Suite (Linting & 200/206 Byte-Range Verification)
```bash
npm test
```

### 3. Launch Local HTTPS Development Server
```bash
npm start
```

Access the application:
* **WebAR Camera Scanner:** `https://localhost:8443/index.html`
* **Archival Monograph Portal:** `https://localhost:8443/portal.html`
* **Target Compiler Tool:** `https://localhost:8443/compiler.html`

---

## 🎯 Human-in-the-Loop Protocol Milestones

- [x] **Milestone A: Scaffolding & Initial Mock Assets** *(Current Status)*
- [ ] **Milestone B: Local HTTPS Validation & Target Compilation** *(Awaiting explicit user confirmation to proceed)*
- [ ] **Milestone C: Cloud Deployment (Cloudflare Pages / GitHub Pages)**

