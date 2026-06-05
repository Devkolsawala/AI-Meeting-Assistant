# Desktop packaging + Windows code signing (Milestone 7)

`apps/desktop` packages with **electron-builder** into a Windows **NSIS** installer.
Code signing is handled by a custom hook ([apps/desktop/scripts/sign.mjs](../apps/desktop/scripts/sign.mjs))
that picks the signing backend from the **`SIGN_PROVIDER`** environment variable and
reads every credential from the environment — **nothing is hardcoded or committed**.

With `SIGN_PROVIDER` unset, the hook is a no-op and the build is left unsigned (the
normal local/dev packaging path).

## Build command

From the repo root (note the local toolchain + cross-drive cache notes below):

```powershell
# Required on this machine: route electron-builder's cache/temp onto one drive
# (winCodeSign extraction does a cross-drive rename that otherwise fails).
$env:ELECTRON_BUILDER_CACHE = "D:\eb-cache"
$env:TEMP = "D:\eb-tmp"; $env:TMP = "D:\eb-tmp"

# Set your signing env vars (see a provider below), then:
$env:Path = "$env:USERPROFILE\.pnpm-shim;$env:Path"
pnpm --filter @meetcopilot/desktop package
```

Output: `apps/desktop/release/MeetCopilot Setup <version>.exe`.

## Choose ONE signing backend

### Option A — Local certificate (`.pfx`)

```powershell
$env:SIGN_PROVIDER   = "local"
$env:WIN_CERT_FILE   = "C:\path\to\cert.pfx"
$env:WIN_CERT_PASSWORD = "<pfx password>"
# Optional: $env:SIGNTOOL_PATH = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
# Optional: $env:SIGN_TIMESTAMP_URL = "http://timestamp.digicert.com"
```

Requires `signtool.exe` (Windows SDK) on `PATH` or via `SIGNTOOL_PATH`. Note that a
standard OV `.pfx` no longer clears SmartScreen instantly — reputation builds over
time. For an immediate clean install, use an EV/cloud option below.

### Option B — Azure Trusted Signing

Install the CLI once: `cargo install trusted-signing-cli` (or set
`TRUSTED_SIGNING_CLI_PATH`).

```powershell
$env:SIGN_PROVIDER        = "azure_trusted_signing"
$env:AZURE_TS_ENDPOINT    = "https://<region>.codesigning.azure.net"
$env:AZURE_TS_ACCOUNT     = "<trusted-signing-account-name>"
$env:AZURE_TS_CERT_PROFILE = "<certificate-profile-name>"
# Entra ID service principal (EnvironmentCredential):
$env:AZURE_TENANT_ID     = "<tenant>"
$env:AZURE_CLIENT_ID     = "<app id>"
$env:AZURE_CLIENT_SECRET = "<secret>"
```

### Option C — SSL.com eSigner (cloud)

Download SSL.com **CodeSignTool** and put it on `PATH` (or set `CODESIGNTOOL_PATH`).

```powershell
$env:SIGN_PROVIDER         = "ssl_com_esigner"
$env:SSL_COM_USERNAME      = "<account email>"
$env:SSL_COM_PASSWORD      = "<account password>"
$env:SSL_COM_CREDENTIAL_ID = "<eSigner credential id>"
$env:SSL_COM_TOTP_SECRET   = "<eSigner TOTP secret>"
```

## Verify the signature

After packaging with a provider set:

```powershell
# PowerShell — should report Status: Valid and your publisher in SignerCertificate.
Get-AuthenticodeSignature ".\apps\desktop\release\MeetCopilot Setup 0.0.0.exe" | Format-List
```

Then run the installer on a clean Windows machine: there should be **no "Unknown
Publisher"** warning, and the User Account Control / SmartScreen prompt should show
your verified publisher name.

## Notes

- No app icon is bundled yet, so the installer uses the default Electron icon. Add
  `apps/desktop/build/icon.ico` and set `win.icon` to brand it (cosmetic; unrelated
  to signing).
- Credentials are read only from the environment at package time — keep them out of
  `.env` files that get committed, and prefer your CI secret store on a build server.
- Wiring the signed installer to the website's download button and auto-update is
  Milestone 8.
