import {
  CloudFog,
  CloudRain,
  Map,
  Snowflake,
  SunMedium,
  ThermometerSun,
} from "lucide-react";
import {
  getBoardEnvironment,
  updateBoardEnvironment,
  useBoardStore,
  type SceneMapMode,
  type SceneSeason,
  type SceneWeather,
} from "@/lib/game";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WEATHER_OPTIONS: Array<{ value: SceneWeather; label: string }> = [
  { value: "sun", label: "Sun" },
  { value: "rain", label: "Rain" },
  { value: "cloudy", label: "Cloudy" },
  { value: "fog", label: "Fog" },
  { value: "snow", label: "Snow" },
];

const SEASON_OPTIONS: Array<{ value: SceneSeason; label: string }> = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "winter", label: "Winter" },
];

const MAP_OPTIONS: Array<{ value: SceneMapMode; label: string }> = [
  { value: "local", label: "Local fallback scene" },
  { value: "google", label: "Google Maps adapter" },
  { value: "openstreetmap", label: "OpenStreetMap / MapLibre" },
];

export function SceneEnvironmentPanel() {
  const board = useBoardStore(state => state.board);
  const environment = getBoardEnvironment(board);
  const city = board.world?.city ?? "Local scene";
  const WeatherIcon = weatherIcon(environment.weather);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_48%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--muted)/0.45))] p-4 shadow-[inset_0_0_28px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scene / Environment</p>
            <h3 className="mt-1 truncate text-base font-semibold">{environment.sceneName || city}</h3>
            <p className="text-[11px] text-muted-foreground">{city} · {board.world?.timezone ?? "local timezone"}</p>
          </div>
          <div className="rounded-xl border bg-background/55 p-2.5 shadow-inner"><WeatherIcon className="h-5 w-5 text-primary" /></div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
          <EnvironmentStat icon={WeatherIcon} label="Weather" value={capitalize(environment.weather)} />
          <EnvironmentStat icon={SunMedium} label="Season" value={capitalize(environment.season)} />
          <EnvironmentStat icon={ThermometerSun} label="Temperature" value={`${environment.temperatureC}°C`} />
          <EnvironmentStat icon={Map} label="Map layer" value={mapLabel(environment.mapMode)} />
        </div>
      </div>

      <div className="grid gap-3">
        <Field label="Scene name">
          <Input className="h-8 text-xs" value={environment.sceneName} onChange={event => updateBoardEnvironment({ sceneName: event.target.value })} placeholder={`${city} scene`} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Weather">
            <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={environment.weather} onChange={event => updateBoardEnvironment({ weather: event.target.value as SceneWeather })}>
              {WEATHER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Season">
            <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={environment.season} onChange={event => updateBoardEnvironment({ season: event.target.value as SceneSeason })}>
              {SEASON_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Local time">
            <Input type="time" className="h-8 text-xs" value={environment.localTime} onChange={event => updateBoardEnvironment({ localTime: event.target.value })} />
          </Field>
          <Field label="Temperature °C">
            <Input type="number" min={-60} max={60} className="h-8 text-xs" value={environment.temperatureC} onChange={event => updateBoardEnvironment({ temperatureC: clampTemperature(event.target.value) })} />
          </Field>
        </div>

        <Field label="Map mode">
          <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={environment.mapMode} onChange={event => updateBoardEnvironment({ mapMode: event.target.value as SceneMapMode })}>
            {MAP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="rounded-md border border-dashed p-3 text-[10px] leading-relaxed text-muted-foreground">
        Environment state controls presentation and narrative context. Geographic truth remains in the selected Google/OSM world source, and a local fallback remains available when map services are unavailable.
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1"><Label className="text-[10px]">{label}</Label>{children}</div>;
}

function EnvironmentStat({ icon: Icon, label, value }: { icon: typeof Map; label: string; value: string }) {
  return <div className="rounded-lg border bg-background/55 p-2 shadow-inner"><Icon className="mb-1 h-3.5 w-3.5 text-primary" /><div className="text-muted-foreground">{label}</div><strong className="block truncate text-foreground">{value}</strong></div>;
}

function weatherIcon(weather: SceneWeather): typeof Map {
  if (weather === "rain") return CloudRain;
  if (weather === "fog" || weather === "cloudy") return CloudFog;
  if (weather === "snow") return Snowflake;
  return SunMedium;
}

function mapLabel(mode: SceneMapMode): string {
  if (mode === "google") return "Google";
  if (mode === "openstreetmap") return "OSM";
  return "Local";
}

function clampTemperature(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(-60, Math.min(60, parsed)) : 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
