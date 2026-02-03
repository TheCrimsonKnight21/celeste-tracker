# Coordinate Files Management

## Overview

The map tracker now loads coordinate files dynamically from the `public/maps/` folder, allowing you to update marker positions without rebuilding the application.

## File Structure

Coordinate files should be placed in their respective area folders:

```
public/maps/
  ├── 1_city/
  │   └── 1_city_coordinates.json
  ├── 2_old_site/
  │   └── 2_old_site_coordinates.json
  ├── 3_hotel/
  │   └── 3_hotel_coordinates.json
  ├── 4_ridge/
  │   └── 4_ridge_coordinates.json
  ├── 5_mirror_temple/
  │   └── 5_mirror_temple_coordinates.json
  ├── 6_reflection/
  │   └── 6_reflection_coordinates.json
  ├── 7_summit/
  │   └── 7_summit_coordinates.json
  └── 8_core/
      └── 8_core_coordinates.json
```

## Coordinate File Format

Each coordinate file should follow this structure:

```json
{
  "area_id": {
    "sub-map-id": [
      {
        "locationId": "location-name",
        "x": 0.5,
        "y": 0.5
      }
    ]
  }
}
```

### Example (1_city_coordinates.json):

```json
{
  "1_city": {
    "city-start": [
      {
        "locationId": "1A - Forsaken City",
        "x": 0.4,
        "y": 0.3
      },
      {
        "locationId": "1A - Forsaken City - Start of Climb Strawberry",
        "x": 0.6,
        "y": 0.5
      }
    ],
    "city-crossing": [
      {
        "locationId": "1A - Forsaken City - Crossing Strawberry",
        "x": 0.5,
        "y": 0.4
      }
    ],
    "city-chasm": [
      {
        "locationId": "1A - Forsaken City - Chasm Strawberry",
        "x": 0.3,
        "y": 0.7
      }
    ]
  }
}
```

## How to Update Coordinates

### Method 1: Manual Update

1. Open the coordinate file for the area you want to update (e.g., `public/maps/1_city/1_city_coordinates.json`)
2. Edit the x and y coordinates (values between 0 and 1, relative to map dimensions)
3. Save the file
4. Refresh your browser to see the changes

### Method 2: Using Edit Mode

1. Enable Edit Mode in the map tracker
2. Place or adjust markers on the map
3. Click "Export Coordinates" to download the updated coordinate file
4. Replace the corresponding file in `public/maps/{area_id}/` with the downloaded file
5. Refresh your browser to verify the changes

## Coordinates System

- **x**: Horizontal position (0 = left edge, 1 = right edge)
- **y**: Vertical position (0 = top edge, 1 = bottom edge)
- Coordinates are relative to the map image dimensions

## Tips

- Always keep a backup of your coordinate files before making changes
- Use Edit Mode to visually place markers rather than manually calculating coordinates
- The export function creates a complete coordinate file for all sub-maps in an area
- If a coordinate file is missing or malformed, the area will display with empty locations (no markers)
- Check the browser console for any loading errors

## Troubleshooting

### Markers not showing up

1. Verify the coordinate file exists in the correct folder
2. Check the file name matches the expected pattern (e.g., `1_city_coordinates.json`)
3. Validate the JSON structure is correct
4. Check browser console for errors
5. Try refreshing the page with Ctrl+Shift+R (hard refresh)

### Wrong marker positions

1. Verify coordinates are between 0 and 1
2. Check that you're editing the correct sub-map's coordinates
3. Ensure the locationId matches exactly (case-sensitive)
