# ER Triage Queue App

A patient-intake and triage-support prototype for an emergency room. It has two
clients that share one Express/AWS backend:

- **Patient website** (`frontend/`) — a patient scans a QR code and fills out
  the intake form on their own phone. On submit they get a **4-digit patient
  number**.
- **Triage app** (`triage-app/`) — a **native (Capacitor) app** for staff that
  displays the check-in QR code and a live priority queue showing each patient's
  number and name. See `triage-app/README.md` for building it.

> **Prototype disclaimer:** This is a hackathon demo and a triage *support*
> tool, not a medical diagnosis system. It does not replace professional
> assessment or emergency protocols.

> **AWS integration:** This build runs on a real Node/Express server and calls
> **Amazon Bedrock** (Claude) to summarize patient descriptions on the intake
> path. Voice intake uses **Amazon Transcribe** for accurate, verbatim
> speech-to-text (optionally **Amazon Transcribe Medical** for clinical
> vocabulary); it is wired and ready but off by default. When it is off, voice
> falls back to the browser's on-device Web Speech API. If Bedrock or Transcribe
> is unavailable the app falls back to the raw patient answers / typed input, so
> it always keeps working.

---

## Features

**Patient website**
- Language **dropdown** (English, Spanish, French, Chinese). The chosen language
  stays fixed through every question and the success screen.
- No session-code step — the patient arrives by scanning the triage app's QR.
- First question asks for **first + last name** (shown to triage).
- One question per step: name, main reason (**select all that apply**, with an
  **Other** free-text option), severity as **colored circular buttons**
  (green → yellow/orange → red), onset (with a dropdown of longer ranges),
  trend, condensed warning-sign categories (with **None of these** → describe),
  and a free-text description.
- A **red microphone** (white icon) sits below every question; it **pulses**
  while listening and transcribes **live** as the patient speaks, with the
  accurate Amazon Transcribe result applied on stop.
- On submit: a big **white check mark in a green circle** with the patient's
  **4-digit patient number** below it.
- Status page with a prominent "condition changed" flow (worse / better /
  changed / **need help now**) and an immediate-help safety modal.

**Triage app (native)**
- **Check-in QR** tab: shows a QR code the patient scans to open the website.
- **Queue** tab: live priority queue with **patient number + name**, color-coded
  by priority; tap a patient for the AI summary and intake.
- One-tap **Accept** priority and a **Sort patients** control (replaces the old
  multi-step override); short, specific status verbs (Call now / Start care /
  Recheck / Finish / Away).

**Patient numbers:** issued sequentially as 4 digits, never repeating a number
in active use, resetting after 10,000.

---

## Project structure

```
.
├── frontend/                 # Browser app (vanilla HTML/CSS/JS, no build step)
│   ├── index.html            # App shell + prototype disclaimer
│   ├── css/styles.css        # Hospital-inspired design system
│   └── js/
│       ├── app.js            # Hash router + entry point
│       ├── config.js         # Supported languages
│       ├── components.js     # Shared UI (priority badge, emergency modal…)
│       ├── data/
│       │   └── questions.js  # Intake question set + warning signs
│       ├── services/
│       │   ├── dom.js        # Tiny DOM helpers (el, mount, navigate, modal)
│       │   ├── i18n.js       # Demo translations
│       │   ├── voiceService.js # Mic recorder → Transcribe, + Web Speech fallback
│       │   └── apiClient.js  # Fetch client the screens use (HTTP → server)
│       └── screens/
│           ├── welcome.js    # Language dropdown → start
│           ├── intake.js     # One-question-per-step intake (+ mic on each)
│           ├── done.js       # Success: green check + patient number
│           ├── status.js     # Status + condition updates
│           └── nurse.js      # Web staff dashboard (also usable in a browser)
│
├── triage-app/               # Native (Capacitor) triage app — see its README
│   ├── capacitor.config.json
│   ├── package.json
│   └── www/                  # Web UI bundled into the native app (QR + queue)
│
├── backend/                  # Node/Express server + AWS integrations
│   ├── server.js             # Express server: REST endpoints + static hosting
│   ├── api.js                # Facade delegating to triageService
│   ├── config.js             # Env-driven feature flags (Transcribe, Bedrock, port)
│   ├── data/
│   │   └── seed.js           # Demo patients (run through real rules)
│   └── services/
│       ├── awsClients.js     # Memoized AWS SDK clients (default cred chain)
│       ├── store.js          # In-memory persistence
│       ├── queueRules.js     # Deterministic priority rules (edit here)
│       ├── triageService.js  # Orchestration (intake, updates, queue, audit)
│       ├── transcribeService.js # Amazon Transcribe (streaming STT + demo fallback)
│       └── bedrockService.js # Amazon Bedrock (live InvokeModel + fallback)
│
├── shared/
│   └── schemas.js            # Record shapes shared by frontend + backend
│
├── package.json              # Server deps + start scripts
├── .env / .env.example       # Config + feature flags (NO credentials)
├── verify-bedrock.ps1        # Proves Bedrock is genuinely invoked
└── README.md
```

