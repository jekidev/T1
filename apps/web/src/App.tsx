import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { TtsProvider } from "./context/TtsContext";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { TemplatesPage } from "./pages/Templates";
import { CoachPage } from "./pages/Coach";
import { WorkspacePage } from "./pages/Workspace";
import { CaseBoardPage } from "./pages/CaseBoard";
import { TimelinePage } from "./pages/Timeline";
import { PreviewsPage } from "./pages/Previews";
import { SettingsPage } from "./pages/Settings";
import { PlayerPage } from "./pages/Player";

export default function App() {
  return <AppProvider><TtsProvider><BrowserRouter><Routes><Route element={<AppShell />}><Route index element={<Dashboard />} /><Route path="templates" element={<TemplatesPage />} /><Route path="coach" element={<CoachPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="player" element={<PlayerPage />} /><Route path="project/:id" element={<WorkspacePage />} /><Route path="project/:id/case-board" element={<CaseBoardPage />} /><Route path="project/:id/timeline" element={<TimelinePage />} /><Route path="project/:id/previews" element={<PreviewsPage />} /></Route></Routes></BrowserRouter></TtsProvider></AppProvider>;
}
