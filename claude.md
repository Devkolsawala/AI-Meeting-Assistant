# MeetCopilot — Project Rules (read this every session)

## What we're building
A Windows desktop AI meeting assistant (Electron + TypeScript). It captures the
meeting's system audio ("Them") and the user's microphone ("You") as two separate
channels, transcribes both with Deepgram, and shows streamed AI answers in a
floating overlay window that is invisible during screen share. A backend on AWS
(near Bedrock) handles auth, model routing, and usage metering. The web app
(Next.js) runs on Vercel. The database is Supabase.

## Tech — do NOT substitute without asking me
- Desktop: Electron + React + TypeScript
- Speech-to-text: Deepgram (multichannel streaming)
- AI: AWS Bedrock via a LiteLLM-style gateway. Fast lane = Amazon Nova / Claude
  Haiku; smart lane = Claude Sonnet. Model choice is decided server-side.
- Backend API: Node + TypeScript on AWS App Runner (us-east-1)
- Web: Next.js on Vercel
- Database/Auth: Supabase (Postgres + Row Level Security + pgvector)
- Monorepo: pnpm workspaces + Turborepo (apps/desktop, apps/web, apps/api, packages/shared)

## How you must work
1. EXPLORE FIRST. Before editing, read the relevant files and restate the plan in
   3-5 bullets. For brand-new code, list the files you'll create. Only ask me if a
   real decision is genuinely ambiguous — otherwise proceed.
2. SMALL STEPS. Build ONE milestone, then STOP and tell me exactly how to run and
   verify it. Never build several milestones at once.
3. SHIP ERROR-FREE. Before you call a step done: run typecheck, lint, and build;
   fix every error and warning; leave NO TODOs or stubbed/placeholder functions in
   the code path.
4. NEVER TOUCH (unless I explicitly ask in this prompt): auth flows, payments/billing,
   usage metering, and secrets. Database migrations are ADDITIVE ONLY (no edits or
   drops of existing columns/tables).
5. SECRETS live in .env / server only — never in the desktop client, never committed.
6. SURGICAL CHANGES. Smallest change that works, fewest files, match existing
   patterns. No speculative abstractions or "while I'm here" refactors.
7. AFTER EACH STEP, give me a 3-line summary: what changed, how to test it, any risks.
8. If you're unsure about something, say so and ask — do not guess silently.

## Definition of done (every task)
- Typecheck + lint + build pass with zero errors.
- The acceptance criteria I gave are met and I can verify them myself.
- You've given me a short run/test instruction.