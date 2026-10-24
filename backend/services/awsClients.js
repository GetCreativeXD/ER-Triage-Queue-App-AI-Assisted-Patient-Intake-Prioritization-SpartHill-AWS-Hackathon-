// =========================================================================
// AWS client factory
// -------------------------------------------------------------------------
// Centralizes creation of AWS SDK v2 (JS) clients. Credentials are resolved
// by the SDK's DEFAULT PROVIDER CHAIN — environment variables
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN), shared
// config/credentials files, or an attached IAM role. We NEVER pass secrets
// explicitly; this keeps credentials out of the codebase entirely.
//
// Clients are created lazily and memoized so we reuse connections.
// =========================================================================

import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { TranscribeStreamingClient } from "@aws-sdk/client-transcribe-streaming";
import { config } from "../config.js";

let _bedrock = null;
let _transcribe = null;

/** Memoized Bedrock Runtime client. */
export function getBedrockClient() {
  if (!_bedrock) {
    _bedrock = new BedrockRuntimeClient({ region: config.aws.region });
  }
  return _bedrock;
}

/** Memoized Amazon Transcribe streaming client (speech-to-text). */
export function getTranscribeClient() {
  if (!_transcribe) {
    _transcribe = new TranscribeStreamingClient({ region: config.aws.region });
  }
  return _transcribe;
}
