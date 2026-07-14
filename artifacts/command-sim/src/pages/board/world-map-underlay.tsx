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
    if (config.mapProvider === "google") {
      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
      if (key) {
        const q = encodeURIComponent(`${config.latitude},${config.longitude}`);
        const zoom = config.workAreaRadiusKm > 100 ? 6 : config.workAreaRadiusKm > 40 ? 8 : config.workAreaRadiusKm > 15 ? 10 : 12;
        return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(key)}&center=${q}&zoom=${zoom}&maptype=roadmap`;
      }
    }
    const delta = Math.max(0.08, config.workAreaRadiusKm / 90);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${config.longitude - delta}%2C${config.latitude - delta}%2C${config.longitude + delta}%2C${config.latitude + delta}&layer=mapnik&marker=${config.latitude}%2C${config.longitude}`;
  }, [config]);

  const usingGoogle = mapUrl.includes("google.com/maps");

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted">
      <iframe title={`Kort over ${config.city}`} src={mapUrl} className={`h-full w-full border-0 transition-opacity ${interactive ? "opacity-100" : "opacity-75 grayscale-[15%]"}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ pointerEvents: interactive ? "auto" : "none" }} />
      {!interactive && <div className="pointer-events-none absolute inset-0 bg-background/10" />}
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-border bg-background/90 px-2 py-1 text-[10px] shadow select-text">
        <div>{config.city}, {config.country} · {config.workAreaRadiusKm} km</div>
        <div className="mt-0.5 text-muted-foreground">{usingGoogle ? "Google Maps" : "OpenStreetMap fallback"} · Maps MCP {mapsMcpAvailable === null ? "checking…" : mapsMcpAvailable ? "connected" : "not connected"}</div>
      </div>
      {interactive && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-background/90 px-3 py-1 text-xs shadow">Map mode active — pan and zoom the real European map</div>}
    </div>
  );
}
