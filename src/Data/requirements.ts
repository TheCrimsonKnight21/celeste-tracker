import { LOCATIONS } from "./locations";
import { MECHANIC_MAPPINGS, ALL_LOGIC_KEYS } from "../Logic/mechanicsMapping";

// Minimal subset of the JSON structure we care about
interface CelesteLevelData {
  levels: Level[];
}

// simple patterns used when JSON names omit chapter prefix for keys
const KEY_PATTERNS: { pattern: string; logicKey: string }[] = [
  { pattern: 'front door key', logicKey: 'hasFrontDoorKey' },
  { pattern: 'hallway key 1', logicKey: 'hasHallwayKey1' },
  { pattern: 'hallway key 2', logicKey: 'hasHallwayKey2' },
  { pattern: 'huge mess key', logicKey: 'hasHugeMessKey' },
  { pattern: 'presidential suite key', logicKey: 'hasPresidentialSuiteKey' },
  { pattern: 'entrance key', logicKey: 'hasEntranceKey' },
  { pattern: 'depths key', logicKey: 'hasDepthsKey' },
  { pattern: 'search key 1', logicKey: 'hasSearchKey1' },
  { pattern: 'search key 2', logicKey: 'hasSearchKey2' },
  { pattern: 'search key 3', logicKey: 'hasSearchKey3' },
  { pattern: 'central chamber key 1', logicKey: 'hasCentralChamberKey1' },
  { pattern: 'central chamber key 2', logicKey: 'hasCentralChamberKey2' },
  { pattern: '2500 m key', logicKey: 'has2500MKey' },
  { pattern: 'power source key 1', logicKey: 'hasPowerSourceKey1' },
  { pattern: 'power source key 2', logicKey: 'hasPowerSourceKey2' },
  { pattern: 'power source key 3', logicKey: 'hasPowerSourceKey3' },
  { pattern: 'power source key 4', logicKey: 'hasPowerSourceKey4' },
  { pattern: 'power source key 5', logicKey: 'hasPowerSourceKey5' },
];
interface Level {
  name: string;
  display_name: string;
  rooms: Room[];
}
interface Room {
  name: string;
  regions: Region[];
}
interface Region {
  name: string;
  locations?: Location[];
}
interface Location {
  name: string;
  display_name: string;
  type: string;
  rule: string[][];
}

// Build a lookup table that maps a normalized AP name (or derived key) to the
// corresponding logicKey defined in MECHANIC_MAPPINGS.  We lowercase and strip
// non-alphanumeric characters when normalizing so that simple string
// comparisons later are case-insensitive and not sensitive to spaces/punctuation.
function buildMechanicLookup(): Record<string, string> {
  const lookup: Record<string, string> = {};

  for (const [apName, mapping] of Object.entries(MECHANIC_MAPPINGS)) {
    const norm = apName.toLowerCase().replace(/[^a-z0-9]/g, "");
    lookup[norm] = mapping.logicKey;
  }

  // also allow direct lookup by logic key (lowercased) in case we already
  // compute a candidate key earlier
  for (const lk of ALL_LOGIC_KEYS) {
    lookup[lk.toLowerCase()] = lk;
  }

  return lookup;
}

// Convert a single JSON mechanic string (as found in a rule) into our
// in-app logic key.  Returns null if the name could not be mapped.
function mapJsonMechanicName(name: string, lookup: Record<string, string>): string | null {
  // normalize the incoming name
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // direct match
  if (lookup[norm]) {
    return lookup[norm];
  }

  // many of the "key" requirements in JSON are expressed without the
  // "has" prefix, so try adding it and look again
  const hasCandidate = `has${norm}`;
  if (lookup[hasCandidate]) {
    return lookup[hasCandidate];
  }

  // ignore purely decorative or irrelevant requirements that appear in the
  // JSON but don't translate to any logic key we care about.  These include
  // gem counters, clutter types, and "kevin blocks" which are just a
  // visual/physics element in-game.
  if (norm.startsWith("gem")) {
    return null;
  }
  if (norm.endsWith("clutter")) {
    return null;
  }
  if (norm === "kevinblocks") {
    return null;
  }

  // special cases that don't normalise cleanly
  switch (norm) {
    case "fireiceballs":
      return lookup["fireandiceballs"] || null; // Fire and Ice
    // nothing else known at the moment
  }

  return null;
}

