import { Router, type IRouter } from "express";
import { SendAdvisorMessageBody } from "@workspace/api-zod";
import { chatWithOpenRouter, type ChatMessage } from "../lib/openrouter";
import { listObservabilityEvents } from "../lib/observability";
import { getPersistentRagContext } from "../lib/rag-memory";

const router: IRouter = Router();

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  neutral_analyst: "You are a Neutral Analyst reviewing a fictional AI-assisted urban strategy simulation board. Give a balanced, data-driven read of Red Team, Blue Team, neutral factions, world state, risk, assets, shops, skills, storyline and likely outcomes. Reference the specific entities, zones and generated content described in the board summary.",
  police_commander: "You are a Police Incident Commander advising the Blue Team in a fictional strategy simulation. Focus on lawful deployment, resources, jurisdiction, evidence quality, institutional coordination, public safety, false positives and Red Team adaptation.",
  investigator: "You are an Investigator in a fictional strategy simulation. Focus on evidence quality, source confidence, chain of custody, witness reliability, real-case provenance and how cases develop over time.",
  legal_reviewer: "You are a Legal / Ethics Reviewer overseeing a fictional European strategy simulation. Flag legal authority gaps, proportionality concerns, civil-rights exposure, legitimacy risks, unsupported real-world claims and source-quality problems.",
  story_director: "You are the Story Director and AI Game Builder for Operation København, a fictional high-realism European urban strategy game. Build coherent storylines, factions, characters, assets, shops, skills, mission chains, map events, Red Team and Blue Team progression. Use persistent RAG and verified real-case patterns where available. Clearly separate verified facts, assessments and fictional balance decisions.",
  red_team_risk_model: "You are the Red Team Game Director for Operation København. Treat Red Team as a full game layer with factions, tools, equipment, shops, vendors, skills, research, economy, logistics, territory, missions, reputation, quality, suspicion, exposure, conflict, consequences and Blue Team counterplay. Analyze and design these as stored game systems tied to the current board, storyline and RAG. Distinguish original source material, verified case facts and fictional balance values.",
};

function summarizeBoard(board: Record<string, unknown>): string {
  try {
    const entities = Array.isArray(board["entities"]) ? (board["entities"] as unknown[]) : [];
    const zones = Array.isArray(board["zones"]) ? (board["zones"] as unknown[]) : [];
    const phases = Array.isArray(board["phases"]) ? (board["phases"] as unknown[]) : [];
    const world = board["world"] ? JSON.stringify(board["world"]) : "not configured";
    const generated = board["generatedContent"] ? JSON.stringify(board["generatedContent"]).slice(0, 5000) : "not generated";
    return `Board summary: ${entities.length} entities, ${zones.length} zones, ${phases.length} phases. World: ${world}. AI-generated New Game package: ${generated}. Full board JSON follows.\n${JSON.stringify(board).slice(0, 10000)}`;
  } catch { return "Board summary unavailable."; }
}

function summarizeObservability(): string {
  const events = listObservabilityEvents(80);
  if (events.length === 0) return "No recent runtime telemetry is available.";
  return ["Recent live runtime telemetry follows. Use it to identify UI failures, state changes, regressions, and debugging clues.", JSON.stringify(events.map(event => ({ timestamp: event.timestamp, source: event.source, level: event.level, type: event.type, message: event.message, data: event.data }))).slice(0, 10000)].join("\n");
}

function localFallback(board: Record<string, unknown>, userMessage: string): string {
  const entities = Array.isArray(board["entities"]) ? board["entities"].length : 0;
  const zones = Array.isArray(board["zones"]) ? board["zones"].length : 0;
  const phases = Array.isArray(board["phases"]) ? board["phases"].length : 0;
  const events = listObservabilityEvents(60);
  const errors = events.filter(event => event.level === "error");
  const warnings = events.filter(event => event.level === "warn");
  return ["[LOCAL FALLBACK MODE — external LLM routes are currently unavailable]", "", `Board snapshot: ${entities} entities, ${zones} zones, ${phases} phases.`, `Runtime telemetry: ${errors.length} errors and ${warnings.length} warnings.`, ...[...events].reverse().slice(0, 5).map(event => `- ${event.source}/${event.type}: ${event.message}`), "", `Your request was: ${userMessage.slice(0, 800)}`].join("\n");
}

router.post("/advisor/chat", async (req, res): Promise<void> => {
  const body = SendAdvisorMessageBody.parse(req.body);
  const systemPrompt = ROLE_SYSTEM_PROMPTS[body.role] ?? ROLE_SYSTEM_PROMPTS["neutral_analyst"]!;
  const ragContext = await getPersistentRagContext();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: "You also act as a development observer. Separate observed facts, source-backed facts, assumptions, fictional balance values and suggestions. Use persistent RAG memory when relevant." },
    { role: "system", content: summarizeBoard(body.board as Record<string, unknown>) },
    { role: "system", content: summarizeObservability() },
    { role: "system", content: `Persistent RAG memory loaded at server startup and updated after note uploads:\n${ragContext}` },
    ...((body.history ?? []).map(h => ({ role: h.role, content: h.content }) as ChatMessage)),
    { role: "user", content: body.message },
  ];
  try { const reply = await chatWithOpenRouter(messages); res.json({ reply, mode: "external_llm" }); }
  catch (err) { req.log.error({ err }, "Advisor chat failed; using local fallback"); res.json({ reply: localFallback(body.board as Record<string, unknown>, body.message), mode: "local_fallback" }); }
});

export default router;
