import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import ScenarioList from '@/pages/scenario-list';
import BoardPage from '@/pages/board';
import AnalyticsPage from '@/pages/analytics';
import { installTelemetry } from '@/lib/telemetry';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Loader2 } from 'lucide-react';

const GraphicsLabPage = lazy(() => import('@/pages/graphics-lab'));
const queryClient = new QueryClient();

function LazyFallback() {
  return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ScenarioList} />
      <Route path="/board/:id" component={BoardPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/graphics-lab">
        <Suspense fallback={<LazyFallback />}><GraphicsLabPage /></Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => installTelemetry(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
