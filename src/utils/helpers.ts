/**
 * Utility functions for Celeste Tracker
 * Extracted from App.tsx for better code organization
 */

import type { MechanicsState } from "../Logic/mechanics";
import type { LocationDef, LocationState } from "../Data/locations";
import { MECHANIC_MAPPINGS } from "../Logic/mechanicsMapping";

/* ================================
   String Hashing
================================ */

/**
 * Generates a stable 32-bit integer hash from a string
 * Used for generating consistent numeric IDs from text
 */
export function simpleStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 1000000; // Limit to reasonable range
}

/* ================================
   Location & Chapter Helpers
================================ */

/** Map of chapter numbers to area names */
export const AREA_NAMES = [
  "Prologue",
  "Forsaken City",
  "Old Site",
  "Celestial Resort",
  "Golden Ridge",
  "Mirror Temple",
  "Reflection",
  "Summit",
  "Epilogue",
  "Core",
  "Farewell"
] as const;

/**
 * Gets the display name for a chapter number
 * @param chapter - Chapter number (0-10)
 * @returns Display name of the chapter
 */
export function getAreaName(chapter: number): string {
  return AREA_NAMES[chapter] ?? `Chapter ${chapter}`;
}

/**
 * Extracts the side (A/B/C) from a location ID or display name
 * @param id - Location ID or display name
 * @returns "A", "B", "C", or undefined
 */
export function extractSideFromId(id: string): string | undefined {
  // Try with spaces first (for display names)
  const spaceMatch = id.match(/(\s+)([ABC])(\s+-\s+)/);
  if (spaceMatch && spaceMatch[2]) {
    return spaceMatch[2];
  }

  // Try with underscores (for cleaned IDs)
  const underscoreMatch = id.match(/_([ABC])_/);
  if (underscoreMatch && underscoreMatch[1]) {
    return underscoreMatch[1];
  }

  // Check for patterns like "Old Site A" or "Celestial Resort B"
  const chapterMatch = id.match(/([ABC])\s+-\s+/);
  if (chapterMatch && chapterMatch[1]) {
    return chapterMatch[1];
  }

  return undefined;
}

/* ================================
   Location Type Detection
================================ */

/** Common checkpoint names in Celeste */
const CHECKPOINT_NAMES = [
  "shrine", "combination lock", "dream altar", "crossing", "chasm", "intervention", "awake",
  "contraption", "scrap pit", "elevator shaft", "huge mess", "presidential suite", "front door",
  "hallway", "staff quarters", "rooftop", "library", "old trail", "cliff face",
  "stepping stones", "gusty canyon", "eye of the storm", "search", "depths", "rescue",
  "unravelling", "mix master", "central chamber", "through the mirror", "hollows",
  "resolution", "reflection", "reprieve", "rock bottom", "hot and cold", "heart of the mountain",
  "into the core", "heartbeat", "burning or freezing", "farewell", "event horizon",
  "determination", "power source", "reconciliation", "remembered", "singular", "stubbornness"
] as const;

/**
 * Extracts the collectible type from a location display name
 * Used to determine if something is a strawberry, cassette, heart, key, etc.
 * @param displayName - Display name of the location
 * @returns Type string or undefined if not a collectible type
 */
export function extractTypeFromDisplayName(displayName: string): string | undefined {
  const lowerName = displayName.toLowerCase();

  // Check for golden strawberry BEFORE regular strawberry
  if (lowerName.includes("golden strawberry") || lowerName.includes("winged golden")) return "Golden Strawberry";
  if (lowerName.includes("strawberry")) return "Strawberry";
  if (lowerName.includes("cassette")) return "Cassette";
  if (lowerName.includes("heart")) return "Crystal Heart";
  if (lowerName.includes("key")) return "Key";
  if (lowerName.includes("moon berry")) return "Moon Berry";
  if (lowerName.includes("raspberry")) return "Raspberry";
  if (lowerName.includes("gem")) return "Gem";
  if (lowerName.includes("core") && lowerName.includes("crystal")) return "Crystal Heart";
  if (lowerName.includes("level clear")) return "Level Clear";

  // Check for checkpoints
  if (/\d+\s*m\b/i.test(displayName)) return "Checkpoint"; // e.g., "500 M", "1000 M"
  if (CHECKPOINT_NAMES.some(cp => lowerName.includes(cp))) return "Checkpoint";

  return undefined;
}

/**
 * Checks if a location definition is a collectible type (strawberry, heart, cassette, etc.)
 * @param loc - Location definition
 * @returns true if the location is a collectible type
 */
export function isCollectibleLocationDef(loc: LocationDef): boolean {
  return extractTypeFromDisplayName(loc.displayName) !== undefined;
}

/**
 * Checks if a location state is a collectible type
 * @param loc - Location state
 * @returns true if the location is a collectible type
 */
export function isCollectibleLocationState(loc: LocationState): boolean {
  return extractTypeFromDisplayName(loc.displayName) !== undefined;
}

/* ================================
   Logic & Mechanics Helpers
================================ */

/**
 * Extracts all required mechanic keys from a logic node
 * Recursively walks through AND/OR nodes to find all "has" keys
 * @param logic - Logic node to extract from
 * @returns Array of mechanic keys
 */
export function getRequiredKeysFromLogic(logic: any): string[] {
  const keys: string[] = [];

  if (logic.type === "has") {
    keys.push(logic.key);
  } else if (logic.type === "and" || logic.type === "or") {
    if (logic.nodes) {
      logic.nodes.forEach((node: any) => {
        keys.push(...getRequiredKeysFromLogic(node));
      });
    }
  }

  return keys;
}

