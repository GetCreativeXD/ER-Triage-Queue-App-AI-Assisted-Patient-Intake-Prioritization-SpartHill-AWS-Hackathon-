// =========================================================================
// HTTP server
// -------------------------------------------------------------------------
// Turns the in-process `api` facade into real REST endpoints and serves the
// static frontend. Credentials are read by the AWS SDK from the environment
// (never from code). Run with: npm start  (after `npm install`).
//
// Routes mirror the method names in backend/api.js so the frontend can call
// them over fetch. Async methods (intake/update) are awaited here because
// they may invoke Bedrock.
// =========================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { api } from "./api.js";
import { config } from "./config.js";
import { bedrockService } from "./services/bedrockService.js";
import { transcribeService } from "./services/transcribeService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const app = express();
app.use(cors());
app.use(express.json());

// Seed demo data once on startup.
api.ensureSeed();

/** Wrap an async route handler so thrown errors become 500 JSON responses. */
function h(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      res.json(result);
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ error: err?.message || "Internal error" });
    }
  };
}

// ---- Health / status ----------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    region: config.aws.region,
    bedrock: { enabled: bedrockService.isConfigured(), model: config.aws.bedrockModelId },
    transcribe: { enabled: transcribeService.isConfigured(), mode: transcribeService.mode() },
  });
});

// ---- Patient-website URL for the triage app's QR code -------------------
// The triage (native) app fetches this and renders it as a QR code. A patient
// scans it with their phone camera to open the patient website. PATIENT_WEB_URL
// can be set when the patient site is hosted somewhere other than this server;
// otherwise we derive the URL from the request so it works on the LAN IP the
// triage device used to reach us.
app.get("/api/patient-url", (req, res) => {
  const configured = process.env.PATIENT_WEB_URL;
  const derived = `${req.protocol}://${req.get("host")}/`;
  res.json({ url: configured || derived });
});

// ---- Sessions / intake --------------------------------------------------
app.post("/api/sessions", h((req) => api.createSession(req.body.sessionCode, req.body.language)));
app.get("/api/sessions/:id", h((req) => api.getSession(req.params.id)));
app.post("/api/sessions/:id/name", h((req) => api.setSessionName(req.params.id, req.body.firstName, req.body.lastName)));
app.post("/api/sessions/:id/intake", h((req) => api.submitIntake(req.params.id, req.body.answers, req.body.signals)));
app.post("/api/sessions/:id/updates", h((req) => api.submitUpdate(req.params.id, req.body.update)));

// ---- Queue --------------------------------------------------------------
app.get("/api/queue", h(() => api.getQueue()));
app.get("/api/queue/:sessionId", h((req) => api.getPatientDetail(req.params.sessionId)));
app.post("/api/queue/:sessionId/confirm", h((req) => api.confirmPriority(req.params.sessionId)));
app.post("/api/queue/:sessionId/override", h((req) => api.overridePriority(req.params.sessionId, req.body.priority, req.body.note)));
app.post("/api/queue/:sessionId/status", h((req) => api.setStatus(req.params.sessionId, req.body.status)));

// ---- Notifications ------------------------------------------------------
app.get("/api/notifications", h(() => api.getNotifications()));
app.post("/api/notifications/:id/acknowledge", h((req) => api.acknowledgeNotification(req.params.id)));

// ---- Voice (Amazon Transcribe speech-to-text) ---------------------------
// The client uploads raw 16-bit PCM audio as the request body. Language and
// sample rate ride along as query params so we can keep the body pure binary.
// A 15 MB cap bounds a single intake clip (~8 min of 16 kHz mono PCM).
app.post(
  "/api/voice/transcribe",
  express.raw({ type: "application/octet-stream", limit: "15mb" }),
  h((req) =>
    api.transcribeVoice({
      audio: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      language: req.query.language || "en",
      sampleRate: Number(req.query.sampleRate) || undefined,
    })
  )
);

// ---- Demo controls ------------------------------------------------------
app.post("/api/demo/reset", h(async () => { await api.resetDemo(); return { ok: true }; }));

// ---- Static frontend ----------------------------------------------------
app.use("/", express.static(join(projectRoot, "frontend")));
app.use("/backend", express.static(join(projectRoot, "backend")));
app.use("/shared", express.static(join(projectRoot, "shared")));
// Serve the triage app's web UI for the browser demo (same origin, so its API
// client talks to this server automatically). In production this ships as a
// native app instead.
app.use("/triage-app", express.static(join(projectRoot, "triage-app", "www")));

const port = config.server.port;
app.listen(port, () => {
  console.log(`\nER Triage server listening on http://localhost:${port}`);
  console.log(`  Patient site:  http://localhost:${port}/`);
  console.log(`  Triage app:    http://localhost:${port}/triage-app/`);
  console.log(`  Region:  ${config.aws.region}`);
  console.log(`  Bedrock:    ${bedrockService.isConfigured() ? "LIVE (" + config.aws.bedrockModelId + ")" : "demo mode"}`);
  console.log(`  Transcribe: ${transcribeService.isConfigured() ? "LIVE (" + transcribeService.mode() + ")" : "demo mode"}\n`);
});
