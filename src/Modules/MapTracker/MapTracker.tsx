import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { type LocationState } from "../../Data/locations";

// Map data structure - updated for multi-part maps
interface AreaMap {
  id: string;
  name: string;
  subMaps: SubMap[];
}

interface SubMap {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  locations: MapLocation[];
}

interface MapLocation {
  locationId: string;
  x: number; // X coordinate (0-1 relative to map)
  y: number; // Y coordinate (0-1 relative to map)
}

interface CoordinateData {
  [areaId: string]: {
    [subMapId: string]: MapLocation[];
  };
}

// Base marker style constant for better performance
const BASE_MARKER_STYLE = {
  position: "absolute" as const,
  transform: "translate(-50%, -50%)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: "bold",
  color: "white",
  boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
} as const;

// Helper function to get marker style based on location type
const getMarkerStyle = (location: LocationState) => {
  const markerColor = location.checked ? "#4CAF50" :
                     location.reachable ? "#2196F3" : "#f44336";

  // Different marker styles based on collectible type
  switch (location.type) {
    case "cassette":
      return {
        ...BASE_MARKER_STYLE,
        width: "24px",
        height: "24px",
        borderRadius: "4px",
        background: markerColor,
        border: "2px solid white",
        content: "♪"
      };
    case "heart":
      return {
        ...BASE_MARKER_STYLE,
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: markerColor,
        border: "2px solid white",
        content: "♥"
      };
    case "key":
      return {
        ...BASE_MARKER_STYLE,
        width: "20px",
        height: "20px",
        borderRadius: "2px",
        background: markerColor,
        border: "2px solid white",
        content: "🗝️"
      };
    case "event": // Level clear events
      return {
        ...BASE_MARKER_STYLE,
        width: "24px",
        height: "24px",
        borderRadius: "4px",
        background: markerColor,
        border: "2px solid white",
        content: "🏁"
      };
    default: // strawberry and other types
      return {
        ...BASE_MARKER_STYLE,
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: markerColor,
        border: "2px solid white",
        content: location.checked ? "✓" : location.reachable ? "?" : "✗"
      };
  }
};

// Configuration for where to find coordinate files for each area
const COORDINATE_FILE_PATHS: Record<string, string> = {
  "1_city": "/maps/1_city/1_city_coordinates.json",
  "2_old_site": "/maps/2_old_site/2_old_site_coordinates.json",
  "3_hotel": "/maps/3_hotel/3_hotel_coordinates.json",
  "4_ridge": "/maps/4_ridge/4_ridge_coordinates.json",
  "5_mirror_temple": "/maps/5_mirror_temple/5_mirror_temple_coordinates.json",
  "6_reflection": "/maps/6_reflection/6_reflection_coordinates.json",
  "7_summit": "/maps/7_summit/7_summit_coordinates.json",
  "8_core": "/maps/8_core/8_core_coordinates.json"
};

