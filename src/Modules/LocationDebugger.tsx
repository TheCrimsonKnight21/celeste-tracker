import { useEffect } from "react";

type DebugItem = any & { collected?: boolean };
type LocationsRecord = Record<string, DebugItem>;

export function LocationDebugger({ locations }: { locations: LocationsRecord }) {
  useEffect(() => {
    const locationsArray = Object.values(locations);
    
    console.log('📍 LocationDebugger:', {
      objectKeys: Object.keys(locations).length,
      arrayLength: locationsArray.length,
      collected: locationsArray.filter(l => l.collected).length,
      notCollected: locationsArray.filter(l => !l.collected).length,
      firstKeys: Object.keys(locations).slice(0, 5),
      sampleCollected: locationsArray.filter(l => l.collected).slice(0, 3),
      sampleNotCollected: locationsArray.filter(l => !l.collected).slice(0, 3),
      fullObject: locations // Be careful with this in large objects
    });
  }, [locations]);

  return null;
}