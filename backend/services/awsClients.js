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
import { LexRuntimeV2Client } from "@aws-sdk/client-lex-runtime-v2";
import { config } from "../config.js";

let _bedrock = null;
let _lex = null;

/** Memoized Bedrock Runtime client. */
export function getBedrockClient() {
  if (!_bedrock) {
    _bedrock = new BedrockRuntimeClient({ region: config.aws.region });
  }
  return _bedrock;
}

/** Memoized Lex Runtime v2 client. */
export function getLexClient() {
  if (!_lex) {
    _lex = new LexRuntimeV2Client({ region: config.aws.region });
  }
  return _lex;
}
