export interface BoardMappingIssue {
  path: string;
  severity: 'error' | 'warning';
  message: string;
}

function assertArray(value: unknown, path: string): value is Array<unknown> {
  return Array.isArray(value);
}

export function validateBoardMapping(board: Record<string, unknown>): BoardMappingIssue[] {
  const issues: BoardMappingIssue[] = [];

  function addError(path: string, message: string) {
    issues.push({ path, severity: 'error', message });
  }

  function addWarning(path: string, message: string) {
    issues.push({ path, severity: 'warning', message });
  }

  if (!board || typeof board !== 'object') {
    addError('board', 'Board is missing or not an object');
    return issues;
  }

  const requiredBoardFields = ['version', 'mapTemplateId', 'entities', 'phases'];
  for (const field of requiredBoardFields) {
    if (!(field in board)) {
      addError(`board.${field}`, `Missing required field: ${field}`);
    }
  }

  if (!assertArray(board.entities, 'board.entities')) {
    addError('board.entities', 'entities must be an array');
  }

  if (!assertArray(board.zones, 'board.zones')) {
    addWarning('board.zones', 'zones is not an array; districts/territories cannot be mapped');
  }

  const simulation = board.simulation as Record<string, unknown> | undefined;
  if (!simulation || typeof simulation !== 'object') {
    addError('board.simulation', 'Missing simulation state; MMO stats panel and turn clock cannot render');
  } else {
    const requiredSimFields = [
      'seed',
      'turn',
      'day',
      'hour',
      'publicConfidence',
      'mediaPressure',
      'blueTeamCoordination',
      'evidenceQuality',
      'cityTension',
      'economyIndex',
      'factions',
      'shops',
      'skills',
    ];
    for (const field of requiredSimFields) {
      if (!(field in simulation)) {
        addError(`board.simulation.${field}`, `Missing simulation field: ${field}`);
      }
    }

    if (!assertArray(simulation.factions, 'board.simulation.factions')) {
      addError('board.simulation.factions', 'factions must be an array');
    }
    if (!assertArray(simulation.shops, 'board.simulation.shops')) {
      addWarning('board.simulation.shops', 'shops is not an array; vendor UI cannot render');
    }
    if (!assertArray(simulation.skills, 'board.simulation.skills')) {
      addWarning('board.simulation.skills', 'skills is not an array; skill panel cannot render');
    }
  }

  const world = board.world as Record<string, unknown> | undefined;
  if (!world || typeof world !== 'object') {
    addError('board.world', 'Missing world state; map and 3D scene cannot be positioned');
  } else {
    const requiredWorldFields = ['city', 'country', 'latitude', 'longitude', 'mapProvider', 'timezone'];
    for (const field of requiredWorldFields) {
      if (!(field in world)) {
        addError(`board.world.${field}`, `Missing world field: ${field}`);
      }
    }
  }

  const generated = board.generatedContent as Record<string, unknown> | undefined;
  if (!generated || typeof generated !== 'object') {
    addWarning('board.generatedContent', 'No generated content; quest/lore generation will be empty');
  } else {
    const recommended = ['premise', 'storyline', 'openingMission', 'factions', 'assets', 'shops', 'skills'];
    for (const field of recommended) {
      if (!(field in generated)) {
        addWarning(`board.generatedContent.${field}`, `Missing generated content field: ${field}`);
      }
    }
  }

  return issues;
}
