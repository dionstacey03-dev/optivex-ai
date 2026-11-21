# OPTIVEX AI

**See Beyond. Recognize Smarter.**

OPTIVEX AI is a browser-based computer-vision application for live face detection, multi-face image analysis, facial landmark visualization, and consent-based identity matching. Built with React, TypeScript, Vite, and `@vladmandic/face-api`, it provides a privacy-conscious workspace with local detection history and analytics.

> **Privacy first:** Face detection and identity recognition are different capabilities. Identity matching is intended only for profiles enrolled with explicit permission. Do not use this application for covert surveillance or to identify people without their authorization.

## Features

- **Live face detection** — camera access with browser permission, real-time detection overlays, face counts, confidence scores, and start/pause/resume/stop controls.
- **Image analysis** — upload an image, detect multiple faces, view bounding boxes and confidence scores, optionally display facial landmarks, and export an annotated PNG.
- **Facial landmarks** — optional 68-point landmark visualization using the bundled face-landmark models.
- **Consent-based recognition** — optional enrolment and matching against locally stored authorized profiles. Recognition can remain disabled; detection-only operation does not require identity matching.
- **Detection history** — review, search, filter, and delete saved live-camera and image-analysis sessions.
- **Analytics dashboard** — activity summaries and charts based on locally recorded detection sessions.
- **Settings and data controls** — configure detection preferences, privacy options, and manage or export locally stored application data.
- **Responsive workspace** — desktop navigation and a mobile navigation drawer.

## Technology stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `@vladmandic/face-api`
- TensorFlow.js backend support through face-api
- Lucide React
- Motion

## Computer-vision models

Model manifests and weight files are bundled in `public/models/` and loaded by the application from `/models`.

| Model | Purpose |
| --- | --- |
| Tiny Face Detector | Lightweight face detection |
| SSD MobileNet V1 | Higher-accuracy face detection, useful for smaller or more distant faces |
| Face Landmark 68 | 68-point facial landmark estimation |
| Face Landmark 68 Tiny | Lightweight facial landmark estimation |
| Face Recognition | Face descriptors for optional authorized matching |

The application exposes Tiny Face Detector and SSD MobileNet V1 as detector choices. Input-size settings are available for Tiny Face Detector. The default input size is configured in the application source; performance and detection quality depend on the device, browser, image resolution, and face size.

## Getting started

### Requirements

- Node.js and npm (or Bun)
- A modern browser with JavaScript and WebGL support recommended
- Camera permission for live detection
- HTTPS or localhost for browser camera access

### Install dependencies

```bash
git clone https://github.com/dionstacey03-dev/optivex-ai.git
cd optivex-ai
npm install
```

### Run the development server

```bash
npm run dev
```

Vite is configured to serve the development application on port `3000` and listen on `0.0.0.0`. Open:

```text
http://localhost:3000
```

### Production build

```bash
npm run build
npm run preview
```

### TypeScript check

```bash
npm run lint
```

The `lint` script runs `tsc --noEmit`.

## Application structure

```text
optivex-ai/
├── public/
│   └── models/                 # Face-api model manifests and weights
├── src/
│   ├── assets/images/          # Landing-page and sample images
│   ├── components/
│   │   ├── charts/             # Analytics charts
│   │   ├── layout/             # Workspace shell and navigation
│   │   ├── ui/                 # Shared UI primitives
│   │   └── views/              # Landing, dashboard, detection, history, etc.
│   ├── services/
│   │   ├── storageService.ts   # Local application persistence
│   │   └── visionEngine.ts     # Model loading and face inference
│   ├── types/                  # Vision and application types
│   ├── utils/                  # Formatting and visual effects
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Privacy and responsible use

OPTIVEX AI is designed for transparent, permission-based use.

- The browser requests camera permission before live camera access.
- Prefer local browser processing and do not upload face imagery unless a clearly disclosed feature requires it and the user has explicitly agreed.
- Enrol a face profile only after obtaining the person's informed, explicit permission.
- Use recognition only against profiles that were intentionally authorized for that purpose.
- Provide users with a way to review and delete stored profiles and history.
- Treat face descriptors and face images as sensitive biometric data.
- Do not use this project for covert monitoring, discriminatory decisions, or identification without authorization.

Application records and authorized profiles are managed through the browser storage service. Browser storage is device- and browser-specific; it is not a secure, encrypted, cross-device identity database. Clearing site data or using a different browser/device may remove or make locally stored records unavailable. Do not store highly sensitive biometric data on shared or untrusted devices.

## Testing and verification

The project was subjected to a reported functional and computer-vision audit, followed by a headless Chromium browser checklist run.

Reported checks include:

- Production Vite build and TypeScript checks passed.
- All five model families loaded from the local `/models` path and were exercised in inference tests.
- Multi-face image detection, confidence scores, and 68-point landmark output were verified on sample images.
- Live video stream handling, detection overlays, pause/resume/stop, and session recording were exercised in headless Chromium using a synthetic video-capture stream.
- Annotated image rendering and PNG export were verified.
- History persistence across refresh, mobile navigation, and layouts at 375px width were checked.
- The reported browser run recorded zero console errors, uncaught page errors, or failed network requests.

**Testing limitation:** The browser camera checklist used Chromium's fake video-capture device with a synthetic video sequence, not a physical webcam and live subject. Test the application with a real camera on the target device before relying on live camera behavior in production. Headless software-rendered inference timings are not representative of hardware-accelerated browser performance.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000 |
| `npm run build` | Create the production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run the TypeScript no-emit check |
| `npm run clean` | Remove generated `dist` and `server.js` files |

## Deployment notes

This is a Vite single-page application. Build it with `npm run build` and deploy the generated `dist/` directory to a static hosting provider that supports HTTPS and SPA fallback routing.

For camera access, serve the deployed site over HTTPS. Ensure the `public/models/` files are included in the deployment and remain accessible under `/models/`. If hosting under a subpath rather than the domain root, review the Vite base path and model asset URL configuration before deployment.

No production deployment is implied by this repository documentation.

## Contributing

Issues and improvements are welcome. When submitting a change, include:

1. A clear description of the problem or enhancement.
2. Steps to reproduce or verify the change.
3. Relevant screenshots or test output when the UI or computer-vision behavior changes.
4. Confirmation that `npm run build` and `npm run lint` pass.

## License

No license file is currently included in this repository. Unless a license is added, the project should be treated as all rights reserved; do not assume it is available for reuse, redistribution, or modification under an open-source license.

---

**OPTIVEX AI** · *See Beyond. Recognize Smarter.*
