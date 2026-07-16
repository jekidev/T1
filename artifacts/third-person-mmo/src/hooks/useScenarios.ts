import { useQuery } from '@tanstack/react-query';
import { fetchScenarios, fetchScenario, type Scenario, type ScenarioSummary } from '../lib/api';

export const scenariosQueryKey = ['scenarios'];
export const scenarioQueryKey = (id: number) => ['scenario', id];

export function useScenarios() {
  return useQuery<ScenarioSummary[], Error>({
    queryKey: scenariosQueryKey,
    queryFn: fetchScenarios,
  });
}

export function useScenario(id: number | undefined) {
  return useQuery<Scenario, Error>({
    queryKey: scenarioQueryKey(id ?? 0),
    queryFn: () => fetchScenario(id!),
    enabled: id !== undefined && id > 0,
  });
}
