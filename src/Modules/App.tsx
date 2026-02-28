import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { type MechanicsState } from "../Logic/mechanics";
import { DebugOverlay } from "./DebugOverlay";
import { LOCATIONS, type LocationState, type LocationDef } from "../Data/locations";
import type { LogicNode } from "../Data/types";
import { buildRuleMap, applyRuleMap } from "../Data/requirements";
import { createEmptyRandomizedMechanics, type RandomizedMechanicsState } from "../Logic/mechanics";
import LogicEditor from "./LogicEditor";
import { evaluateLogic } from "../Logic/logic";
import { MECHANIC_MAPPINGS } from "../Logic/mechanicsMapping";
import { LocationDebugger } from "./LocationDebugger";
import { LocationDiagnostic } from "./LocationDiagnostic";
import {useWebSocket }from "../Archipelago/useWebSocket";
import { MapTracker } from "./MapTracker";
import {
  simpleStringHash,
  getAreaName,
  extractSideFromId,
  extractTypeFromDisplayName,
  getMechanicKeyFromAPName,
  enhanceAPNameMatching,
  getClientUUID,
  getRequiredKeysFromLogic
} from "../utils/helpers";
import { processSlotData } from "../utils/slotDataProcessor";

/* ===============================
   Types & Local Helpers
================================ */

type APMessage = any;
// let apSocket: WebSocket | null = null;
let pendingReceivedItems: number[] = [];

/**
 * Check if a location is a collectible (displayable) type
 */
function isCollectibleLocationDef(loc: LocationDef): boolean {
  const type = extractTypeFromDisplayName(loc.displayName);
  return type !== undefined;
}

function isCollectibleLocationState(loc: LocationState): boolean {
  const type = extractTypeFromDisplayName(loc.displayName);
  return type !== undefined;
}

/**
 * Get display name for a mechanic from its logic key
 */
function getMechanicDisplayName(logicKey: string): string {
  for (const mapping of Object.values(MECHANIC_MAPPINGS)) {
    if (mapping.logicKey === logicKey) {
      return mapping.display;
    }
  }
  
  // Fallback formatting
  const formatted = logicKey.replace(/([A-Z])/g, ' $1').trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}



/* ===============================
   App
================================ */

export default function App() {

  /* ---------- Logs ---------- */
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = useCallback((line: string) =>
    setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 300)), []);

  const logMechanicsChange = (oldMech: MechanicsState, newMech: MechanicsState) => {
    const changedKeys = Object.keys(oldMech).filter(key => 
      oldMech[key as keyof MechanicsState] !== newMech[key as keyof MechanicsState]
    );
    
    if (changedKeys.length > 0) {
      console.log("Mechanics changed:", changedKeys.map(k => 
        `${k}: ${oldMech[k as keyof MechanicsState]} -> ${newMech[k as keyof MechanicsState]}`
      ));
      addLog(`Mechanics updated: ${changedKeys.map(k => 
        `${getMechanicDisplayName(k)} (${k}): ${oldMech[k as keyof MechanicsState] ? "ON" : "OFF"} → ${newMech[k as keyof MechanicsState] ? "ON" : "OFF"}`
      ).join(", ")}`);
    }
  };

  /* ---------- Mechanics ---------- */
  const [mechanics, setMechanics] = useState<MechanicsState>(() => {
    const saved = localStorage.getItem("celeste-mechanics");
    const emptyMechanics = createEmptyRandomizedMechanics();
    const savedMechanics = saved ? JSON.parse(saved) : {};
    
    // Merge saved mechanics with empty mechanics, but only keep valid mechanics
    const merged = { ...emptyMechanics };
    Object.keys(savedMechanics).forEach(key => {
      if (key in emptyMechanics) { // Only keep mechanics that exist in the current system
        merged[key as keyof MechanicsState] = savedMechanics[key];
      }
    });
    
    return merged;
  });

  useEffect(() => {
    console.log("Saving mechanics to localStorage:", mechanics);
    localStorage.setItem("celeste-mechanics", JSON.stringify(mechanics));
  }, [mechanics]);

  // Debug logging for mechanics changes
  useEffect(() => {
    console.log("Mechanics updated:", mechanics);
    console.log("Enabled mechanics:", Object.entries(mechanics).filter(([_, value]) => value).map(([key]) => key));
  }, [mechanics]);

  /* ---------- Randomized Mechanics ---------- */
  const randomizedMechanics: RandomizedMechanicsState = {
    ...createEmptyRandomizedMechanics(),
    ...mechanics,
  };

  /* ---------- Skills ---------- */
  const [allowSeq, setAllowSeq] = useState(true);

  /* ---------- Filters ---------- */
  const [selectedChapter, setSelectedChapter] = useState<string>("all");
  const [selectedSide, setSelectedSide] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedReachability, setSelectedReachability] = useState<string>("all");

  /* ---------- UI Toggles ---------- */
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showConditionEditors, setShowConditionEditors] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapEditMode, setMapEditMode] = useState<boolean>(false);

  /* ---------- Archipelago Configuration ---------- */
  const [selectedGoal, setSelectedGoal] = useState<string>("summit-a");
  const [strawberryCount, setStrawberryCount] = useState<number>(0);
  const [goalStrawberryRequirement, setGoalStrawberryRequirement] = useState<number>(0);
  // toggles derived from server slot data or manual UI
  const [includeBSides, setIncludeBSides] = useState<boolean>(true);
  const [includeCSides, setIncludeCSides] = useState<boolean>(true);
  const [includeGoldenStrawberries, setIncludeGoldenStrawberries] = useState<boolean>(true);
  const [includeCore, setIncludeCore] = useState<boolean>(true);
  const [includeFarewell, setIncludeFarewell] = useState<boolean>(true);
  const [includeCheckpoints, setIncludeCheckpoints] = useState<boolean>(false);
  const [lockGoalArea, setLockGoalArea] = useState<boolean>(false);

  // sanity toggles from slot data
  const [binosanity, setBinosanity] = useState<boolean>(false);
  const [keysanity, setKeysanity] = useState<boolean>(false);
  const [gemsanity, setGemsanity] = useState<boolean>(false);
  const [carsanity, setCarsanity] = useState<boolean>(false);

  /* ---------- Archipelago URL ---------- */
  const [archipelagoUrl, setArchipelagoUrl] = useState<string>(() => {
    return localStorage.getItem("archipelago-url") || "ws://localhost:38281";
  });
  
  /* ---------- Slot Name ---------- */
  const [slotName, setSlotName] = useState<string>(() => {
    return localStorage.getItem("archipelago-slot-name") || "Player1";
  });
  /* ---------- Archipelago Password ---------- */
  const [password, setPassword] = useState<string>(() => {
    return localStorage.getItem("archipelago-password") || "";
  });
  const [trackedPlayerSlot] = useState<number>(1); // Track player in slot 1
  const [show, setShow] = useState<boolean>(false);

  const [showMechanics, setShowMechanics] = useState(true);

  const [showKeys, setShowKeys] = useState(true);

  useEffect(() => {
    localStorage.setItem("archipelago-url", archipelagoUrl);
  }, [archipelagoUrl]);

  useEffect(() => {
    localStorage.setItem("archipelago-slot-name", slotName);
  }, [slotName]);

  useEffect(() => {
    localStorage.setItem("archipelago-password", password);
  }, [password]);

  // Extract unique values for filters from collectible locations only
  const collectibleLocationDefs = LOCATIONS.filter(isCollectibleLocationDef);
  const chapters = [...new Set(collectibleLocationDefs.map(l => l.chapter))].sort((a, b) => a - b);
  
  // Extract sides from collectible locations
  const sidesSet = new Set<string>();
  collectibleLocationDefs.forEach(loc => {
    const side = extractSideFromId(loc.id);
    if (side) sidesSet.add(side);
  });
  const sides = Array.from(sidesSet).sort();
  
  // Types from collectible locations
  const typesSet = new Set<string>();
  collectibleLocationDefs.forEach(loc => {
    const type = extractTypeFromDisplayName(loc.displayName);
    if (type) typesSet.add(type);
  });
  // Ensure all types are available in filter
  typesSet.add("Key");
  typesSet.add("Gem");
  const types = Array.from(typesSet).sort();

  /* ===============================
     Unified Location State
  ================================ */
  const [locations, setLocations] = useState<Record<string, LocationState>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  /* ---------- Initialize locations ---------- */
    /* ---------- Initialize locations ---------- */
  useEffect(() => {
    if (isInitialized) return;

    async function initialize() {
      console.log("Initializing locations...");

      // attempt to fetch rules from the CelesteLevelData.json file
      console.log("Fetching location rules...");
      try {
        const ruleMap = await buildRuleMap();
        applyRuleMap(ruleMap);
        console.log(`Applied rules for ${Object.keys(ruleMap).length} locations`);
        // show a couple of examples so developers can inspect what was loaded
        const samples = LOCATIONS.filter(l => l.requires && l.requires.length > 0).slice(0, 5);
        console.log("example location requirements:", samples.map(s => ({name: s.apName, req: s.requires})));
      } catch (e) {
        console.warn("Failed to load location rules", e);
      }

      const savedLogic = JSON.parse(localStorage.getItem("celeste-location-logic") || "{}");
      const savedChecked = JSON.parse(localStorage.getItem("celeste-location-checked") || "{}");

      const initial: Record<string, LocationState> = {};
      LOCATIONS.forEach((loc) => {
        // Determine a default logic node based on requires if no saved logic
        let defaultLogic: LogicNode = {
          type: "has",
          key: "noCondition",
        };
        if (loc.requires && loc.requires.length > 0) {
          if (loc.requires.length === 1) {
            defaultLogic = { type: "has", key: loc.requires[0] };
          } else {
            defaultLogic = {
              type: "and",
              nodes: loc.requires.map((k) => ({ type: "has", key: k })),
            };
          }
        }

        // Try to get logic from saved, otherwise use default.  If the
        // saved logic is just the placeholder we generated before (i.e. has
        // key "noCondition"), treat it as missing so that rules from the
        // JSON are applied.
        const saved = savedLogic[loc.id];
        const logic =
          saved && saved.key && saved.key !== "noCondition" ? saved : defaultLogic;

        initial[loc.id] = {
          ...loc,
          checked: savedChecked[loc.id] || false,
          reachable: false,
          logic: logic,
          apLocationId: undefined,
          apItemId: loc.apItemId || simpleStringHash(loc.id),
        };
      });

      console.log("Initial locations set:", Object.keys(initial).length);
      console.log("Checked locations loaded:", Object.values(initial).filter(l => l.checked).length);

      // Debug: Show which locations have logic
      const locationsWithCustomLogic = Object.values(initial).filter(l => savedLogic[l.id]);
      console.log("Locations with saved logic:", locationsWithCustomLogic.length);

      setLocations(initial);
      setIsInitialized(true);
    }

    initialize();
  }, [isInitialized]);

  /* ---------- Memoize configuration to reduce dependencies ---------- */
  const locationConfig = useMemo(() => ({
    selectedGoal,
    strawberryCount,
    goalStrawberryRequirement,
    includeBSides,
    includeCSides,
    includeGoldenStrawberries,
    includeCore,
    includeFarewell,
    includeCheckpoints,
    lockGoalArea,
  }), [selectedGoal, strawberryCount, goalStrawberryRequirement, includeBSides, includeCSides, includeGoldenStrawberries, includeCore, includeFarewell, includeCheckpoints, lockGoalArea]);

  /* ---------- Calculate reachability ---------- */
