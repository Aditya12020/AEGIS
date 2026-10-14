import L from 'leaflet';

/**
 * AEGIS Map Tile Provider Configuration
 * 
 * Supports:
 * 1. Configured custom key via VITE_MAP_PROVIDER_KEY or VITE_CARTO_API_KEY
 * 2. High-reliability dark canvas fallback (Esri World Dark Gray Base)
 *    which does not watermark or require API keys.
 * 3. Graceful fallback event handling.
 */
export function getMapTileLayer(onTileError?: () => void): L.TileLayer {
  const customKey = (import.meta as any).env?.VITE_MAP_PROVIDER_KEY || (import.meta as any).env?.VITE_CARTO_API_KEY;

  if (customKey && typeof customKey === 'string' && customKey.trim() !== '') {
    const layer = L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${customKey.trim()}`,
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '&copy; CartoDB, OpenStreetMap contributors',
      }
    );
    if (onTileError) {
      layer.on('tileerror', onTileError);
    }
    return layer;
  }

  // Reliable, un-watermarked dark basemap for maritime investigation
  const layer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 16,
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    }
  );

  if (onTileError) {
    layer.on('tileerror', onTileError);
  }

  return layer;
}
