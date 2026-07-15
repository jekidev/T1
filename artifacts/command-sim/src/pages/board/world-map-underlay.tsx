import { useEffect, useMemo, useState } from "react";
import { loadWorldConfig, type WorldConfig } from "@/lib/world-config";

interface WorldMapUnderlayProps { interactive?: boolean; }

export function WorldMapUnderlay({ interactive = false }: WorldMapUnderlayProps) {
  const [config, setConfig] = useState<WorldConfig>(() => loadWorldConfig());
  const [mapsMcpAvailable, setMapsMcpAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const handler = (event: Event) => { const custom = event as CustomEvent<WorldConfig>; setConfig(custom.detail ?? loadWorldConfig()); };
    window.addEventListener("world-config-changed", handler);
    return () => window.removeEventListener("world-config-changed", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcp/servers")
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => {
        const serialized = JSON.stringify(payload).toLowerCase();
        if (!cancelled) setMapsMcpAvailable(serialized.includes("google maps") || serialized.includes("google-maps") || serialized.includes("maps-mcp"));
      })
      .catch(() => { if (!cancelled) setMapsMcpAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  const mapUrl = useMemo(() => {
    const zoom = config.workAreaRadiusKm > 100 ? 6 : config.workAreaRadiusKm > 40 ? 8 : config.workAreaRadiusKm > 15 ? 10 : 12;
    const params = new URLSearchParams({ lat: String(config.latitude), lng: String(config.longitude), zoom: String(zoom) });
    return `/api/workspace/maps/embed?${params.toString()}`;
  }, [config]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]">
      <iframe title={`Google Maps over ${config.city}`} src={mapUrl} className={`h-full w-full border-0 transition-all duration-300 ${interactive ? "opacity-100" : "opacity-80 saturate-[0.9] contrast-[1.05]"}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ pointerEvents: interactive ? "auto" : "none" }} />
      {!interactive && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,hsl(var(--background)/0.2))] shadow-[inset_0_0_80px_hsl(var(--background)/0.35)]" />}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border/70 bg-background/90 px-3 py-2 text-[10px] shadow-xl backdrop-blur select-text">
        <div className="font-medium">{config.city}, {config.country} · {config.workAreaRadiusKm} km</div>
        <div className="mt-0.5 text-muted-foreground">Google Maps verified by preflight · Maps MCP {mapsMcpAvailable === null ? "checking…" : mapsMcpAvailable ? "connected" : "optional"}</div>
      </div>
      {interactive && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border bg-background/90 px-3 py-1 text-xs shadow-xl backdrop-blur">Google Maps mode active — pan and zoom the real map</div>}
    </div>
  );
}
