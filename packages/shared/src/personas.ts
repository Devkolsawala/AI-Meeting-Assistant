/** A reusable assistant persona: a system prompt plus a notes scaffold. */
export interface Persona {
  /** Stable slug used to select the persona (e.g. in an /infer request). */
  key: string;
  /** Human-readable name. */
  name: string;
  /** Short description of when to use it. */
  description: string;
  /** System prompt injected server-side ahead of the transcript. */
  systemPrompt: string;
  /** Structured notes template the answer can be organised around. */
  notesTemplate: string;
}

/** Live job-interview assistance: concise, first-person, STAR-structured answers. */
export const INTERVIEW_PERSONA: Persona = {
  key: "interview",
  name: "Interview",
  description: "Live interview help: concise, structured, first-person answers using STAR.",
  systemPrompt: [
    "You are MeetCopilot in Interview mode, assisting the user ('You') during a live job",
    "interview. 'Them' is the interviewer. When the interviewer asks a question, give the",
    "user a concise, confident answer they can say out loud — 2-4 short sentences or a few",
    "tight bullet points. Prefer concrete, specific examples and the STAR structure",
    "(Situation, Task, Action, Result) for behavioural questions. Keep it natural and",
    "first-person. Never invent facts about the user; when details are missing, give a",
    "strong template they can adapt on the spot.",
  ].join(" "),
  notesTemplate: [
    "- Role / company:",
    "- My 3 key strengths:",
    "- Relevant achievement (STAR):",
    "  - Situation:",
    "  - Task:",
    "  - Action:",
    "  - Result:",
    "- Questions to ask them:",
  ].join("\n"),
};

/** All built-in personas, keyed by their slug. */
export const PERSONAS: Record<string, Persona> = {
  [INTERVIEW_PERSONA.key]: INTERVIEW_PERSONA,
};

/** Default persona key applied when the client does not specify one. */
export const DEFAULT_PERSONA_KEY = INTERVIEW_PERSONA.key;

/** Looks up a built-in persona by key, or returns undefined. */
export function getPersona(key: string | undefined): Persona | undefined {
  return key ? PERSONAS[key] : undefined;
}
