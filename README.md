# 🌌 VECTRONOMY

[![Status](https://img.shields.io/badge/Status-Beta_v0.01-00ffc2?style=for-the-badge&logo=codeforces&logoColor=09090f)](https://github.com/obsidian-pixel-backup/vectronomy.github.io)
[![Tech Stack](https://img.shields.io/badge/Tech_Stack-TypeScript_%2F_Vite-007acc?style=for-the-badge&logo=typescript&logoColor=ffffff)](https://github.com/obsidian-pixel-backup/vectronomy.github.io)
[![License](https://img.shields.io/badge/License-MIT-00ffc2?style=for-the-badge)](https://github.com/obsidian-pixel-backup/vectronomy.github.io)

> **VECTRONOMY** is a professional-grade, high-fidelity SVG Creation & Vector Editing Studio specifically tailored for laser cutting, CNC, and precision fabrication workflows.

Designed with a premium dark cyber-glassmorphism aesthetic, VECTRONOMY provides fabrication artists and engineers with a powerful three-column CAD workspace inside their browser to manipulate, refine, and export vector designs with absolute pixel precision.

---

## ✨ Key Features

### 📐 Advanced Vector Studio & CAD Workspace
- **Dynamic Drawing Suite**: Instantiate rectangles, circles, straight lines, and complex bezier curves using a custom, interactive Pen tool.
- **Ultra-Precise Node Editor**: Select individual anchor points and vector handles with pixel-perfect accuracy, backed by a high-performance memoized UI rendering engine.
- **Infinite Workspace Canvas**: Full pan and zoom capabilities (Zoom In/Out, Fit to View, Reset Zoom) with real-time zoom level telemetry.
- **High-Fidelity Properties Panel**: Instant control over coordinates, dimensions, rotations, stroke attributes (width, opacity, caps, joins), and solid/ruled fill properties.
- **Align & Distribute Grid**: One-click alignment operations (Left, Right, Vertical/Horizontal Centering) and element depth ordering (Bring to Front, Send to Back).

### ⚡ Proprietary Conversion Engine
- **Seamless CAD Conversion**: Instantly ingest complex industrial project files (`.xcs`, `.json`, `.zip`) and directly open standard `.svg` designs.
- **Production-Ready Exporter**: Clean export of fully compiled, fabrication-ready SVGs with separated structural layers.

### 🎨 State-of-the-Art User Interface
- **Premium Glassmorphic Aesthetics**: Frosted-glass sidebar panels, glowing active indicators, vibrant neon-mint highlights, and fluid micro-animations.
- **Onboarding Walkthrough**: Built-in interactive master tour that guides new users through every tool, panel, and shortcut in the workspace.
- **Live SVG Source Inspector**: Live-synchronized XML code viewer that allows copy-on-click manipulation of the underlying SVG.

---

## 🛠️ System Architecture & Tech Stack

VECTRONOMY is engineered for sub-millisecond execution times and robust client-side rendering:

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework & Bundler** | **Vite + TypeScript** | Enables ultra-fast hot module replacement (HMR) and strict compile-time type safety. |
| **Styling & Theme** | **Vanilla CSS3** | Custom design system utilizing HSL-tailored variables, backdrop filters, and hardware-accelerated transforms. |
| **Vector Engine** | **Paper.js** | Drives real-time geometric operations, bezier math, and robust path transformations. |

---

## 🚀 Quick Start (Local Setup)

Get VECTRONOMY up and running locally in less than a minute:

### 1. Clone the Repository
```bash
git clone https://github.com/obsidian-pixel-backup/vectronomy.github.io.git
cd vectronomy.github.io
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Spin up the Dev Server
```bash
npm run dev
```
*Vite will start the application locally. Navigate to `http://localhost:5173` in your browser.*

### 4. Build for Production
```bash
npm run build
```

---

## 🎹 Keyboard Shortcuts

Accelerate your workflow with professional CAD keybindings:

*   <kbd>V</kbd> — Select & Move Tool
*   <kbd>H</kbd> — Pan & Hand Tool
*   <kbd>R</kbd> — Rectangle Tool
*   <kbd>E</kbd> — Ellipse / Circle Tool
*   <kbd>L</kbd> — Line Tool
*   <kbd>P</kbd> — Pen / Bezier Tool
*   <kbd>N</kbd> — Node Editor Mode
*   <kbd>Del</kbd> — Delete Selection
*   <kbd>Ctrl</kbd> + <kbd>Z</kbd> — Undo
*   <kbd>Ctrl</kbd> + <kbd>Y</kbd> — Redo
*   <kbd>F</kbd> — Fit Canvas to Viewport
*   <kbd>0</kbd> — Reset Zoom to 100%

---

> [!IMPORTANT]
> **Licensing & Open Source**
> **VECTRONOMY** is open-source software licensed under the highly permissive [MIT License](LICENSE). Feel free to inspect, fork, customize, build upon, and use it in your own fabrication pipelines and design workflows!

---

<p align="center">
  Crafted with 🌌 by <b>Cortex & Obsidian Pixel</b>. All rights reserved.
</p>
