import type { LogicNode } from "./types";

export type LocationDef = {
  id: string;
  apName: string;
  apItemId: number;
  chapter: number;
  displayName: string;
  type: "room" | "strawberry" | "cassette" | "heart" | "key" | "event" | "checkpoint";
  requires: string[];
};

export type LocationState = LocationDef & {
  checked: boolean;
  reachable: boolean;
  logic: LogicNode;
  apLocationId?: number;
  logicEvaluation?: {
    status: "free" | "sequence" | "locked";
    missing: string[];
  };
};

function inferType(name: string): LocationDef["type"] {
  // Check for Golden Strawberry FIRST before checking for "Golden" in the name
  if (name.includes("Golden Strawberry")) return "strawberry";
  if (name.includes("Winged Golden Strawberry")) return "strawberry";
  // Now check for regular strawberries (including those in "Golden Ridge")
  if (name.includes("Strawberry")) return "strawberry";
  if (name.includes("Cassette")) return "cassette";
  if (name.includes("Heart")) return "heart";
  if (name.includes("Key")) return "key";
  if (name.includes("Moon Berry")) return "strawberry"; // Special strawberry
  if (name.includes("Gem")) return "strawberry"; // Gems are like strawberries
  if (name.includes("Shrine")) return "checkpoint";
  if (name.includes("Combination Lock")) return "checkpoint";
  if (name.includes("Dream Altar")) return "checkpoint";
  if (name.includes("Level Clear")) return "event";
  if (name.includes(" M") && /\d+\s*M/.test(name)) return "checkpoint"; // e.g., "500 M", "1000 M"
  // Named checkpoints
  if (["Crossing", "Chasm", "Intervention", "Awake", "Contraption", "Scrap Pit",
      "Elevator Shaft", "Huge Mess", "Presidential Suite", "Front Door", "Hallway",
      "Staff Quarters", "Rooftop", "Library", "Old Trail", "Cliff Face",
      "Stepping Stones", "Gusty Canyon", "Eye of the Storm", "Search", "Depths",
      "Rescue", "Unravelling", "Mix Master", "Central Chamber", "Through the Mirror",
      "Hollows", "Resolution", "Reflection", "Reprieve", "Rock Bottom",
      "Hot and Cold", "Heart of the Mountain", "Into the Core", "Heartbeat",
      "Burning or Freezing", "Farewell", "Event Horizon", "Determination",
      "Power Source", "Reconciliation", "Remembered", "Singular", "Stubbornness"].some(cp => name.includes(cp))) {
    return "checkpoint";
  }
  return "room";
}

function inferChapter(name: string): number {
  if (name.startsWith("Prologue")) return 0;
  if (name.startsWith("Forsaken City")) return 1;
  if (name.startsWith("Old Site")) return 2;
  if (name.startsWith("Celestial Resort")) return 3;
  if (name.startsWith("Golden Ridge")) return 4;
  if (name.startsWith("Mirror Temple")) return 5;
  if (name.startsWith("Reflection")) return 6;
  if (name.startsWith("The Summit")) return 7;
  if (name.startsWith("Epilogue")) return 8;
  if (name.startsWith("Core")) return 9;
  if (name.startsWith("Farewell")) return 10;
  return -1;
}

// Generate a simple hash from string for apItemId
function simpleStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 1000000; // Limit to reasonable range
}

// Clean up ID by removing special characters
function cleanId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * RAW AP LOCATION LIST
 * Source: user-provided canonical list
 */
