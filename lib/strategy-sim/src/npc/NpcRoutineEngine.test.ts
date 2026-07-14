import test from "node:test";
import assert from "node:assert/strict";
import { applyRoutineDecision, decideNpcRoutine } from "./NpcRoutineEngine";
import type { NPCComponent } from "./types";

function createNpc(): NPCComponent {
  return {
    name: "Maja",
    ageBracket: "adult",
    role: {
      id: "shop-owner",
      occupation: "Butiksejer",
      responsibilities: ["open_shop"],
      workplaceId: "shop-1",
      homeId: "home-1",
      scheduleTemplate: "weekday",
      allowedActions: ["sleep", "travel_to_work", "work", "eat", "rest", "seek_safety", "idle"],
      socialStatus: 50,
      economicStatus: 55,
    },
    schedule: [
      { id: "sleep", startMinute: 0, endMinute: 420, action: "sleep", locationId: "home-1", priority: 50 },
      { id: "commute", startMinute: 420, endMinute: 480, action: "travel_to_work", locationId: "shop-1", priority: 50 },
      { id: "work", startMinute: 480, endMinute: 960, action: "work", locationId: "shop-1", priority: 50 },
    ],
    personality: { openness: 0.5, conscientiousness: 0.8, extraversion: 0.4, agreeableness: 0.7, emotionalVolatility: 0.3 },
    needs: { hunger: 20, fatigue: 10, social: 30, safety: 10 },
    relationships: {},
    beliefs: {},
    goals: ["run_shop"],
    morals: ["honesty"],
    emotionalState: "calm",
    currentAction: "idle",
    memory: [],
  };
}

void test("routine follows the active schedule without LLM calls", () => {
  const npc = createNpc();
  const decision = decideNpcRoutine("npc-1", npc, { tick: 500, ticksPerGameMinute: 1 });
  assert.equal(decision.action, "work");
  assert.equal(decision.locationId, "shop-1");
  assert.equal(decision.source, "schedule");
});

void test("critical needs override the schedule deterministically", () => {
  const npc = createNpc();
  npc.needs.safety = 95;
  npc.needs.fatigue = 99;
  const decision = decideNpcRoutine("npc-1", npc, { tick: 500, ticksPerGameMinute: 1 });
  assert.equal(decision.action, "seek_safety");
  assert.equal(decision.source, "need");
});

void test("routine decisions cannot bypass role action permissions", () => {
  const npc = createNpc();
  assert.throws(() => applyRoutineDecision(npc, {
    npcId: "npc-1",
    action: "steal",
    source: "fallback",
    reason: "invalid test",
  }), /not allowed/);
});
