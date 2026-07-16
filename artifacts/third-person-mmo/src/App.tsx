import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useScenario, useScenarios } from './hooks/useScenarios';
import { validateBoardMapping, type BoardMappingIssue } from './lib/validateBoardMapping';

const Scene3D = lazy(() => import('./components/Scene3D'));

export default function App() {
  const { data: scenarios, isLoading: scenariosLoading, error: scenariosError } = useScenarios();
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (scenarios && scenarios.length > 0 && selectedId === undefined) {
      setSelectedId(scenarios[0].id);
    }
  }, [scenarios, selectedId]);

  const { data: scenario, isLoading: scenarioLoading, error: scenarioError } = useScenario(selectedId);

  const issues = useMemo<BoardMappingIssue[]>(() => {
    if (!scenario) return [];
    return validateBoardMapping((scenario.board ?? {}) as Record<string, unknown>);
  }, [scenario]);

  const error = scenariosError?.message ?? scenarioError?.message ?? null;
  const loading = scenariosLoading || scenarioLoading;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-bold mb-4">T1 Third-Person MMO RPG</h1>
      {error && <p className="text-red-400">Error: {error}</p>}
      {loading && !scenario && <p>Loading scenario...</p>}
      {scenarios && scenarios.length === 0 && (
        <p className="text-yellow-400">No scenarios found. Create one in command-sim or POST to /api/scenarios first.</p>
      )}
      {scenarios && scenarios.length > 0 && (
        <div className="mb-4">
          <label className="mr-2 text-slate-400">Scenario:</label>
          <select
            className="bg-slate-800 text-slate-100 rounded px-3 py-1"
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {scenario && <ScenarioPanel scenario={scenario} issues={issues} />}
    </div>
  );
}

function ScenarioPanel({ scenario, issues }: { scenario: { name: string; description: string | null; board: unknown }; issues: BoardMappingIssue[] }) {
  const board = (scenario.board ?? {}) as Record<string, any>;
  const simulation = (board.simulation ?? {}) as Record<string, any>;
  const factions = (simulation.factions ?? []) as Array<Record<string, any>>;
  const world = (board.world ?? null) as Record<string, any> | null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">{scenario.name}</h2>
        <p className="text-slate-400">{scenario.description}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Turn" value={simulation.turn} />
        <Stat label="Day" value={simulation.day} />
        <Stat label="Hour" value={simulation.hour} />
        <Stat label="City Tension" value={simulation.cityTension} />
        <Stat label="Public Confidence" value={simulation.publicConfidence} />
        <Stat label="Media Pressure" value={simulation.mediaPressure} />
        <Stat label="Evidence Quality" value={simulation.evidenceQuality} />
        <Stat label="Economy Index" value={simulation.economyIndex} />
        <Stat label="Blue Coordination" value={simulation.blueTeamCoordination} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Factions</h3>
        <ul className="divide-y divide-slate-700">
          {factions.map((faction) => (
            <li key={faction.id as string} className="py-2 flex justify-between">
              <span>
                {faction.name} <span className="text-slate-500">({faction.faction})</span>
              </span>
              <span className="text-slate-300 text-sm">
                Treasury {faction.treasury} · Cohesion {faction.cohesion} · Suspicion {faction.suspicion}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {world && (
        <div className="text-sm text-slate-400">
          World: {world.city}, {world.country} — map provider {world.mapProvider}
        </div>
      )}

      <ValidationReport issues={issues} />

      <div>
        <h3 className="text-lg font-semibold mb-2">3D Scene (lazy loaded)</h3>
        <Suspense fallback={<div className="h-[60vh] rounded-lg bg-slate-900 animate-pulse" />}>
          <Scene3D />
        </Suspense>
      </div>
    </div>
  );
}

function ValidationReport({ issues }: { issues: BoardMappingIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-green-400 text-sm">Board mapping validation passed.</p>;
  }
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return (
    <div className="bg-slate-800 p-4 rounded">
      <h3 className="text-lg font-semibold mb-2">
        Board Mapping Validation — {errors.length} error(s), {warnings.length} warning(s)
      </h3>
      <ul className="space-y-1 max-h-60 overflow-auto">
        {issues.map((issue, index) => (
          <li key={index} className={`text-sm ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
            <span className="font-mono">{issue.path}</span> — {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-slate-800 p-3 rounded">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-mono">{String(value ?? '—')}</div>
    </div>
  );
}
