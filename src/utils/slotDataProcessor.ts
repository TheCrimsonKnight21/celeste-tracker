/**
 * Slot Data Processing
 * Handles Archipelago server configuration and slot data
 */

import { GOAL_MAPPING, parseBool, parseFarewellValue } from "./helpers";

/**
 * Processes slot data from Archipelago server and applies settings
 * Updates multiple setter functions based on server configuration
 */
export function processSlotData(
  slotData: any,
  setters: {
    setSelectedGoal: (goal: string) => void;
    setLockGoalArea: (lock: boolean) => void;
    setIncludeBSides: (include: boolean) => void;
    setIncludeCSides: (include: boolean) => void;
    setIncludeGoldenStrawberries: (include: boolean) => void;
    setIncludeCore: (include: boolean) => void;
    setIncludeFarewell: (include: boolean) => void;
    setIncludeCheckpoints: (include: boolean) => void;
    setBinosanity: (val: boolean) => void;
    setKeysanity: (val: boolean) => void;
    setGemsanity: (val: boolean) => void;
    setCarsanity: (val: boolean) => void;
    setGoalStrawberryRequirement: (req: number) => void;
  },
  addLog: (message: string) => void
) {
  // Apply goal setting
  if (slotData.goal_area !== undefined) {
    const goalValue = String(slotData.goal_area).toLowerCase().replace(/-/g, '_');
    const mappedGoal = GOAL_MAPPING[goalValue];
    if (mappedGoal) {
      setters.setSelectedGoal(mappedGoal);
      addLog(`🎯 Server: Set goal to ${mappedGoal}`);
    }
  }

  // Apply lock_goal_area setting
  if (slotData.lock_goal_area !== undefined) {
    const lockVal = parseBool(slotData.lock_goal_area);
    setters.setLockGoalArea(lockVal);
    addLog(`🔒 Server: Goal area lock ${lockVal ? 'enabled' : 'disabled'}`);
  }

  // Apply side selection settings
  if (slotData.include_b_sides !== undefined || slotData.include_c_sides !== undefined) {
    const includeBSides = parseBool(slotData.include_b_sides);
    const includeCSides = parseBool(slotData.include_c_sides);
    setters.setIncludeBSides(includeBSides);
    setters.setIncludeCSides(includeCSides);
    addLog(`⚙️ Server: B sides ${includeBSides ? 'enabled' : 'disabled'}, C sides ${includeCSides ? 'enabled' : 'disabled'}`);
  }

  // Apply golden strawberry setting
  if (slotData.include_goldens !== undefined) {
    const includeGoldens = parseBool(slotData.include_goldens);
    setters.setIncludeGoldenStrawberries(includeGoldens);
    addLog(`⚙️ Server: Goldens ${includeGoldens ? 'enabled' : 'disabled'}`);
  }

  // Apply Core chapter setting
  if (slotData.include_core !== undefined) {
    const includeCoreVal = parseBool(slotData.include_core);
    setters.setIncludeCore(includeCoreVal);
    addLog(`⚙️ Server: Core ${includeCoreVal ? 'enabled' : 'disabled'}`);
  }

  // Apply Farewell chapter setting
  if (slotData.include_farewell !== undefined) {
    const includeFarewellVal = parseFarewellValue(slotData.include_farewell);
    setters.setIncludeFarewell(includeFarewellVal);
    addLog(`⚙️ Server: Farewell ${includeFarewellVal ? 'enabled' : 'disabled'}`);
  }

  // Apply checkpoints setting
  if (slotData.checkpointsanity !== undefined) {
    const checkpointsanityVal = parseBool(slotData.checkpointsanity);
    setters.setIncludeCheckpoints(checkpointsanityVal);
    addLog(`⚙️ Server: Checkpointsanity ${checkpointsanityVal ? 'enabled' : 'disabled'}`);
  }

  // Apply sanity toggles
  if (slotData.binosanity !== undefined) {
    const val = parseBool(slotData.binosanity);
    setters.setBinosanity(val);
    addLog(`⚙️ Server: Binosanity ${val ? 'enabled' : 'disabled'}`);
  }

  if (slotData.keysanity !== undefined) {
    const val = parseBool(slotData.keysanity);
    setters.setKeysanity(val);
    addLog(`⚙️ Server: Keysanity ${val ? 'enabled' : 'disabled'}`);
  }

  if (slotData.gemsanity !== undefined) {
    const val = parseBool(slotData.gemsanity);
    setters.setGemsanity(val);
    addLog(`⚙️ Server: Gemsanity ${val ? 'enabled' : 'disabled'}`);
  }

  if (slotData.carsanity !== undefined) {
    const val = parseBool(slotData.carsanity);
    setters.setCarsanity(val);
    addLog(`⚙️ Server: Carsanity ${val ? 'enabled' : 'disabled'}`);
  }

  // Handle strawberry requirements (absolute number)
  if (slotData.strawberries_required !== undefined) {
    const required = parseInt(String(slotData.strawberries_required));
    if (!isNaN(required) && required >= 0) {
      setters.setGoalStrawberryRequirement(required);
      addLog(`🍓 Server: Strawberry requirement set to ${required}`);
    }
  }

  // Handle strawberry requirements (percentage-based)
  if (slotData.strawberries_required_percentage !== undefined && slotData.total_strawberries !== undefined) {
    const percentage = parseInt(String(slotData.strawberries_required_percentage));
    const total = parseInt(String(slotData.total_strawberries));
    if (!isNaN(percentage) && !isNaN(total)) {
      const required = Math.ceil((percentage / 100) * total);
      setters.setGoalStrawberryRequirement(required);
      addLog(`🍓 Server: Strawberry requirement set to ${required} (${percentage}% of ${total})`);
    }
  }
}