const locationsWithReachability = useMemo(() => {
  if (!isInitialized || Object.keys(locations).length === 0) return locations;
  
  const config = locationConfig;
  const next = { ...locations };
  const filtered: Record<string, LocationState> = {};
  
  Object.values(next).forEach((loc) => {
    try {
      // Check if location should be included in logic based on configuration
      const shouldIncludeInLogic = (loc: LocationState): boolean => {
        // Always include non-collectible locations (they're part of the base game)
        if (!isCollectibleLocationState(loc)) return true;
        
        // Check goal-based filtering
        const goalChapter = (() => {
          switch (config.selectedGoal) {
            case "summit-a": case "summit-b": case "summit-c": return 7;
            case "core-a": case "core-b": case "core-c": return 9;
            case "empty-space": return 8; // Epilogue
            case "farewell": case "farewell-golden": return 10;
            default: return null;
          }
        })();
        
        // Goal area locking only affects reachability, not visibility
        // We'll handle locking in the reachability calculation below
        
        // If this location is in a chapter beyond the goal, exclude it
        if (goalChapter !== null && loc.chapter > goalChapter) return false;
        
        // Check side filtering
        // side filtering: allow individually for B and C
        const side = extractSideFromId(loc.id);
        if (side === "B" && !config.includeBSides) return false;
        if (side === "C" && !config.includeCSides) return false;
        
        // Check golden strawberries
        if (!config.includeGoldenStrawberries && loc.displayName.toLowerCase().includes("golden strawberry")) {
          return false;
        }
        
        // Check Core chapter
        if (!config.includeCore && loc.chapter === 9) return false;
        
        // Check Farewell chapter
        if (!config.includeFarewell && loc.chapter === 10) return false;
        
        // Check checkpoints
        if (!config.includeCheckpoints && loc.type === "checkpoint") return false;
        
        return true;
      };
      
      // Skip locations that should not be included
      if (!shouldIncludeInLogic(loc)) {
        return; // Don't add to filtered object
      }
      
      // Check goal area locking (affects reachability but not visibility)
      const goalChapter = (() => {
        switch (config.selectedGoal) {
          case "summit-a": case "summit-b": case "summit-c": return 7;
          case "core-a": case "core-b": case "core-c": return 9;
          case "empty-space": return 8;
          case "farewell": case "farewell-golden": return 10;
          default: return null;
        }
      })();
      
      if (config.lockGoalArea && goalChapter !== null && loc.chapter === goalChapter && config.goalStrawberryRequirement > 0) {
        if (config.strawberryCount < config.goalStrawberryRequirement) {
          loc.reachable = false;
          loc.logicEvaluation = { status: "locked", missing: [`Requires ${config.goalStrawberryRequirement} strawberries (have ${config.strawberryCount})`] };
          filtered[loc.id] = loc;
          return;
        }
      }
      
      const result = evaluateLogic(loc.logic, randomizedMechanics);
      
      // Store the evaluation result details
      loc.logicEvaluation = result;
      
      if (!allowSeq && result.status === "sequence") {
        loc.reachable = false;
      } else {
        loc.reachable = result.status !== "locked";
      }
      
      filtered[loc.id] = loc;
    } catch (error) {
      console.error(`Error evaluating logic for ${loc.id}:`, error);
      loc.reachable = false;
      loc.logicEvaluation = { status: "locked", missing: ["error"] };
      filtered[loc.id] = loc;
    }
  });
  
  return filtered;
}, [mechanics, allowSeq, isInitialized, locations, locationConfig]); 

  /* ---------- Save location logic ---------- */
useEffect(() => {
  if (!isInitialized) return;
  
  // Use a reference or check if there are actual changes
  const logicOut: Record<string, any> = {};
  const locationsSnapshot = locations; // Take snapshot
  
  Object.values(locationsSnapshot).forEach((loc) => {
    logicOut[loc.id] = loc.logic;
  });
  
  const jsonString = JSON.stringify(logicOut, null, 2);
  console.log("Saving location logic to localStorage, size:", jsonString.length);
  localStorage.setItem("celeste-location-logic", jsonString);
}, [locations, isInitialized]); 

  /* ---------- Reset all conditions to no condition ---------- */
  const resetAllConditions = useCallback(() => {
    setLocations(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = {
          ...next[key],
          logic: { type: "has" as const, key: "noCondition" }
        };
      });
      return next;
    });
    addLog("🗑️ Reset all location conditions to 'No Condition'");
  }, [addLog]);

  /* ---------- Reset everything for new server ---------- */
  const resetForNewServer = useCallback(() => {
    // Reset mechanics to defaults
    const emptyMechanics = createEmptyRandomizedMechanics();
    setMechanics(emptyMechanics);
    
    // Reset all locations to unchecked and no condition
    setLocations(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = {
          ...next[key],
          checked: false,
          logic: { type: "has" as const, key: "noCondition" }
        };
      });
      return next;
    });
    
    // Clear localStorage
    localStorage.removeItem("celeste-mechanics");
    localStorage.removeItem("celeste-location-logic");
    localStorage.removeItem("celeste-location-checked");
    
    addLog("🔄 Reset all mechanics and locations for new server connection");
  }, [addLog]);

  /* ---------- Handle location click (for map view) ---------- */
  const handleLocationClick = useCallback((locationId: string) => {
    setLocations(prev => {
      const next = { ...prev };
      if (next[locationId]) {
        const wasChecked = next[locationId].checked;
        next[locationId] = {
          ...next[locationId],
          checked: !wasChecked
        };
        addLog(`${!wasChecked ? "✅" : "❌"} ${next[locationId].displayName}`);
      }
      return next;
    });
  }, [addLog]);

  /* ---------- Handle coordinate mapping save ---------- */
  const handleCoordinatesSaved = useCallback((areaId: string, subMapId: string, locations: Array<{locationId: string, x: number, y: number}>) => {
    // Here you would typically save to a file or database
    // For now, we'll just log it and show an alert
    console.log(`Coordinates saved for ${areaId}/${subMapId}:`, locations);
    addLog(`📍 Saved ${locations.length} coordinates for ${areaId}/${subMapId}`);
  }, [addLog]);

  /* ---------- Save checked locations ---------- */
  useEffect(() => {
    if (!isInitialized || Object.keys(locations).length === 0) return;
    
    const checkedOut: Record<string, boolean> = {};
    Object.values(locations).forEach((loc) => {
      checkedOut[loc.id] = loc.checked;
    });
    
    localStorage.setItem("celeste-location-checked", JSON.stringify(checkedOut));
    console.log("Saved checked locations:", Object.values(locations).filter(l => l.checked).length);
  }, [locations, isInitialized]);


  
  /* ===============================
     AP Dynamic Mappings
  ================================ */
  const itemIdToMechanicRef = useRef<Record<number, keyof MechanicsState>>({});
  const itemIdToNameRef = useRef<Record<number, string>>({});
  const locationNameToIdRef = useRef<Record<string, number>>({});


/* ===============================
   Archipelago - WebSocket
================================ */

// Use the custom WebSocket hook
const { isConnected, send, socket } = useWebSocket({
  url: archipelagoUrl,
  onMessage: (data) => {
    if (Array.isArray(data)) {
      data.forEach(handleAPMessage);
    } else {
      handleAPMessage(data);
    }
  },
  onOpen: () => {
    console.log("✅ WebSocket opened successfully");
    addLog("✅ WebSocket connected to Archipelago");
    
    // Send connect message immediately - but only if socket is actually open
    setTimeout(() => {
     console.log("✅ WebSocket opened successfully");
    addLog("✅ WebSocket connected to Archipelago");
    }, 100); // Small delay to ensure socket is ready
  },
  onClose: (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    addLog(`🔌 WebSocket closed (${event.code} - ${event.reason || 'no reason'})`);
  },
  onError: (event) => {
    console.error("WebSocket error:", event);
    addLog("❌ WebSocket error occurred");
  },
  reconnectInterval: 10000, // Increased to 10 seconds
  maxReconnectAttempts: 5   // Reduced attempts
});

// Add this useEffect to debug connection state changes
useEffect(() => {
  console.log("Connection state changed:", {
    isConnected,
    socketReadyState: sendAPMessage,
    socketExists: !!socket
  });
}, [isConnected, socket]);