/**
 * Gets the display name for a mechanic from its logic key
 * @param logicKey - The logic key (e.g., "dashrefills", "hasFrontDoorKey")
 * @returns Human-readable display name
 */
export function getMechanicDisplayName(logicKey: string): string {
  for (const mapping of Object.values(MECHANIC_MAPPINGS)) {
    if (mapping.logicKey === logicKey) {
      return mapping.display;
    }
  }

  // Fallback formatting for unknown keys
  const formatted = logicKey.replace(/([A-Z])/g, ' $1').trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Gets mechanic key from Archipelago item name
 * Supports exact matches, partial matches, and special cases
 * @param apName - Archipelago item name
 * @returns Logic key or null if no mapping found
 */
export function getMechanicKeyFromAPName(apName: string): keyof MechanicsState | null {
  console.log(`Looking for mapping for AP item: "${apName}"`);

  // First, try exact match in MECHANIC_MAPPINGS
  if (MECHANIC_MAPPINGS[apName]) {
    console.log(`Exact match found: "${apName}" -> "${MECHANIC_MAPPINGS[apName].logicKey}"`);
    return MECHANIC_MAPPINGS[apName].logicKey as keyof MechanicsState;
  }

  // Try to find a partial match
  for (const [apKey, mapping] of Object.entries(MECHANIC_MAPPINGS)) {
    if (apName.includes(apKey) || apKey.includes(apName)) {
      console.log(`Partial match found: "${apName}" matches "${apKey}" -> "${mapping.logicKey}"`);
      return mapping.logicKey as keyof MechanicsState;
    }
  }

  // Special handling for Dash Refills
  if (apName.includes("Dash Refill")) {
    return "dashrefills" as keyof MechanicsState;
  }

  // Check if it's a crystal heart
  if (apName.includes("Crystal Heart")) {
    return "crystalheart" as keyof MechanicsState;
  }

  console.log(`No mapping found for "${apName}"`);
  return null;
}

/**
 * Enhances AP name matching by handling known naming variations
 * @param apName - Raw AP item name
 * @returns Enhanced name with consistent formatting
 */
export function enhanceAPNameMatching(apName: string): string {
  let enhanced = apName;

  // Handle Golden Ridge naming differences
  if (apName.includes("Golden Ridge A - Room a-")) {
    enhanced = apName.replace("Golden Ridge A - Room a-", "Golden Ridge A - ");
  }
  if (apName.includes("Golden Ridge A - Room b-")) {
    enhanced = apName.replace("Golden Ridge A - Room b-", "Golden Ridge A - ");
  }
  if (apName.includes("Golden Ridge A - Room c-")) {
    enhanced = apName.replace("Golden Ridge A - Room c-", "Golden Ridge A - ");
  }
  if (apName.includes("Golden Ridge A - Room d-")) {
    enhanced = apName.replace("Golden Ridge A - Room d-", "Golden Ridge A - ");
  }

  // Handle Gem locations
  if (apName.includes("The Summit A - Gem")) {
    const gemNum = apName.match(/Gem (\d+)/)?.[1];
    if (gemNum) {
      enhanced = `The Summit A - Gem ${gemNum}`;
    }
  }

  // Normalize spacing
  enhanced = enhanced.replace(/Room\s+/g, "Room ");
  enhanced = enhanced.replace(/\s+-\s+/g, " - ");

  return enhanced;
}

/* ================================
   Parser Helpers
================================ */

/**
 * Parses various value types to boolean
 * Handles booleans, numbers, strings
 * @param value - Value to parse
 * @returns true or false
 */
export function parseBool(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return false;
}

/**
 * Parses farewell-specific values to boolean
 * Used for slot data parsing
 * @param value - Value to parse
 * @returns true or false
 */
export function parseFarewellValue(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    return value !== 'none' && value !== '0' && value !== '';
  }
  return false;
}

/** Goal mapping from various formats to normalized goal names */
export const GOAL_MAPPING: Record<string, string> = {
  '0': 'summit-a', '0a': 'summit-a',
  '1': 'summit-b', '1b': 'summit-b',
  '2': 'summit-c', '2c': 'summit-c',
  '3': 'core-a', '3a': 'core-a',
  '4': 'core-b', '4b': 'core-b',
  '5': 'core-c', '5c': 'core-c',
  '6': 'summit-a', '6a': 'summit-a',
  '7': 'core-a', '7a': 'summit-a',
  '8': 'farewell', '8a': 'farewell',
  '9': 'farewell-golden', '9g': 'farewell-golden',
  '10': 'farewell', '10a': 'farewell',
  'the_summit_a': 'summit-a',
  'the_summit_b': 'summit-b',
  'the_summit_c': 'summit-c',
  'the_core_a': 'core-a',
  'the_core_b': 'core-b',
  'the_core_c': 'core-c',
  'summit_a': 'summit-a',
  'summit_b': 'summit-b',
  'summit_c': 'summit-c',
  'core_a': 'core-a',
  'core_b': 'core-b',
  'core_c': 'core-c',
  'empty_space': 'empty-space',
  'farewell': 'farewell',
  'farewell_golden': 'farewell-golden'
} as const;

/**
 * Gets a unique UUID for this client, stored in localStorage
 * Used for Archipelago connection identification
 * @returns UUID string
 */
export function getClientUUID(): string {
  const key = "ap-client-uuid";
  let uuid = localStorage.getItem(key);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(key, uuid);
  }
  return uuid;
}