// Updated map data - organized by areas with sub-maps
// Locations will be loaded dynamically from the public folder
const AREA_MAPS_TEMPLATE: AreaMap[] = [
  {
    id: "1_city",
    name: "Forsaken City",
    subMaps: [
      {
        id: "city-start",
        name: "City Start",
        imageUrl: "/maps/1_city/city-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "city-crossing",
        name: "City Crossing",
        imageUrl: "/maps/1_city/city-crossing.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "city-chasm",
        name: "City Chasm",
        imageUrl: "/maps/1_city/city-chasm.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "2_old_site",
    name: "Old Site",
    subMaps: [
      {
        id: "old-site-start",
        name: "Old Site Start",
        imageUrl: "/maps/2_old_site/old-site-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "old-site-intervention",
        name: "Old Site Intervention",
        imageUrl: "/maps/2_old_site/old-site-intervention.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "old-site-awake",
        name: "Old Site Awake",
        imageUrl: "/maps/2_old_site/old-site-awake.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "3_hotel",
    name: "Celestial Resort",
    subMaps: [
      {
        id: "hotel-start",
        name: "Hotel Start",
        imageUrl: "/maps/3_hotel/hotel-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "hotel-elevator-shaft",
        name: "Hotel Elevator Shaft",
        imageUrl: "/maps/3_hotel/hotel-elevator-shaft.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "hotel-huge-mess",
        name: "Hotel Huge Mess",
        imageUrl: "/maps/3_hotel/hotel-huge-mess.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "hotel-presidential-suite",
        name: "Hotel Presidential Suite",
        imageUrl: "/maps/3_hotel/hotel-presidential-suite.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "4_ridge",
    name: "Golden Ridge",
    subMaps: [
      {
        id: "ridge-start",
        name: "Ridge Start",
        imageUrl: "/maps/4_ridge/ridge-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "ridge-old-trail",
        name: "Ridge Old Trail",
        imageUrl: "/maps/4_ridge/ridge-old-trail.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "ridge-cliff-face",
        name: "Ridge Cliff Face",
        imageUrl: "/maps/4_ridge/ridge-cliff-face.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "ridge-shrine",
        name: "Ridge Shrine",
        imageUrl: "/maps/4_ridge/ridge-shrine.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "5_mirror_temple",
    name: "Mirror Temple",
    subMaps: [
      {
        id: "mirror-temple-start",
        name: "Mirror Temple Start",
        imageUrl: "/maps/5_mirror_temple/mirror-temple-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "mirror-temple-depths",
        name: "Mirror Temple Depths",
        imageUrl: "/maps/5_mirror_temple/mirror-temple-depths.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "mirror-temple-search",
        name: "Mirror Temple Search",
        imageUrl: "/maps/5_mirror_temple/mirror-temple-search.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "mirror-temple-search-2",
        name: "Mirror Temple Search 2",
        imageUrl: "/maps/5_mirror_temple/mirror-temple-search-2.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "mirror-temple-unravelling",
        name: "Mirror Temple Unravelling",
        imageUrl: "/maps/5_mirror_temple/mirror-temple-unravelling.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "6_reflection",
    name: "Reflection",
    subMaps: [
      {
        id: "reflection-hollows",
        name: "Reflection Hollows",
        imageUrl: "/maps/6_reflection/reflection-hollows.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "7_summit",
    name: "The Summit",
    subMaps: [
      {
        id: "summit-start",
        name: "Summit Start",
        imageUrl: "/maps/7_summit/summit-start.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-500-m",
        name: "Summit 500 M",
        imageUrl: "/maps/7_summit/summit-500-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-1000-m",
        name: "Summit 1000 M",
        imageUrl: "/maps/7_summit/summit-1000-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-1500-m",
        name: "Summit 1500 M",
        imageUrl: "/maps/7_summit/summit-1500-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-2000-m",
        name: "Summit 2000 M",
        imageUrl: "/maps/7_summit/summit-2000-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-2500-m",
        name: "Summit 2500 M",
        imageUrl: "/maps/7_summit/summit-2500-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-3000-m",
        name: "Summit 3000 M",
        imageUrl: "/maps/7_summit/summit-3000-m.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-3000-m-1",
        name: "Summit 3000 M 1",
        imageUrl: "/maps/7_summit/summit-3000-m-1.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "summit-3000-m-2",
        name: "Summit 3000 M 2",
        imageUrl: "/maps/7_summit/summit-3000-m-2.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  },
  {
    id: "8_core",
    name: "Core",
    subMaps: [
      {
        id: "core-into-the-core",
        name: "Into the Core",
        imageUrl: "/maps/8_core/core-into-the-core.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "core-hot-and-cold",
        name: "Hot and Cold",
        imageUrl: "/maps/8_core/core-hot-and-cold.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "core-heart-of-the-mountain",
        name: "Heart of the Mountain",
        imageUrl: "/maps/8_core/core-heart-of-the-mountain.png",
        width: 800,
        height: 600,
        locations: []
      },
      {
        id: "core-heart-of-the-mountain-2",
        name: "Heart of the Mountain 2",
        imageUrl: "/maps/8_core/core-heart-of-the-mountain-2.png",
        width: 800,
        height: 600,
        locations: []
      }
    ]
  }
];

interface MapTrackerProps {
  locations: Record<string, LocationState>;
  onLocationClick: (locationId: string) => void;
  isEditMode?: boolean;
  onCoordinatesSaved?: (areaId: string, subMapId: string, locations: Array<{locationId: string, x: number, y: number}>) => void;
}

export function MapTracker({ locations, onLocationClick, isEditMode = false }: MapTrackerProps) {
  const [selectedArea, setSelectedArea] = useState<string>("1_city");
  const [selectedSubMap, setSelectedSubMap] = useState<string>("city-start");
  const [editMarkers, setEditMarkers] = useState<Array<{locationId: string, x: number, y: number, subMapId: string}>>([]);
  
  // State for dynamically loaded area maps
  const [areaMaps, setAreaMaps] = useState<AreaMap[]>(AREA_MAPS_TEMPLATE);

  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOccurred, setDragOccurred] = useState<boolean>(false);
  const [lastMousePos, setLastMousePos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [containerSize, setContainerSize] = useState<{width: number, height: number}>({width: 800, height: 600});
  const [actualImageSize, setActualImageSize] = useState<{width: number, height: number}>({width: 800, height: 600});

  // Ref for the map container
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load coordinates dynamically from public folder
  useEffect(() => {
    const loadCoordinates = async () => {
      const updatedMaps = await Promise.all(
        AREA_MAPS_TEMPLATE.map(async (area) => {
          const coordPath = COORDINATE_FILE_PATHS[area.id];
          if (!coordPath) return area;
          
          try {
            const response = await fetch(coordPath);
            if (!response.ok) {
              console.warn(`Coordinates not found for ${area.id}, using empty locations`);
              return area;
            }
            
            const coordinateData: CoordinateData = await response.json();
            const areaData = coordinateData[area.id];
            
            if (!areaData) {
              console.warn(`No coordinate data for area ${area.id}`);
              return area;
            }
            
            // Update sub-maps with their coordinate data
            const updatedSubMaps = area.subMaps.map(subMap => ({
              ...subMap,
              locations: areaData[subMap.id] || []
            }));
            
            return { ...area, subMaps: updatedSubMaps };
          } catch (error) {
            console.error(`Failed to load coordinates for ${area.id}:`, error);
            return area;
          }
        })
      );
      
      setAreaMaps(updatedMaps);
    };
    
    loadCoordinates();
  }, []);

  const currentArea = useMemo(() =>
    areaMaps.find(area => area.id === selectedArea) || areaMaps[0],
    [selectedArea, areaMaps]
  );

  const currentSubMap = useMemo(() => {
    const subMap = currentArea.subMaps.find(sub => sub.id === selectedSubMap);
    return subMap || currentArea.subMaps[0];
  }, [currentArea, selectedSubMap]);

  // Load existing coordinates into editMarkers when entering edit mode
  useEffect(() => {
    if (isEditMode && editMarkers.length === 0) {
      const area = areaMaps.find(a => a.id === selectedArea);
      if (area) {
        const allMarkers: Array<{locationId: string, x: number, y: number, subMapId: string}> = [];
        area.subMaps.forEach(subMap => {
          subMap.locations.forEach(loc => {
            allMarkers.push({
              locationId: loc.locationId,
              x: loc.x,
              y: loc.y,
              subMapId: subMap.id
            });
          });
        });
        setEditMarkers(allMarkers);
      }
    }
  }, [isEditMode, selectedArea, editMarkers.length, areaMaps]);

  // Reset edit markers, zoom/pan, and sub-map selection when changing areas
  useEffect(() => {
    if (!isEditMode) {
      setEditMarkers([]);
    }
    setZoom(1);
    setPanX(0);
    setPanY(0);
    // Reset to first sub-map of the new area
    const newArea = areaMaps.find(area => area.id === selectedArea);
    if (newArea && newArea.subMaps.length > 0) {
      setSelectedSubMap(newArea.subMaps[0].id);
    }
  }, [selectedArea, isEditMode, areaMaps]);

  // Reset zoom and pan when changing sub-maps
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [selectedSubMap]);

  // Update container size when component mounts or window resizes
  useEffect(() => {
    const updateContainerSize = () => {
      if (mapContainerRef.current) {
        setContainerSize({ 
          width: mapContainerRef.current.clientWidth, 
          height: mapContainerRef.current.clientHeight 
        });
      }
      // Also update actual image size if image is loaded
      if (imageRef.current) {
        setActualImageSize({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // Update image size when sub-map changes
  useEffect(() => {
    const updateImageSize = () => {
      if (imageRef.current) {
        setActualImageSize({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };
    // Delay to ensure image has loaded
    const timer = setTimeout(updateImageSize, 100);
    return () => clearTimeout(timer);
  }, [selectedSubMap]);

  // Add wheel event listener to prevent page scrolling
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(1, Math.min(3, zoom * zoomFactor));
      setZoom(newZoom);
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelEvent);
  }, [zoom]);

  // In edit mode, show all locations for the current area and sub-map
  const allLocationsForArea = useMemo(() => {
    if (!isEditMode) return [];

    // Map area IDs to chapter numbers
    const areaToChapter: Record<string, number> = {
      "1_city": 1,
      "2_old_site": 2,
      "3_hotel": 3,
      "4_ridge": 4,
      "5_mirror_temple": 5,
      "6_reflection": 6,
      "7_summit": 7,
      "8_core": 9
    };

    const chapter = areaToChapter[selectedArea];
    if (!chapter) return [];

    const filtered = Object.values(locations).filter(loc => {
      // Filter locations by chapter
      if (loc.chapter !== chapter) return false;

      // Only show A side locations (exclude B and C sides)
      // Check for patterns like "_B_" or "_C_" but not "_A_"
      const hasB = loc.id.includes("_B_");
      const hasC = loc.id.includes("_C_");
      if (hasB || hasC) return false;

      // Only show collectible locations and level clears
      return loc.type === "strawberry" || loc.type === "cassette" || loc.type === "heart" || loc.type === "key" || loc.type === "event" || loc.type === "checkpoint";
    });

    // Debug logging for Golden Ridge
    if (selectedArea === "4_ridge") {
      const allChapter4 = Object.values(locations).filter(loc => loc.chapter === 4);
      console.log(`Golden Ridge Debug:`);
      console.log(`- Total locations with chapter 4: ${allChapter4.length}`);
      console.log(`- After filtering: ${filtered.length}`);
      console.log(`- Sample filtered IDs:`, filtered.map(l => l.id));
      console.log(`- Sample filtered types:`, filtered.map(l => l.type));
      
      // Check what's being filtered out
      const filteredOut = allChapter4.filter(loc => !filtered.includes(loc));
      console.log(`- Filtered out count: ${filteredOut.length}`);
      console.log(`- Filtered out samples:`, filteredOut.slice(0, 5).map(l => `${l.id} (${l.type})`));
    }

    return filtered;
  }, [locations, selectedArea, isEditMode]);

  // Get markers placed in current sub-map
  const currentSubMapMarkers = useMemo(() => {
    return editMarkers.filter(marker => marker.subMapId === selectedSubMap);
  }, [editMarkers, selectedSubMap]);

  const mapLocations = useMemo(() => {
    if (isEditMode) {
      // In edit mode, show only markers for the current sub-map
      return editMarkers
        .filter(marker => marker.subMapId === selectedSubMap)
        .map(marker => ({
          ...marker,
          location: locations[marker.locationId]
        })).filter(item => item.location);
    } else {
      // In view mode, show default coordinates but only for locations that exist in the locations prop
      // This respects logic settings (e.g., golden strawberries only show when includeGoldenStrawberries is true)
      return currentSubMap.locations.map(mapLoc => {
        const location = locations[mapLoc.locationId];
        return {
          ...mapLoc,
          location
        };
      }).filter(item => item.location); // Only show locations that exist in the locations prop
    }
  }, [currentSubMap, locations, isEditMode, editMarkers, selectedSubMap]);

  // Handle map click in edit mode
  const handleMapClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode) return;
    
    // Don't place marker if a drag just occurred (panning)
    if (dragOccurred) {
      return;
    }

    const containerRect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - containerRect.left;
    const clickY = event.clientY - containerRect.top;
    
    // Use the actual displayed image dimensions instead of container dimensions
    // The image is set to width: 100%, height: auto, so it fills the container width
    // but the actual displayed height is based on the image's aspect ratio
    const displayedWidth = actualImageSize.width;
    const displayedHeight = actualImageSize.height;
    
    // The image is inside a container with transform: scale(zoom) translate(panX/zoom, panY/zoom)
    // Markers use percentage positioning (left: x*100%, top: y*100%)
    // With the transform, a marker at position (x%, y%) appears at screen coordinates:
    //   screenX = (x * displayedWidth) * zoom + panX
    //   screenY = (y * displayedHeight) * zoom + panY
    // 
    // Solving for x and y given click position (clickX, clickY):
    //   x = (clickX - panX) / (displayedWidth * zoom)
    //   y = (clickY - panY) / (displayedHeight * zoom)
    const x = (clickX - panX) / (displayedWidth * zoom);
    const y = (clickY - panY) / (displayedHeight * zoom);

    // Find the next location that doesn't have a marker yet
    const unmarkedLocations = allLocationsForArea.filter(loc =>
      !editMarkers.some(marker => marker.locationId === loc.id)
    );

    if (unmarkedLocations.length > 0) {
      const nextLocation = unmarkedLocations[0];
      const newMarker = {
        locationId: nextLocation.id,
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        subMapId: selectedSubMap
      };

      setEditMarkers(prev => [...prev, newMarker]);
    }
  }, [isEditMode, dragOccurred, panX, panY, zoom, allLocationsForArea, editMarkers, selectedSubMap, actualImageSize]);

  // Remove marker in edit mode
  const removeMarker = useCallback((locationId: string) => {
    setEditMarkers(prev => prev.filter(marker => marker.locationId !== locationId));
  }, []);

  // Export coordinates in edit mode - exports ALL sub-maps for the current area
  const exportCoordinates = useCallback(() => {
    const area = areaMaps.find(a => a.id === selectedArea);
    if (!area) return;

    // Group markers by sub-map
    const subMapsData: Record<string, Array<{locationId: string, x: number, y: number}>> = {};
    
    // Initialize all sub-maps with empty arrays
    area.subMaps.forEach(subMap => {
      subMapsData[subMap.id] = [];
    });

    // Populate with markers
    editMarkers.forEach(marker => {
      if (!subMapsData[marker.subMapId]) {
        subMapsData[marker.subMapId] = [];
      }
      subMapsData[marker.subMapId].push({
        locationId: marker.locationId,
        x: marker.x,
        y: marker.y
      });
    });

    const coordinates = {
      [selectedArea]: subMapsData
    };

    const dataStr = JSON.stringify(coordinates, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `${selectedArea}_coordinates.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [selectedArea, editMarkers, areaMaps]);

  // Clear all markers in current sub-map
  const clearMarkers = useCallback(() => {
    setEditMarkers(prev => prev.filter(marker => marker.subMapId !== selectedSubMap));
  }, [selectedSubMap]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only start dragging if we're not clicking on a marker or other interactive element
    const target = event.target as HTMLElement;
    const isMarker = target.closest('[data-marker]');
    const isInteractive = target.tagName === 'BUTTON' || target.closest('button');
    
    if (!isMarker && !isInteractive && event.button === 0) { // Left mouse button, not on marker or button
      setIsDragging(true);
      setDragOccurred(false);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;
      
      // If mouse moved significantly, mark that a drag occurred
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        setDragOccurred(true);
      }
      
      // Calculate proper pan limits based on container size and zoom
      // Images are scaled to fit container width, maintaining 800x600 aspect ratio (4:3)
      const imageAspectRatio = 600 / 800; // 0.75
      const displayWidth = containerSize.width;
      const displayHeight = displayWidth * imageAspectRatio;
      
      const maxPanX = Math.max(0, displayWidth * (zoom - 1));
      const maxPanY = Math.max(0, displayHeight * (zoom - 1));
      
      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, panX + deltaX));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, panY + deltaY));
      
      setPanX(newPanX);
      setPanY(newPanY);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const zoomIn = () => setZoom(Math.min(3, zoom * 1.2));
  const zoomOut = () => setZoom(Math.max(1, zoom * 0.8));
  const resetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>🗺️ Map Tracker</h2>

      {/* Area and Sub-map Selectors */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Select Area:
          </label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", minWidth: "150px" }}
          >
            {areaMaps.map(area => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Select Map:
          </label>
          <select
            value={selectedSubMap}
            onChange={(e) => setSelectedSubMap(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", minWidth: "150px" }}
          >
            {currentArea.subMaps.map(subMap => (
              <option key={subMap.id} value={subMap.id}>
                {subMap.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zoom Controls */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "#ffffff", fontWeight: "bold" }}>Zoom:</span>
        <button
          onClick={zoomOut}
          style={{
            padding: "8px 12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🔍-
        </button>
        <span style={{ color: "#ffffff", minWidth: "60px", textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          style={{
            padding: "8px 12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🔍+
        </button>
        <button
          onClick={resetZoom}
          style={{
            padding: "8px 12px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Reset
        </button>
        <span style={{ color: "#cccccc", fontSize: "12px", marginLeft: "10px" }}>
          Mouse wheel to zoom • Drag to pan • Right-click markers to interact
        </span>
      </div>

      {/* Map Container */}
      <div 
        ref={mapContainerRef}
        style={{
          position: "relative",
          border: "2px solid #333",
          borderRadius: "8px",
          overflow: "hidden",
          background: "#000000",
          maxWidth: "100%",
          minHeight: "400px",
          height: "auto",
          userSelect: "none"
        }}
      >
        <div style={{
          position: "relative",
          width: "100%",
          minHeight: "400px",
          height: "auto",
          cursor: isDragging ? "grabbing" : (isEditMode ? "crosshair" : "grab"),
          userSelect: "none"
        }}
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}>
          {/* Map Image */}
          <div style={{
            transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            transformOrigin: "0 0",
            width: "100%",
            height: "auto",
            userSelect: "none"
          }}>
            <img
              ref={imageRef}
              src={currentSubMap.imageUrl}
              alt={currentSubMap.name}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                pointerEvents: "none",
                userSelect: "none"
              }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                setActualImageSize({
                  width: img.clientWidth,
                  height: img.clientHeight
                });
              }}
              onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div style="
                    width: 100%;
                    height: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(45deg, #e0e0e0, #c0c0c0);
                    color: #666;
                    font-size: 18px;
                    font-weight: bold;
                  ">
                    🏔️ ${currentSubMap.name}<br/>
                    <small>(Map image not found)</small>
                  </div>
                `;
              }
            }}
          />

          {/* Location Markers */}
          {mapLocations.map((mapLoc) => {
            const { location, x, y } = mapLoc;
            const markerStyle = getMarkerStyle(location);

            return (
              <div
                key={location.id}
                data-marker="true"
                style={{
                  ...markerStyle,
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  position: "absolute",
                  pointerEvents: "auto"
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditMode) {
                    removeMarker(location.id);
                  } else {
                    onLocationClick(location.id);
                  }
                }}
                title={isEditMode ?
                  `${location.displayName} - Click to remove` :
                  (() => {
                    const status = location.checked ? "Checked" : location.reachable ? "Reachable" : "Locked";
                    let tooltip = `${location.displayName} - ${status}`;

                    if (!location.checked && location.logicEvaluation) {
                      const evalResult = location.logicEvaluation;
                      if (evalResult.missing.length > 0) {
                        tooltip += `\nMissing: ${evalResult.missing.join(", ")}`;
                      } else if (evalResult.status === "free") {
                        tooltip += "\nReason: Always available";
                      } else if (evalResult.status === "sequence") {
                        tooltip += "\nReason: Requires sequence break";
                      }
                    }

                    return tooltip;
                  })()
                }
              >
                {markerStyle.content}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Edit Mode Controls */}
      {isEditMode && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          background: "#1a1a1a",
          borderRadius: "8px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div style={{ color: "#ffffff", fontWeight: "bold" }}>
            Edit Mode: {currentSubMapMarkers.length} / {allLocationsForArea.length} markers placed in {currentSubMap.name}
          </div>
          <button
            onClick={exportCoordinates}
            style={{
              padding: "8px 16px",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Export Coordinates
          </button>
          <button
            onClick={clearMarkers}
            style={{
              padding: "8px 16px",
              background: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Clear All
          </button>
          <div style={{ color: "#cccccc", fontSize: "12px" }}>
            Click on map to place markers. Click markers to remove them.
          </div>
        </div>
      )}

      {/* Edit Mode Location List */}
      {isEditMode && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          background: "#1a1a1a",
          borderRadius: "8px",
          maxHeight: "300px",
          overflowY: "auto"
        }}>
          <h3 style={{ color: "#ffffff", marginTop: 0 }}>Locations to Place:</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "5px" }}>
            {allLocationsForArea.map(loc => {
              const hasMarker = editMarkers.some(marker => marker.locationId === loc.id);
              return (
                <div
                  key={loc.id}
                  style={{
                    color: hasMarker ? "#4CAF50" : "#ffffff",
                    fontSize: "12px",
                    textDecoration: hasMarker ? "line-through" : "none"
                  }}
                >
                  {hasMarker ? "✓" : "○"} {loc.displayName}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: "20px",
        padding: "15px",
        background: "#000000",
        color: "#ffffff",
        borderRadius: "8px",
        display: "flex",
        gap: "20px",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#4CAF50",
            border: "2px solid white"
          }}></div>
          <span>Checked</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#2196F3",
            border: "2px solid white"
          }}></div>
          <span>Reachable</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#f44336",
            border: "2px solid white"
          }}></div>
          <span>Locked</span>
        </div>
      </div>
    </div>
  );
}