// Update all socket references to use the new send function
const sendAPMessage = (message: any) => {
  if (!send(message)) {
    console.log("Cannot send message, WebSocket not connected");
    addLog("⚠️ Cannot send message - WebSocket not connected");
    return false;
  }
  return true;
};

  function handleAPMessage(msg: APMessage) {
  // Removed duplicate message handling to ensure live syncing works properly
  
  addLog(`AP → ${msg.cmd}`);

    if (msg.cmd === "LocationChecks" || msg.cmd === "LocationInfo" || msg.cmd === "RoomUpdate") {
      // These might contain checked locations too
      console.log(`${msg.cmd} message:`, msg);
      
      // Try to extract checked locations
      let checkedLocations: number[] = [];
      
      if (msg.locations && Array.isArray(msg.locations)) {
        checkedLocations = msg.locations;
      } else if (msg.checked_locations && Array.isArray(msg.checked_locations)) {
        checkedLocations = msg.checked_locations;
      }
      
      if (checkedLocations.length > 0) {
        console.log(`${msg.cmd} has ${checkedLocations.length} checked locations`);
        
        setLocations((prev) => {
          const next = { ...prev };
          let updatedCount = 0;
          
          Object.keys(next).forEach((key) => {
            const loc = next[key];
            if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
              if (!loc.checked) {
                next[key] = { ...loc, checked: true };
                updatedCount++;
                console.log(`[${msg.cmd}] Marked as checked: ${loc.displayName}`);
              }
            }
          });
          
          if (updatedCount > 0) {
            addLog(`✅ ${msg.cmd} updated ${updatedCount} location(s)`);
          }
          return next;
        });
      }
    }

    
    if (msg.cmd === "RoomInfo") {
      console.log("RoomInfo message:", msg);
      if (socket?.readyState === WebSocket.OPEN) {
        console.log("RoomInfo received → sending Connect");

        send([{
          cmd: "Connect",
          game: "Celeste (Open World)",
          name: slotName,
          password: password,
          tags: ["Tracker"],
          items_handling: 7,
          uuid: getClientUUID(),
          version: { major: 0, minor: 5, build: 0, class: "Version" },
        }]);
      }
      // RoomInfo contains slot_data for all players
      if (msg.slot_data && typeof msg.slot_data === 'object') {
        // Get slot data for tracked player (slot 1)
        const playerSlotData = msg.slot_data[trackedPlayerSlot];
        
        if (playerSlotData) {
          console.log("Player slot data:", playerSlotData);
          
          processSlotData(
            playerSlotData,
            {
              setSelectedGoal,
              setLockGoalArea,
              setIncludeBSides,
              setIncludeCSides,
              setIncludeGoldenStrawberries,
              setIncludeCore,
              setIncludeFarewell,
              setIncludeCheckpoints,
              setBinosanity,
              setKeysanity,
              setGemsanity,
              setCarsanity,
              setGoalStrawberryRequirement
            },
            addLog
          );
        }
      }
      
    if (msg.cmd === "ItemInfo") {
      // Handle initial items that were already received
      console.log("ItemInfo:", msg);
      
      if (msg.items && Array.isArray(msg.items)) {
        let strawberryCountIncrement = 0;
        
        // First, count strawberries and identify mechanics
        const mechanicsToAdd: (keyof MechanicsState)[] = [];
        
        for (const item of msg.items) {
          if (item.player === 1) { // Only our player's items
            const mech = itemIdToMechanicRef.current[item.item];
            if (mech) {
              mechanicsToAdd.push(mech);
            } else {
              // Check if this is a strawberry
              const itemName = itemIdToNameRef.current[item.item];
              if (itemName && itemName.toLowerCase().includes('strawberry') && !itemName.toLowerCase().includes('golden')) {
                strawberryCountIncrement++;
              }
            }
          }
        }
        
        // Update mechanics
        if (mechanicsToAdd.length > 0) {
          setMechanics((prev) => {
            const updated = { ...prev };
            let updatedCount = 0;
            
            mechanicsToAdd.forEach(mech => {
              if (!updated[mech]) {
                updated[mech] = true;
                updatedCount++;
              }
            });
            
            if (updatedCount > 0) {
              addLog(`✅ Loaded ${updatedCount} previously received mechanics`);
            }
            return updated;
          });
        }
        
        // Update strawberry count
        if (strawberryCountIncrement > 0) {
          setStrawberryCount(prev => {
            const newCount = prev + strawberryCountIncrement;
            addLog(`🍓 Loaded ${strawberryCountIncrement} previously collected strawberries (total: ${newCount})`);
            return newCount;
          });
        }
      }
    }
      
      // Handle checked locations from RoomInfo
      if (msg.checked_locations && Array.isArray(msg.checked_locations)) {
        const checkedLocations = msg.checked_locations;
        console.log(`RoomInfo - ${checkedLocations.length} checked locations`);
        
        setLocations(prev => {
          const next = { ...prev };
          let updatedCount = 0;
          
          Object.keys(next).forEach((key) => {
            const loc = next[key];
            if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
              if (!loc.checked) {
                next[key] = { ...loc, checked: true };
                updatedCount++;
              }
            }
          });
          
          if (updatedCount > 0) {
            addLog(`✅ Loaded ${updatedCount} checked locations`);
          }
          return next;
        });
      }
    }
    
    if (msg.cmd === "Connected") {
      addLog("✅ Successfully connected to Archipelago server");
      
      // Extract slot data which contains game-specific settings
      if (msg.slot_data) {
        console.log("Connected - slot_data:", msg.slot_data);
        console.log("All slot_data keys:", Object.keys(msg.slot_data));
        console.log("Full slot_data:", JSON.stringify(msg.slot_data, null, 2));
        
        processSlotData(
          msg.slot_data,
          {
            setSelectedGoal,
            setLockGoalArea,
            setIncludeBSides,
            setIncludeCSides,
            setIncludeGoldenStrawberries,
            setIncludeCore,
            setIncludeFarewell,
            setIncludeCheckpoints,
            setBinosanity,
            setKeysanity,
            setGemsanity,
            setCarsanity,
            setGoalStrawberryRequirement
          },
          addLog
        );
      }
    }
        
    if (msg.cmd === "Retrieved") {
  console.log("=== RETRIEVED MESSAGE DEBUG ===");
  console.log("Full Retrieved message:", msg);
  
  if (msg.keys) {
    // Handle slot_data from Retrieved
    if (msg.keys.slot_data) {
      console.log("Retrieved - slot_data:", msg.keys.slot_data);
      const slotData = msg.keys.slot_data;
      
      processSlotData(
        slotData,
        {
          setSelectedGoal,
          setLockGoalArea,
          setIncludeBSides,
          setIncludeCSides,
          setIncludeGoldenStrawberries,
          setIncludeCore,
          setIncludeFarewell,
          setIncludeCheckpoints,
          setBinosanity,
          setKeysanity,
          setGemsanity,
          setCarsanity,
          setGoalStrawberryRequirement
        },
        addLog
      );
    }
    
    // Check for checked_locations
    if (msg.keys.checked_locations && Array.isArray(msg.keys.checked_locations)) {
      const checkedLocations = msg.keys.checked_locations;
      console.log(`Found checked_locations with ${checkedLocations.length} items`);
      
      if (checkedLocations.length > 0) {
        setLocations(prev => {
          const next = { ...prev };
          let updatedCount = 0;
          
          Object.keys(next).forEach((key) => {
            const loc = next[key];
            if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
              if (!loc.checked) {
                next[key] = { ...loc, checked: true };
                updatedCount++;
                console.log(`Marked as checked: ${loc.displayName} (AP ID: ${loc.apLocationId})`);
              }
            }
          });
          
          if (updatedCount > 0) {
            addLog(`✅ Loaded ${updatedCount} checked location(s) from Retrieved`);
          }
          return next;
        });
      }
    }
    
    // Check for received_items
    if (msg.keys.received_items && Array.isArray(msg.keys.received_items)) {
      console.log("Processing received_items from Retrieved");
      const receivedItems = msg.keys.received_items;
      console.log(`Received items count: ${receivedItems.length}`);
      console.log(`itemIdToNameRef populated: ${Object.keys(itemIdToNameRef.current).length} items`);
      
      let strawberryCountIncrement = 0;
      
      setMechanics(prev => {
        const updated = { ...prev };
        let changed = false;
        
        receivedItems.forEach((item: any) => {
          const itemId = typeof item === 'number' ? item : item?.item;
          if (itemId) {
            const mech = itemIdToMechanicRef.current[itemId];
            if (mech && !updated[mech]) {
              updated[mech] = true;
              changed = true;
              console.log(`Setting ${mech} from received_items: ${itemId}`);
            }
            
            // Count strawberries
            const itemName = itemIdToNameRef.current[itemId];
            console.log(`Item ${itemId}: ${itemName}`);
            if (itemName && itemName.toLowerCase().includes('strawberry') && !itemName.toLowerCase().includes('golden')) {
              strawberryCountIncrement++;
              console.log(`Found strawberry: ${itemName}`);
            }
          }
        });
        
        return changed ? updated : prev;
      });
      
      console.log(`Total strawberries counted: ${strawberryCountIncrement}`);
      
      // Update strawberry count
      if (strawberryCountIncrement > 0) {
        setStrawberryCount(prev => {
          const newCount = prev + strawberryCountIncrement;
          console.log(`Setting strawberry count to: ${newCount}`);
          addLog(`🍓 Loaded ${strawberryCountIncrement} strawberries from server (total: ${newCount})`);
          return newCount;
        });
      } else {
        console.log("No strawberries found in received_items");
      }
    }
  }
  
  console.log("=== END RETRIEVED DEBUG ===");
}

// Replace the entire DataPackage handler with this improved version:

