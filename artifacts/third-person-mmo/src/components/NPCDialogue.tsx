import { useMemo, useState } from 'react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { useResolveTurn } from '../hooks/useResolveTurn';
import type { PlayerTurnAction } from '../lib/api';

const ROLES = [
  { value: 'story_director', label: 'Story Director' },
  { value: 'police_commander', label: 'Police Commander' },
  { value: 'red_team_risk_model', label: 'Red Team Risk Model' },
];

const ACTION_TYPES: PlayerTurnAction['type'][] = [
  'invest',
  'gather_intelligence',
  'reduce_pressure',
  'expand_influence',
  'train',
  'wait',
];

export default function NPCDialogue({ scenarioId, board }: { scenarioId: number; board: Record<string, any> }) {
  const simulation = (board.simulation ?? {}) as Record<string, any>;
  const entities = (board.entities ?? []) as Array<Record<string, any>>;
  const factions = (simulation.factions ?? []) as Array<Record<string, any>>;

  const npcs = useMemo(() => {
    if (entities.length > 0) {
      return entities.filter((e) => ['npc', 'unit', 'contact'].includes(e.category));
    }
    return factions;
  }, [entities, factions]);

  const [selectedNpc, setSelectedNpc] = useState<string>(npcs[0]?.id ?? '');
  const [role, setRole] = useState('story_director');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [actionType, setActionType] = useState<PlayerTurnAction['type']>('wait');
  const [amount, setAmount] = useState(10);

  const advisor = useAdvisorChat();
  const resolve = useResolveTurn(scenarioId);

  const selectedNpcName = useMemo(() => {
    const found = npcs.find((n) => n.id === selectedNpc);
    return found?.name ?? found?.faction ?? 'Unknown';
  }, [npcs, selectedNpc]);

  async function handleSend() {
    if (!message.trim()) return;
    try {
      const res = await advisor.mutateAsync({ role, message, board });
      setReply(res.reply);
    } catch (e) {
      setReply(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleResolve() {
    const action: PlayerTurnAction = { type: actionType, amount };
    const selected = npcs.find((n) => n.id === selectedNpc);
    if (selected?.id) action.factionId = selected.id;
    await resolve.mutateAsync(action);
  }

  return (
    <div className="bg-slate-800 p-4 rounded space-y-4">
      <h3 className="text-lg font-semibold">NPC Dialogue & Turn Resolution</h3>

      {npcs.length > 0 && (
        <div>
          <label className="text-sm text-slate-400">Target</label>
          <select
            className="w-full bg-slate-900 text-slate-100 rounded px-3 py-2 mt-1"
            value={selectedNpc}
            onChange={(e) => setSelectedNpc(e.target.value)}
          >
            {npcs.map((npc) => (
              <option key={npc.id as string} value={npc.id as string}>{npc.name ?? npc.faction ?? npc.id}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm text-slate-400">Advisor role</label>
        <select
          className="w-full bg-slate-900 text-slate-100 rounded px-3 py-2 mt-1"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-slate-400">Message to {selectedNpcName}</label>
        <textarea
          className="w-full bg-slate-900 text-slate-100 rounded px-3 py-2 mt-1"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask for intel, a quest, or a tactical opinion..."
        />
      </div>

      <button
        onClick={handleSend}
        disabled={advisor.isPending || !message.trim()}
        className="px-4 py-2 bg-blue-600 rounded disabled:opacity-50"
      >
        {advisor.isPending ? 'Sending...' : 'Send'}
      </button>

      {reply && (
        <div className="bg-slate-900 p-3 rounded text-sm whitespace-pre-wrap">
          <strong className="text-slate-400">{selectedNpcName}:</strong> {reply}
        </div>
      )}

      <div className="border-t border-slate-700 pt-4">
        <h4 className="font-semibold mb-2">Resolve Turn</h4>
        <div className="flex gap-2">
          <select
            className="bg-slate-900 text-slate-100 rounded px-3 py-2"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as PlayerTurnAction['type'])}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-slate-900 text-slate-100 rounded px-3 py-2 w-24"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button
            onClick={handleResolve}
            disabled={resolve.isPending}
            className="px-4 py-2 bg-emerald-600 rounded disabled:opacity-50"
          >
            {resolve.isPending ? 'Resolving...' : 'Resolve Turn'}
          </button>
        </div>
        {resolve.isSuccess && (
          <p className="text-green-400 text-sm mt-2">{resolve.data.summary}</p>
        )}
        {resolve.isError && (
          <p className="text-red-400 text-sm mt-2">{resolve.error.message}</p>
        )}
      </div>
    </div>
  );
}
