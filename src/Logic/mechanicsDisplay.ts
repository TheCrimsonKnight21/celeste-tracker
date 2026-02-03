import type { RandomizedMechanicsState } from "../Logic/mechanics";

// Function to format mechanics for display
export function formatMechanicsForDisplay(mechanics: RandomizedMechanicsState): Record<string, boolean> {
  const formatted: Record<string, boolean> = {};
  
  Object.entries(mechanics).forEach(([key, value]) => {
    // Remove 'has' prefix and format the key
    const displayKey = key.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim();
    formatted[displayKey] = value;
  });
  
  return formatted;
}

// Or if you want an array format:
export function getMechanicsDisplayArray(mechanics: RandomizedMechanicsState): Array<{name: string, enabled: boolean}> {
  return Object.entries(mechanics)
    .filter(([key]) => !key.startsWith('has')) // Optional: filter out 'has' prefixed
    .map(([key, value]) => ({
      name: key.replace(/([A-Z])/g, ' $1').trim(),
      enabled: value
    }));
}