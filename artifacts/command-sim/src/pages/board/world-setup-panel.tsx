import { useState } from 'react';
import { MapPin, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadWorldConfig, saveWorldConfig, type WorldConfig } from '@/lib/world-config';

interface WorldSetupPanelProps {
  open: boolean;
  onClose: () => void;
}

const CITY_PRESETS: Record<string, Pick<WorldConfig, 'region' | 'municipality' | 'latitude' | 'longitude'>> = {
  København: { region: 'Hovedstaden', municipality: 'København', latitude: 55.6761, longitude: 12.5683 },
  Aarhus: { region: 'Midtjylland', municipality: 'Aarhus', latitude: 56.1629, longitude: 10.2039 },
  Odense: { region: 'Syddanmark', municipality: 'Odense', latitude: 55.4038, longitude: 10.4024 },
  Aalborg: { region: 'Nordjylland', municipality: 'Aalborg', latitude: 57.0488, longitude: 9.9217 },
  Esbjerg: { region: 'Syddanmark', municipality: 'Esbjerg', latitude: 55.4765, longitude: 8.4594 },
};

export function WorldSetupPanel({ open, onClose }: WorldSetupPanelProps) {
  const [config, setConfig] = useState<WorldConfig>(() => loadWorldConfig());

  if (!open) return null;

  const update = <K extends keyof WorldConfig>(key: K, value: WorldConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }));
  };

  const chooseCity = (city: string) => {
    const preset = CITY_PRESETS[city];
    if (!preset) return update('city', city);
    setConfig(current => ({ ...current, city, ...preset, workAreaLabel: `${city} og omegn` }));
  };

  const save = () => {
    saveWorldConfig(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" /> World Setup</div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-xs">Land<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.country} onChange={event => update('country', event.target.value)} /></label>
          <label className="text-xs">Startby<select className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.city} onChange={event => chooseCity(event.target.value)}>{Object.keys(CITY_PRESETS).map(city => <option key={city}>{city}</option>)}</select></label>
          <label className="text-xs">Region<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.region} onChange={event => update('region', event.target.value)} /></label>
          <label className="text-xs">Kommune<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.municipality} onChange={event => update('municipality', event.target.value)} /></label>
          <label className="text-xs">Arbejdsområde<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.workAreaLabel} onChange={event => update('workAreaLabel', event.target.value)} /></label>
          <label className="text-xs">Radius: {config.workAreaRadiusKm} km<input type="range" min="1" max="250" className="mt-3 w-full" value={config.workAreaRadiusKm} onChange={event => update('workAreaRadiusKm', Number(event.target.value))} /></label>
          <label className="text-xs">Leverandørland<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.supplierCountry} onChange={event => update('supplierCountry', event.target.value)} /></label>
          <label className="text-xs">Kortudbyder<select className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.mapProvider} onChange={event => update('mapProvider', event.target.value as WorldConfig['mapProvider'])}><option value="google">Google Maps</option><option value="openstreetmap">OpenStreetMap</option></select></label>
          <label className="text-xs">Sprog<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.language} onChange={event => update('language', event.target.value)} /></label>
          <label className="text-xs">Valuta<input className="mt-1 w-full rounded border border-input bg-background px-2 py-2" value={config.currency} onChange={event => update('currency', event.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4"><Button variant="outline" onClick={onClose}>Annuller</Button><Button onClick={save}><Save className="mr-2 h-4 w-4" />Gem verden</Button></div>
      </div>
    </div>
  );
}