/**
 * Fetches the Celeste level data JSON from the parser repository, parses it,
 * and returns a mapping from AP location name ➜ array of logic keys that must
 * be satisfied to reach that location.
 *
 * Only locations that already exist in `LOCATIONS` are returned; anything else
 * is ignored (binoculars, clutter, etc.).
 */
export async function buildRuleMap(): Promise<Record<string, string[]>> {
  // Try the local copy first.  This is what developers will edit directly
  // and it also avoids network/CORS issues when running the tracker on a
  // filesystem or offline.
  let json: CelesteLevelData | null = null;
  try {
    const respLocal = await fetch("/CelesteLevelData.json");
    if (respLocal.ok) {
      json = (await respLocal.json()) as CelesteLevelData;
      console.log("Loaded CelesteLevelData.json from local public folder");
    }
  } catch (err) {
    console.warn("Local CelesteLevelData.json fetch failed", err);
  }

  // if local copy did not succeed, fall back to the github data
  if (!json) {
    const url =
      "https://raw.githubusercontent.com/matthewjaykoster/Celeste-LevelData-Parser/main/data/CelesteLevelData.json";
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        json = (await resp.json()) as CelesteLevelData;
        console.log("Loaded CelesteLevelData.json from remote url");
      } else {
        console.warn("Failed to download CelesteLevelData.json", resp.status);
      }
    } catch (err) {
      console.warn("Network error while fetching level data", err);
    }
  }

  if (!json) {
    console.error("Unable to load Celeste level data from remote or local");
    return {};
  }

  const apNameSet = new Set(LOCATIONS.map((l) => l.apName));
  const lookup = buildMechanicLookup();
  const ruleMap: Record<string, string[]> = {};
  const unmappedMechanics = new Set<string>();

  json.levels.forEach((lvl) => {
    const levelDisplay = lvl.display_name;

    lvl.rooms.forEach((room) => {
      const roomName = room.name;

      room.regions.forEach((reg) => {
        (reg.locations || []).forEach((loc) => {
          let suffix: string;
          // use same naming strategy that the raw list uses
          if (loc.type === "strawberry") {
            suffix = `Room ${roomName} ${loc.display_name}`;
          } else {
            suffix = loc.display_name;
          }
          const apName = `${levelDisplay} - ${suffix}`;

          if (!apNameSet.has(apName)) {
            // location not tracked by our app, skip it
            return;
          }

          const rule = loc.rule && loc.rule.length > 0 ? loc.rule[0] : [];
          const logicKeys: string[] = [];
          rule.forEach((mech) => {
            const key = mapJsonMechanicName(mech, lookup);
            if (key) {
              logicKeys.push(key);
            } else {
              unmappedMechanics.add(mech);
              console.warn(`unmapped mechanic '${mech}' for location '${apName}'`);
            }
          });

          ruleMap[apName] = logicKeys;
        });
      });
    });
  });

  // copy rules from A sides to B/C sides when no explicit rule exists.
  // this helps ensure the tracker still gates B/C checks even if the JSON
  // file only contains the A-side entries.
  Object.keys(ruleMap).forEach((name) => {
    if (name.includes(' A - ')) {
      [' B - ', ' C - '].forEach((side) => {
        const other = name.replace(' A - ', side);
        if (!ruleMap[other]) {
          ruleMap[other] = [...ruleMap[name]];
        }
      });
    }
  });

  if (unmappedMechanics.size > 0) {
    console.warn("Unmapped mechanics encountered:", Array.from(unmappedMechanics).join(", "));
  }

  return ruleMap;
}

/**
 * Apply a rule map produced by {@link buildRuleMap} to the mutable
 * `LOCATIONS` array.  This mutates the objects in place (they are copied
 * later when the app initializes state) so callers should fetch the map and
 * immediately run this before anything else reads LOCATIONS.
 */
export function applyRuleMap(ruleMap: Record<string, string[]>) {
  LOCATIONS.forEach((loc) => {
    loc.requires = ruleMap[loc.apName] || [];
  });
}
