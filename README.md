# Celeste Tracker (Archipelago)

A web-based **Archipelago Tracker** for *Celeste*, designed to display
progression, reachable checks, and game configuration during multiplayer
Archipelago sessions.

This tracker automatically interprets level logic data and visualizes
progression state in real time.

------------------------------------------------------------------------

## Overview

Celeste Tracker is a browser application built to support **Archipelago
multiworld runs**.

It provides:

-   Automatic slot data configuration detection
-   Dynamic location reachability logic
-   Manual override capability
-   Offline fallback support
-   Persistent custom logic settings

The tracker focuses on reliability, clarity, and compatibility with
Archipelago standards.

------------------------------------------------------------------------

## Features

### Archipelago Integration

When connected to an Archipelago room, the tracker automatically reads
slot data and applies:

-   B-Sides
-   C-Sides
-   Checkpointsanity
-   Keysanity
-   Gemsanity
-   Binosanity
-   Carsanity

Settings are shown directly in the UI for verification.

### Dynamic Logic Parsing

-   Uses `CelesteLevelData.json`
-   Converts requirement rules into internal logic keys
-   Normalizes requirement names automatically
-   Supports future parser updates without code changes

### Offline Mode

If remote data fails to load, the tracker falls back to bundled logic
data.

### Persistent Custom Logic

Manual rule adjustments are stored in browser localStorage and persist
between sessions.

------------------------------------------------------------------------

## Requirements

-   Node.js 18+
-   npm

------------------------------------------------------------------------

## Installation

Clone the repository:

``` bash
git clone https://github.com/TheCrimsonKnight21/celeste-tracker.git
cd celeste-tracker
```

Install dependencies:

``` bash
npm install
```

Start development server:

``` bash
npm run dev
```

Open:

    http://localhost:5173

------------------------------------------------------------------------

## Available Scripts

  Command               Description
  --------------------- -----------------------------
  npm run dev           Start development server
  npm run build         Build production version
  npm run preview       Preview production build
  npm run check-rules   Validate parsed logic rules

------------------------------------------------------------------------

## Updating Logic Data

Replace:

    public/CelesteLevelData.json

with a newly exported parser file, then restart the server.

------------------------------------------------------------------------

## Resetting Logic Cache

If logic behaves unexpectedly:

Open browser console:

``` js
localStorage.removeItem('celeste-location-logic');
```

Refresh the page.

------------------------------------------------------------------------

## Development

Tech Stack:

-   React
-   TypeScript
-   Vite

Suggested improvements:

-   Expanded shortcut logic modeling
-   Performance optimization
-   Additional tracker integrations

------------------------------------------------------------------------

## Contributing

1.  Fork repository
2.  Create feature branch
3.  Submit Pull Request

Contributions are welcome.

------------------------------------------------------------------------

## License

No license currently specified.

Until a license is added, all rights remain with the repository owner.

------------------------------------------------------------------------

## Acknowledgements

-   Archipelago Multiworld Project
-   Celeste Modding Community
