import { useEffect } from "react";
import { useLocation } from "wouter";
import ScenarioList from "./scenario-list";
import { Button } from "@/components/ui/button";
import { PanelsTopLeft } from "lucide-react";

export default function ScenarioListShell() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const enforce = () => {
      const slider = document.querySelector('input[aria-label="Initial moral spectrum"]') as HTMLInputElement | null;
      if (!slider) return;
      slider.min = "1";
      if (Number(slider.value) < 1) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(slider, "1");
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.1),transparent_35%)]">
      <div className="fixed right-4 top-4 z-40"><Button variant="outline" className="bg-card/90 shadow-xl backdrop-blur" onClick={() => setLocation("/workspace")}><PanelsTopLeft className="mr-2 h-4 w-4" />Workspace & Preflight</Button></div>
      <ScenarioList />
    </div>
  );
}
