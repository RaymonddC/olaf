# OLAF — Installation Guide

Complete step-by-step guide to get OLAF running locally from scratch.

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| Python | 3.11+ | https://python.org |
| Google Cloud CLI | latest | https://cloud.google.com/sdk/docs/install |
| Git | any | https://git-scm.com |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/your-org/olaf.git
cd olaf
```

---

## Step 2 — Google Accounts Setup

You need two things from Google:

### 2a. Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Click **Create API key**
3. Copy the key — you will use it in both `.env` files

### 2b. Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `olaf-dev`) → **Create project**
3. Enable these services:

**Authentication:**
- Build → Authentication → Get started
- Email/Password → Enable → Save

**Firestore:**
- Build → Firestore Database → Create database
- Choose **Start in test mode** → select a region → Enable

**Cloud Messaging:**
- Enabled by default — no action needed

4. **Get the Web App config** (for frontend):
   - Project Settings (gear icon) → General → scroll to "Your apps"
   - Click **</>** → register app → copy the `firebaseConfig` object

5. **Set up Application Default Credentials** (for backend):
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```

---

## Step 3 — Backend Setup

```bash
cd backend
```

### Install Python dependencies

```bash
pip install google-adk firebase-admin fastapi "uvicorn[standard]" playwright google-cloud-storage google-cloud-aiplatform google-cloud-firestore google-genai pydantic-settings python-dotenv httpx pytest pytest-asyncio ruff
```

### Install Playwright browser

```bash
python -m playwright install chromium
```

### Create environment file

**Windows:**
```bash
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

### Edit `backend/.env`

Open the file and fill in:

```env
# Google AI
GOOGLE_API_KEY=AIzaSy...          # Your Gemini API key from Step 2a
GOOGLE_CLOUD_PROJECT=olaf-dev-xxx # Your Firebase project ID

# Firebase Admin (leave blank — uses Application Default Credentials)
FIREBASE_ADMIN_PROJECT_ID=olaf-dev-xxx
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Cloud Storage (create a bucket in GCP Console, or use any name)
GCS_ARTIFACTS_BUCKET=olaf-artifacts

# App settings
PORT=8080
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
SESSION_DB_URI=sqlite+aiosqlite:///./sessions.db
ENABLE_DEV_UI=true
```

### Start the backend

```bash
python main.py
```

You should see:
```
INFO: Firebase Admin initialised with ADC
INFO: OLAF backend started with 9 custom route groups
INFO: Uvicorn running on http://0.0.0.0:8080
```

Backend is running at **http://localhost:8080**
ADK Dev UI available at **http://localhost:8080/dev-ui**

---

## Step 4 — Frontend Setup

Open a **new terminal** (keep backend running).

```bash
cd frontend
npm install
```

### Create environment file

**Windows:**
```bash
copy .env.example .env.local
```

**Mac/Linux:**
```bash
cp .env.example .env.local
```

### Edit `frontend/.env.local`

Fill in the Firebase web config from Step 2b:

```env
# Firebase Web App Config (from Firebase Console → Project Settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=olaf-dev-xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=olaf-dev-xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=olaf-dev-xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Firebase Admin (leave blank for local dev)
FIREBASE_ADMIN_PROJECT_ID=olaf-dev-xxx
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Gemini API Key (same key as backend)
GEMINI_API_KEY=AIzaSy...
```

### Start the frontend

```bash
npm run dev
```

Frontend is running at **http://localhost:3000**

---

## Step 5 — Verify Everything Works

Open http://localhost:3000 in your browser.

| Check | Expected |
|---|---|
| Login page loads | ✅ |
| Register a new account | ✅ |
| Talk page loads | ✅ |
| Memories page loads | ✅ |
| Help page loads | ✅ |
| Backend health check | `GET http://localhost:8080/health` → `{"status":"healthy"}` |

### Run backend tests

```bash
cd backend
pytest
# Expected: 38 passed
```

---

## Firebase Hosting — Blaze Plan (for dynamic routes)

Firebase Hosting with Next.js webframeworks requires the **Blaze (pay-as-you-go) plan** if any page is server-rendered (dynamic). The free Spark plan does not support Cloud Functions, which Firebase uses to serve dynamic Next.js routes.

**When you need this:**
- Any page uses `getServerSideProps`, server components with data fetching, or dynamic routes that can't be statically generated at build time.

**How to upgrade:**
1. Go to https://console.firebase.google.com → select your project
2. Click **Spark** (bottom-left) → **Upgrade** → select **Blaze**
3. Add a billing account (credit card required — free tier still applies, ~$0 for low traffic)

**After upgrading**, re-run:
```bash
firebase deploy --only hosting
```

**Free tier limits (Blaze):**
- Cloud Functions: 2M invocations/month free
- Hosting: 10 GB storage, 360 MB/day transfer free
- Firestore: 1 GB storage, 50K reads/20K writes per day free

For a hackathon / low-traffic app, you will very likely stay within the free tier.

---

## Troubleshooting

### `pip install` fails with metadata error
Run from inside the `backend/` directory, not the repo root.

### `python -m playwright install chromium` — module not found
You need to install dependencies first (`pip install ... playwright`).

### `gcloud` not recognized
Close and reopen your terminal after installing Google Cloud CLI so the PATH updates.

### `Firebase: Error (auth/operation-not-allowed)`
Enable Email/Password sign-in in Firebase Console → Authentication → Sign-in method.

### `Firebase: Error (auth/invalid-api-key)`
Your `NEXT_PUBLIC_FIREBASE_API_KEY` in `frontend/.env.local` is wrong or missing. Restart `npm run dev` after editing `.env.local`.

### Backend starts but Firestore calls fail
Run `gcloud auth application-default login` and make sure your Google account has access to the Firebase project.

### Voice companion doesn't connect
The Gemini Live API requires the **Generative Language API** to be enabled in your Google Cloud project:
1. Go to https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Select your project
3. Click **Enable**

---

## Common Commands

| Command | What it does |
|---|---|
| `python main.py` | Start backend (port 8080) |
| `npm run dev` | Start frontend (port 3000) |
| `pytest` | Run backend tests |
| `npx tsc --noEmit` | Check frontend TypeScript |
| `python -m ruff check .` | Lint backend Python |
| `gcloud auth application-default login` | Re-authenticate ADC |

---

## What You Need from Firebase Console

| Value | Where to find it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project Settings → General → Your apps → Web app → apiKey |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Project Settings → General → Your apps → Web app → authDomain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project Settings → General → Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Project Settings → General → Your apps → Web app → storageBucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Project Settings → General → Your apps → Web app → messagingSenderId |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Project Settings → General → Your apps → Web app → appId |
| `FIREBASE_ADMIN_PROJECT_ID` | Same as Project ID |
