import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveTurn, type PlayerTurnAction, type TurnResolution } from '../lib/api';
import { scenarioQueryKey, scenariosQueryKey } from './useScenarios';

export function useResolveTurn(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation<TurnResolution, Error, PlayerTurnAction | undefined>({
    mutationFn: (action) => resolveTurn(id!, action),
    onSuccess: (data) => {
      queryClient.setQueryData(scenarioQueryKey(id!), data.scenario);
      queryClient.invalidateQueries({ queryKey: scenariosQueryKey });
    },
  });
}
