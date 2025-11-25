import { Polygon } from 'react-leaflet';
import { useManagementZones } from '@/hooks/useManagementZones';
import { LatLngExpression } from 'leaflet';

interface ManagementZonesLayerProps {
  fieldId: string | null | undefined;
  visible?: boolean;
  sourceType?: string;
}

// Zone colors: high=green, medium=yellow, low=red
const ZONE_COLORS = {
  high: '#4CAF50',    // Green - high productivity
  medium: '#FFC107',  // Yellow/Amber - medium productivity  
  low: '#F44336',     // Red - low productivity
};

const ZONE_FILL_OPACITY = 0.4;  // Slightly lower fill for better visibility
const ZONE_BORDER_OPACITY = 0.9; // Strong borders
const ZONE_BORDER_WEIGHT = 3;    // Thicker borders for visibility

/**
 * ManagementZonesLayer - Renders management zones on a Leaflet map
 * 
 * This layer component fetches and displays field-level management zones
 * (typically derived from satellite imagery analysis). Each zone represents
 * areas of similar productivity/characteristics (low/medium/high).
 * 
 * Features:
 * - Auto-fetches zones when fieldId changes
 * - Color-coded by productivity (red=low, yellow=medium, green=high)
 * - Respects visibility prop for toggling
 * - Handles loading and error states gracefully
 */
export function ManagementZonesLayer({
  fieldId,
  visible = true,
  sourceType = 'sentinel2_ndvi_7yr',
}: ManagementZonesLayerProps) {
  const { zones, loading, hasZones, error } = useManagementZones(
    fieldId,
    sourceType,
    visible // Only fetch when visible
  );

  // Debug logging
  if (visible && fieldId && zones.length > 0) {
    console.log(`[ManagementZones] Rendering ${zones.length} zones for field ${fieldId}`);
  }

  // Don't render if not visible or no zones
  if (!visible || !hasZones || loading) {
    return null;
  }

  return (
    <>
      {zones.map((zone) => {
        // Convert GeoJSON coordinates to Leaflet format
        // GeoJSON: [[[lon, lat], ...]]
        // Leaflet: [[lat, lon], ...]
        const positions: LatLngExpression[] = zone.geometry.coordinates[0].map(
          ([lon, lat]) => [lat, lon] as LatLngExpression
        );

        const color = ZONE_COLORS[zone.zone_class] || ZONE_COLORS.medium;

        return (
          <Polygon
            key={zone.zone_key}
            positions={positions}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: ZONE_FILL_OPACITY,
              weight: ZONE_BORDER_WEIGHT,
              opacity: ZONE_BORDER_OPACITY,
            }}
            // Ensure zones render on top of field boundaries
            pane="overlayPane"
          >
            {/* Future: Add popup with zone details
            <Popup>
              <div className="text-sm">
                <p className="font-semibold capitalize">{zone.zone_class} Productivity</p>
                <p className="text-xs text-muted-foreground">
                  {zone.zone_area_acres.toFixed(1)} acres
                </p>
              </div>
            </Popup>
            */}
          </Polygon>
        );
      })}
    </>
  );
}

