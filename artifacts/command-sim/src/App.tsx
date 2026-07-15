import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ObservabilityConsent } from "@/components/observability-consent";
import { PreflightGate } from "@/components/workspace-preflight";
import NotFound from "@/pages/not-found";
import ScenarioList from "@/pages/scenario-list";
import BoardPage from "@/pages/board";
import AnalyticsPage from "@/pages/analytics";
import AssetLabPage from "@/pages/asset-lab";
import GeoLabPage from "@/pages/geo-lab";
import CodingAgentPage from "@/pages/coding-agent";
import WorkspacePage from "@/pages/workspace";
import { installTelemetry } from "@/lib/telemetry";
import { Route, Switch, Router as WouterRouter } from "wouter";

const queryClient = new QueryClient();

function GuardedBoard() {
  return <PreflightGate><BoardPage /></PreflightGate>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ScenarioList} />
      <Route path="/workspace" component={WorkspacePage} />
      <Route path="/board/:id" component={GuardedBoard} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/asset-lab" component={AssetLabPage} />
      <Route path="/geo-lab" component={GeoLabPage} />
      <Route path="/coding-agent" component={CodingAgentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => installTelemetry(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <ObservabilityConsent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
