import { Router, type IRouter } from "express";
import { SendAdvisorMessageBody } from "@workspace/api-zod";
import { chatWithOpenRouter, type ChatMessage } from "../lib/openrouter";
import { listObservabilityEvents } from "../lib/observability";

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
    "You are an abstract Red-Team Risk Model used for defensive planning in a fictional tabletop simulation. Identify vulnerabilities and plausible adversarial reactions ONLY in abstract, general terms (e.g. 'the network might relocate operations' or 'increase lookout coverage'). " +
    "You must NEVER provide real-world operational instructions for evasion, concealment, surveillance countermeasures, trafficking, weapons, violence, or any other illegal activity. If asked for such detail, decline and redirect to abstract risk framing only.",
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

  const compact = events.map((event) => ({
    timestamp: event.timestamp,
    source: event.source,
    level: event.level,
    type: event.type,
    message: event.message,
    data: event.data,
  }));

  return [
    "Recent live runtime telemetry follows. Use it to identify UI failures, state changes, regressions, and debugging clues. Do not claim access to code or logs not present here.",
    JSON.stringify(compact).slice(0, 10000),
  ].join("\n");
}

router.post("/advisor/chat", async (req, res): Promise<void> => {
  const body = SendAdvisorMessageBody.parse(req.body);
  const systemPrompt = ROLE_SYSTEM_PROMPTS[body.role] ?? ROLE_SYSTEM_PROMPTS["neutral_analyst"]!;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content:
        "You also act as a development observer for this game interface. When the user asks about bugs, UX, state behavior, or further game design, reason from the supplied board snapshot and runtime telemetry. Separate observed facts from suggestions.",
    },
    { role: "system", content: summarizeBoard(body.board as Record<string, unknown>) },
    { role: "system", content: summarizeObservability() },
    ...((body.history ?? []).map((h) => ({ role: h.role, content: h.content }) as ChatMessage)),
    { role: "user", content: body.message },
  ];

  try {
    const reply = await chatWithOpenRouter(messages);
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Advisor chat failed");
    res.status(502).json({ message: "The AI advisor is currently unavailable." });
  }
});

export default router;
