import { useBoardStore, computeScores, ScoreResult } from "@/lib/game";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Scale, Activity, Eye, AlertTriangle, Users, Box, Zap, Target } from "lucide-react";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

function getScoreIcon(key: string) {
  switch (key) {
    case 'publicSafety': return Shield;
    case 'evidenceQuality': return Scale;
    case 'operationalRisk': return AlertTriangle;
    case 'detection': return Eye;
    case 'civilianImpact': return Users;
    case 'resourceUse': return Box;
    case 'legitimacy': return Activity;
    case 'networkDisruption': return Zap;
    case 'missionObjectives': return Target;
    default: return Activity;
  }
}

function getScoreColor(value: number, invert: boolean = false) {
  const v = invert ? 100 - value : value;
  if (v < 33) return "bg-red-500";
  if (v < 66) return "bg-amber-500";
  return "bg-emerald-500";
}

export function ScoringPanel() {
  const board = useBoardStore(s => s.board);
  const scores = useMemo(() => computeScores(board), [board]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0f141f] border-t border-border text-foreground overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-secondary/50 flex justify-between items-center">
        <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-muted-foreground">Tactical Assessment</h2>
        <div className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-mono border border-primary/30">LIVE ANALYSIS</div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
          {scores.map(score => {
            const Icon = getScoreIcon(score.key);
            // Some scores are better when high (Safety), others when low (Risk)
            const invert = ['operationalRisk', 'civilianImpact'].includes(score.key);
            
            return (
              <Accordion type="single" collapsible key={score.key} className="border border-border/50 bg-card rounded-md shadow-sm">
                <AccordionItem value={score.key} className="border-none">
                  <AccordionTrigger className="px-3 py-2 hover:bg-muted/50 rounded-md [&[data-state=open]]:rounded-b-none">
                    <div className="flex flex-col w-full text-left pr-2">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {score.label}
                        </div>
                        <div className="font-mono text-sm font-bold">{score.value}</div>
                      </div>
                      <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getScoreColor(score.value, invert)} transition-all duration-500`}
                          style={{ width: `${score.value}%` }}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 pt-1 text-xs bg-muted/20 border-t border-border/50">
                    <p className="text-muted-foreground mb-3 leading-relaxed mt-2">{score.summary}</p>
                    <div className="space-y-2">
                      {score.factors.map((factor, i) => (
                        <div key={i} className="flex flex-col gap-0.5 border-l-2 pl-2 border-border">
                          <div className="flex justify-between font-medium">
                            <span>{factor.label}</span>
                            <span className={`font-mono ${factor.contribution > 0 ? 'text-emerald-400' : factor.contribution < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                              {factor.contribution > 0 ? '+' : ''}{factor.contribution}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{factor.detail}</div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}