The frontend screens import **only** `frontend/js/services/apiClient.js`, which
makes `fetch` calls to the Express server. The server owns all state and every
AWS integration; the browser never touches AWS or holds credentials. Everything
cloud-facing hides behind service modules that fall back to demo behavior when
AWS is off or a call fails.

---

## Architecture

- **Frontend** — a single-page app with a hash router. Each screen is a small
  render function that builds DOM with the `el`/`mount` helpers (no framework,
  no build step).
- **Backend service layer** — `api.js` exposes methods named after the planned
  REST endpoints (`POST /api/sessions`, `GET /api/queue`, …) and resolves them
  in-process against `triageService`. Swapping to a real HTTP server later only
  changes the bodies of these methods.
- **Queue logic** — `queueRules.js` is the single, transparent source of truth
  for recommended priority and queue ordering. Every recommendation carries a
  human-readable reason. AI never sets priority.
- **Notifications & audit** — `triageService` writes an audit record for every
  priority/status change and raises nurse notifications on meaningful changes.
- **Persistence** — `store.js` keeps data in memory and mirrors it to
  `localStorage`, so a refresh preserves demo state. The interface matches what
  a DynamoDB-backed store would expose.
- **Amazon Transcribe** — the patient records a short clip on the description
  question; `voiceService.js` encodes it as 16 kHz mono 16-bit PCM and uploads
  it to `POST /api/voice/transcribe`, where `transcribeService.js` streams it to
  Amazon Transcribe (or **Transcribe Medical**) and returns a verbatim
  transcript plus a confidence score. That transcript is what the patient
  reviews, what the nurse sees, and what Bedrock summarizes — so the pipeline is
  *speech → accurate text → nuanced summary*. With Transcribe off (or on any
  failure) the UI falls back to the browser's on-device Web Speech API and typed
  input. Transcribe replaces the earlier Amazon Lex integration, which was an
  intent/slot chatbot engine and discarded the free-form nuance this use case
  needs.

---

## Running the app

Requires **Node.js 18+**.

```powershell
# 1. Install dependencies (once)
npm install

# 2. Make AWS credentials available to the server's shell (temporary STS creds shown)
$env:AWS_ACCESS_KEY_ID = "..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_SESSION_TOKEN = "..."      # only for temporary/role credentials
$env:AWS_DEFAULT_REGION = "us-east-1"

# 3. Start the server (serves the frontend AND the API)
npm start
```

Then open **http://localhost:3001/**.

- Patient experience: start on the welcome screen.
- Nurse experience: open **http://localhost:3001/#/nurse** in a second tab.

The server reads credentials from the environment via the AWS SDK's default
provider chain — nothing is hard-coded. On boot it logs whether Bedrock and
Transcribe are LIVE or in demo mode. Demo data is seeded automatically; use **Reset demo**
on the nurse dashboard to reload a fresh set of patients.

### Verifying Bedrock is actually used

Run the included script in the same window where your credentials are set:

```powershell
.\verify-bedrock.ps1
```

It starts the server, submits a patient intake over HTTP (which calls Bedrock to
summarize), and prints the raw description next to the AI summary. A **PASS**
means the summary differs from the raw text and no Bedrock errors were logged —
i.e. Amazon Bedrock genuinely produced it. You can also watch the server console
during a normal run: a successful summary logs no `[bedrock] ... failed` line.

### Demo script
1. Open the staff/triage view (the native app, or `#/nurse` in a browser) —
   four seeded patients appear, sorted by priority. The triage app's **Check-in
   QR** tab shows the code a patient scans.
2. On a phone, open the patient website (scan the QR, or browse to the server
   root), pick a language, enter a name, and complete intake.
3. On submit, the patient sees a green check with their **4-digit patient
   number**; the patient appears in the queue with that number + name and a
   notification.
