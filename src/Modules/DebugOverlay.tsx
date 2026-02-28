import type { RandomizedMechanicsState } from "../Logic/mechanics";
import type { LocationDef } from "../Data/locations";
import { MECHANIC_MAPPINGS } from "../Logic/mechanicsMapping";
type DebugItem = LocationDef & { 
  checked?: boolean;
  collected?: boolean;
  reachable?: boolean;
  apLocationId?: number;
};
type LocationsRecord = Record<string, DebugItem>;

export function DebugOverlay({
  mechanics,
  locations
}: {
  mechanics: RandomizedMechanicsState;
  locations: LocationsRecord;
}) {
  // Convert locations object to array for display
  const locationsArray = Object.values(locations);
  
  // Get display names for mechanics
  const mechanicsWithDisplayNames = Object.entries(mechanics).map(([key, value]) => {
    let displayName = key;
    for (const mapping of Object.values(MECHANIC_MAPPINGS)) {
      if (mapping.logicKey === key) {
        displayName = mapping.display;
        break;
      }
    }
    return { key, displayName, value };
  });
  // Filter mechanics to remove 'has' prefix
  // const filteredMechanics = Object.entries(mechanics)
  //   .filter(([key]) => !key.startsWith('has'));

  return (
    <div
      style={{
        // ... styles ...
      }}
    >
      {/* Debug info header */}
      <div style={{ color: "#ff0", marginBottom: 8 }}>
        Debug: {locationsArray.length} locations ({locationsArray.filter(l => l.checked).length} checked)
      </div>

      <strong>Randomized Mechanics ({mechanicsWithDisplayNames.length})</strong>
      <div style={{ marginBottom: 8 }}>
        {mechanicsWithDisplayNames.map(({ displayName, value }) => (
          <div key={displayName}>
            {displayName}: {value ? "✓" : "✗"}
          </div>
        ))}
      </div>

      <hr style={{ borderColor: "#333" }} />

      <strong>Locations ({locationsArray.filter(l => l.checked).length}/{locationsArray.length})</strong>
      {locationsArray.length === 0 ? (
        <div style={{ color: "#f00", fontStyle: "italic" }}>
          No locations data!
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {locationsArray.slice(0, 50).map(location => {
            return (
              <div 
                key={location.apName || location.id}
                style={{
                  color: location.checked ? "#0f0" : location.reachable ? "#ff0" : "#f00",
                  opacity: location.checked ? 0.7 : 1,
                  fontSize: 11
                }}
              >
                {location.checked ? "✓" : location.reachable ? "○" : "✗"} 
                [{location.chapter}] {location.displayName}
                {location.apLocationId && ` (AP:${location.apLocationId})`}
              </div>
            );
          })}
          {locationsArray.length > 50 && (
            <div style={{ color: "#888", fontStyle: "italic" }}>
              ... and {locationsArray.length - 50} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}