if (msg.cmd === "DataPackage") {
  const game = msg.data.games["Celeste (Open World)"];
  if (!game) {
    addLog("❌ No Celeste game found in DataPackage");
    return;
  }

  console.log("=== DATAPACKAGE DEBUG ===");
  console.log("Full DataPackage:", msg.data);
  console.log("Celeste game data:", game);
  
  // Check for game options/settings
  if (game.options) {
    console.log("Game options found:", game.options);
    console.log("Full game object:", game);
    addLog(`🎯 Found game options in DataPackage`);
    
    // Try to extract goal settings
    if (game.options.goal) {
      console.log("Goal setting:", game.options.goal);
      addLog(`🎯 Goal setting detected: ${game.options.goal}`);
      
      // Auto-set goal based on server settings
      const goalMapping: Record<string, string> = {
        'summit_a': 'Summit A',
        'summit_b': 'Summit B', 
        'summit_c': 'Summit C',
        'core_a': 'Core A',
        'core_b': 'Core B',
        'core_c': 'Core C'
      };
      
      const mappedGoal = goalMapping[game.options.goal.toLowerCase()];
      if (mappedGoal) {
        setSelectedGoal(mappedGoal);
        addLog(`🎯 Auto-set goal to: ${mappedGoal}`);
      }
    }
    
    // Check for other relevant settings
    const relevantOptions = ['goal', 'goal_area', 'include_core', 'include_farewell', 'include_goldens', 'include_golden_berries', 'include_b_sides', 'include_c_sides', 'include_sides'];
    relevantOptions.forEach(option => {
      if (game.options[option] !== undefined) {
        console.log(`${option}:`, game.options[option]);
        addLog(`⚙️ ${option}: ${game.options[option]}`);
        
        // Auto-apply settings
        if (option === 'goal_area' || (option === 'goal' && !game.options.goal_area)) {
          const goalMapping: Record<string, string> = {
            'the_summit_a': 'Summit A',
            'the_summit_b': 'Summit B', 
            'the_summit_c': 'Summit C',
            'the_core_a': 'Core A',
            'the_core_b': 'Core B',
            'the_core_c': 'Core C'
          };
          
          const mappedGoal = goalMapping[game.options[option].toLowerCase().replace(/-/g, '_')];
          if (mappedGoal) {
            setSelectedGoal(mappedGoal.toLowerCase().replace(' ', '-'));
            addLog(`🎯 Auto-set goal to: ${mappedGoal}`);
          }
        }
        if (option === 'include_core' && typeof game.options[option] === 'boolean') {
          setIncludeCore(game.options[option]);
          addLog(`⚙️ Auto-set include_core: ${game.options[option]}`);
        }
        if (option === 'include_farewell' && (typeof game.options[option] === 'boolean' || typeof game.options[option] === 'string')) {
          const optionValue = game.options[option];
          let farewellVal = false;
          if (typeof optionValue === 'boolean') {
            farewellVal = optionValue;
          } else if (typeof optionValue === 'string') {
            farewellVal = optionValue !== 'none' && optionValue !== '0' && optionValue !== '';
          }
          setIncludeFarewell(farewellVal);
          addLog(`⚙️ Auto-set include_farewell: ${farewellVal}`);
        }
        if (option === 'include_goldens' || option === 'include_golden_berries') {
          const goldensVal = game.options[option] === true || game.options[option] === 'true';
          setIncludeGoldenStrawberries(goldensVal);
          addLog(`⚙️ Auto-set include_golden_berries: ${goldensVal}`);
        }
        if ((option === 'include_b_sides' || option === 'include_c_sides' || option === 'include_sides') && typeof game.options[option] === 'boolean') {
          if (option === 'include_sides') {
            const val = game.options[option];
            setIncludeBSides(val);
            setIncludeCSides(val);
            addLog(`⚙️ Auto-set include_sides: ${val}`);
          } else if (option === 'include_b_sides') {
            setIncludeBSides(game.options[option]);
            addLog(`⚙️ Auto-set include_b_sides: ${game.options[option]}`);
          } else if (option === 'include_c_sides') {
            setIncludeCSides(game.options[option]);
            addLog(`⚙️ Auto-set include_c_sides: ${game.options[option]}`);
          }
        }
        
        // Handle strawberry requirements
        if (option === 'strawberries_required_percentage' && game.options.total_strawberries) {
          const percentage = parseInt(game.options[option]);
          const total = parseInt(game.options.total_strawberries);
          if (!isNaN(percentage) && !isNaN(total)) {
            const required = Math.ceil((percentage / 100) * total);
            setGoalStrawberryRequirement(required);
            addLog(`🍓 Auto-set strawberry requirement: ${required} (${percentage}% of ${total})`);
          }
        }
      }
    });
  }
  
  // Store location name to ID mapping
  locationNameToIdRef.current = game.location_name_to_id || {};
  
  // Helper function to categorize AP items
  const categorizeAPItem = (itemName: string): 'mechanic' | 'collectible' | 'other' => {
    const lowerName = itemName.toLowerCase();
    
    // These are mechanics (items that unlock abilities)
    const mechanicKeywords = [
      "spring", "traffic block", "cassette block", "dream block", "coin", 
      "strawberry seed", "sinking platform", "moving platform", "blue booster",
      "blue cloud", "move block", "white block", "swap block", "red booster",
      "torch", "theo crystal", "feather", "bumper", "kevin", "pink cloud",
      "badeline booster", "fire and ice", "core toggle", "core block",
      "pufferfish", "jellyfish", "breaker box", "dash refill", "double dash",
      "yellow cassette", "green cassette", "bird", "dash switch", "seeker", "key"
    ];
    
    // These are collectible items (NOT mechanics) that appear as received items
    const collectibleItemKeywords = [
      "strawberry", "raspberry", "cassette", "gem", "moon berry",
      "golden strawberry", "crystal heart" 
    ];
    
    // Special case: if it contains "cassette" but also "block", it's a mechanic
    if (lowerName.includes("cassette") && !lowerName.includes("block")) {
      return 'collectible'; // Cassettes without "block" are collectible items
    }
    
    if (mechanicKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'mechanic';
    }
    
    if (collectibleItemKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'collectible';
    }
    
    return 'other';
  };
  
  // Map AP item IDs to mechanics
  if (game.item_name_to_id) {
    const itemIdToMechanic: Record<number, keyof MechanicsState> = {};
    const itemIdToName: Record<number, string> = {};
    
    Object.entries(game.item_name_to_id).forEach(([apItemName, apItemId]) => {
      const category = categorizeAPItem(apItemName);
      
      // Store the name mapping for all items
      itemIdToName[apItemId as number] = apItemName;
      
      if (category === 'mechanic') {
        const mechanicKey = getMechanicKeyFromAPName(apItemName);
        if (mechanicKey) {
          itemIdToMechanic[apItemId as number] = mechanicKey;
          addLog(`🔧 Mapped AP mechanic: ${apItemName} → ${mechanicKey}`);
        } else {
          console.log(`Could not find mechanic mapping for: ${apItemName}`);
        }
      } else if (category === 'collectible') {
        console.log(`📌 AP collectible item (not a mechanic): ${apItemName} (ID: ${apItemId})`);
        // These are items like Strawberries, Cassettes that are received as items
        // but don't unlock mechanics - they just increment item count
      } else {
        console.log(`❓ Other AP item: ${apItemName} (ID: ${apItemId})`);
      }
    });
    
    itemIdToMechanicRef.current = itemIdToMechanic;
    itemIdToNameRef.current = itemIdToName;
    
    // Process any pending items now that we have mappings
    if (pendingReceivedItems.length > 0) {
      console.log(`Processing ${pendingReceivedItems.length} pending items`);
      setMechanics(prev => {
        const updated = { ...prev };
        let processedCount = 0;
        
        pendingReceivedItems.forEach(itemId => {
          const mech = itemIdToMechanic[itemId];
          if (mech && !updated[mech]) {
            updated[mech] = true;
            processedCount++;
            addLog(`🎁 Processed queued item ${itemId} → ${mech}`);
          }
        });
        
        pendingReceivedItems = [];
        if (processedCount > 0) {
          addLog(`✅ Processed ${processedCount} queued items`);
        }
        return updated;
      });
    }
  }

  // Map locations to AP IDs - focus on COLLECTIBLE locations
  setLocations(prev => {
    const next = { ...prev };
    let mappedCount = 0;
    
    // Clear existing mappings to allow remapping
    Object.keys(next).forEach(key => {
      next[key].apLocationId = undefined;
      next[key].apName = "";
      next[key].apItemId = 0;
    });
    
    // Create a reverse mapping for debugging and to prevent duplicates
    const apIdToLocationKey: Record<number, string> = {};
    
    if (game.location_name_to_id) {
      // First pass: collect all AP location names that are collectibles
      const apCollectibleLocations = Object.entries(game.location_name_to_id).filter(([apLocationName, _]) => {
        const lowerName = apLocationName.toLowerCase();
        
        // These are collectible location names in AP
        const apCollectiblePatterns = [
          "strawberry", "crystal heart", "cassette", "moon berry", 
          "golden strawberry", "raspberry", "key", "gem", "level clear"
        ];
        
        // Also check for patterns like "Forsaken City A - Crossing" (these are NOT collectibles)
        // Collectibles usually have specific names, not just room names
        const isGenericRoomName = 
          lowerName.includes("crossing") ||
          lowerName.includes("chasm") ||
          lowerName.includes("intervention") ||
          lowerName.includes("awake") ||
          lowerName.includes("shrine") ||
          (/\d+\s*m/.test(lowerName) && !lowerName.includes("key")); // Patterns like "500 M" but not "2500 M Key"
        
        const hasCollectiblePattern = apCollectiblePatterns.some(pattern => lowerName.includes(pattern));
        
        return hasCollectiblePattern && !isGenericRoomName;
      });
      
      console.log(`Found ${apCollectibleLocations.length} collectible AP locations out of ${Object.keys(game.location_name_to_id).length} total`);
      
      // Second pass: match AP locations to our locations
      apCollectibleLocations.forEach(([apLocationName, apLocationId]) => {
        // Skip if this AP ID is already mapped
        if (apIdToLocationKey[apLocationId as number]) {
          console.log(`⚠️ AP ID ${apLocationId} already mapped to ${apIdToLocationKey[apLocationId as number]}, skipping "${apLocationName}"`);
          return;
        }
        
        // Enhance AP name for better matching
        const enhancedApName = enhanceAPNameMatching(apLocationName);
        
        // Normalize names for better matching
        const normalizeName = (name: string) => {
          return name.toLowerCase()
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        };
        
        const normApName = normalizeName(enhancedApName);
        
        // Try to find matching location in our collectible locations
        let bestMatchKey: string | null = null;
        let bestMatchScore = 0;
        
        Object.keys(next).forEach((key) => {
          const loc = next[key];
          
          // Only match collectible locations
          if (!isCollectibleLocationState(loc)) {
            return;
          }
          
          // Skip if this location already has an AP ID
          if (loc.apLocationId) {
            return;
          }
          
          // Enhance local name too
          const enhancedDisplayName = enhanceAPNameMatching(loc.displayName);
          const normDisplayName = normalizeName(enhancedDisplayName);
          
          // Calculate match score
          let score = 0;
          
          // Strategy 1: Exact match on normalized names
          if (normDisplayName === normApName) {
            score = 100;
          }
          
          // Strategy 2: One contains the other
          else if (normDisplayName.includes(normApName) || normApName.includes(normDisplayName)) {
            score = 80;
          }
          
          // Strategy 3: Match by chapter, type, and partial name
          const getChapterFromName = (name: string): number | null => {
            if (name.includes("prologue")) return 0;
            if (name.includes("forsaken city")) return 1;
            if (name.includes("old site")) return 2;
            if (name.includes("celestial resort")) return 3;
            if (name.includes("golden ridge")) return 4;
            if (name.includes("mirror temple")) return 5;
            if (name.includes("reflection")) return 6;
            if (name.includes("summit") || name.includes("the summit")) return 7;
            if (name.includes("epilogue")) return 8;
            if (name.includes("core")) return 9;
            if (name.includes("farewell")) return 10;
            return null;
          };
          
          const displayChapter = getChapterFromName(normDisplayName);
          const apChapter = getChapterFromName(normApName);
          
          if (displayChapter !== null && apChapter !== null && displayChapter === apChapter) {
            score += 20; // Same chapter
          }
          
          // Extract type from both names
          const displayType = extractTypeFromDisplayName(enhancedDisplayName);
          const apType = extractTypeFromDisplayName(enhancedApName);
          
          if (displayType && apType && displayType === apType) {
            score += 20; // Same type
          }
          
          // Extract side from both names
          const displaySide = extractSideFromId(loc.id);
          const apHasSide = /[ABC]\s+-\s+/i.test(enhancedApName);
          const apSide = enhancedApName.match(/([ABC])\s+-\s+/i)?.[1];
          
          if (displaySide && apSide && displaySide.toUpperCase() === apSide.toUpperCase()) {
            score += 10; // Same side
          } else if (!displaySide && !apHasSide) {
            score += 5; // Both don't have sides specified
          }
          
          // Strategy 4: Match by room number patterns
          const displayRoomMatch = enhancedDisplayName.match(/Room\s+([a-z0-9\-]+)/i);
          const apRoomMatch = enhancedApName.match(/Room\s+([a-z0-9\-]+)/i);
          
          if (displayRoomMatch && apRoomMatch && displayRoomMatch[1] === apRoomMatch[1]) {
            score += 15; // Same room identifier
          }
          
          // Word matching bonus
          const apWords = normApName.split(' ');
          const locWords = normDisplayName.split(' ');
          let wordMatches = 0;
          apWords.forEach(apWord => {
            if (locWords.includes(apWord)) {
              wordMatches++;
            }
          });
          score += wordMatches * 2; // small bonus for each matching word
          
          // Update best match if this is better
          if (score > bestMatchScore && score > 30) { // Lower threshold for matching
            bestMatchScore = score;
            bestMatchKey = key;
          }
        });
        
        if (bestMatchKey && bestMatchScore > 30) {
          const loc = next[bestMatchKey];
          
          // Double-check we're not creating a duplicate
          if (loc.apLocationId) {
            console.log(`⚠️ Location ${bestMatchKey} already has AP ID ${loc.apLocationId}, skipping new assignment for "${apLocationName}"`);
            return;
          }
          
          // Update the location
          next[bestMatchKey] = { 
            ...loc, 
            apLocationId: apLocationId as number,
            apName: apLocationName,
            apItemId: apLocationId as number
          };
          
          // Record the mapping to prevent duplicates
          apIdToLocationKey[apLocationId as number] = bestMatchKey;
          
          mappedCount++;
          console.log(`✅ Mapped (score: ${bestMatchScore}): ${apLocationName} (AP ID: ${apLocationId}) → "${loc.displayName}"`);
        } else {
          console.log(`❌ No good match found for AP location: "${apLocationName}" (ID: ${apLocationId})`);
          // Try enhanced name for debugging
          console.log(`   Enhanced AP name: "${enhancedApName}"`);
          console.log(`   Normalized AP name: "${normApName}"`);
          
          // Try to find what might match
          const possibleMatches = Object.values(next)
            .filter(loc => isCollectibleLocationState(loc) && !loc.apLocationId)
            .filter(loc => {
              const normLoc = normalizeName(loc.displayName);
              return normLoc.includes(normApName.substring(0, Math.min(15, normApName.length))) || 
                     normApName.includes(normLoc.substring(0, Math.min(15, normLoc.length)));
            })
            .slice(0, 3);
          
          if (possibleMatches.length > 0) {
            console.log(`   Possible matches:`, possibleMatches.map(l => l.displayName));
          } else {
            console.log(`   No similar local locations found`);
          }
        }
      });
    }
    
    addLog(`✅ Mapped ${mappedCount} collectible locations to AP IDs`);
    console.log(`Total locations mapped: ${mappedCount}`);
    
    // Debug: Show what got mapped
    const mappedLocations = Object.values(next).filter(loc => loc.apLocationId);
    console.log("Mapped locations (first 10):", mappedLocations.slice(0, 10).map(l => ({
      name: l.displayName,
      apId: l.apLocationId,
      apName: l.apName,
      id: l.id
    })));
    
    // Show locations that didn't get mapped (for debugging)
    const unmappedCollectibles = Object.values(next).filter(loc => 
      isCollectibleLocationState(loc) && !loc.apLocationId
    );
    console.log(`Unmapped collectible locations: ${unmappedCollectibles.length}`);
    
    if (unmappedCollectibles.length > 0) {
      console.log("Sample unmapped collectibles (first 5):", 
        unmappedCollectibles.slice(0, 5).map(l => l.displayName));
    }
    
    // Now request checked locations
    setTimeout(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        sendAPMessage(([{ 
          cmd: "Get",
          keys: ["checked_locations"]
        }]));
        addLog("🔄 Requesting checked locations after DataPackage");
      }
    }, 500);
    
    return next;
  });

  addLog("✅ Loaded AP Data Package");
}
    if (msg.cmd === "ReceivedItems") {
  console.log("ReceivedItems message:", msg);
  addLog(`📦 Received ${msg.items.length} items from Archipelago`);
  
  // Process items immediately
  for (const it of msg.items) {
    const mech = itemIdToMechanicRef.current[it.item];
    if (mech) {
      // Update mechanics state
      setMechanics(prev => {
        if (prev[mech] === true) {
          // Already have this mechanic
          return prev;
        }
        
        console.log(`Setting mechanic ${mech} to true from item ${it.item}`);
        const updated = { ...prev, [mech]: true };
        logMechanicsChange(prev, updated);
        return updated;
      });
    } else {
      // Check if this is a strawberry item to increment counter
      // We need to check the item name from the DataPackage
      const itemName = itemIdToNameRef.current[it.item];
      if (itemName && itemName.toLowerCase().includes('strawberry') && !itemName.toLowerCase().includes('golden')) {
        setStrawberryCount(prev => {
          const newCount = prev + 1;
          addLog(`🍓 Strawberry collected! Count: ${newCount}`);
          return newCount;
        });
      }
      
      // Not a mechanic, assume it's a collectible item corresponding to a checked location
      let foundLocation = false;
      setLocations(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const loc = next[key];
          if (loc.apItemId === it.item && !loc.checked) {
            next[key] = { ...loc, checked: true };
            addLog(`✅ Marked location as checked from item ${it.item}: ${loc.displayName}`);
            foundLocation = true;
          }
        });
        return next;
      });
      if (!foundLocation) {
        console.log(`Item ${it.item} not yet mapped, adding to pending`);
        if (!pendingReceivedItems.includes(it.item)) {
          pendingReceivedItems.push(it.item);
        }
      }
    }
  }
  
  // If we have pending items and the DataPackage hasn't arrived yet,
  // request it again
  if (pendingReceivedItems.length > 0) {
    setTimeout(() => {
      sendAPMessage(([{ cmd: "GetDataPackage" }]));
    }, 1000);
  }
}

    if (msg.cmd === "RoomUpdate") {
      console.log("RoomUpdate:", msg);
      
      // Handle checked locations from RoomUpdate
      if (msg.checked_locations) {
        const checkedLocations = Array.isArray(msg.checked_locations) ? msg.checked_locations : [];
        console.log("RoomUpdate - checked locations:", checkedLocations);
        
        if (checkedLocations.length > 0) {
          setLocations((prev) => {
            const next = { ...prev };
            let updatedCount = 0;
            
            Object.keys(next).forEach((key) => {
              const loc = next[key];
              if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
                if (!loc.checked) {
                  // Create a new object instead of mutating
                  next[key] = { ...loc, checked: true };
                  updatedCount++;
                  addLog(`✅ Location checked: ${loc.displayName}`);
                }
              }
            });
            
            return next; // This returns a new object reference
          });
        }
      }
    }

    if (msg.cmd === "PrintJSON") {
      // Handle PrintJSON messages (chat messages)
      // Sometimes location checks come as PrintJSON messages
      if (msg.data && typeof msg.data === "string") {
        const dataStr = msg.data.toLowerCase();
        if (dataStr.includes("checked") || dataStr.includes("location")) {
          console.log("PrintJSON location check message:", msg.data);
          // Try to extract location information from the message
        }
      }
    }

    if (msg.cmd === "Bounced") {
      // Bounced messages often contain location checks
      console.log("Bounced message:", msg);
      
      if (msg.tags && msg.tags.includes("Client") && msg.data) {
        try {
          // Parse the bounced data which might contain location information
          const bouncedData = JSON.parse(msg.data);
          if (bouncedData.locations && Array.isArray(bouncedData.locations)) {
            const checkedLocations = bouncedData.locations;
            console.log("Bounced - checked locations:", checkedLocations);
            
            setLocations((prev) => {
              const next = { ...prev };
              let updatedCount = 0;
              
              Object.keys(next).forEach((key) => {
                const loc = next[key];
                if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
                  if (!loc.checked) {
                    next[key] = { ...loc, checked: true };
                    updatedCount++;
                    addLog(`✅ Bounced check: ${loc.displayName}`);
                  }
                }
              });
              
              return next;
            });
          }
        } catch (error) {
          console.error("Error parsing Bounced data:", error);
        }
      }
    }

    if (msg.cmd === "LocationInfo") {
      // LocationInfo messages contain location data
      console.log("LocationInfo:", msg);
      
      if (msg.locations && Array.isArray(msg.locations)) {
        setLocations((prev) => {
          const next = { ...prev };
          let updatedCount = 0;
          
          // LocationInfo can have an array of location objects
          msg.locations.forEach((locInfo: any) => {
            if (locInfo.status && locInfo.player && locInfo.location) {
              // Check if this location belongs to our player
              if (locInfo.player === 1) { // Player 1 is usually the local player
                Object.keys(next).forEach((key) => {
                  const loc = next[key];
                  if (loc.apLocationId === locInfo.location) {
                    const wasChecked = loc.checked;
                    const isChecked = locInfo.status > 0; // Status > 0 means checked
                    
                    if (!wasChecked && isChecked) {
                      next[key] = { ...loc, checked: true };
                      updatedCount++;
                      addLog(`✅ LocationInfo check: ${loc.displayName}`);
                    }
                  }
                });
              }
            }
          });
          
          if (updatedCount > 0) {
            addLog(`✅ Updated ${updatedCount} location(s) from LocationInfo`);
          }
          return next;
        });
      }
    }

    if (msg.cmd === "LocationChecks") {
      // When location checks are sent or received
      console.log("LocationChecks:", msg);
      if (msg.locations && Array.isArray(msg.locations)) {
        const checkedLocations = msg.locations;
        
        setLocations((prev) => {
          const next = { ...prev };
          let updatedCount = 0;
          
          Object.keys(next).forEach((key) => {
            const loc = next[key];
            if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
              if (!loc.checked) {
                next[key] = { ...loc, checked: true };
                updatedCount++;
                addLog(`✅ LocationChecks: ${loc.displayName}`);
              }
            }
          });
          
          return next;
        });
      }
    }
    
    if (msg.cmd === "SetReply") {
      // Handle SetReply messages which update client data
      if (msg.key === "checked_locations" && msg.value) {
        const checkedLocations = Array.isArray(msg.value) ? msg.value : [];
        console.log("SetReply - checked locations:", checkedLocations);
        
        setLocations((prev) => {
          const next = { ...prev };
          let updatedCount = 0;
          
          Object.keys(next).forEach((key) => {
            const loc = next[key];
            if (loc.apLocationId && checkedLocations.includes(loc.apLocationId)) {
              if (!loc.checked) {
                next[key] = { ...loc, checked: true };
                updatedCount++;
              }
            }
          });
          
          if (updatedCount > 0) {
            addLog(`✅ SetReply updated ${updatedCount} location(s)`);
          }
          return next;
        });
      }
    }

    if (msg.cmd === "ConnectionRefused") {
      addLog(`❌ Connection refused: ${msg.errors?.join(", ")}`);
    }

    if (msg.cmd === "ConnectionError") {
      addLog(`❌ Connection error: ${msg.errors?.join(", ")}`);
    }
  }

  /* ---------- Filter locations ---------- */
  const filteredLocations = useMemo(() => {
    return Object.values(locationsWithReachability).filter((loc) => {
      // First, only show collectible locations
      if (!isCollectibleLocationState(loc)) return false;
      
      // Exclude locations that are filtered out by Archipelago goal settings
      if (loc.logicEvaluation?.missing?.includes("Excluded by goal settings")) return false;
      
      if (selectedChapter !== "all" && loc.chapter !== parseInt(selectedChapter)) return false;
      
      // Check side if filter is active
      if (selectedSide !== "all") {
        const locationSide = extractSideFromId(loc.id);
        if (!locationSide || locationSide !== selectedSide) return false;
      }
      
      // Check type if filter is active
      if (selectedType !== "all") {
        const locationType = extractTypeFromDisplayName(loc.displayName);
        if (!locationType || locationType !== selectedType) return false;
      }
      
      // Check reachability filter
      if (selectedReachability !== "all") {
        switch (selectedReachability) {
          case "reachable":
            if (!loc.reachable) return false;
            break;
          case "unreachable":
            if (loc.reachable) return false;
            break;
          case "checked":
            if (!loc.checked) return false;
            break;
          case "unchecked":
            if (loc.checked) return false;
            break;
        }
      }
      
      return true;
    });
  }, [locationsWithReachability, selectedChapter, selectedSide, selectedType, selectedReachability]);

