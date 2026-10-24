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
import { lexService } from "./services/lexService.js";

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
    lex: { enabled: lexService.isConfigured() },
  });
});

// ---- Sessions / intake --------------------------------------------------
app.post("/api/sessions", h((req) => api.createSession(req.body.sessionCode, req.body.language)));
app.get("/api/sessions/:id", h((req) => api.getSession(req.params.id)));
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

// ---- Voice (Amazon Lex) -------------------------------------------------
app.post("/api/voice/start", h((req) => api.startVoice(req.body.language, req.body.sessionId)));
app.post("/api/voice/message", h((req) => lexService.sendPatientMessage(req.body.sessionId, req.body.message, req.body.language)));

// ---- Demo controls ------------------------------------------------------
app.post("/api/demo/reset", h(() => { api.resetDemo(); return { ok: true }; }));

// ---- Static frontend ----------------------------------------------------
app.use("/", express.static(join(projectRoot, "frontend")));
app.use("/backend", express.static(join(projectRoot, "backend")));
app.use("/shared", express.static(join(projectRoot, "shared")));

const port = config.server.port;
app.listen(port, () => {
  console.log(`\nER Triage server listening on http://localhost:${port}`);
  console.log(`  Region:  ${config.aws.region}`);
  console.log(`  Bedrock: ${bedrockService.isConfigured() ? "LIVE (" + config.aws.bedrockModelId + ")" : "demo mode"}`);
  console.log(`  Lex:     ${lexService.isConfigured() ? "LIVE" : "demo mode"}\n`);
});
