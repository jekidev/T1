import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation } from "wouter";
import {
  defaultBoundsAround,
  deriveDefaultGameplayRole,
  geoToLocal,
  type GeoBounds,
  type ImportedPlace,
  type PlacedWorldAsset,
  type PublicOsmCategory,
  type WorldChunk,
} from "@workspace/geo-world";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { loadWorldConfig } from "@/lib/world-config";
import { withClientSpan } from "@/lib/telemetry";
import { ArrowLeft, Database, Loader2, MapPinned, MousePointer2, RefreshCw, ShieldCheck } from "lucide-react";

interface StoredWorldRegion {
  id: string;
  importedAt: string;
  savedAt: string;
  source: "openstreetmap-overpass";
  attribution: string;
  bounds: GeoBounds;
  center: { latitude: number; longitude: number; altitude: number };
  areaSquareKilometers: number;
  categories: PublicOsmCategory[];
  features: ImportedPlace[];
  chunks: WorldChunk[];
}

interface StoredPlacement {
  regionId: string;
  asset: PlacedWorldAsset;
}

const CATEGORY_OPTIONS: PublicOsmCategory[] = [
  "roads",
  "buildings",
  "landuse",
  "restaurant",
  "shop",
  "hospital",
  "school",
  "cafe",
  "office",
  "warehouse",
  "parking",
  "station",
  "pharmacy",
  "park",
  "police",
];

const INITIAL_CATEGORIES: PublicOsmCategory[] = ["roads", "buildings", "shop", "cafe", "hospital", "station", "park"];
const VIEW_WIDTH = 1_000;
const VIEW_HEIGHT = 650;

