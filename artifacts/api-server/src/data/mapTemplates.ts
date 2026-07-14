// Metadata for built-in map templates. Must keep ids in sync with
// artifacts/command-sim/src/lib/game/mapTemplates.ts, which owns the full
// stylized shape geometry used for client-side rendering.

export interface MapTemplateMeta {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
}

export const MAP_TEMPLATES: MapTemplateMeta[] = [
  {
    id: "copenhagen-center",
    name: "Copenhagen City Center",
    description: "Dense historic core with canals, plazas, and mixed pedestrian/vehicle streets.",
    width: 1000,
    height: 1000,
  },
  {
    id: "norrebro",
    name: "Nørrebro District",
    description: "Mixed residential and commercial neighborhood with narrow streets, courtyards, and a large public park.",
    width: 1000,
    height: 1000,
  },
  {
    id: "industrial-harbor",
    name: "Industrial Harbor",
    description: "Working waterfront with container yards, warehouses, rail spurs, and restricted-access docks.",
    width: 1000,
    height: 1000,
  },
  {
    id: "suburban-district",
    name: "Suburban District",
    description: "Low-density residential blocks, cul-de-sacs, a school zone, and a strip retail corridor.",
    width: 1000,
    height: 1000,
  },
  {
    id: "train-station",
    name: "Train Station Area",
    description: "Transit hub with platforms, concourse, surrounding development, and taxi/bus staging.",
    width: 1000,
    height: 1000,
  },
  {
    id: "custom",
    name: "Custom / Generic Map",
    description: "A blank stylized canvas with a light street grid — build any fictional location from scratch.",
    width: 1000,
    height: 1000,
  },
];
