import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getReplayConsent,
  getReplayProvider,
  setReplayConsent,
  type ReplayConsent,
} from "@/lib/session-replay";
import { EyeOff, ShieldCheck } from "lucide-react";

export function ObservabilityConsent() {
  const [consent, setConsent] = useState<ReplayConsent>(() => getReplayConsent());

  useEffect(() => {
    const listener = (event: Event) => {
      setConsent((event as CustomEvent<Exclude<ReplayConsent, null>>).detail);
    };
    window.addEventListener("operation-observability-consent", listener);
    return () => window.removeEventListener("operation-observability-consent", listener);
  }, []);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[10000] mx-auto max-w-2xl">
      <Card className="border-primary/40 bg-card/95 shadow-xl backdrop-blur">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Privacy-safe diagnostic recording</p>
            <p className="text-xs text-muted-foreground">
              Optional session replay helps reproduce UI failures. Text, inputs, Monaco, tokens, API keys,
              canvas content and secret-marked elements are masked or excluded. Retention is configurable and recording can be disabled at any time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setReplayConsent("denied")}>
              <EyeOff className="mr-1 h-3.5 w-3.5" /> No replay
            </Button>
            <Button size="sm" onClick={() => setReplayConsent("granted")}>
              Allow diagnostics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ObservabilityStatus() {
  const [provider, setProvider] = useState(getReplayProvider());
  useEffect(() => {
    const interval = window.setInterval(() => setProvider(getReplayProvider()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  return <span className="text-[10px] text-muted-foreground">Replay: {provider}</span>;
}
