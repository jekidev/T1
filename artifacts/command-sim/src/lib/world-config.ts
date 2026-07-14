export interface WorldConfig {
  country: string;
  region: string;
  municipality: string;
  city: string;
  workAreaLabel: string;
  workAreaRadiusKm: number;
  supplierCountry: string;
  language: string;
  currency: string;
  timezone: string;
  latitude: number;
  longitude: number;
  mapProvider: 'google' | 'openstreetmap';
}

const STORAGE_KEY = 'urban-strategy-world-config-v1';

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  country: 'Danmark',
  region: 'Hovedstaden',
  municipality: 'København',
  city: 'København',
  workAreaLabel: 'København og omegn',
  workAreaRadiusKm: 25,
  supplierCountry: 'Danmark',
  language: 'da-DK',
  currency: 'DKK',
  timezone: 'Europe/Copenhagen',
  latitude: 55.6761,
  longitude: 12.5683,
  mapProvider: 'google',
};

export function loadWorldConfig(): WorldConfig {
  if (typeof window === 'undefined') return DEFAULT_WORLD_CONFIG;
  try {
    return { ...DEFAULT_WORLD_CONFIG, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<WorldConfig>) };
  } catch {
    return DEFAULT_WORLD_CONFIG;
  }
}

export function saveWorldConfig(config: WorldConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('world-config-changed', { detail: config }));
}
