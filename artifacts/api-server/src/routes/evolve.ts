import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";
import { listObservabilityEvents } from "../lib/observability";

const router: IRouter = Router();
const evolveDir = path.resolve(process.cwd(), ".runtime/evolve");

interface EvolutionProposal {
  id: string;
  createdAt: string;
  status: "proposed" | "approved" | "rejected";
  observations: string[];
  diagnosis: string[];
  proposals: Array<{ title: string; targetFeature: string; reason: string; validation: string[] }>;
}

async function readProposals(): Promise<EvolutionProposal[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(evolveDir, "proposals.json"), "utf8")) as EvolutionProposal[];
  } catch {
    return [];
  }
}

async function writeProposals(proposals: EvolutionProposal[]) {
  await fs.mkdir(evolveDir, { recursive: true });
  await fs.writeFile(path.join(evolveDir, "proposals.json"), JSON.stringify(proposals, null, 2), "utf8");
}

router.get("/evolve/proposals", async (_req, res): Promise<void> => {
  res.json({ proposals: await readProposals() });
});

router.post("/evolve/analyze", async (_req, res): Promise<void> => {
  const events = listObservabilityEvents(300);
  const errorCounts = new Map<string, number>();
  for (const event of events.filter((row) => row.level === "error" || row.level === "warn")) {
    errorCounts.set(event.type, (errorCounts.get(event.type) ?? 0) + 1);
  }
  const ranked = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const observations = ranked.slice(0, 10).map(([type, count]) => `${type} occurred ${count} times`);
  const proposals = ranked.slice(0, 5).map(([type, count]) => ({
    title: `Reduce recurring ${type}`,
    targetFeature: type.startsWith("llm.") ? "ai-advisor" : type.includes("network") ? "api-and-backend" : "ui-and-experience",
    reason: `${count} warning/error events were observed in the current runtime buffer.`,
    validation: ["pnpm typecheck", "pnpm build", "reproduce the triggering workflow", "confirm event count no longer increases"],
  }));
  const record: EvolutionProposal = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "proposed",
    observations,
    diagnosis: observations.length ? ["Recurring telemetry patterns warrant review."] : ["No recurring warning/error pattern is currently available."],
    proposals,
  };
  const existing = await readProposals();
  existing.push(record);
  await writeProposals(existing.slice(-200));
  res.status(201).json(record);
});

router.post("/evolve/proposals/:id/decision", async (req, res): Promise<void> => {
  const decision = req.body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    res.status(422).json({ message: "decision must be approved or rejected" });
    return;
  }
  const proposals = await readProposals();
  const proposal = proposals.find((row) => row.id === req.params.id);
  if (!proposal) {
    res.status(404).json({ message: "proposal not found" });
    return;
  }
  proposal.status = decision;
  await writeProposals(proposals);
  res.json(proposal);
});

export default router;
