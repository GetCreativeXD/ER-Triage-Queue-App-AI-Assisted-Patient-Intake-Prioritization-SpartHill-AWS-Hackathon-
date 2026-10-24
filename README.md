# ER Triage Queue App

A patient-intake and triage-support prototype for an emergency room. Patients
check in by typing or speaking, and triage nurses get a live, scanable priority
queue with transparent, nurse-overridable recommendations.

> **Prototype disclaimer:** This is a hackathon demo and a triage *support*
> tool, not a medical diagnosis system. It does not replace professional
> assessment or emergency protocols.

> **AWS integration:** This build runs on a real Node/Express server and calls
> **Amazon Bedrock** (Claude) to summarize patient descriptions on the intake
> path. **Amazon Lex** voice intake is wired and ready but off by default
> (no bot configured); voice falls back to the browser's Web Speech API until a
> bot is provisioned. If Bedrock is unavailable the app falls back to the raw
> patient answers, so it always keeps working.

---

## Features

**Patient**
- Welcome screen with a language **text box** and a **microphone button** to
  choose a language by typing or speaking.
- Session-code check-in (no account creation).
- One-question-at-a-time intake with buttons, a severity slider, warning-sign
  multi-select, and free text / voice.
- Answer review + edit before submitting.
- Status page with a prominent "condition changed" flow (worse / better /
  changed / **need help now**) and an immediate-help safety modal.

**Nurse**
- Live priority queue (auto-refreshing) with position, priority, trend, wait
  time, and last-update time.
- "Changed" / review flags for patients whose condition updated.
- Detail panel with intake summary, update timeline, and the **reason** for
  each recommendation.
- Confirm or **override** the system recommendation; set patient status
  (call / being seen / recheck / completed / unavailable).
- Notifications strip with distinct high-severity alerts and acknowledgement.

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
│       │   └── voiceService.js # Web Speech API wrapper (Lex-swappable)
│       └── screens/
│           ├── welcome.js    # Language text box + mic button
│           ├── sessionCode.js
│           ├── intake.js
│           ├── confirm.js
│           ├── status.js     # Status + condition updates
│           └── nurse.js      # Dashboard, detail, notifications
│
├── backend/                  # Node/Express server + AWS integrations
│   ├── server.js             # Express server: REST endpoints + static hosting
│   ├── api.js                # Facade delegating to triageService
│   ├── config.js             # Env-driven feature flags (Lex, Bedrock, port)
│   ├── data/
│   │   └── seed.js           # Demo patients (run through real rules)
│   └── services/
│       ├── awsClients.js     # Memoized AWS SDK clients (default cred chain)
│       ├── store.js          # In-memory persistence
│       ├── queueRules.js     # Deterministic priority rules (edit here)
│       ├── triageService.js  # Orchestration (intake, updates, queue, audit)
│       ├── lexService.js     # Amazon Lex (live RecognizeText + demo fallback)
│       └── bedrockService.js # Amazon Bedrock (live InvokeModel + fallback)
│
├── frontend/js/services/
│   └── apiClient.js          # Fetch client the screens use (HTTP → server)
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
- **Amazon Lex** — `lexService.js` wraps the voice conversation. With no
  credentials it reports demo mode and the UI falls back to the browser's Web
  Speech API (`voiceService.js`) and typed input.

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
provider chain — nothing is hard-coded. On boot it logs whether Bedrock and Lex
are LIVE or in demo mode. Demo data is seeded automatically; use **Reset demo**
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
1. Open the nurse dashboard in one tab — four seeded patients appear, sorted by
   priority.
2. In another tab, pick a language (type or mic), enter a session code, and
   complete intake.
3. The new patient appears in the queue with a notification.
4. On the patient status page, tap **Report a change → I feel worse**, raise the
   severity, and send. The queue reorders and a high-severity alert appears.
5. Open the patient in the nurse detail panel, read the reason, then **Confirm**
   or **Override** the priority and set a status.

---

## Environment variables

Copy `.env.example` to `.env` to enable AWS features. All are optional; the app
runs fully in demo mode without them.

Non-secret config lives in `.env` (gitignored). **Credentials never go in
`.env`** — they come from the shell environment, an IAM role, or an SSO profile.

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port (default `3001`). |
| `AWS_REGION` | AWS region for Lex/Bedrock (default `us-east-1`). |
| `BEDROCK_ENABLED` | `true` to use Amazon Bedrock summaries/explanations. |
| `BEDROCK_MODEL_ID` | Bedrock model/inference-profile id (see note below). |
| `LEX_ENABLED` | `true` to use live Amazon Lex voice intake. |
| `LEX_BOT_ID`, `LEX_BOT_ALIAS_ID`, `LEX_LOCALE_ID` | Lex bot identifiers + locale. |
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
- **Lex (when enabled):** `lex:RecognizeText` scoped to the specific bot alias.

The AWS design should be reviewed for hospital privacy, security, retention, and
compliance requirements before any real patient data is used.

The AWS design should be reviewed for hospital privacy, security, retention, and
compliance requirements before any real patient data is used.

---

## Testing (manual)

1. **Intake (typed):** complete the flow with keyboard only; confirm the patient
   reaches the status page and appears in the queue.
2. **Intake (voice):** on a browser with speech support, use the mic on the
   description question; confirm the transcript appears for review.
3. **Queue ordering:** seed patients should sort with "Immediate review" at the
   top and "Low urgency" at the bottom; waiting time breaks ties.
4. **Condition update → escalation:** report worsening + high severity and
   confirm the priority rises and a high-severity notification appears.
5. **Nurse override:** override a recommendation and confirm the queue and audit
   reflect the change.
6. **Responsive:** verify the nurse layout collapses to one column on a
   tablet-width viewport.

---

## Known limitations

- Hackathon prototype only — **not** a medical diagnostic tool.
- Persistence is in-memory on the server; restarting resets to seed data and
  there is no real database or multi-device durability.
- **Amazon Bedrock is live** on the intake summary path (requires model access
  + credentials); it falls back to raw text if unavailable.
- **Amazon Lex is wired but off by default** — no bot is provisioned, so voice
  uses the browser's Web Speech API. Create a Lex v2 bot, then set
  `LEX_ENABLED=true` + the bot/alias ids to make it live.
- Translations cover only a small demo set of strings.
- No authentication; the nurse view is open for demo convenience.
```
