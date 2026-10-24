# Frontend

Interactive educational frontend for the Digital Twin Engineering Validation Platform.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`.

## Build

```bash
npm run build
```

Production output is created in `frontend/dist`.

## Current behavior

Version 1 intentionally uses browser-side demo data so the educational site can be deployed immediately before the backend/database are complete. The next phase replaces the local demo data with FastAPI calls while keeping this UI.
