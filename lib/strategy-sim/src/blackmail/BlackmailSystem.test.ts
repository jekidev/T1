import test from "node:test";
import assert from "node:assert/strict";
import { StrategySimulation } from "../StrategySimulation";
import { createFactionEntity, createUnitEntity } from "../ecs/entityFactory";

function createBlackmailScenario(seed = 1) {
  const simulation = new StrategySimulation({
    seed,
    tickRate: 20,
    blackmail: {
      evidenceMinQuality: 20,
      cooldownTicks: 5,
      fearBaseSuccess: 0.95,
      greedBaseSuccess: 0.95,
      isolationBaseSuccess: 0.95,
      fearCeasefireTicks: 8,
      isolationDurationTicks: 8,
    },
  });

  simulation.addEntity(createFactionEntity({
    id: "faction-player",
    name: "Player Faction",
    tick: 0,
    treasury: 1_000,
    reputation: 100,
    operationalSecurity: 100,
    blackmailResistance: 0,
  }));
  simulation.addEntity(createFactionEntity({
    id: "faction-target",
    name: "Target Faction",
    tick: 0,
    treasury: 1_000,
    reputation: 70,
    operationalSecurity: 0,
    blackmailResistance: 0,
  }));

  const playerUnit = createUnitEntity({
    id: "player-unit",
    factionId: "faction-player",
    tick: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  const targetUnit = createUnitEntity({
    id: "target-unit",
    factionId: "faction-target",
    tick: 0,
    position: { x: 1, y: 0, z: 0 },
  });
  targetUnit.combat!.targetId = playerUnit.identity.id;
  simulation.addEntity(playerUnit);
  simulation.addEntity(targetUnit);

  return simulation;
}

void test("evidence gathering and fear execution are deterministic", () => {
  const first = createBlackmailScenario(1);
  const second = createBlackmailScenario(1);

  for (const simulation of [first, second]) {
    const gather = simulation.blackmail.gatherEvidence("faction-player", "faction-target", 1);
    assert.equal(gather.accepted, true);
    simulation.step(1);

    const targetView = simulation.blackmail.getTargets("faction-player")[0];
    assert.ok(targetView);
    assert.ok(targetView.evidenceQuality >= 20);
    assert.equal(targetView.canExecute, true);

    const execute = simulation.blackmail.execute("faction-player", "faction-target", "fear", 2);
    assert.equal(execute.accepted, true);
    simulation.step(1);
  }

  assert.equal(first.canonicalSnapshot(), second.canonicalSnapshot());

  const result = first.events.all().find(event => event.type === "blackmail.resolved");
  assert.ok(result);
  assert.equal((result.payload as { success: boolean }).success, true);
  assert.equal((result.payload as { approach: string }).approach, "fear");

  const targetFaction = first.world.get("faction-target");
  const targetUnit = first.world.get("target-unit");
  assert.equal(targetFaction?.blackmail?.compromisedBy["faction-player"], true);
  assert.equal(targetFaction?.blackmail?.intimidatedUntilTick, 10);
  assert.equal(targetUnit?.morale?.current, 85);
  assert.equal(targetUnit?.combat?.targetId, undefined);

  const dossier = first.world.get("faction-player")?.blackmail?.dossiers["faction-target"];
  assert.equal(dossier?.evidenceQuality, 0);
  assert.equal(dossier?.cooldownTicks, 5);
});

void test("greed transfers only available in-game treasury and activates cooldown", () => {
  const simulation = createBlackmailScenario(1);
  const actor = simulation.world.get("faction-player")!;
  actor.blackmail!.dossiers["faction-target"] = {
    evidenceQuality: 100,
    cooldownTicks: 0,
    compromised: false,
  };

  const result = simulation.blackmail.execute("faction-player", "faction-target", "greed", 1);
  assert.equal(result.accepted, true);
  simulation.step(1);

  const resolved = simulation.events.all().find(event => event.type === "blackmail.resolved");
  assert.ok(resolved);
  const payload = resolved.payload as { success: boolean; effect: { payment?: number } };
  assert.equal(payload.success, true);
  assert.ok((payload.effect.payment ?? 0) >= 300);
  assert.ok((payload.effect.payment ?? 0) <= 1_000);

  const actorTreasury = simulation.world.get("faction-player")!.factionState!.treasury;
  const targetTreasury = simulation.world.get("faction-target")!.factionState!.treasury;
  assert.equal(actorTreasury + targetTreasury, 2_000);
  assert.ok(actorTreasury > 1_000);

  const retry = simulation.blackmail.execute("faction-player", "faction-target", "greed", 2);
  assert.equal(retry.accepted, true, "schema-valid commands are queued before subsystem rule validation");
  simulation.step(1);
  const rejected = simulation.events.all().find(event =>
    event.type === "command.rejected"
      && (event.payload as { commandId?: string }).commandId === (retry.accepted ? retry.command.id : ""),
  );
  assert.ok(rejected);
  assert.equal((rejected.payload as { code: string }).code, "cooldown_active");
});

void test("blackmail state survives save and deterministic continuation", () => {
  const original = createBlackmailScenario(1);
  original.blackmail.gatherEvidence("faction-player", "faction-target", 1);
  original.step(1);
  const snapshot = original.exportSnapshot();

  const restored = createBlackmailScenario(999);
  restored.importSnapshot(snapshot);

  original.blackmail.execute("faction-player", "faction-target", "isolation", 2);
  restored.blackmail.execute("faction-player", "faction-target", "isolation", 2);
  original.step(4);
  restored.step(4);

  assert.equal(original.canonicalSnapshot(), restored.canonicalSnapshot());
});

void test("service rejects self-targeting and reports target eligibility", () => {
  const simulation = createBlackmailScenario();
  assert.deepEqual(simulation.blackmail.getTargets("missing"), []);
  assert.equal(simulation.blackmail.canGatherEvidence("faction-player", "faction-player").allowed, false);

  const targets = simulation.blackmail.getTargets("faction-player");
  assert.equal(targets.length, 1);
  assert.equal(targets[0]!.factionId, "faction-target");
  assert.equal(targets[0]!.canGatherEvidence, true);
  assert.equal(targets[0]!.canExecute, false);
});
