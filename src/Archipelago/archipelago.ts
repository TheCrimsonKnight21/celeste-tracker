import { useWebSocket } from "./useWebSocket";

export function setupArchipelago({
  url,
  onLocationChecked,
  onDataPackage,
}: {
  url: string;
  onLocationChecked: (locations: number[]) => void;
  onDataPackage: (pkg: any) => void;
}) {
  return useWebSocket({
    url,
    onMessage(packet) {
      if (!packet?.cmd) return;

      switch (packet.cmd) {
        case "LocationChecks":
          onLocationChecked([...packet.locations]);
          break;

        case "RoomUpdate":
          if (packet?.checked_locations) {
            onLocationChecked([...packet.checked_locations]);
          }
          break;

        case "DataPackage":
          onDataPackage(packet.data);
          break;
      }
    },
  });
}
