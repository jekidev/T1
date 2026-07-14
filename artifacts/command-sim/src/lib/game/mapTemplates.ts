// Stylized, non-operational map geometry for real-world-inspired location templates.
// Coordinates are in the same 0-1000 normalized space as BoardEntity/BoardZone.
// These are illustrative abstractions, not real surveyed map data.

export type MapShapeCategory =
  | "water"
  | "road"
  | "rail"
  | "block"
  | "park"
  | "landmark";

export interface MapShape {
  category: MapShapeCategory;
  // Either a rect (x,y,w,h) or a polygon (points). Renderer supports both.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  label?: string;
}

export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  shapes: MapShape[];
}

function grid(x: number, y: number, w: number, h: number): MapShape {
  return { category: "block", x, y, width: w, height: h };
}

export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: "copenhagen-center",
    name: "Copenhagen City Center",
    description:
      "Dense historic core with canals, plazas, and mixed pedestrian/vehicle streets.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "water", points: [[0, 780], [1000, 820], [1000, 1000], [0, 1000]], label: "Harbor Canal" },
      { category: "road", x: 0, y: 300, width: 1000, height: 28, label: "Strøget Avenue" },
      { category: "road", x: 480, y: 0, width: 28, height: 780, label: "Rådhuspladsen Axis" },
      { category: "road", x: 0, y: 560, width: 1000, height: 22 },
      { category: "park", x: 60, y: 60, width: 220, height: 160, label: "King's Garden" },
      { category: "landmark", x: 430, y: 250, width: 120, height: 90, label: "City Hall Square" },
      grid(60, 340, 380, 200),
      grid(560, 340, 380, 200),
      grid(60, 600, 380, 160),
      grid(560, 600, 380, 160),
      { category: "landmark", x: 700, y: 120, width: 140, height: 100, label: "Nyhavn Waterfront" },
    ],
  },
  {
    id: "norrebro",
    name: "Nørrebro District",
    description:
      "Mixed residential and commercial neighborhood with narrow streets, courtyards, and a large public cemetery/park.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "park", x: 620, y: 60, width: 320, height: 380, label: "Assistens Cemetery Park" },
      { category: "road", x: 0, y: 480, width: 1000, height: 26, label: "Nørrebrogade" },
      { category: "road", x: 300, y: 0, width: 24, height: 1000 },
      { category: "road", x: 0, y: 200, width: 1000, height: 20 },
      grid(40, 40, 220, 140),
      grid(40, 240, 220, 220),
      grid(340, 40, 240, 420),
      grid(340, 540, 240, 220),
      grid(40, 540, 240, 220),
      grid(40, 800, 540, 160),
      { category: "landmark", x: 640, y: 620, width: 160, height: 100, label: "Community Center" },
    ],
  },
  {
    id: "industrial-harbor",
    name: "Industrial Harbor",
    description:
      "Working waterfront with container yards, warehouses, rail spurs, and restricted-access docks.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "water", x: 0, y: 0, width: 1000, height: 260, label: "Harbor Basin" },
      { category: "road", x: 0, y: 300, width: 1000, height: 24, label: "Port Access Road" },
      { category: "rail", x: 0, y: 400, width: 1000, height: 14, label: "Freight Spur" },
      grid(40, 360, 200, 260, ),
      grid(280, 360, 200, 260),
      grid(520, 360, 200, 260),
      grid(760, 360, 200, 260),
      { category: "landmark", x: 40, y: 700, width: 260, height: 200, label: "Container Yard" },
      { category: "landmark", x: 360, y: 700, width: 260, height: 200, label: "Warehouse Row" },
      { category: "landmark", x: 700, y: 700, width: 260, height: 200, label: "Restricted Dock" },
    ],
  },
  {
    id: "suburban-district",
    name: "Suburban District",
    description:
      "Low-density residential blocks, cul-de-sacs, a school zone, and a strip retail corridor.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "road", x: 0, y: 480, width: 1000, height: 22, label: "Main Corridor" },
      { category: "road", x: 200, y: 0, width: 18, height: 1000 },
      { category: "road", x: 780, y: 0, width: 18, height: 1000 },
      { category: "park", x: 420, y: 40, width: 200, height: 160, label: "Community Park" },
      { category: "landmark", x: 60, y: 60, width: 100, height: 80, label: "School" },
      grid(40, 560, 180, 380),
      grid(260, 560, 180, 380),
      grid(560, 560, 180, 380),
      grid(820, 560, 140, 380),
      { category: "landmark", x: 300, y: 520, width: 400, height: 30, label: "Retail Strip" },
    ],
  },
  {
    id: "train-station",
    name: "Train Station Area",
    description:
      "Transit hub with platforms, concourse, surrounding transit-oriented development, and taxi/bus staging.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "landmark", x: 340, y: 380, width: 320, height: 220, label: "Station Concourse" },
      { category: "rail", x: 0, y: 440, width: 1000, height: 100, label: "Platform Tracks" },
      { category: "road", x: 0, y: 700, width: 1000, height: 24, label: "Station Boulevard" },
      { category: "road", x: 480, y: 0, width: 24, height: 380 },
      grid(40, 40, 380, 300),
      grid(560, 40, 400, 300),
      grid(40, 760, 400, 200),
      grid(520, 760, 440, 200),
      { category: "landmark", x: 700, y: 620, width: 160, height: 60, label: "Taxi / Bus Staging" },
    ],
  },
  {
    id: "custom",
    name: "Custom / Generic Map",
    description:
      "A blank stylized canvas with a light street grid — build any fictional location from scratch.",
    width: 1000,
    height: 1000,
    shapes: [
      { category: "road", x: 0, y: 330, width: 1000, height: 16 },
      { category: "road", x: 0, y: 660, width: 1000, height: 16 },
      { category: "road", x: 330, y: 0, width: 16, height: 1000 },
      { category: "road", x: 660, y: 0, width: 16, height: 1000 },
    ],
  },
];

export function getMapTemplate(id: string): MapTemplate {
  return MAP_TEMPLATES.find((t) => t.id === id) ?? MAP_TEMPLATES[MAP_TEMPLATES.length - 1];
}