// Group filtered locations by chapter for display
const locationsByChapter: Record<number, LocationState[]> = {};
const usedKeys = new Set<string>(); // Track used keys

filteredLocations.forEach((loc) => {
  // Skip if we've already used this key
  if (usedKeys.has(loc.id)) {
    console.warn(`Duplicate location key detected: ${loc.id} (${loc.displayName})`);
    return;
  }
  
  usedKeys.add(loc.id);
  
  if (!locationsByChapter[loc.chapter]) {
    locationsByChapter[loc.chapter] = [];
  }
  locationsByChapter[loc.chapter].push(loc);
});

  /* ---------- Handle location checking ---------- */
 const handleLocationCheck = (loc: LocationState) => {
  const locationType = extractTypeFromDisplayName(loc.displayName);
  
  // Only send checks for actual collectibles (not keys/gems if those are location-specific)
  if (loc.apLocationId && loc.reachable && !loc.checked) {
    // For keys, we might want different logic
    if (locationType === "Key") {
      // Keys might need special handling
      console.log(`Key location ${loc.displayName} would be checked`);
    }
    
    // Send check to Archipelago
    sendAPMessage(([
      {
        cmd: "LocationChecks",
        locations: [loc.apLocationId],
      },
    ]));
    
    // Update local state immediately
    setLocations(prev => ({
      ...prev,
      [loc.id]: { ...prev[loc.id], checked: true }
    }));
    
    addLog(`📍 Sent check for ${loc.displayName}`);
  }
};

  // Export conditions to JSON file
  const exportConditions = () => {
    const locationLogic: Record<string, any> = {};
    Object.values(locations).forEach((loc) => {
      locationLogic[loc.id] = loc.logic;
    });
    const data = JSON.stringify(locationLogic, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'celeste-location-conditions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import conditions from JSON file
  const importConditions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const locationLogic = JSON.parse(e.target?.result as string);
          setLocations(prev => {
            const next = { ...prev };
            Object.keys(locationLogic).forEach(key => {
              if (next[key]) {
                next[key] = { ...next[key], logic: locationLogic[key] };
              }
            });
            return next;
          });
          addLog('📥 Imported location conditions from file');
        } catch (err) {
          alert('Invalid conditions file');
        }
      };
      reader.readAsText(file);
    }
  };

  /* ===============================
     UI
  ================================ */

  if (!isInitialized) {
    return (
      <div style={{ 
        padding: '40px', 
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
          backdropFilter: 'blur(10px)',
          padding: '3rem',
          borderRadius: '20px',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '3em',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🏔️ Celeste Tracker
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: 'var(--text-secondary)',
            fontSize: '1.2em'
          }}>
            <div className="loading-spinner" style={{
              width: '24px',
              height: '24px',
              border: '3px solid rgba(139, 92, 246, 0.3)',
              borderTop: '3px solid #8b5cf6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ margin: 0 }}>Loading locations and logic...</p>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header with gradient */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
        backdropFilter: 'blur(10px)',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
      }}>
        <h1 style={{
          fontSize: '2.5em',
          margin: '0 0 0.5rem 0',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center'
        }}>
          🏔️ Celeste OW Archipelago Tracker
        </h1>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          margin: 0,
          fontSize: '1.1em'
        }}>
          Track your progress through the mountain
        </p>
      </div>
      
      {/* Connection Status */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        marginBottom: '1.5rem',
        background: isConnected 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)' 
          : socket?.readyState === WebSocket.CONNECTING
          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)'
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)',
        color: 'white',
        borderRadius: '12px',
        fontWeight: '600',
        fontSize: '1.05em',
        border: `2px solid ${isConnected ? '#10b981' : socket?.readyState === WebSocket.CONNECTING ? '#3b82f6' : '#ef4444'}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'all 0.3s ease'
      }}>
        <span style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: isConnected ? '#10b981' : socket?.readyState === WebSocket.CONNECTING ? '#3b82f6' : '#ef4444',
          boxShadow: `0 0 10px ${isConnected ? '#10b981' : socket?.readyState === WebSocket.CONNECTING ? '#3b82f6' : '#ef4444'}`,
          animation: isConnected ? 'none' : 'pulse 2s ease-in-out infinite'
        }}></span>
        {isConnected ? '✅ Connected to Archipelago' : socket?.readyState === WebSocket.CONNECTING ? '🔄 Connecting to Archipelago...' : '❌ Not connected to Archipelago'}
      </div>

      {/* Archipelago Connection Settings */}
      <div style={{ 
        padding: '1.5rem', 
        marginBottom: '1.5rem',
        background: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          {/* Server URL */}
          <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '1.05em'
              }}
            >
              🌐 Server URL:
            </label>

            <input
              type="text"
              value={archipelagoUrl}
              onChange={(e) => setArchipelagoUrl(e.target.value)}
              placeholder="ws://localhost:38281"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid var(--border-color)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.95em',
                background: 'var(--surface)',
                color: 'var(--text-primary)'
              }}
            />

            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--text-muted)',
                marginTop: '0.5rem',
                fontStyle: 'italic'
              }}
            >
              💡 Default: ws://localhost:38281
            </div>
          </div>

          {/* Slot Name */}
          <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '1.05em'
              }}
            >
              👤 Slot Name:
            </label>

            <input
              type="text"
              value={slotName}
              onChange={(e) => setSlotName(e.target.value)}
              placeholder="Player1"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.95em',
                background: 'var(--surface)',
                color: 'var(--text-primary)'
              }}
            />

            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--text-muted)',
                marginTop: '0.5rem',
                fontStyle: 'italic'
              }}
            >
              💡 Your player/slot name
            </div>
          </div>

          {/* Server Password */}
          <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '1.05em'
              }}
            >
              🔑 Server Password:
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '2px solid var(--border-color)',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.95em',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)'
                }}
              />
               
              <button
                onClick={() => setShow(!show)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {show ? 'Hide' : 'Show'}
              </button>
              
            </div>
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--text-muted)',
                marginTop: '0.5rem',
                fontStyle: 'italic'
              }}
            >
              💡 Optional, only if your server has a password
            </div>
          </div>

          {/* Reconnect Button */}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={() => {
                const currentUrl = archipelagoUrl;
                setArchipelagoUrl('');
                setTimeout(() => setArchipelagoUrl(currentUrl), 100);
              }}
              style={{
                padding: '0.75rem 1.75rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: '48px'
              }}
            >
              🔄 Reconnect
            </button>
            
          </div>
          
        </div>
      </div>

      {/* Main Controls */}
      <div style={{ 
        display: "flex", 
        gap: "20px", 
        marginBottom: "20px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={allowSeq}
            onChange={(e) => setAllowSeq(e.target.checked)}
          />
          <span>Allow Sequence Breaks</span>
        </label>
        <button onClick={exportConditions}>📤 Export Conditions</button>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>📥 Import Conditions:</span>
          <input type="file" accept=".json" onChange={importConditions} />
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setViewMode("list")}
            style={{
              padding: "8px 16px",
              background: viewMode === "list" ? "#4CAF50" : "#607D8B",
              color: "white",
              border: "none",
              borderRadius: "4px"
            }}
          >
            📋 List View
          </button>
          <button
            onClick={() => setViewMode("map")}
            style={{
              padding: "8px 16px",
              background: viewMode === "map" ? "#4CAF50" : "#607D8B",
              color: "white",
              border: "none",
              borderRadius: "4px"
            }}
          >
            🗺️ Map View
          </button>
        </div>
        {viewMode === "map" && (
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              onClick={() => setMapEditMode(!mapEditMode)}
              style={{
                padding: "6px 12px",
                background: mapEditMode ? "#FF5722" : "#607D8B",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            >
              {mapEditMode ? "🔧 Exit Edit Mode" : "🔧 Edit Markers"}
            </button>
          </div>
        )}
      </div>

      {/* Map View - Show at top right when in map mode */}
      {viewMode === "map" && (
        <div style={{
          marginBottom: "20px",
          border: "2px solid #333",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <MapTracker
            locations={locationsWithReachability}
            onLocationClick={handleLocationClick}
            isEditMode={mapEditMode}
            onCoordinatesSaved={handleCoordinatesSaved}
          />
        </div>
      )}



      {/* Archipelago Configuration */}
      <div style={{ 
        marginBottom: "2rem",
        padding: "1.5rem",
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
        borderRadius: "16px",
        border: "2px solid rgba(139, 92, 246, 0.3)",
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
      }}>
        <h2 style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.8em',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center'
        }}>🎯 Archipelago Configuration</h2>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "20px",
          marginBottom: "20px"
        }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-primary)", fontSize: '1.05em' }}>
              🎯 Goal:
            </label>
            <select 
              value={selectedGoal}
              onChange={(e) => setSelectedGoal(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px", 
                borderRadius: "8px",
                border: '2px solid rgba(139, 92, 246, 0.3)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '1em',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <option value="summit-a">Summit A</option>
              <option value="summit-b">Summit B</option>
              <option value="summit-c">Summit C</option>
              <option value="core-a">Core A</option>
              <option value="core-b">Core B</option>
              <option value="core-c">Core C</option>
              <option value="empty-space">Empty Space</option>
              <option value="farewell">Farewell</option>
              <option value="farewell-golden">Farewell Golden</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-primary)", fontSize: '1.05em' }}>
              🍓 Strawberries Collected:
            </label>
            <div style={{ 
              fontSize: "2em", 
              fontWeight: "bold", 
              color: "#10b981", 
              padding: "12px",
              textAlign: "center",
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
              borderRadius: "10px",
              border: "2px solid rgba(16, 185, 129, 0.5)",
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.3s ease'
            }}>
              {strawberryCount}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-primary)", fontSize: '1.05em' }}>
              🔒 Goal Requirement:
            </label>
            <div style={{ 
              fontSize: "2em", 
              fontWeight: "bold", 
              color: "#f59e0b", 
              padding: "12px",
              textAlign: "center",
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
              borderRadius: "10px",
              border: "2px solid rgba(245, 158, 11, 0.5)",
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)',
              transition: 'all 0.3s ease'
            }}>
              {goalStrawberryRequirement}
            </div>
          </div>
        </div>

        <div style={{ 
          padding: "1.25rem",
          background: 'rgba(30, 41, 59, 0.6)',
          borderRadius: "12px",
          border: "1px solid rgba(139, 92, 246, 0.2)"
        }}>
          <label style={{ 
            display: 'block',
            fontWeight: "bold", 
            color: "var(--text-primary)",
            marginBottom: '12px',
            fontSize: '1.15em'
          }}>
            ⚙️ Logic Options:
          </label>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '10px'
          }}>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: (includeBSides || includeCSides) ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={includeBSides}
                    onChange={(e) => setIncludeBSides(e.target.checked)}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                  <span>B sides</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={includeCSides}
                    onChange={(e) => setIncludeCSides(e.target.checked)}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                  <span>C sides</span>
                </label>
              </div>
            </label>
            </div>
            
            
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: includeGoldenStrawberries ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={includeGoldenStrawberries}
                onChange={(e) => setIncludeGoldenStrawberries(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Include Golden Strawberries</span>
            </label>
            
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: includeCore ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={includeCore}
                onChange={(e) => setIncludeCore(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Include Core Chapter</span>
            </label>
            
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: includeFarewell ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={includeFarewell}
                onChange={(e) => setIncludeFarewell(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Include Farewell Chapter</span>
            </label>
            
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: includeCheckpoints ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={includeCheckpoints}
                onChange={(e) => setIncludeCheckpoints(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Include Checkpoints (Checkpointsanity)</span>
            </label>
            
            {/* new sanity toggles */}
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: binosanity ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={binosanity}
                onChange={(e) => setBinosanity(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Binosanity</span>
            </label>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: keysanity ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={keysanity}
                onChange={(e) => setKeysanity(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Keysanity</span>
            </label>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: gemsanity ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={gemsanity}
                onChange={(e) => setGemsanity(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Gemsanity</span>
            </label>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: carsanity ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={carsanity}
                onChange={(e) => setCarsanity(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Carsanity</span>
            </label>
            
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              color: "var(--text-primary)",
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: lockGoalArea ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={lockGoalArea}
                onChange={(e) => setLockGoalArea(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Lock Goal Area (Require Strawberries)</span>
            </label>
          </div>
        </div>


      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
        gap: '15px',
        marginBottom: '2rem'
      }}>
        <div className="stat-card" style={{ 
          padding: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)', 
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ fontSize: '0.95em', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>📍 Collectibles</div>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>
            {filteredLocations.length}
          </div>
        </div>
        <div className="stat-card" style={{ 
          padding: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)', 
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ fontSize: '0.95em', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>✅ Reachable</div>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#10b981' }}>
            {filteredLocations.filter(l => l.reachable).length}
          </div>
        </div>
        <div className="stat-card" style={{ 
          padding: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)', 
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ fontSize: '0.95em', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>☑️ Checked</div>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f59e0b' }}>
            {filteredLocations.filter(l => l.checked).length}
          </div>
        </div>
        <div className="stat-card" style={{ 
          padding: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)', 
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ fontSize: '0.95em', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>🔒 Locked</div>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#ef4444' }}>
            {filteredLocations.filter(l => !l.reachable).length}
          </div>
        </div>
        <div className="stat-card" style={{ 
          padding: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)', 
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ fontSize: '0.95em', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>⬜ Unchecked</div>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#8b5cf6' }}>
            {filteredLocations.filter(l => !l.checked).length}
          </div>
        </div>
      </div>

      {/* Current Mechanics */}
<div style={{ marginBottom: "30px" }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer"
    }}
    onClick={() => setShowMechanics(prev => !prev)}
  >
    <h2 style={{ margin: 0 }}>
      Current Mechanics (
      {Object.entries(mechanics).filter(([key, value]) => !key.includes('Key') && key !== 'noCondition' && value).length}
      /
      {Object.entries(mechanics).filter(([key]) => !key.includes('Key') && key !== 'noCondition').length}
      )
    </h2>

    <span style={{ fontSize: "1.5rem" }}>
      {showMechanics ? "▼" : "▶"}
    </span>
  </div>

  {showMechanics && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 8,
        marginTop: 12
      }}
    >
      {Object.entries(mechanics)
        .filter(([key]) => !key.includes('Key') && key !== 'noCondition')
        .map(([key, value]) => {
          const displayName = getMechanicDisplayName(key);

          return (
            <div
              key={key}
              style={{
                padding: 8,
                background: value ? "#4CAF50" : "#f5f5f5",
                color: value ? "white" : "#333",
                border: `1px solid ${value ? "#4CAF50" : "#ddd"}`,
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onClick={() => {
                setMechanics(prev => {
                  const mechanicKey = key as keyof MechanicsState;
                  const updated = { ...prev, [mechanicKey]: !prev[mechanicKey] };
                  logMechanicsChange(prev, updated);
                  return updated;
                });
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <span>{displayName}</span>
              <span style={{ fontWeight: "bold" }}>
                {value ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
    </div>
  )}
</div>

      {/* Current Keys - Display key toggles */}
      <div style={{ marginBottom: "30px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer"
          }}
          onClick={() => setShowKeys(prev => !prev)}
        >
          <h2 style={{ margin: 0 }}>
            Current Keys (
            {Object.entries(mechanics).filter(([key, value]) => key.includes('Key') && value).length}
            /
            {Object.entries(mechanics).filter(([key]) => key.includes('Key')).length}
            )
          </h2>

          <span style={{ fontSize: "1.5rem" }}>
            {showKeys ? "▼" : "▶"}
          </span>
        </div>

        {showKeys && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 8,
              marginTop: 12
            }}
          >
            {Object.entries(mechanics)
              .filter(([key]) => key.includes('Key'))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => {
                const displayName = getMechanicDisplayName(key);

                return (
                  <div
                    key={key}
                    style={{
                      padding: 8,
                      background: value ? "#2196F3" : "#f5f5f5",
                      color: value ? "white" : "#333",
                      border: `1px solid ${value ? "#2196F3" : "#ddd"}`,
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      whiteSpace: "pre-line"
                    }}
                    onClick={() => {
                      setMechanics(prev => {
                        const mechanicKey = key as keyof MechanicsState;
                        const updated = { ...prev, [mechanicKey]: !prev[mechanicKey] };
                        logMechanicsChange(prev, updated);
                        return updated;
                      });
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <span>{displayName}</span>
                    <span style={{ fontWeight: "bold" }}>{value ? "✓" : "✗"}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Filters - Only show in list view */}
      {viewMode === "list" && (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '15px',
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'rgba(30, 41, 59, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Chapter:
          </label>
          <select 
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="all">All Chapters</option>
            {chapters.map(ch => (
              <option key={ch} value={ch}>
                {getAreaName(ch)} ({ch})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Side:
          </label>
          <select 
            value={selectedSide}
            onChange={(e) => setSelectedSide(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="all">All Sides</option>
            {sides.map(side => (
              <option key={side} value={side}>Side {side}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Type:
          </label>
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="all">All Types</option>
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        {/* Add Reachability Filter */}
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Reachability:
          </label>
          <select 
            value={selectedReachability}
            onChange={(e) => setSelectedReachability(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="all">All</option>
            <option value="reachable">Reachable Only</option>
            <option value="unreachable">Unreachable Only</option>
            <option value="checked">Checked Only</option>
            <option value="unchecked">Unchecked Only</option>
          </select>
        </div>
        
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={() => {
              setSelectedChapter("all");
              setSelectedSide("all");
              setSelectedType("all");
              setSelectedReachability("all");
            }}
            style={{
              padding: "8px 16px",
              background: "#9e9e9e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              width: "100%"
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      )}

      {/* Content Display - Only show location list in list view */}
      {viewMode === "list" && (
      <>
      {/* Locations Display - Only Collectibles */}
      {Object.keys(locationsByChapter).length > 0 ? (
        Object.keys(locationsByChapter).sort((a, b) => parseInt(a) - parseInt(b)).map((chapterKey) => {
          const chapterNum = parseInt(chapterKey);
          const chapterLocations = locationsByChapter[chapterNum];
          
          return (
            <div key={chapterNum} style={{ marginBottom: "30px" }}>
              <h2 style={{ 
                padding: "10px", 
                background: "#673ab7", 
                color: "white",
                borderRadius: "4px"
              }}>
                {getAreaName(chapterNum)} (Chapter {chapterNum}) - {chapterLocations.length} collectibles
              </h2>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "15px" }}>
                {chapterLocations.map((loc) => {
                  const requiredKeys = getRequiredKeysFromLogic(loc.logic);
                  const locationSide = extractSideFromId(loc.id);
                  const locationType = extractTypeFromDisplayName(loc.displayName);
                  
                  return (
                    <div key={loc.id} style={{ 
                      opacity: loc.reachable ? 1 : 0.6,
                      padding: "15px",
                      background: loc.reachable ? (loc.checked ? "#000000ff" : "#000000ff") : "#000000ff",
                      border: `2px solid ${loc.checked ? "#2196F3" : loc.reachable ? "#4CAF50" : "#9e9e9e"}`,
                      borderRadius: "8px",
                      transition: "all 0.2s"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                        <input
                          type="checkbox"
                          checked={loc.checked}
                          disabled={!loc.reachable || loc.checked}
                          onChange={() => handleLocationCheck(loc)}
                          style={{ 
                            transform: "scale(1.3)",
                            cursor: loc.reachable && !loc.checked ? "pointer" : "not-allowed"
                          }}
                        />
                        <span style={{ 
                          fontSize: "1.3em",
                          fontWeight: "bold" 
                        }}>
                          {loc.checked ? "🔵" : loc.reachable ? "🟢" : "⚫"}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", fontSize: "1.1em" }}>{loc.displayName}</div>
                          <div style={{ fontSize: "0.9em", color: "#666", display: "flex", gap: "10px", marginTop: "4px" }}>
                            {locationSide && <span>Side: {locationSide}</span>}
                            {locationType && <span>Type: {locationType}</span>}
                          </div>
                        </div>
                        {loc.apLocationId && (
                          <span style={{ 
                            fontSize: "0.8em", 
                            color: "#666",
                            background: "#f0f0f0",
                            padding: "2px 6px",
                            borderRadius: "3px"
                          }}>
                            AP: {loc.apLocationId}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ margin: "10px 0" }}>
                        {showConditionEditors && (
                          <LogicEditor
                            logic={loc.logic}
                            onChange={(logic) =>
                              setLocations((prev) => ({
                                ...prev,
                                [loc.id]: { ...loc, logic },
                              }))
                            }
                            mechanics={mechanics}
                            isRoot={true}
                          />
                        )}
                      </div>
                      
                      {/* Location Info */}
                      <div style={{ 
                        fontSize: "0.85em", 
                        color: "#666",
                        padding: "8px",
                        background: "#f9f9f9",
                        borderRadius: "4px",
                        border: "1px solid #eee"
                      }}>
                        <div style={{ marginBottom: "4px" }}>
                          <strong>Status:</strong> {loc.checked ? "Checked" : loc.reachable ? "Reachable" : "Locked"}
                        </div>
                        {requiredKeys.length > 0 && (
                          <div style={{ marginBottom: "4px" }}>
                            <strong>Required:</strong> {requiredKeys.map(k => getMechanicDisplayName(k)).join(", ")}
                          </div>
                        )}
                        {!loc.reachable && !loc.checked && loc.logicEvaluation?.missing && loc.logicEvaluation.missing.length > 0 && (
                          <div style={{ marginBottom: "4px", color: "#f44336" }}>
                            <strong>Missing:</strong> {loc.logicEvaluation.missing.map(m => {
                              // Check if it's a mechanic key (has no spaces and is camelCase) or a message
                              if (m.includes(" ") || m.includes("(")) {
                                // It's already a formatted message (like "Requires 50 strawberries (have 25)")
                                return m;
                              } else {
                                // It's a mechanic key, format it
                                return getMechanicDisplayName(m);
                              }
                            }).join(", ")}
                          </div>
                        )}
                        <div style={{ 
                          color: loc.reachable ? "#4CAF50" : "#f44336",
                          fontWeight: "bold"
                        }}>
                          {loc.reachable ? "✓ Accessible" : "✗ Locked"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ 
          padding: "20px", 
          textAlign: "center", 
          background: "#f5f5f5",
          borderRadius: "8px",
          marginBottom: "20px"
        }}>
          <h3>No collectible locations match the current filters</h3>
          <p>Try adjusting your filter settings</p>
        </div>
      )}
      </>
      )}

      {/* Bottom Controls */}
      <div style={{ 
        display: "flex", 
        gap: "10px", 
        marginTop: "20px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            padding: "8px 16px",
            background: showDebug ? "#FF5722" : "#607D8B",
            color: "white",
            border: "none",
            borderRadius: "4px"
          }}
        >
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
        <button
          onClick={() => setShowConditionEditors(!showConditionEditors)}
          style={{
            padding: "8px 16px",
            background: showConditionEditors ? "#FF5722" : "#607D8B",
            color: "white",
            border: "none",
            borderRadius: "4px"
          }}
        >
          {showConditionEditors ? "Hide Condition Editors" : "Show Condition Editors"}
        </button>
        <button
          onClick={resetAllConditions}
          style={{
            padding: "8px 16px",
            background: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px"
          }}
        >
          Reset All Conditions
        </button>
        <button
          onClick={resetForNewServer}
          style={{
            padding: "8px 16px",
            background: "#FF5722",
            color: "white",
            border: "none",
            borderRadius: "4px"
          }}
        >
          Reset for New Server
        </button>
      </div>

      {showDebug && (
        <>
          {/* Logs */}
          <div>
            <h2>Logs ({logs.length})</h2>
            <div
              style={{
                background: "#111",
                color: "#0f0",
                padding: 12,
                height: 300,
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: 12,
                borderRadius: "4px"
              }}
            >
              {logs.length > 0 ? (
                logs.map((l, i) => (
                  <div key={i} style={{ 
                    padding: "2px 0",
                    borderBottom: i < logs.length - 1 ? "1px solid #333" : "none"
                  }}>
                    {l}
                  </div>
                ))
              ) : (
                <div style={{ color: "#888", textAlign: "center", padding: "20px" }}>
                  No logs yet
                </div>
              )}
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                marginTop: "10px",
                padding: "8px 16px",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px"
              }}
            >
              Clear Logs
            </button>
          </div>
          <LocationDiagnostic locations={locationsWithReachability} />
          <LocationDebugger locations={locationsWithReachability} />
          <DebugOverlay mechanics={mechanics} locations={locationsWithReachability} />
        </>
      )}
    </div>
  );
}