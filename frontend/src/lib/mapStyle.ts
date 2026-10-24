/**
 * The openfreemap "dark" style is near-black (land rgb(12,12,12), roads #181818,
 * labels rgb(101,101,101)), which reads as an unreadable void behind the app.
 * These overrides repaint the same layers with a legible navy palette — land
 * lighter than water, roads and place names near-white with a dark halo — while
 * keeping the dark look the rest of the UI uses.
 *
 * Applied with map.setPaintProperty() right after style load, so the base style
 * URL (and its tile/glyph/sprite sources) stays untouched.
 */
export const MAP_RECOLOR: Record<string, Record<string, string | number>> = {
  // Land & water
  background: { "background-color": "#24365a" },
  water: { "fill-color": "#0a1526" },
  waterway: {
    "line-color": "#4f96de",
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 13, 3] as unknown as number,
  },
  water_name: { "text-color": "#8fb3dd", "text-halo-color": "#0a1220", "text-halo-width": 1.4 },

  // Land use / cover
  landcover_ice_shelf: { "fill-color": "#43587a" },
  landcover_glacier: { "fill-color": "#43587a" },
  landuse_residential: { "fill-color": "#33466d", "fill-opacity": 0.6 },
  landuse_park: { "fill-color": "#26503c" },
  landcover_wood: { "fill-color": "#275036" },
  building: { "fill-color": "#33456a", "fill-outline-color": "#40557a" },

  // Aeroways
  "aeroway-taxiway": { "line-color": "#45566f" },
  "aeroway-runway-casing": { "line-color": "#0a1424" },
  "aeroway-area": { "fill-color": "#33415a" },
  "aeroway-runway": { "line-color": "#4a5a75" },

  // Piers read as land
  road_area_pier: { "fill-color": "#24365a" },
  road_pier: { "line-color": "#24365a" },

  // Roads: casing dark, surface bright
  highway_path: { "line-color": "#3d4d68" },
  highway_minor: { "line-color": "#4a5d80", "line-opacity": 0.95 },
  highway_major_casing: { "line-color": "#0a1424" },
  highway_major_inner: { "line-color": "#c3d2e8" },
  highway_major_subtle: { "line-color": "#5d7194" },
  highway_motorway_casing: { "line-color": "#0a1424" },
  highway_motorway_inner: { "line-color": "#f2f7ff" },
  highway_motorway_subtle: { "line-color": "#71869f" },

  // Rail
  railway_transit: { "line-color": "#6b7f9e" },
  railway_transit_dashline: { "line-color": "#24365a" },
  railway_minor: { "line-color": "#6b7f9e" },
  railway_minor_dashline: { "line-color": "#24365a" },
  railway: { "line-color": "#6b7f9e" },
  railway_dashline: { "line-color": "#24365a" },

  // Boundaries
  boundary_state: { "line-color": "#93a9c9" },
  "boundary_country_z0-4": { "line-color": "#97adcd" },
  "boundary_country_z5-": { "line-color": "#97adcd" },

  // Labels
  highway_name_other: {
    "text-color": "#cdd9ea",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.5,
  },
  highway_name_motorway: {
    "text-color": "#f0f5ff",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.5,
  },
  place_other: { "text-color": "#e3ebf7", "text-halo-color": "#0a1220", "text-halo-width": 1.6 },
  place_suburb: { "text-color": "#e3ebf7", "text-halo-color": "#0a1220", "text-halo-width": 1.6 },
  place_village: { "text-color": "#e3ebf7", "text-halo-color": "#0a1220", "text-halo-width": 1.6 },
  place_town: { "text-color": "#e3ebf7", "text-halo-color": "#0a1220", "text-halo-width": 1.6 },
  place_city: { "text-color": "#eef3fb", "text-halo-color": "#0a1220", "text-halo-width": 1.8 },
  place_city_large: {
    "text-color": "#eef3fb",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.8,
  },
  place_state: { "text-color": "#c3d3ea", "text-halo-color": "#0a1220", "text-halo-width": 1.4 },
  place_country_other: {
    "text-color": "#c4d2e8",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.4,
  },
  place_country_minor: {
    "text-color": "#c4d2e8",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.4,
  },
  place_country_major: {
    "text-color": "#c4d2e8",
    "text-halo-color": "#0a1220",
    "text-halo-width": 1.4,
  },
};