export default function GeoLabPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const world = loadWorldConfig();
  const [latitude, setLatitude] = useState(world.latitude);
  const [longitude, setLongitude] = useState(world.longitude);
  const [radiusKm, setRadiusKm] = useState(0.65);
  const [categories, setCategories] = useState<PublicOsmCategory[]>(INITIAL_CATEGORIES);
  const [region, setRegion] = useState<StoredWorldRegion | null>(null);
  const [placements, setPlacements] = useState<StoredPlacement[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ImportedPlace | null>(null);
  const [importing, setImporting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [roleMessage, setRoleMessage] = useState("");

  const bounds = useMemo(() => defaultBoundsAround({ latitude, longitude, altitude: 0 }, radiusKm), [latitude, longitude, radiusKm]);

  const refreshPlacements = async (regionId: string) => {
    const response = await fetch(`/api/world/assets/placements?regionId=${encodeURIComponent(regionId)}`);
    const body = await response.json() as { placements?: StoredPlacement[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? `Placement request failed with HTTP ${response.status}.`);
    setPlacements(body.placements ?? []);
  };

  const importRegion = async () => {
    setImporting(true);
    setSelectedPlace(null);
    setRoleMessage("");
    try {
      const imported = await withClientSpan("game.world.import", {
        centerLatitude: latitude,
        centerLongitude: longitude,
        radiusKm,
        categories,
      }, async () => {
        const response = await fetch("/api/world/regions/import-osm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bounds, categories, chunkZoom: 15 }),
        });
        const body = await response.json() as { region?: StoredWorldRegion; error?: string };
        if (!response.ok || !body.region) throw new Error(body.error ?? `World import failed with HTTP ${response.status}.`);
        return body.region;
      });
      setRegion(imported);
      await refreshPlacements(imported.id);
      toast({
        title: "OSM region imported",
        description: `${imported.features.length} public features and ${imported.chunks.length} chunks saved.`,
      });
    } catch (error) {
      toast({ title: "World import failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const placeMarker = async (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!region || placing) return;
    if ((event.target as Element).closest("[data-feature-id]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * VIEW_WIDTH;
    const y = (event.clientY - rect.top) / rect.height * VIEW_HEIGHT;
    const geoPosition = unprojectPoint(x, y, region.bounds);
    const local = geoToLocal(geoPosition, region.center);
    const asset: PlacedWorldAsset = {
      id: crypto.randomUUID(),
      assetId: "builtin:map-marker",
      geoPosition,
      localTransform: {
        position: [local.x, local.y, local.z],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      gameRole: "decoration",
      placedBy: "local-player",
      createdAt: new Date().toISOString(),
      version: 1,
    };

    setPlacing(true);
    try {
      await withClientSpan("game.world.asset_placement", { regionId: region.id, assetId: asset.assetId }, async () => {
        const response = await fetch("/api/world/assets/placements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionId: region.id, asset }),
        });
        const body = await response.json() as { error?: string; issues?: string[] };
        if (!response.ok) throw new Error(body.error ?? body.issues?.join(" ") ?? `Placement failed with HTTP ${response.status}.`);
      });
      await refreshPlacements(region.id);
    } catch (error) {
      toast({ title: "Placement rejected", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  const deletePlacement = async (placement: StoredPlacement) => {
    try {
      const response = await fetch(
        `/api/world/assets/placements/${encodeURIComponent(placement.asset.id)}?regionId=${encodeURIComponent(placement.regionId)}&version=${placement.asset.version}`,
        { method: "DELETE" },
      );
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Delete failed with HTTP ${response.status}.`);
      await refreshPlacements(placement.regionId);
    } catch (error) {
      toast({ title: "Delete rejected", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const validateRole = async (role: "business" | "warehouse" | "safehouse" | "stashhouse" | "hospital" | "police" | "social_hub") => {
    if (!selectedPlace) return;
    setRoleMessage("");
    try {
      const response = await fetch("/api/world/locations/validate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place: selectedPlace,
          role: {
            placeId: selectedPlace.sourceId,
            role,
            fictionalized: role === "safehouse" || role === "stashhouse",
            assignedBy: "scenario",
          },
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Role validation failed with HTTP ${response.status}.`);
      setRoleMessage(`${role} is valid as a separate gameplay role. Public category remains ${selectedPlace.publicCategory}.`);
    } catch (error) {
      setRoleMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    if (!region) return;
    void refreshPlacements(region.id).catch(() => undefined);
  }, [region?.id]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-semibold">Geospatial World Lab</h1>
              <p className="text-xs text-muted-foreground">OSM/Overpass → chunks → public feature classification → authoritative placement</p>
            </div>
          </div>
          <Badge variant="outline">No Google Earth extraction</Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr_320px]">
          <Card>
            <CardHeader><CardTitle className="text-sm">Import region</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Latitude"><Input type="number" step="0.0001" value={latitude} onChange={event => setLatitude(Number(event.target.value))} /></Field>
              <Field label="Longitude"><Input type="number" step="0.0001" value={longitude} onChange={event => setLongitude(Number(event.target.value))} /></Field>
              <Field label="Radius km"><Input type="number" min="0.1" max="5" step="0.05" value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))} /></Field>
              <div className="space-y-2">
                <p className="text-xs font-medium">Public OSM categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map(category => {
                    const active = categories.includes(category);
                    return (
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className="h-7 text-[10px]"
                        onClick={() => setCategories(current => active ? current.filter(value => value !== category) : [...current, category])}
                      >
                        {category}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Button className="w-full" disabled={importing || categories.length === 0} onClick={() => void importRegion()}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Import and save region
              </Button>
              <div className="rounded border p-2 text-[10px] text-muted-foreground">
                Bounds: {bounds.south.toFixed(5)}, {bounds.west.toFixed(5)} → {bounds.north.toFixed(5)}, {bounds.east.toFixed(5)}
              </div>
              {region && (
                <div className="space-y-1 rounded border p-2 text-[10px]">
                  <div>Region: {region.id}</div>
                  <div>Features: {region.features.length}</div>
                  <div>Chunks: {region.chunks.length}</div>
                  <div>Area: {region.areaSquareKilometers.toFixed(2)} km²</div>
                  <div>{region.attribution}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tactical vector preview</CardTitle>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <MousePointer2 className="h-3.5 w-3.5" />Click empty space to place marker
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {region ? (
                <svg
                  viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                  className="h-[650px] w-full cursor-crosshair bg-muted/20"
                  onClick={event => void placeMarker(event)}
                  role="img"
                  aria-label="Imported OpenStreetMap vector preview"
                >
                  <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} className="fill-background" />
                  {region.features.map(feature => (
                    <FeatureShape
                      key={feature.sourceId}
                      feature={feature}
                      bounds={region.bounds}
                      selected={selectedPlace?.sourceId === feature.sourceId}
                      onSelect={() => setSelectedPlace(feature)}
                    />
                  ))}
                  {placements.map(placement => {
                    const point = projectPoint(placement.asset.geoPosition.longitude, placement.asset.geoPosition.latitude, region.bounds);
                    return (
                      <g key={placement.asset.id} onClick={event => { event.stopPropagation(); void deletePlacement(placement); }} className="cursor-pointer">
                        <circle cx={point.x} cy={point.y} r="10" className="fill-primary stroke-background" strokeWidth="3" />
                        <path d={`M ${point.x} ${point.y - 14} L ${point.x - 5} ${point.y - 5} L ${point.x + 5} ${point.y - 5} Z`} className="fill-primary" />
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex h-[650px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <MapPinned className="h-10 w-10" />Import a bounded region to create the world preview.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Feature and safety boundary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedPlace ? (
                <>
                  <div className="space-y-1 rounded border p-3 text-xs">
                    <div className="font-medium">{selectedPlace.name ?? "Unnamed public map feature"}</div>
                    <div>Source: {selectedPlace.sourceId}</div>
                    <div>Public category: <strong>{selectedPlace.publicCategory}</strong></div>
                    <div>Default game role: {deriveDefaultGameplayRole(selectedPlace).role}</div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Public category is immutable map data. Gameplay role is a separate scenario layer.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["business", "warehouse", "safehouse", "stashhouse", "hospital", "police", "social_hub"] as const).map(role => (
                      <Button key={role} size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void validateRole(role)}>{role}</Button>
                    ))}
                  </div>
                  {roleMessage && <div className="rounded border p-2 text-[10px]">{roleMessage}</div>}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Select an imported feature to inspect its public classification.</p>
              )}

              <div className="rounded border p-3 text-[10px] text-muted-foreground">
                <ShieldCheck className="mb-2 h-4 w-4" />
                Residential OSM names and address tags are stripped. Real residences cannot be tagged as safehouses or stashhouses. Those roles require a fictional, non-residential scenario assignment.
              </div>

              <div className="space-y-1 rounded border p-3 text-[10px]">
                <div className="flex items-center justify-between"><span>Saved placements</span><Button size="icon" variant="ghost" className="h-6 w-6" disabled={!region} onClick={() => region && void refreshPlacements(region.id)}><RefreshCw className="h-3.5 w-3.5" /></Button></div>
                {placements.length === 0 ? <span className="text-muted-foreground">None</span> : placements.map(item => (
                  <button key={item.asset.id} className="block w-full truncate text-left hover:underline" onClick={() => void deletePlacement(item)}>
                    {item.asset.assetId} · v{item.asset.version}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium">{label}</span>{children}</label>;
}

function FeatureShape({
  feature,
  bounds,
  selected,
  onSelect,
}: {
  feature: ImportedPlace;
  bounds: GeoBounds;
  selected: boolean;
  onSelect: () => void;
}) {
  const geometry = feature.geometry;
  const className = selected
    ? "stroke-primary fill-primary/30"
    : feature.publicCategory === "road"
      ? "stroke-muted-foreground/60 fill-none"
      : feature.publicCategory === "landuse" || feature.publicCategory === "park"
        ? "stroke-border fill-muted/50"
        : "stroke-border fill-muted-foreground/15";

  const common = {
    "data-feature-id": feature.sourceId,
    className: `${className} cursor-pointer`,
    onClick: (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); onSelect(); },
  };

  if (!geometry || geometry.type === "Point") {
    const point = projectPoint(feature.coordinates.longitude, feature.coordinates.latitude, bounds);
    return <circle {...common} cx={point.x} cy={point.y} r={selected ? 7 : 4} strokeWidth={selected ? 3 : 1.5} />;
  }
  if (geometry.type === "LineString") {
    const points = geometry.coordinates.map(([longitude, latitude]) => projectPoint(longitude, latitude, bounds));
    return <polyline {...common} points={points.map(point => `${point.x},${point.y}`).join(" ")} strokeWidth={selected ? 4 : 1.5} vectorEffect="non-scaling-stroke" />;
  }
  const ring = geometry.coordinates[0] ?? [];
  const points = ring.map(([longitude, latitude]) => projectPoint(longitude, latitude, bounds));
  return <polygon {...common} points={points.map(point => `${point.x},${point.y}`).join(" ")} strokeWidth={selected ? 3 : 1} vectorEffect="non-scaling-stroke" />;
}

function projectPoint(longitude: number, latitude: number, bounds: GeoBounds): { x: number; y: number } {
  return {
    x: (longitude - bounds.west) / (bounds.east - bounds.west) * VIEW_WIDTH,
    y: (bounds.north - latitude) / (bounds.north - bounds.south) * VIEW_HEIGHT,
  };
}

function unprojectPoint(x: number, y: number, bounds: GeoBounds): { latitude: number; longitude: number; altitude: number } {
  return {
    longitude: bounds.west + x / VIEW_WIDTH * (bounds.east - bounds.west),
    latitude: bounds.north - y / VIEW_HEIGHT * (bounds.north - bounds.south),
    altitude: 0,
  };
}
