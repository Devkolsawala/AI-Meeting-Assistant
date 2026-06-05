// Custom electron-builder Windows sign hook. Selects the signing backend from the
// SIGN_PROVIDER env var and reads ALL credentials from environment variables —
// nothing is hardcoded, and nothing is committed. When SIGN_PROVIDER is unset the
// build is left UNSIGNED (the normal dev/local packaging path).
//
// Providers:
//   local                 — signtool.exe with a local .pfx
//                           (WIN_CERT_FILE, WIN_CERT_PASSWORD; optional SIGNTOOL_PATH)
//   azure_trusted_signing — Azure Trusted Signing via `trusted-signing-cli`
//                           (AZURE_TS_ENDPOINT, AZURE_TS_ACCOUNT, AZURE_TS_CERT_PROFILE;
//                            auth via AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET)
//   ssl_com_esigner       — SSL.com eSigner via CodeSignTool
//                           (SSL_COM_USERNAME, SSL_COM_PASSWORD, SSL_COM_CREDENTIAL_ID,
//                            SSL_COM_TOTP_SECRET; optional CODESIGNTOOL_PATH)
//
// Optional: SIGN_TIMESTAMP_URL overrides the RFC-3161 timestamp server.
import { execFileSync } from "node:child_process";

function requireEnv(key) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`[sign] Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function run(command, args) {
  const redacted = args.map((arg) => (/password|secret|totp|token/i.test(arg) ? "***" : arg));
  console.log(`[sign] ${command} ${redacted.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit" });
}

export default function sign(configuration) {
  const file = configuration.path;
  const provider = (process.env.SIGN_PROVIDER ?? "none").trim().toLowerCase();
  const timestampUrl = process.env.SIGN_TIMESTAMP_URL?.trim() || "http://timestamp.digicert.com";

  switch (provider) {
    case "":
    case "none":
      console.warn(`[sign] SIGN_PROVIDER not set — leaving "${file}" UNSIGNED (dev build).`);
      return;

    case "local":
      run(process.env.SIGNTOOL_PATH?.trim() || "signtool", [
        "sign",
        "/fd",
        "sha256",
        "/f",
        requireEnv("WIN_CERT_FILE"),
        "/p",
        requireEnv("WIN_CERT_PASSWORD"),
        "/tr",
        timestampUrl,
        "/td",
        "sha256",
        file,
      ]);
      return;

    case "azure_trusted_signing":
      run(process.env.TRUSTED_SIGNING_CLI_PATH?.trim() || "trusted-signing-cli", [
        "-e",
        requireEnv("AZURE_TS_ENDPOINT"),
        "-a",
        requireEnv("AZURE_TS_ACCOUNT"),
        "-c",
        requireEnv("AZURE_TS_CERT_PROFILE"),
        file,
      ]);
      return;

    case "ssl_com_esigner":
      run(process.env.CODESIGNTOOL_PATH?.trim() || "CodeSignTool", [
        "sign",
        `-username=${requireEnv("SSL_COM_USERNAME")}`,
        `-password=${requireEnv("SSL_COM_PASSWORD")}`,
        `-credential_id=${requireEnv("SSL_COM_CREDENTIAL_ID")}`,
        `-totp_secret=${requireEnv("SSL_COM_TOTP_SECRET")}`,
        `-input_file_path=${file}`,
        "-override",
      ]);
      return;

    default:
      throw new Error(
        `[sign] Unknown SIGN_PROVIDER "${provider}" ` +
          `(expected: local | azure_trusted_signing | ssl_com_esigner | none)`,
      );
  }
}
