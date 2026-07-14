import { BookOpen, Home, Layers, Settings, Sparkles, Wand2 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { GlobalPlayer } from "./GlobalPlayer";

const nav = [
  { to: "/", label: "Hjem", icon: Home, end: true },
  { to: "/templates", label: "Templates", icon: Layers },
  { to: "/coach", label: "Coach", icon: Wand2 },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><BookOpen size={18} /></span>
          <span><strong>CaseCraft</strong><small>KRIMI-VÆRKSTEDET</small></span>
        </NavLink>
        <nav className="desktop-nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <span className="demo-badge"><Sparkles size={13} /> Lokal/privat</span>
      </header>
      <main className="main-content"><Outlet /></main>
      <GlobalPlayer />
      <nav className="mobile-nav">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "mobile-link active" : "mobile-link"}>
            <Icon size={20} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
