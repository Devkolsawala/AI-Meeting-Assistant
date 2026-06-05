# Deploy `apps/api` to AWS App Runner (Milestone 3)

The backend (`apps/api`) is containerized and deployed to **AWS App Runner in
`us-east-1`** (same region as Bedrock). App Runner pulls a container image from
**ECR**, runs it, gives you an HTTPS URL, and health-checks `GET /health`.

Nothing here is committed: all secrets are set as App Runner environment variables,
and AWS credentials for Bedrock come from an App Runner **instance role** (no keys
in the image).

---

## 0. Prerequisites

- Docker, the AWS CLI (`aws configure` done), and an AWS account.
- Bedrock model access enabled in `us-east-1` for the models you use (Nova Lite,
  Claude 3.5 Sonnet) — Bedrock console → *Model access*.
- Set a few shell variables (PowerShell):

```powershell
$ACCOUNT = (aws sts get-caller-identity --query Account --output text)
$REGION  = "us-east-1"
$REPO    = "meetcopilot-api"
$ECR     = "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO"
```

## 1. Build and push the image to ECR

```powershell
# Create the repo once.
aws ecr create-repository --repository-name $REPO --region $REGION

# Log Docker in to ECR.
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

# Build from the REPO ROOT (the Dockerfile lives in apps/api but needs the whole workspace).
docker build -f apps/api/Dockerfile -t "${ECR}:latest" .

# Push.
docker push "${ECR}:latest"
```

Quick local smoke test before pushing (optional):

```powershell
docker run --rm -p 8787:8787 --env-file .env "${ECR}:latest"
curl http://127.0.0.1:8787/health
```

## 2. Create the Bedrock instance role (no AWS keys in the container)

App Runner assigns this role to the running container so the AWS SDK's default
provider chain can call Bedrock — no `AWS_ACCESS_KEY_ID` needed.

1. IAM → Roles → Create role → **Custom trust policy**, trusted service
   `tasks.apprunner.amazonaws.com`.
2. Attach a policy allowing Bedrock streaming inference:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "*"
    }
  ]
}
```

3. Name it e.g. `MeetCopilotApiInstanceRole`.

## 3. Create the App Runner service

Console → App Runner → **Create service** → *Container registry* → your ECR image
`meetcopilot-api:latest`:

- **Port:** `8787` (matches the image's `EXPOSE`/`PORT`).
- **Health check:** HTTP, path `/health`.
- **Instance role:** `MeetCopilotApiInstanceRole` (from step 2).
- **Environment variables:** see the checklist below.
- **Auto-deploy:** optional (redeploys when you push `:latest`).

CLI alternative — fill `apprunner-service.json` from the template at the end of this
doc, then:

```powershell
aws apprunner create-service --cli-input-json file://apprunner-service.json --region $REGION
```

After it reaches **Running**, note the service URL, e.g.
`https://abcd1234.us-east-1.awsapprunner.com`.

```powershell
curl https://<service>.us-east-1.awsapprunner.com/health
# -> {"ok":true,"service":"MeetCopilot backend","time":"..."}
```

---

## App Runner environment variables (the full checklist)

Set these on the service. **Secrets** should be stored in AWS Secrets Manager /
SSM and referenced, or pasted as env values — never committed.

| Variable                    | Required | Notes |
| --------------------------- | -------- | ----- |
| `HOST`                      | no       | Already `0.0.0.0` in the image. Leave unset. |
| `PORT`                      | no       | Already `8787` in the image; must match the service port. |
| `SUPABASE_URL`              | **yes**  | `https://<project>.supabase.co`. Used for JWT verification (JWKS) and service-role DB writes. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes**  | Service role key. Writes usage/billing rows (bypasses RLS). **Secret.** |
| `SUPABASE_JWT_SECRET`       | optional | Set only if your project signs JWTs with HS256. If unset, tokens are verified via the project JWKS using `SUPABASE_URL`. **Secret.** |
| `DEEPGRAM_API_KEY`          | **yes**  | Mints short-lived STT tokens. **Secret.** |
| `ELEVENLABS_API_KEY`        | optional | Only if using the ElevenLabs STT provider. **Secret.** |
| `SARVAM_API_KEY`            | optional | Only if using the Sarvam STT provider. **Secret.** |
| `AWS_REGION`                | recommended | `us-east-1`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | no | Omit — the instance role (step 2) supplies Bedrock credentials. |
| `BEDROCK_FAST_MODEL_ID`     | optional | Defaults to `amazon.nova-lite-v1:0`. |
| `BEDROCK_SMART_MODEL_ID`    | optional | Defaults to `anthropic.claude-3-5-sonnet-20240620-v1:0`. |
| `FREE_MAX_SESSIONS`         | optional | Free-tier session cap (default `2`). |
| `FREE_MAX_STT_SECONDS`      | optional | Free-tier STT-seconds cap (default `180`). |
| `USAGE_WARN_RATIO`          | optional | Soft-warning threshold (default `0.8`). |

---

## Point the clients at the deployed API

### Desktop (`apps/desktop`)

The desktop reads the backend base URL from the **`API_URL`** env var (defaults to
`http://127.0.0.1:8787`). Set it to the App Runner URL when you run/build:

```powershell
$env:API_URL = "https://<service>.us-east-1.awsapprunner.com"
pnpm --filter @meetcopilot/desktop start
```

For packaged installers, bake `API_URL` into the build environment (the signed
installer flow is Milestone 7/8). With the default **Deepgram** provider, all
backend calls (`/stt-token`, `/session/*`, `/infer`) go through the Electron main
process, so the renderer's localhost CSP needs no change. (ElevenLabs/Sarvam make
some calls from the renderer; pointing those at a remote API would require widening
the overlay `connect-src` CSP — out of scope here since Deepgram is the default.)

### Web (`apps/web` on Vercel)

Set **`NEXT_PUBLIC_API_BASE_URL`** to the App Runner URL in the Vercel project
(Settings → Environment Variables) and redeploy. The account page does not call the
backend yet (it reads the plan from Supabase directly); this is wired ahead of the
Milestone 5 usage meter.

---

## `apprunner-service.json` template (CLI option)

Replace `<ACCOUNT>`, the role ARN, and the env values. Use Secrets Manager refs for
secrets in production rather than plaintext `RuntimeEnvironmentVariables`.

```json
{
  "ServiceName": "meetcopilot-api",
  "SourceConfiguration": {
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::<ACCOUNT>:role/AppRunnerECRAccessRole"
    },
    "AutoDeploymentsEnabled": false,
    "ImageRepository": {
      "ImageIdentifier": "<ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/meetcopilot-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8787",
        "RuntimeEnvironmentVariables": {
          "AWS_REGION": "us-east-1",
          "SUPABASE_URL": "https://<project>.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY": "<secret>",
          "DEEPGRAM_API_KEY": "<secret>"
        }
      }
    }
  },
  "InstanceConfiguration": {
    "InstanceRoleArn": "arn:aws:iam::<ACCOUNT>:role/MeetCopilotApiInstanceRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
```

> `AccessRoleArn` is an ECR-access role App Runner uses to *pull* the image (create
> one with the `AWSAppRunnerServicePolicyForECRAccess` managed policy). The
> `InstanceRoleArn` is the Bedrock role from step 2 used at *runtime*.
