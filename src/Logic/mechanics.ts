/**
 * Game Mechanics Definitions
 * 
 * Defines all collectible mechanics that affect location reachability in
 * the Celeste Archipelago randomizer.
 * 
 * Categories:
 * - Movement mechanics (dash refills, springs, feathers)
 * - Block types (cassette blocks, dream blocks, etc.)
 * - Enemies (bumpers, kevins, pufferfish)
 * - Key items (hotel keys, temple keys, etc.)
 * 
 * The MechanicsState type tracks which mechanics are currently available
 * to the player, which is used to calculate location reachability.
 * 
 * @module
 */

export const RANDOMIZED_MECHANICS = [
  "dashrefills",
  "springs",
  "trafficblocks",
  "pinkcassetteblocks",
  "bluecassetteblocks",
  "dreamblocks",
  "coins",
  "strawberryseeds",
  "sinkingplatforms",
  "movingplatforms",
  "blueclouds",
  "pinkclouds",
  "blueboosters",
  "redboosters",
  "moveblocks",
  "whiteblock",
  "swapblocks",
  "dashswitches",
  "torches",
  "theocrystal",
  "feathers",
  "bumpers",
  "kevins",
  "badelineboosters",
  "fireandiceballs",
  "coretoggles",
  "coreblocks",
  "pufferfish",
  "jellyfish",
  "doubledashrefills",
  "breakerboxes",
  "yellowcassetteblocks",
  "greencassetteblocks",
  "bird",
  "hasFrontDoorKey",
  "hasHallwayKey1",
  "hasHallwayKey2",
  "hasHugeMessKey",
  "hasPresidentialSuiteKey",
  "hasEntranceKey",
  "hasDepthsKey",
  "hasSearchKey1",
  "hasSearchKey2",
  "hasSearchKey3",
  "hasCentralChamberKey1",
  "hasCentralChamberKey2",
  "has2500MKey",
  "hasPowerSourceKey1",
  "hasPowerSourceKey2",
  "hasPowerSourceKey3",
  "hasPowerSourceKey4",
  "hasPowerSourceKey5",
  "noCondition"
] as const;

export type RandomizedMechanic = typeof RANDOMIZED_MECHANICS[number];
export type MechanicsState = Record<RandomizedMechanic, boolean>;
export type RandomizedMechanicsState = Record<RandomizedMechanic, boolean>;

export function createEmptyRandomizedMechanics(): RandomizedMechanicsState {
  return Object.fromEntries(
    RANDOMIZED_MECHANICS.map(m => [m, false])
  ) as RandomizedMechanicsState;
}

export interface SkillState {
  canWaveDash: boolean;
  canHyperDash: boolean;
  canWallBounce: boolean;
  canCornerBoost: boolean;
}