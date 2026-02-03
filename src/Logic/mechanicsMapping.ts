export interface MechanicMapping {
  logicKey: string;
  display: string;
}

export const MECHANIC_MAPPINGS: Record<string, MechanicMapping> = {
  // AP Name -> Mapping
  "Dash Refills": { logicKey: "dashrefills", display: "Dash Refills" },
  "Springs": { logicKey: "springs", display: "Springs" },
  "Traffic Blocks": { logicKey: "trafficblocks", display: "Traffic Blocks" },
  "Pink Cassette Blocks": { logicKey: "pinkcassetteblocks", display: "Pink Cassette Blocks" },
  "Blue Cassette Blocks": { logicKey: "bluecassetteblocks", display: "Blue Cassette Blocks" },
  "Dream Blocks": { logicKey: "dreamblocks", display: "Dream Blocks" },
  "Coins": { logicKey: "coins", display: "Coins" },
  "Strawberry Seeds": { logicKey: "strawberryseeds", display: "Strawberry Seeds" },
  "Sinking Platforms": { logicKey: "sinkingplatforms", display: "Sinking Platforms" },
  "Moving Platforms": { logicKey: "movingplatforms", display: "Moving Platforms" },
  "Blue Clouds": { logicKey: "blueclouds", display: "Blue Clouds" },
  "Pink Clouds": { logicKey: "pinkclouds", display: "Pink Clouds" },
  "Blue Boosters": { logicKey: "blueboosters", display: "Blue Boosters" },
  "Red Boosters": { logicKey: "redboosters", display: "Red Boosters" },
  "Move Blocks": { logicKey: "moveblocks", display: "Move Blocks" },
  "White Block": { logicKey: "whiteblock", display: "White Block" },
  "Swap Blocks": { logicKey: "swapblocks", display: "Swap Blocks" },
  "Dash Switches": { logicKey: "dashswitches", display: "Dash Switches" },
  "Torches": { logicKey: "torches", display: "Torches" },
  "Theo Crystal": { logicKey: "theocrystal", display: "Theo Crystal" },
  "Feathers": { logicKey: "feathers", display: "Feathers" },
  "Bumpers": { logicKey: "bumpers", display: "Bumpers" },
  "Kevins": { logicKey: "kevins", display: "Kevins" },
  "Badeline Boosters": { logicKey: "badelineboosters", display: "Badeline Boosters" },
  "Fire and Ice Balls": { logicKey: "fireandiceballs", display: "Fire and Ice Balls" },
  "Core Toggles": { logicKey: "coretoggles", display: "Core Toggles" },
  "Core Blocks": { logicKey: "coreblocks", display: "Core Blocks" },
  "Pufferfish": { logicKey: "pufferfish", display: "Pufferfish" },
  "Jellyfish": { logicKey: "jellyfish", display: "Jellyfish" },
  "Double Dash Refills": { logicKey: "doubledashrefills", display: "Double Dash Refills" },
  "Breaker Boxes": { logicKey: "breakerboxes", display: "Breaker Boxes" },
  "Yellow Cassette Blocks": { logicKey: "yellowcassetteblocks", display: "Yellow Cassette Blocks" },
  "Green Cassette Blocks": { logicKey: "greencassetteblocks", display: "Green Cassette Blocks" },
  "Bird": { logicKey: "bird", display: "Bird" },
  "Seekers": { logicKey: "seekers", display: "Seekers" },
  "Crystal Heart": { logicKey: "crystalheart", display: "Crystal Heart" },
  "Celestial Resort A - Front Door Key": { logicKey: "hasFrontDoorKey", display: "Front Door Key\n(Celestial Resort A)" },
  "Celestial Resort A - Hallway Key 1": { logicKey: "hasHallwayKey1", display: "Hallway Key 1\n(Celestial Resort A)" },
  "Celestial Resort A - Hallway Key 2": { logicKey: "hasHallwayKey2", display: "Hallway Key 2\n(Celestial Resort A)" },
  "Celestial Resort A - Huge Mess Key": { logicKey: "hasHugeMessKey", display: "Huge Mess Key\n(Celestial Resort A)" },
  "Celestial Resort A - Presidential Suite Key": { logicKey: "hasPresidentialSuiteKey", display: "Presidential Suite Key\n(Celestial Resort A)" },
  "Mirror Temple A - Entrance Key": { logicKey: "hasEntranceKey", display: "Entrance Key\n(Mirror Temple A)" },
  "Mirror Temple A - Depths Key": { logicKey: "hasDepthsKey", display: "Depths Key\n(Mirror Temple A)" },
  "Mirror Temple A - Search Key 1": { logicKey: "hasSearchKey1", display: "Search Key 1\n(Mirror Temple A)" },
  "Mirror Temple A - Search Key 2": { logicKey: "hasSearchKey2", display: "Search Key 2\n(Mirror Temple A)" },
  "Mirror Temple A - Search Key 3": { logicKey: "hasSearchKey3", display: "Search Key 3\n(Mirror Temple A)" },
  "Mirror Temple B - Central Chamber Key 1": { logicKey: "hasCentralChamberKey1", display: "Central Chamber Key 1\n(Mirror Temple B)" },
  "Mirror Temple B - Central Chamber Key 2": { logicKey: "hasCentralChamberKey2", display: "Central Chamber Key 2\n(Mirror Temple B)" },
  "The Summit A - 2500 M Key": { logicKey: "has2500MKey", display: "2500 M Key\n(The Summit A)" },
  "Farewell - Power Source Key 1": { logicKey: "hasPowerSourceKey1", display: "Power Source Key 1\n(Farewell)" },
  "Farewell - Power Source Key 2": { logicKey: "hasPowerSourceKey2", display: "Power Source Key 2\n(Farewell)" },
  "Farewell - Power Source Key 3": { logicKey: "hasPowerSourceKey3", display: "Power Source Key 3\n(Farewell)" },
  "Farewell - Power Source Key 4": { logicKey: "hasPowerSourceKey4", display: "Power Source Key 4\n(Farewell)" },
  "Farewell - Power Source Key 5": { logicKey: "hasPowerSourceKey5", display: "Power Source Key 5\n(Farewell)" },
  "No Condition": { logicKey: "noCondition", display: "No Condition" },
};

export function getLogicKeyFromAPName(apName: string): string | null {
  for (const [apKey, mapping] of Object.entries(MECHANIC_MAPPINGS)) {
    if (apName.includes(apKey)) {
      return mapping.logicKey;
    }
  }
  return null;
}

export function getDisplayNameFromLogicKey(logicKey: string): string {
  for (const mapping of Object.values(MECHANIC_MAPPINGS)) {
    if (mapping.logicKey === logicKey) {
      return mapping.display;
    }
  }
  return logicKey;
}

export function getAPNameFromLogicKey(logicKey: string): string | null {
  for (const [apKey, mapping] of Object.entries(MECHANIC_MAPPINGS)) {
    if (mapping.logicKey === logicKey) {
      return apKey;
    }
  }
  return null;
}

// Get all available logic keys for dropdowns
export const ALL_LOGIC_KEYS = Object.values(MECHANIC_MAPPINGS).map(m => m.logicKey);

// Get all display names for UI
export const ALL_DISPLAY_NAMES = Object.values(MECHANIC_MAPPINGS).map(m => m.display);