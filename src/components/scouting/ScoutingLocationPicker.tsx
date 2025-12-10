import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Circle, useMapEvents, useMap } from "react-leaflet";
import { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import { fieldsAPI, type Field } from "@/lib/api";
import { MapPin, Loader2, Navigation, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import L from "leaflet";
import { MapColors, getCropColor } from "@/lib/colors";

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom marker icon for scouting location (red pin)
const scoutingMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Custom icon for current device location (blue dot)
const currentLocationIcon = new L.DivIcon({
  html: `
    <div style="position: relative; width: 20px; height: 20px;">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        background: ${MapColors.locationMarker};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  className: 'current-location-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Note: getCropColor is now imported from @/lib/colors

// Component to fit map bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
}

interface ScoutingLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  locationDescription: string;
  fieldId: string | null;
  onUpdate: (updates: any) => void;
}

function LocationMarker({ position, setPosition }: { position: LatLng | null; setPosition: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position} icon={scoutingMarkerIcon} />;
}

export function ScoutingLocationPicker({
  latitude,
  longitude,
  locationAccuracy,
  locationDescription,
  fieldId,
  onUpdate,
}: ScoutingLocationPickerProps) {
  const [position, setPosition] = useState<LatLng | null>(
    latitude && longitude ? new LatLng(latitude, longitude) : null
  );
  const [fields, setFields] = useState<Field[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  
  // Current device location (continuous tracking)
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [currentLocationAccuracy, setCurrentLocationAccuracy] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    loadFields();
    // Auto-get current location on mount
    getCurrentLocation();
  }, []);

  // Watch device location continuously
  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation(new LatLng(latitude, longitude));
        setCurrentLocationAccuracy(accuracy);
      },
      (error) => {
        console.error("Geolocation watch error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Calculate map bounds from field boundaries
  useEffect(() => {
    if (fields.length > 0) {
      const bounds = L.latLngBounds([]);
      fields.forEach((field: any) => {
        if (field.geometry?.coordinates) {
          const coords = field.geometry.coordinates;
          
          // Handle different GeoJSON formats
          let allPolygons: number[][][][] = [];
          if (field.geometry.type === "Polygon") {
            allPolygons = [coords]; // Wrap single polygon in array
          } else if (field.geometry.type === "MultiPolygon") {
            allPolygons = coords; // Use all polygons
          }

          // Add all coordinates from all polygons to bounds
          allPolygons.forEach((polygon: number[][][]) => {
            polygon[0]?.forEach((coord: number[]) => {
              bounds.extend([coord[1], coord[0]]); // Leaflet uses [lat, lng]
            });
          });
        }
      });
      if (bounds.isValid()) {
        setMapBounds(bounds);
      }
    }
  }, [fields]);

  // Note: Position updates are now handled in handlePositionChange
  // to avoid conflicts with field detection
  // useEffect(() => {
  //   if (position) {
  //     onUpdate({
  //       latitude: position.lat,
  //       longitude: position.lng,
  //     });
  //   }
  // }, [position]);

  const loadFields = async () => {
    try {
      setLoadingFields(true);
      const response = await fieldsAPI.getFields({ include_geometry: true });
      
      // Filter fields that have geometry and sort alphabetically
      const fieldsWithBoundaries = (response.fields || [])
        .filter((field: any) => {
          return field.geometry && field.geometry.coordinates;
        })
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      
      setFields(fieldsWithBoundaries);
    } catch (error) {
      console.error("Failed to load fields:", error);
    } finally {
      setLoadingFields(false);
    }
  };

  // Detect field from location using backend API
  const detectFieldFromLocationAPI = async (lat: number, lng: number): Promise<any | null> => {
    try {
      const response = await fieldsAPI.detectFieldFromLocation(lat, lng);
      if (response.field_detected && response.field) {
        return response.field;
      }
      return null;
    } catch (error) {
      console.error('Failed to detect field:', error);
      return null;
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = new LatLng(latitude, longitude);
        setPosition(newPos);
        onUpdate({
          latitude,
          longitude,
          location_accuracy: accuracy,
        });
        setLoadingLocation(false);
        toast.success("Location captured");
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Failed to get your location. Please tap on the map.");
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handlePositionChange = async (newPos: LatLng) => {
    setPosition(newPos);
    
    // Auto-detect field using backend API
    try {
      const detectedField = await detectFieldFromLocationAPI(newPos.lat, newPos.lng);
      if (detectedField) {
        onUpdate({ 
          field_id: detectedField.field_id,
          latitude: newPos.lat,
          longitude: newPos.lng
        });
        toast.success(`Field detected: ${detectedField.name}`, { duration: 2000 });
      } else {
        onUpdate({ 
          field_id: null,
          latitude: newPos.lat,
          longitude: newPos.lng
        });
      }
    } catch (error) {
      console.error('Field detection failed:', error);
      // Still update position even if detection fails
      onUpdate({ 
        field_id: null,
        latitude: newPos.lat,
        longitude: newPos.lng
      });
    }
  };

  // Client-side detection removed - now using backend API with PostGIS

  return (
    <div className="flex flex-col h-full">
      {/* Map */}
      <div className="relative h-[50vh] border-b">
        {/* Loading State */}
        {loadingFields && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-[999]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading fields...</p>
            </div>
          </div>
        )}
        
        {/* Map Container - Always render but show loading overlay */}
        <MapContainer
          center={[40.0, -95.0]} // Default center (will be overridden by FitBounds)
          zoom={10}
          className="h-full w-full"
          zoomControl={true}
        >
          {/* Satellite imagery layer */}
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          
          {/* Labels and Boundaries Overlay */}
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          
          {/* Fit bounds to all fields */}
          {mapBounds && <FitBounds bounds={mapBounds} />}
          
          {/* Field boundaries */}
          {fields.map((field: any) => {
            if (!field.geometry?.coordinates) return null;
            
            const coords = field.geometry.coordinates;
            let allPolygons: number[][][][] = [];
            
            if (field.geometry.type === "Polygon") {
              allPolygons = [coords];
            } else if (field.geometry.type === "MultiPolygon") {
              allPolygons = coords;
            }
            
            const color = getCropColor(field.crop_name || field.name || "");
            
            return allPolygons.map((polygon: number[][][], polygonIndex: number) => {
              const positions = polygon.map((ring: number[][]) =>
                ring.map((coord: number[]) => [coord[1], coord[0]] as L.LatLngExpression)
              );
              
              return (
                <Polygon
                  key={`${field.field_id}-${polygonIndex}`}
                  positions={positions}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                />
              );
            });
          })}
          
          {/* Current device location (blue dot) */}
          {currentLocation && (
            <>
              <Marker position={currentLocation} icon={currentLocationIcon} />
              {currentLocationAccuracy && (
                <Circle
                  center={currentLocation}
                  radius={currentLocationAccuracy}
                  pathOptions={{
                    color: MapColors.locationMarker,
                    fillColor: MapColors.locationMarker,
                    fillOpacity: 0.1,
                    weight: 1,
                  }}
                />
              )}
            </>
          )}
          
          {/* Scouting location marker (red pin) */}
          <LocationMarker position={position} setPosition={handlePositionChange} />
        </MapContainer>

        {/* GPS Button Overlay */}
        <div className="absolute bottom-4 right-4 z-[1000]">
          <Button
            onClick={getCurrentLocation}
            disabled={loadingLocation}
            size="icon"
            className="rounded-full shadow-lg"
          >
            {loadingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Location Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Coordinates Display */}
        {position && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-medium">Location Captured</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
            {locationAccuracy && (
              <p className="text-xs text-muted-foreground">
                Accuracy: ±{locationAccuracy.toFixed(1)} meters
              </p>
            )}
          </div>
        )}

        {!position && (
          <div className="bg-muted border rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              📍 Tap on the map to set your scouting location, or use the GPS button
            </p>
          </div>
        )}

        {/* Field Selection */}
        <div className="space-y-2">
          <Label htmlFor="field-select">Field (Optional)</Label>
          <Select
            value={fieldId || "none"}
            onValueChange={(value) => onUpdate({ field_id: value === "none" ? null : value })}
            disabled={loadingFields}
          >
            <SelectTrigger id="field-select">
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No field selected</SelectItem>
              {fields.map((field) => (
                <SelectItem key={field.field_id} value={field.field_id}>
                  {field.name} {field.farm_name && `(${field.farm_name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location Description */}
        <div className="space-y-2">
          <Label htmlFor="location-desc">Location Description (Optional)</Label>
          <Input
            id="location-desc"
            placeholder="e.g., Northwest corner, near oak tree"
            value={locationDescription}
            onChange={(e) => onUpdate({ location_description: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Add a description to help identify this spot later
          </p>
        </div>

        {/* Tips - Collapsible */}
        <div className="bg-muted/50 border rounded-lg overflow-hidden">
          <button 
            onClick={() => setShowTips(!showTips)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors"
          >
            <p className="text-sm font-medium">💡 Location Tips</p>
            {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showTips && (
            <div className="px-3 pb-3 border-t pt-2">
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Use GPS for most accurate location</li>
                <li>Or tap on the map if GPS is unavailable</li>
                <li>Field selection helps organize your notes</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