4. On the patient status page, tap **Report a change → I feel worse**, raise the
   severity, and send. The queue reorders and a high-severity alert appears.
5. Open the patient in the triage detail view, read the reason, then **Accept**
   the priority or use **Sort patients** to change it, and set a status.

---

## Environment variables

Copy `.env.example` to `.env` to enable AWS features. All are optional; the app
runs fully in demo mode without them.

Non-secret config lives in `.env` (gitignored). **Credentials never go in
`.env`** — they come from the shell environment, an IAM role, or an SSO profile.

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port (default `3001`). |
| `AWS_REGION` | AWS region for Transcribe/Bedrock (default `us-east-1`). |
| `BEDROCK_ENABLED` | `true` to use Amazon Bedrock summaries/explanations. |
| `BEDROCK_MODEL_ID` | Bedrock model/inference-profile id (see note below). |
| `TRANSCRIBE_ENABLED` | `true` to transcribe recorded intake audio server-side. |
| `TRANSCRIBE_MEDICAL` | `true` to use Amazon Transcribe Medical (clinical vocab, en-US only). |
| `TRANSCRIBE_MEDICAL_SPECIALTY` | Medical specialty when medical mode is on (default `PRIMARYCARE`). |
| `TRANSCRIBE_SAMPLE_RATE` | Audio sample rate in Hz (default `16000`; keep in sync with the frontend). |
| `WAIT_THRESHOLD_MINUTES` | Minutes before a long wait alerts the nurse. |

### Bedrock model access

The model must be enabled for your account/region. List what you can reach:

```powershell
aws bedrock list-foundation-models --region us-east-1 `
  --query "modelSummaries[?contains(modelId,'claude')].modelId" --output text
```

Newer Claude models (4.x+) are **not** invokable by their bare model id on
on-demand throughput; they require a cross-region **inference profile** id
(note the `us.` prefix). This repo is configured with a working one:

```
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
```

If you see `ValidationException: ... on-demand throughput isn't supported`, you
used a bare model id — switch to the `us.`-prefixed inference profile.

### IAM permissions

Minimum for the live path:

- **Bedrock:** `bedrock:InvokeModel` on the chosen model / inference profile ARN.
- **Transcribe (when enabled):** `transcribe:StartStreamTranscription`, plus
  `transcribe:StartMedicalStreamTranscription` when `TRANSCRIBE_MEDICAL=true`.

The AWS design should be reviewed for hospital privacy, security, retention, and
compliance requirements before any real patient data is used.

---

## Testing (manual)

1. **Intake (typed):** pick a language, enter a name, and complete every
   question with the keyboard; confirm the success screen shows a 4-digit
   patient number and the patient appears in the queue with number + name.
2. **Intake (voice):** on any question, tap the red mic — it pulses and shows
   live text as you speak; tap again to stop. With `TRANSCRIBE_ENABLED=true` the
   recorded clip is sent to Amazon Transcribe and the accurate transcript
   replaces the live text; otherwise the on-device text is kept.
3. **Language persistence:** change the language on the welcome screen and
   confirm it stays the same through every question and the success screen.
4. **Queue ordering:** seed patients sort with "Immediate review" at the top and
   "Low urgency" at the bottom; waiting time breaks ties.
5. **Condition update → escalation:** report worsening + high severity and
   confirm the priority rises and a high-severity notification appears.
6. **Sort patients:** in the triage view, use **Sort patients** to set a
   priority and confirm the queue re-sorts and the audit reflects the change.
7. **Patient numbers:** create several patients and confirm numbers are 4
   digits, sequential, and never repeat an active one.

---

## Known limitations

- Hackathon prototype only — **not** a medical diagnostic tool.
- Persistence is in-memory on the server; restarting resets to seed data and
  there is no real database or multi-device durability.
- **Amazon Bedrock is live** on the intake summary path (requires model access
  + credentials); it falls back to raw text if unavailable.
- **Amazon Transcribe is wired but off by default** — set `TRANSCRIBE_ENABLED=true`
  (and optionally `TRANSCRIBE_MEDICAL=true`) with the IAM permissions above to
  make server-side speech-to-text live. Until then, voice uses the browser's
  on-device Web Speech API. Transcribe Medical is English (en-US) only; other
  languages use standard Transcribe.
- Translations cover only a small demo set of strings.
- No authentication; the nurse view is open for demo convenience.
```
