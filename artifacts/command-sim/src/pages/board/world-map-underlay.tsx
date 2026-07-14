import { useEffect, useMemo, useState } from 'react';
import { loadWorldConfig, type WorldConfig } from '@/lib/world-config';

export function WorldMapUnderlay() {
  const [config, setConfig] = useState<WorldConfig>(() => loadWorldConfig());

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<WorldConfig>;
      setConfig(custom.detail ?? loadWorldConfig());
    };
    window.addEventListener('world-config-changed', handler);
    return () => window.removeEventListener('world-config-changed', handler);
  }, []);

  const mapUrl = useMemo(() => {
    if (config.mapProvider === 'google') {
      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
      if (key) {
        const q = encodeURIComponent(`${config.city}, ${config.country}`);
        return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&zoom=11`;
      }
    }

    const delta = Math.max(0.08, config.workAreaRadiusKm / 90);
    const left = config.longitude - delta;
    const right = config.longitude + delta;
    const top = config.latitude + delta;
    const bottom = config.latitude - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${config.latitude}%2C${config.longitude}`;
  }, [config]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted">
      <iframe
        title={`Kort over ${config.city}`}
        src={mapUrl}
        className="h-full w-full border-0 opacity-75 grayscale-[15%]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="pointer-events-none absolute inset-0 bg-background/10" />
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-border bg-background/85 px-2 py-1 text-[10px] shadow">
        {config.city} · {config.workAreaRadiusKm} km · Leverandør: {config.supplierCountry}
      </div>
    </div>
  );
}