const RAW_LOCATIONS = [
  // Prologue
  "Prologue - Level Clear",
  
  // Forsaken City A
  "Forsaken City A - Chasm","Forsaken City A - Crossing",
  "Forsaken City A - Room 2 Strawberry","Forsaken City A - Room 3 Strawberry","Forsaken City A - Room 3b Strawberry","Forsaken City A - Room 5 Strawberry","Forsaken City A - Room 5z Strawberry","Forsaken City A - Room 5a Strawberry","Forsaken City A - Room 6 Strawberry","Forsaken City A - Room 7zb Strawberry","Forsaken City A - Room s1 Strawberry","Forsaken City A - Crystal Heart","Forsaken City A - Room 7z Strawberry","Forsaken City A - Room 8zb Strawberry","Forsaken City A - Room 7a Strawberry","Forsaken City A - Room 9z Strawberry","Forsaken City A - Room 8b Strawberry","Forsaken City A - Room 9 Strawberry","Forsaken City A - Room 9b Strawberry","Forsaken City A - Room 9c Strawberry","Forsaken City A - Room 10zb Strawberry","Forsaken City A - Room 11 Strawberry","Forsaken City A - Cassette","Forsaken City A - Room 12z Strawberry","Forsaken City A - Golden Strawberry","Forsaken City A - Winged Golden Strawberry","Forsaken City A - Level Clear",
  
  // Forsaken City B
  "Forsaken City B - Contraption","Forsaken City B - Scrap Pit","Forsaken City B - Golden Strawberry","Forsaken City B - Level Clear",
  
  // Forsaken City C
  "Forsaken City C - Golden Strawberry","Forsaken City C - Level Clear",
  
  // Old Site A
  "Old Site A - Awake","Old Site A - Intervention",
  "Old Site A - Crystal Heart","Old Site A - Room 1 Strawberry","Old Site A - Room d0 Strawberry","Old Site A - Room d3 Strawberry","Old Site A - Room d2 Strawberry 1","Old Site A - Room d2 Strawberry 2","Old Site A - Cassette","Old Site A - Room d1 Strawberry","Old Site A - Room d6 Strawberry","Old Site A - Room d4 Strawberry","Old Site A - Room d5 Strawberry","Old Site A - Room 4 Strawberry","Old Site A - Room 5 Strawberry","Old Site A - Room 8 Strawberry","Old Site A - Room 9 Strawberry","Old Site A - Room 9b Strawberry","Old Site A - Room 10 Strawberry","Old Site A - Room 12c Strawberry","Old Site A - Room 12d Strawberry","Old Site A - Room end_3c Strawberry","Old Site A - Golden Strawberry","Old Site A - Level Clear",
  
  // Old Site B
  "Old Site B - Combination Lock","Old Site B - Dream Altar","Old Site B - Golden Strawberry","Old Site B - Level Clear",
  
  // Old Site C
  "Old Site C - Golden Strawberry","Old Site C - Level Clear",
  
  // Celestial Resort A
  "Celestial Resort A - Front Door Key","Celestial Resort A - Hallway Key 1","Celestial Resort A - Hallway Key 2","Celestial Resort A - Huge Mess Key","Celestial Resort A - Presidential Suite Key",
  "Celestial Resort A - Elevator Shaft","Celestial Resort A - Huge Mess","Celestial Resort A - Presidential Suite",
  "Celestial Resort A - Room s2 Strawberry 1","Celestial Resort A - Room s2 Strawberry 2","Celestial Resort A - Room s3 Strawberry","Celestial Resort A - Room 00-a Strawberry","Celestial Resort A - Room 00-b Strawberry","Celestial Resort A - Room 04-b Strawberry","Celestial Resort A - Room 06-a Strawberry","Celestial Resort A - Room 07-b Strawberry","Celestial Resort A - Room 06-b Strawberry","Celestial Resort A - Room 06-c Strawberry","Celestial Resort A - Room 05-c Strawberry","Celestial Resort A - Room 12-y Strawberry","Celestial Resort A - Room 10-y Strawberry","Celestial Resort A - Crystal Heart","Celestial Resort A - Room 12-c Strawberry","Celestial Resort A - Room 11-d Strawberry","Celestial Resort A - Room 13-b Strawberry","Celestial Resort A - Room 13-x Strawberry","Celestial Resort A - Room 08-x Strawberry","Celestial Resort A - Room 06-d Strawberry","Celestial Resort A - Room 04-c Strawberry","Celestial Resort A - Room 03-b Strawberry 1","Celestial Resort A - Room 03-b Strawberry 2","Celestial Resort A - Cassette","Celestial Resort A - Room roof03 Strawberry","Celestial Resort A - Room roof06 Strawberry 1","Celestial Resort A - Room roof06 Strawberry 2","Celestial Resort A - Golden Strawberry","Celestial Resort A - Level Clear",
  
  // Celestial Resort B
  "Celestial Resort B - Library","Celestial Resort B - Rooftop","Celestial Resort B - Staff Quarters","Celestial Resort B - Golden Strawberry","Celestial Resort B - Level Clear",
  
  // Celestial Resort C
  "Celestial Resort C - Golden Strawberry","Celestial Resort C - Level Clear",
  
  // Golden Ridge A
  "Golden Ridge A - Cliff Face","Golden Ridge A - Old Trail",
  "Golden Ridge A - Cassette","Golden Ridge A - Shrine","Golden Ridge A - Crystal Heart",
  "Golden Ridge A - Room a-01x Strawberry","Golden Ridge A - Room a-02 Strawberry","Golden Ridge A - Room a-03 Strawberry","Golden Ridge A - Room a-04 Strawberry","Golden Ridge A - Room a-06 Strawberry","Golden Ridge A - Room a-07 Strawberry","Golden Ridge A - Room a-10 Strawberry","Golden Ridge A - Room a-09 Strawberry","Golden Ridge A - Room b-01 Strawberry 1","Golden Ridge A - Room b-01 Strawberry 2","Golden Ridge A - Room b-04 Strawberry","Golden Ridge A - Room b-07 Strawberry","Golden Ridge A - Room b-03 Strawberry","Golden Ridge A - Room b-02 Strawberry 1","Golden Ridge A - Room b-02 Strawberry 2","Golden Ridge A - Room b-secb Strawberry","Golden Ridge A - Room b-08 Strawberry","Golden Ridge A - Room c-00 Strawberry","Golden Ridge A - Room c-01 Strawberry","Golden Ridge A - Room c-05 Strawberry","Golden Ridge A - Room c-06 Strawberry","Golden Ridge A - Room c-06b Strawberry","Golden Ridge A - Room c-08 Strawberry","Golden Ridge A - Room c-10 Strawberry","Golden Ridge A - Room d-00b Strawberry","Golden Ridge A - Room d-01 Strawberry","Golden Ridge A - Room d-04 Strawberry","Golden Ridge A - Room d-07 Strawberry","Golden Ridge A - Room d-09 Strawberry","Golden Ridge A - Golden Strawberry","Golden Ridge A - Level Clear",
  
  // Golden Ridge B
  "Golden Ridge B - Eye of the Storm","Golden Ridge B - Gusty Canyon","Golden Ridge B - Stepping Stones","Golden Ridge B - Golden Strawberry","Golden Ridge B - Level Clear",
  
  // Golden Ridge C
  "Golden Ridge C - Golden Strawberry","Golden Ridge C - Level Clear",
  
  // Mirror Temple A
  "Mirror Temple A - Entrance Key","Mirror Temple A - Depths Key",
  "Mirror Temple A - Search Key 1","Mirror Temple A - Search Key 2","Mirror Temple A - Search Key 3",
  "Mirror Temple A - Depths","Mirror Temple A - Rescue","Mirror Temple A - Search","Mirror Temple A - Unravelling",
  "Mirror Temple A - Room a-00x Strawberry","Mirror Temple A - Room a-01 Strawberry 1","Mirror Temple A - Room a-01 Strawberry 2","Mirror Temple A - Room a-02 Strawberry","Mirror Temple A - Room a-03 Strawberry","Mirror Temple A - Room a-04 Strawberry","Mirror Temple A - Room a-05 Strawberry","Mirror Temple A - Room a-06 Strawberry","Mirror Temple A - Room a-07 Strawberry","Mirror Temple A - Room a-11 Strawberry","Mirror Temple A - Room a-15 Strawberry","Mirror Temple A - Room a-14 Strawberry","Mirror Temple A - Room b-18 Strawberry","Mirror Temple A - Room b-01c Strawberry","Mirror Temple A - Room b-20 Strawberry 1","Mirror Temple A - Room b-20 Strawberry 2","Mirror Temple A - Room b-21 Strawberry","Mirror Temple A - Room b-03 Strawberry","Mirror Temple A - Room b-05 Strawberry","Mirror Temple A - Room b-10 Strawberry","Mirror Temple A - Room b-12 Strawberry","Mirror Temple A - Room b-17 Strawberry 1","Mirror Temple A - Room b-17 Strawberry 2","Mirror Temple A - Cassette","Mirror Temple A - Crystal Heart","Mirror Temple A - Room c-08 Strawberry","Mirror Temple A - Room d-04 Strawberry 1","Mirror Temple A - Room d-04 Strawberry 2","Mirror Temple A - Room d-15 Strawberry 1","Mirror Temple A - Room d-15 Strawberry 2","Mirror Temple A - Room d-13 Strawberry","Mirror Temple A - Room d-19 Strawberry","Mirror Temple A - Room e-06 Strawberry","Mirror Temple A - Golden Strawberry","Mirror Temple A - Level Clear",
  
  // Mirror Temple B
  "Mirror Temple B - Central Chamber Key 1","Mirror Temple B - Central Chamber Key 2",
  "Mirror Temple B - Central Chamber","Mirror Temple B - Mix Master","Mirror Temple B - Through the Mirror","Mirror Temple B - Golden Strawberry","Mirror Temple B - Level Clear",
  
  // Mirror Temple C
  "Mirror Temple C - Golden Strawberry","Mirror Temple C - Level Clear",
  
  // Reflection A
  "Reflection A - Hollows","Reflection A - Reflection","Reflection A - Resolution","Reflection A - Rock Bottom",
  "Reflection A - Crystal Heart","Reflection A - Cassette","Reflection A - Golden Strawberry","Reflection A - Level Clear",
  
  // Reflection B
  "Reflection B - Reflection","Reflection B - Reprieve","Reflection B - Rock Bottom","Reflection B - Golden Strawberry","Reflection B - Level Clear",
  
  // Reflection C
  "Reflection C - Golden Strawberry","Reflection C - Level Clear",
  
  // The Summit A
  "The Summit A - 500 M","The Summit A - 1000 M","The Summit A - 1500 M","The Summit A - 2000 M","The Summit A - 2500 M","The Summit A - 2500 M Key","The Summit A - 3000 M",
  "The Summit A - Room a-02b Strawberry","The Summit A - Room a-04b Strawberry 1","The Summit A - Room a-04b Strawberry 2","The Summit A - Room a-05 Strawberry","The Summit A - Room b-02 Strawberry","The Summit A - Room b-02b Strawberry","The Summit A - Room b-02e Strawberry","The Summit A - Room b-04 Strawberry","The Summit A - Room b-08 Strawberry","The Summit A - Room b-09 Strawberry","The Summit A - Room c-03b Strawberry","The Summit A - Room c-05 Strawberry","The Summit A - Room c-06b Strawberry","The Summit A - Room c-07b Strawberry","The Summit A - Room c-08 Strawberry","The Summit A - Room c-09 Strawberry","The Summit A - Room d-00 Strawberry","The Summit A - Room d-01c Strawberry","The Summit A - Room d-01d Strawberry","The Summit A - Room d-03 Strawberry","The Summit A - Cassette","The Summit A - Room d-04 Strawberry","The Summit A - Room d-07 Strawberry","The Summit A - Room d-08 Strawberry","The Summit A - Room d-10b Strawberry","The Summit A - Room e-02 Strawberry","The Summit A - Room e-05 Strawberry","The Summit A - Room e-07 Strawberry","The Summit A - Room e-09 Strawberry","The Summit A - Room e-11 Strawberry","The Summit A - Room e-12 Strawberry","The Summit A - Room e-10 Strawberry","The Summit A - Room e-13 Strawberry","The Summit A - Room f-00 Strawberry","The Summit A - Room f-01 Strawberry","The Summit A - Room f-07 Strawberry","The Summit A - Room f-08b Strawberry","The Summit A - Room f-08c Strawberry","The Summit A - Room f-11 Strawberry 1","The Summit A - Room f-11 Strawberry 2","The Summit A - Room f-11 Strawberry 3","The Summit A - Crystal Heart","The Summit A - Room g-00b Strawberry 1","The Summit A - Room g-00b Strawberry 2","The Summit A - Room g-00b Strawberry 3","The Summit A - Room g-01 Strawberry 1","The Summit A - Room g-01 Strawberry 2","The Summit A - Room g-01 Strawberry 3","The Summit A - Room g-03 Strawberry","The Summit A - Golden Strawberry",
  "The Summit A - Gem 1","The Summit A - Gem 2","The Summit A - Gem 3","The Summit A - Gem 4","The Summit A - Gem 5","The Summit A - Gem 6",
  "The Summit A - Level Clear",
  
  // The Summit B
  "The Summit B - 500 M","The Summit B - 1000 M","The Summit B - 1500 M","The Summit B - 2000 M","The Summit B - 2500 M","The Summit B - 3000 M","The Summit B - Golden Strawberry","The Summit B - Level Clear",
  
  // The Summit C
  "The Summit C - Golden Strawberry","The Summit C - Level Clear",
  
  // Core A
  "Core A - Heart of the Mountain","Core A - Hot and Cold","Core A - Into the Core",
  "Core A - Room b-06 Strawberry","Core A - Room c-00b Strawberry","Core A - Room c-02 Strawberry","Core A - Room c-03b Strawberry","Core A - Room d-06 Strawberry","Core A - Cassette","Core A - Golden Strawberry","Core A - Level Clear",
  
  // Core B
  "Core B - Burning or Freezing","Core B - Heartbeat","Core B - Into the Core","Core B - Golden Strawberry","Core B - Level Clear",
  
  // Core C
  "Core C - Golden Strawberry","Core C - Level Clear",
  
  // Farewell
  "Farewell - Determination","Farewell - Event Horizon","Farewell - Farewell","Farewell - Power Source","Farewell - Reconciliation","Farewell - Remembered","Farewell - Singular","Farewell - Stubbornness",
  "Farewell - Power Source Key 1","Farewell - Power Source Key 2","Farewell - Power Source Key 3","Farewell - Power Source Key 4","Farewell - Power Source Key 5",
  "Farewell - Crystal Heart?","Farewell - Moon Berry","Farewell - Golden Strawberry","Farewell - Level Clear"
];

export const LOCATIONS: LocationDef[] = RAW_LOCATIONS.map(name => ({
  id: cleanId(name),
  apName: name,
  apItemId: simpleStringHash(name), // Generate a stable numeric ID
  displayName: name,
  chapter: inferChapter(name),
  type: inferType(name),
  requires: [] // ← intentionally empty for now
}));

// Helper function to find location by ID
export function getLocationById(id: string): LocationDef | undefined {
  return LOCATIONS.find(loc => loc.id === id);
}

// Helper function to find location by AP name
export function getLocationByApName(apName: string): LocationDef | undefined {
  return LOCATIONS.find(loc => loc.apName === apName);
}

// Helper function to get locations by chapter
export function getLocationsByChapter(chapter: number): LocationDef[] {
  return LOCATIONS.filter(loc => loc.chapter === chapter);
}

// Helper function to get locations by type
export function getLocationsByType(type: LocationDef["type"]): LocationDef[] {
  return LOCATIONS.filter(loc => loc.type === type);
}