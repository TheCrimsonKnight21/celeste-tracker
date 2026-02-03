import { useEffect } from "react";

type LocationsRecord = Record<string, any>;

export function LocationDiagnostic({ locations }: { locations: LocationsRecord }) {
  useEffect(() => {
    const locationsArray = Object.values(locations);
    
    console.group('🔍 Location Diagnostic');
    console.log('Total locations:', locationsArray.length);
    console.log('Locations with apItemId:', locationsArray.filter(l => l.apItemId).length);
    console.log('Locations collected:', locationsArray.filter(l => l.collected).length);
    
    // Sample of locations with apItemId
    const locationsWithIds = locationsArray.filter(l => l.apItemId);
    console.log('Sample locations with IDs:', locationsWithIds.slice(0, 5));
    
    // Check if we have the received items
    const receivedItemIds = [211886104, 211886080, 211886085];
    receivedItemIds.forEach(itemId => {
      const match = locationsArray.find(l => l.apItemId === itemId);
      console.log(`Item ${itemId}:`, match ? `Found in "${match.displayName}"` : 'NOT FOUND');
    });
    
    console.groupEnd();
  }, [locations]);

  return null;
}