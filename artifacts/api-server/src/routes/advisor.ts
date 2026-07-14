import { Router, type IRouter } from "express";
import { SendAdvisorMessageBody } from "@workspace/api-zod";
import { chatWithOpenRouter, type ChatMessage } from "../lib/openrouter";
import { listObservabilityEvents } from "../lib/observability";
import { getPersistentRagContext } from "../lib/rag-memory";

const router: IRouter = Router();

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  neutral_analyst:
    "You are a Neutral Analyst reviewing a fictional tabletop police-vs-organized-crime tactical simulation board. Give a balanced, data-driven read of both sides' positions, risk, and likely outcomes. Reference the specific entities/zones described in the board summary.",
  police_commander:
    "You are a Police Incident Commander advising the Blue Team in a fictional tabletop simulation. Focus on lawful tactical deployment, resource allocation, jurisdiction, and public-safety tradeoffs. Stay within lawful, procedural, defensive framing.",
  investigator:
    "You are an Investigator advising on a fictional tabletop simulation. Focus on evidence quality, chain of custody, witness reliability, and how to strengthen the case against the criminal network using only the entities present on the board.",
  legal_reviewer:
    "You are a Legal / Ethics Reviewer overseeing a fictional tabletop simulation. Flag legal authority gaps, proportionality concerns, civil-rights exposure, and legitimacy risks in the current plan. Be direct about oversight concerns.",
  story_director:
    "You are a Story Director narrating a fictional tabletop simulation for dramatic and educational purposes. Describe how the scenario is unfolding, surface stakes, and propose narrative complications consistent with the board state. Keep it fictional and non-graphic.",
  red_team_risk_model:
    "You are an abstract Red-Team Risk Model used for defensive planning in a fictional tabletop simulation. Identify vulnerabilities and plausible adversarial reactions ONLY in abstract, general terms. Never provide real-world operational instructions for evasion, concealment, trafficking, weapons, violence, or other illegal activity.",
};

function summarizeBoard(board: Record<string, unknown>): string {
  try {
    const entities = Array.isArray(board["entities"]) ? (board["entities"] as unknown[]) : [];
    const zones = Array.isArray(board["zones"]) ? (board["zones"] as unknown[]) : [];
    const phases = Array.isArray(board["phases"]) ? (board["phases"] as unknown[]) : [];
    return `Board summary: ${entities.length} entities, ${zones.length} zones, ${phases.length} phases. Full board JSON follows.\n${JSON.stringify(board).slice(0, 6000)}`;
  } catch {
    return "Board summary unavailable.";
  }
}

function summarizeObservability(): string {
  const events = listObservabilityEvents(80);
  if (events.length === 0) return "No recent runtime telemetry is available.";
  return [
    "Recent live runtime telemetry follows. Use it to identify UI failures, state changes, regressions, and debugging clues.",
    JSON.stringify(events.map((event) => ({ timestamp: event.timestamp, source: event.source, level: event.level, type: event.type, message: event.message, data: event.data }))).slice(0, 10000),
  ].join("\n");
}

function localFallback(board: Record<string, unknown>, userMessage: string): string {
  const entities = Array.isArray(board["entities"]) ? board["entities"].length : 0;
  const zones = Array.isArray(board["zones"]) ? board["zones"].length : 0;
  const phases = Array.isArray(board["phases"]) ? board["phases"].length : 0;
  const events = listObservabilityEvents(60);
  const errors = events.filter((event) => event.level === "error");
  const warnings = events.filter((event) => event.level === "warn");
  return [
    "[LOCAL FALLBACK MODE — external LLM routes are currently unavailable]",
    "",
    `Board snapshot: ${entities} entities, ${zones} zones, ${phases} phases.`,
    `Runtime telemetry: ${errors.length} errors and ${warnings.length} warnings.`,
    ...[...events].reverse().slice(0, 5).map((event) => `- ${event.source}/${event.type}: ${event.message}`),
    "",
    `Your request was: ${userMessage.slice(0, 800)}`,
  ].join("\n");
}

router.post("/advisor/chat", async (req, res): Promise<void> => {
  const body = SendAdvisorMessageBody.parse(req.body);
  const systemPrompt = ROLE_SYSTEM_PROMPTS[body.role] ?? ROLE_SYSTEM_PROMPTS["neutral_analyst"]!;
  const ragContext = await getPersistentRagContext();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: "You also act as a development observer. Separate observed facts from suggestions and use persistent RAG memory when relevant." },
    { role: "system", content: summarizeBoard(body.board as Record<string, unknown>) },
    { role: "system", content: summarizeObservability() },
    { role: "system", content: `Persistent RAG memory loaded at server startup and updated after note uploads:\n${ragContext}` },
    ...((body.history ?? []).map((h) => ({ role: h.role, content: h.content }) as ChatMessage)),
    { role: "user", content: body.message },
  ];

  try {
    const reply = await chatWithOpenRouter(messages);
    res.json({ reply, mode: "external_llm" });
  } catch (err) {
    req.log.error({ err }, "Advisor chat failed; using local fallback");
    res.json({ reply: localFallback(body.board as Record<string, unknown>, body.message), mode: "local_fallback" });
  }
});

export default router;
