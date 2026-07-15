import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BoardState } from "@/lib/game";
import {
  getBoardBlackmailTargets,
  type BoardBlackmailAction,
} from "@/lib/strategy/boardStrategyBridge";
import { Eye, HandCoins, ShieldAlert, Target, UsersRound } from "lucide-react";

interface BlackmailPanelProps {
  board: BoardState;
  actorFactionId: string;
  onAction: (action: BoardBlackmailAction) => void;
}

export function BlackmailPanel({ board, actorFactionId, onAction }: BlackmailPanelProps) {
  const targets = useMemo(
    () => getBoardBlackmailTargets(board, actorFactionId),
    [board, actorFactionId],
  );
  const [targetFactionId, setTargetFactionId] = useState("");

  useEffect(() => {
    if (!targets.some(target => target.factionId === targetFactionId)) {
      setTargetFactionId(targets[0]?.factionId ?? "");
    }
  }, [targets, targetFactionId]);

  const target = targets.find(item => item.factionId === targetFactionId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1 text-xs">
            <Target className="h-3.5 w-3.5" />
            In-game blackmail
          </CardTitle>
          <Badge variant="outline" className="text-[9px]">Command validated</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {targets.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Select a faction with another active faction in the strategy snapshot.
          </p>
        ) : (
          <>
            <Select value={targetFactionId} onValueChange={setTargetFactionId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Target faction" />
              </SelectTrigger>
              <SelectContent>
                {targets.map(item => (
                  <SelectItem key={item.factionId} value={item.factionId}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {target && (
              <>
                <div className="rounded border p-2 text-[10px]">
                  <div className="flex items-center justify-between font-medium">
                    <span>{target.name}</span>
                    <span>{Math.round(target.evidenceQuality)}% evidence</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${Math.max(0, Math.min(100, target.evidenceQuality))}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                    <span><Eye className="inline h-3 w-3" /> OPSEC {Math.round(target.operationalSecurity)}</span>
                    <span><ShieldAlert className="inline h-3 w-3" /> Resistance {Math.round(target.resistance)}</span>
                    <span>Suspicion {Math.round(target.suspicion)}</span>
                    <span>Cooldown {target.cooldownTicks}</span>
                  </div>
                  {target.compromised && (
                    <Badge className="mt-2 text-[9px]">Compromised</Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full text-xs"
                  disabled={!target.canGatherEvidence}
                  onClick={() => onAction({
                    type: "gather",
                    actorFactionId,
                    targetFactionId: target.factionId,
                  })}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Gather evidence
                </Button>

                <div className="grid grid-cols-3 gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-1 text-[10px]"
                    disabled={!target.canExecute}
                    onClick={() => onAction({
                      type: "execute",
                      actorFactionId,
                      targetFactionId: target.factionId,
                      approach: "fear",
                    })}
                  >
                    <ShieldAlert className="mr-1 h-3 w-3" /> Fear
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-1 text-[10px]"
                    disabled={!target.canExecute}
                    onClick={() => onAction({
                      type: "execute",
                      actorFactionId,
                      targetFactionId: target.factionId,
                      approach: "greed",
                    })}
                  >
                    <HandCoins className="mr-1 h-3 w-3" /> Greed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-1 text-[10px]"
                    disabled={!target.canExecute}
                    onClick={() => onAction({
                      type: "execute",
                      actorFactionId,
                      targetFactionId: target.factionId,
                      approach: "isolation",
                    })}
                  >
                    <UsersRound className="mr-1 h-3 w-3" /> Isolate
                  </Button>
                </div>

                {!target.canGatherEvidence && !target.canExecute && target.unavailableReason && (
                  <p className="text-[10px] text-muted-foreground">{target.unavailableReason}</p>
                )}
              </>
            )}
          </>
        )}
        <p className="text-[9px] text-muted-foreground">
          Fictional strategy mechanic. Outcomes resolve through the deterministic ECS command pipeline.
        </p>
      </CardContent>
    </Card>
  );
}
