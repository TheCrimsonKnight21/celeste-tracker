# Celeste Tracker - Code Architecture

## Overview

This document describes the refactored structure of the Celeste Tracker application. The app is a location tracking tool for the Celeste Archipelago randomizer.

## Project Structure

```
src/
├── Modules/           # React components
│   ├── App.tsx       # Main application component
│   ├── App.css       # Component-specific styles
│   ├── DebugOverlay.tsx
│   ├── LocationDebugger.tsx
│   ├── LocationDiagnostic.tsx
│   ├── LogicEditor.tsx
│   └── MapTracker/   # Map tracking subcomponent
├── Data/             # Data definitions and types
│   ├── locations.ts  # Location definitions
│   ├── requirements.ts
│   ├── strawberries.ts
│   ├── types.ts      # TypeScript type definitions
├── Logic/            # Game logic and mechanics
│   ├── logic.ts
│   ├── mechanics.ts
│   ├── mechanicsDisplay.ts
│   └── mechanicsMapping.ts
├── Archipelago/      # Archipelago multiplayer integration
│   ├── apParser.ts
│   ├── archipelago.ts
│   ├── useWebSocket.ts
├── utils/            # Utility functions (NEW!)
│   ├── helpers.ts    # Common helper functions
│   └── slotDataProcessor.ts  # Server slot data handling
├── assets/           # Static assets
├── main.tsx          # React entry point
├── index.css         # Global styles (consolidated)
└── App.css          # Component-specific styles
```

## Key Improvements Made

### 1. **Removed Redundant Files**
   - Deleted `src/Modules-old.zip` and `src/Modules.zip` (backup files)
   - Removed `src/Dev log.txt` (old development notes)
   - Cleaned up `src/Data/trackers.code-workspace` (stray config file)

### 2. **Extracted Utility Functions**
   
   **`src/utils/helpers.ts`** - Contains common helper functions:
   - `simpleStringHash()` - Generates stable numeric IDs from strings
   - `getAreaName()` - Maps chapter numbers to display names
   - `extractSideFromId()` - Extracts A/B/C side designation
   - `extractTypeFromDisplayName()` - Detects collectible types (strawberry, cassette, heart, key, etc.)
   - `isCollectibleLocationDef()` / `isCollectibleLocationState()` - Type checking helpers
   - `getRequiredKeysFromLogic()` - Extracts mechanic requirements from logic trees
   - `getMechanicDisplayName()` - Formats mechanic names for UI
   - `getMechanicKeyFromAPName()` - Maps Archipelago item names to mechanic keys
   - `enhanceAPNameMatching()` - Normalizes AP item name variations
   - `parseBool()` / `parseFarewellValue()` - Type conversion helpers
   - `getClientUUID()` - Manages client identification
   
   **`src/utils/slotDataProcessor.ts`** - Handles Archipelago server configuration:
   - `processSlotData()` - Applies server slot data to tracker settings
   - Supports goal configuration, side selection, sanity toggles, strawberry requirements

### 3. **Consolidated CSS**
   
   **Before:** Styles scattered in `App.css` and `index.css`
   **After:** Unified in `index.css` with organized sections:
   - Color variables and theme definitions
   - Component base styles (cards, badges, buttons)
   - Utility classes (spacing, text alignment)
   - Responsive design breakpoints
   - Animation definitions
   - Reduced inline styles in React components

### 4. **Improved Code Organization**
   
   - `src/Data/locations.ts` now imports `simpleStringHash` from `utils/helpers.ts`
   - `src/Modules/App.tsx` imports all helper functions from utilities
   - Removed 100+ lines of duplicate functions from App.tsx
   - Better separation of concerns: data, logic, utilities, UI

## Important Files & Their Purpose

### Data Layer
- **`locations.ts`**: Defines all in-game locations with their properties
- **`requirements.ts`**: Handles logic requirements and rules loading
- **`types.ts`**: TypeScript types for location, logic, and mechanics

### Logic Layer
- **`mechanics.ts`**: Defines game mechanics and their states
- **`logic.ts`**: Evaluates location reachability based on mechanics
- **`mechanicsMapping.ts`**: Maps Archipelago items to game mechanics

### UI Components
- **`App.tsx`**: Main controller component (still large, could be further split)
- **`LogicEditor.tsx`**: Edits location requirement logic
- **`MapTracker/`**: Visual map-based location tracking

### Utility Modules
- **`helpers.ts`**: ~340 lines of reusable helper functions
- **`slotDataProcessor.ts`**: ~120 lines for server configuration handling

## Running the Application

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build  
npm run preview

# Run type checking
npm run build

# Lint code
npm run lint

# Check location rules
npm run check-rules
```

## Future Refactoring Opportunities

1. **Extract more components from App.tsx** - Current file is 3400+ lines
   - LocationsList component
   - MechanicsPanel component
   - StatsPanel component
   - ArchipelagoPanel component

2. **Create a state management layer** - Consider using Context API or state management
   - Separate game logic from UI state
   - Improve performance with selective re-renders

3. **Add more granular CSS classes** to replace inline styles in remaining components

4. **Extract navigation logic** into separate utilities

5. **Add comprehensive error handling** for Archipelago connection issues

## Color Palette

The application uses a modern dark theme:
- **Primary**: #8b5cf6 (Purple)
- **Secondary**: #10b981 (Green/Emerald)
- **Accent**: #f59e0b (Amber)
- **Danger**: #ef4444 (Red)
- **Info**: #3b82f6 (Blue)
- **Background**: #0f172a to #1e293b (Dark Blue)

## Type Safety

The codebase uses TypeScript with strict type checking. Key types:
- `LocationDef`: Location definition
- `LocationState`: Location with runtime state
- `MechanicsState`: Current mechanics availability
- `LogicNode`: Requirement logic tree node

All functions are properly typed and documented with JSDoc comments.

## Performance Notes

- CSS is optimized with gradients and transitions
- Animations use hardware acceleration (`will-change`)
- Custom scrollbar styling for consistent appearance
- Responsive design adapts to mobile screens

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox for layout
- ES2020+ features via Vite build system

---

For detailed component documentation, see individual file headers.
