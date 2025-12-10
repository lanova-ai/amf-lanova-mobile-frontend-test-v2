import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, Circle } from "react-leaflet";
import { Loader2, ChevronDown, ChevronUp, Camera, Mic, FileText, Trash2, Layers, Navigation } from "lucide-react";
import { fieldsAPI, fieldNotesAPI, FieldNote, voiceAPI, documentsAPI, handlePageError } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import { ManagementZonesLayer } from "@/components/ManagementZonesLayer";
import NDVIMapLayer from "@/components/NDVIMapLayer";
import NDVILegend from "@/components/NDVILegend";
import PrecipMapLayer from "@/components/PrecipMapLayer";
import PrecipLegend from "@/components/PrecipLegend";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapColors, getCropColor } from "@/lib/colors";

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icon for current location (blue dot)
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

// Component to fit map bounds to all fields
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
}

// Component to track zoom level
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    
    // Initial zoom
    onZoomChange(map.getZoom());
    
    // Listen for zoom changes
    map.on('zoomend', handleZoom);
    
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  
  return null;
}

// Note: getCropColor is now imported from @/lib/colors

// Calculate NDVI date range (last 15 days)
// Note: Satellite data has a 3-4 day processing delay
function getNDVIDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3); // Use data from 3 days ago to account for processing delay
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 15); // 15 days before the end date
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

// Calculate Precipitation date range (last 7 days for MVP)
function getPrecipDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

const FieldsMap = () => {
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  
  // Field boundaries state
  const [showFieldBoundaries, setShowFieldBoundaries] = useState(true);
  
  // Management zones state (for specific field only)
  const [zonesFieldId, setZonesFieldId] = useState<string | null>(null);
  
  // NDVI state
  const [showNDVI, setShowNDVI] = useState(false);
  const [ndviOpacity, setNDVIOpacity] = useState(0.7);
  const [ndviLoading, setNDVILoading] = useState(false);
  const [ndviLegendData, setNDVILegendData] = useState<any | null>(null);
  
  // Precipitation state
  const [showPrecip, setShowPrecip] = useState(false);
  const [precipOpacity, setPrecipOpacity] = useState(0.7);
  const [precipLoading, setPrecipLoading] = useState(false);
  const [precipLegendData, setPrecipLegendData] = useState<any | null>(null);
  
  // Field notes state
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>([]);
  
  // Map zoom state
  const [currentZoom, setCurrentZoom] = useState(10);
  const MIN_ZOOM_FOR_MARKERS = 13; // Show markers only when zoomed in to level 13 or more
  
  // Marker state
  const [markerPosition, setMarkerPosition] = useState<L.LatLng | null>(null);
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [fieldNoteId, setFieldNoteId] = useState<string | null>(null);
  const [creatingFieldNote, setCreatingFieldNote] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingFieldNote, setDeletingFieldNote] = useState(false);
  const [popupInteractionActive, setPopupInteractionActive] = useState(false);
  
  // Current location state
  const [currentLocation, setCurrentLocation] = useState<L.LatLng | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  // Smart navigation based on what's attached to the field note
  const handleViewDetails = async (note: FieldNote) => {
    try {
      // Priority: Voice Note > Document > Text Note
      if (note.voice_note_count > 0) {
        // Fetch voice notes for this field note using proper API client
        const voiceData = await voiceAPI.getVoiceNotes({ field_note_id: note.id, limit: 1 });
        const voiceNote = voiceData.voice_notes?.[0];
        
        if (voiceNote) {
          navigate(`/recordings/${voiceNote.id}`);
          return;
        }
      }
      
      if (note.document_count > 0) {
        // Fetch documents for this field note using proper API client
        const docsData = await documentsAPI.getDocuments({ field_note_id: note.id, limit: 1 });
        const doc = docsData.documents?.[0];
        
        if (doc) {
          navigate(`/documents/${doc.id}`);
          return;
        }
      }
      
      // Fallback: Navigate to field note detail (text note or observation)
      navigate(`/field-notes/${note.id}`);
    } catch (error) {
      console.error('Error navigating to details:', error);
      toast.error('Failed to open details');
    }
  };

  useEffect(() => {
    const fetchFieldsAndNotes = async () => {
      try {
        setLoading(true);
        
        // Fetch fields and field notes in parallel
        const [fieldsData, fieldNotesData] = await Promise.all([
          fieldsAPI.getFields({ include_geometry: true }),
          fieldNotesAPI.listFieldNotes({ limit: 500 }).catch(() => ({ field_notes: [], total: 0 }))
        ]);
        
        const data = fieldsData;
        
        // Filter fields that have geometry
        const fieldsWithBoundaries = data.fields.filter((field: any) => {
          return field.geometry && field.geometry.coordinates;
        });

        if (fieldsWithBoundaries.length === 0) {
          toast.error("No fields with boundaries found");
          setLoading(false);
          return;
        }

        setFields(fieldsWithBoundaries);

        // Calculate bounds to fit all fields (including all polygons in MultiPolygon fields)
        const bounds = L.latLngBounds([]);
        fieldsWithBoundaries.forEach((field: any) => {
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

        // Store field notes
        setFieldNotes(fieldNotesData.field_notes);

        toast.success(`Loaded ${fieldsWithBoundaries.length} fields${fieldNotesData.field_notes.length > 0 ? ` and ${fieldNotesData.field_notes.length} location notes` : ''}`);
      } catch (error: any) {
        console.error("Error fetching fields:", error);
        const errorMsg = handlePageError(error, "Failed to load fields");
        if (errorMsg) toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchFieldsAndNotes();
  }, []);

  // Track user's current location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    let watchId: number;

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      setCurrentLocation(L.latLng(latitude, longitude));
      setLocationAccuracy(accuracy);
      setLocationError(null);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error);
      setLocationError(error.message);
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // Watch position for updates
    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // Cleanup
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Clear marker and reset state
  const clearMarker = () => {
    setMarkerPosition(null);
    setSelectedField(null);
    setFieldNoteId(null);
  };

  // Delete field note
  const handleDeleteFieldNote = async () => {
    if (!fieldNoteId) {
      return;
    }

    try {
      setDeletingFieldNote(true);
      await fieldNotesAPI.deleteFieldNote(fieldNoteId);
      
      // Remove from field notes list
      setFieldNotes(prev => prev.filter(note => note.id !== fieldNoteId));
      
      toast.success("Location note deleted");
      clearMarker();
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error("Error deleting field note:", error);
      toast.error("Failed to delete location note");
    } finally {
      setDeletingFieldNote(false);
    }
  };

  // Create or get existing field note
  const ensureFieldNote = async (): Promise<string | null> => {
    if (fieldNoteId) {
      return fieldNoteId; // Already created
    }

    if (!markerPosition || !selectedField) {
      toast.error("No location selected");
      return null;
    }

    try {
      setCreatingFieldNote(true);
      const fieldNote = await fieldNotesAPI.createFieldNote({
        field_id: selectedField.field_id,
        location: {
          lat: markerPosition.lat,
          lon: markerPosition.lng,
        },
      });
      
      // Add to field notes list
      setFieldNotes(prev => [...prev, fieldNote]);
      
      setFieldNoteId(fieldNote.id);
      toast.success("Location note created");
      return fieldNote.id;
    } catch (error: any) {
      console.error("Error creating field note:", error);
      toast.error("Failed to create location note");
      return null;
    } finally {
      setCreatingFieldNote(false);
    }
  };

  // Convert GeoJSON coordinates to Leaflet positions
  // Returns an array of polygon position arrays to handle both Polygon and MultiPolygon
  const getFieldPolygons = (field: any): L.LatLngExpression[][][] => {
    if (!field.geometry?.coordinates) return [];

    const coords = field.geometry.coordinates;
    let polygons: number[][][][] = [];

    if (field.geometry.type === "Polygon") {
      // Single polygon: wrap it in an array to standardize handling
      polygons = [coords];
    } else if (field.geometry.type === "MultiPolygon") {
      // Multiple polygons: use all of them
      polygons = coords;
    }

    // Convert [lng, lat] to [lat, lng] for Leaflet
    // For each polygon, map all rings (outer + holes)
    return polygons.map((polygon: number[][][]) =>
      polygon.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as L.LatLngExpression)
      )
    );
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-[999]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-farm-accent" />
            <p className="text-farm-muted">Loading fields...</p>
          </div>
        </div>
      )}

      {/* Map Container */}
      {!loading && fields.length > 0 && (
        <MapContainer
          center={[40.0, -95.0]} // Default center (will be overridden by FitBounds)
          zoom={10}
          className="w-full h-full"
        >
          {/* Satellite Base Layer */}
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
          
          {/* Track zoom level */}
          <ZoomTracker onZoomChange={setCurrentZoom} />

          {/* Render field polygons */}
          {showFieldBoundaries && fields.map((field: any) => {
            const polygons = getFieldPolygons(field);
            const cropColor = getCropColor(field.crop_name);

            // Render all polygons for this field (handles both Polygon and MultiPolygon)
            return polygons.length > 0 ? (
              polygons.map((positions, polygonIndex) => (
                <Polygon
                  key={`${field.field_id}-${polygonIndex}`}
                  positions={positions}
                  pathOptions={{
                    color: cropColor,
                    fillColor: cropColor,
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      // Don't create marker if user is interacting with a popup
                      if (popupInteractionActive) {
                        return;
                      }
                      
                      // Place marker at click location (reset field note for new location)
                      setMarkerPosition(e.latlng);
                      setSelectedField(field);
                      setFieldNoteId(null); // Reset field note when placing new marker
                    },
                  }}
                />
              ))
            ) : null;
          })}

          {/* Render management zones layer for selected field only */}
          {zonesFieldId && (
            <ManagementZonesLayer
              key={`zones-${zonesFieldId}`}
              fieldId={zonesFieldId}
              visible={true}
            />
          )}

          {/* Render marker at clicked location (always visible if exists) */}
          {markerPosition && selectedField && currentZoom >= MIN_ZOOM_FOR_MARKERS && (
            <Marker position={markerPosition}>
              <Popup 
                className="custom-popup" 
                minWidth={280}
                eventHandlers={{
                  add: () => {
                    setPopupInteractionActive(true);
                  },
                  remove: () => {
                    // Small delay to ensure click doesn't leak through
                    setTimeout(() => setPopupInteractionActive(false), 100);
                  },
                }}
              >
                <div 
                  className="p-3"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="mb-4">
                    <p className="text-xs text-farm-muted mb-1">
                      {selectedField.farm_name || 'Unknown Farm'}
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      {selectedField.name}
                    </h3>
                  </div>

                  {/* Show "View Details" if this is an existing note, otherwise show action buttons */}
                  {fieldNoteId ? (
                    /* Existing Note Actions */
                    <div className="space-y-2">
                      {/* View Details Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Find the note from fieldNotes array
                          const note = fieldNotes.find(n => n.id === fieldNoteId);
                          if (note) {
                            handleViewDetails(note);
                          } else {
                            // Fallback if note not found in array
                            navigate(`/field-notes/${fieldNoteId}`);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-farm-accent text-white hover:bg-farm-accent/90 rounded-lg transition-colors font-medium"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <span>View Details</span>
                      </button>

                      {/* Delete Location Note Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteDialog(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors font-medium"
                      >
                        <Trash2 className="h-5 w-5 flex-shrink-0" />
                        <span>Delete Location Note</span>
                      </button>
                    </div>
                  ) : (
                    /* Action Buttons for New Location */
                    <div className="space-y-2">
                    {/* Add Scouting Note */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (markerPosition && selectedField) {
                          // Navigate to scouting notes creation with pre-filled location data
                          navigate(`/scouting-notes/create?field_id=${selectedField.field_id}&lat=${markerPosition.lat}&lng=${markerPosition.lng}`);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium"
                    >
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      <span>Add Scouting Note</span>
                    </button>

                    {/* View Report Button (only for JD fields) */}
                    {selectedField.external_source === 'johndeere' && selectedField.external_id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate('/farm-reports', {
                            state: {
                              fieldId: selectedField.field_id,
                              operationId: selectedField.operation_id,
                              year: new Date().getFullYear(),
                              autoLoad: true
                            }
                          });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-farm-accent/10 hover:bg-farm-accent/20 text-farm-accent rounded-lg transition-colors"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <span className="font-medium">View JD Report</span>
                      </button>
                    )}

                    {/* View Zones Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Toggle zones for this field
                        if (zonesFieldId === selectedField.field_id) {
                          setZonesFieldId(null); // Hide zones
                          toast.info("Management zones hidden");
                        } else {
                          setZonesFieldId(selectedField.field_id); // Show zones
                          toast.success("Loading management zones...");
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        zonesFieldId === selectedField.field_id
                          ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                          : 'bg-farm-accent/10 hover:bg-farm-accent/20 text-farm-accent'
                      }`}
                    >
                      <Layers className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">
                        {zonesFieldId === selectedField.field_id ? 'Hide Zones' : 'View Zones'}
                      </span>
                    </button>
                    
                    {/* Add Photos */}
                    {/* <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const noteId = await ensureFieldNote();
                        if (noteId) {
                          setUploadModalOpen(true);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      disabled={creatingFieldNote}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-farm-accent/10 hover:bg-farm-accent/20 text-farm-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingFieldNote ? (
                        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5 flex-shrink-0" />
                      )}
                      <span className="font-medium">Add Photos</span>
                    </button> */}

                    {/* Add Recording */}
                    {/* <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const noteId = await ensureFieldNote();
                        if (noteId && markerPosition) {
                          navigate(`/voice-capture?field_note_id=${noteId}&lat=${markerPosition.lat}&lng=${markerPosition.lng}`);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      disabled={creatingFieldNote}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-farm-accent/10 hover:bg-farm-accent/20 text-farm-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingFieldNote ? (
                        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                      ) : (
                        <Mic className="h-5 w-5 flex-shrink-0" />
                      )}
                      <span className="font-medium">Add Recording</span>
                    </button> */}
                  </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Render current location marker */}
          {currentLocation && (
            <>
              <Marker 
                position={currentLocation} 
                icon={currentLocationIcon}
                zIndexOffset={1000}
              >
                <Popup>
                  <div className="p-2 text-center">
                    <p className="font-semibold text-sm mb-1">Your Location</p>
                    {locationAccuracy && (
                      <p className="text-xs text-farm-muted">
                        Accuracy: ±{Math.round(locationAccuracy)}m
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
              {/* Accuracy circle */}
              {locationAccuracy && (
                <Circle
                  center={currentLocation}
                  radius={locationAccuracy}
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

          {/* Render existing field notes markers (only at sufficient zoom) */}
          {currentZoom >= MIN_ZOOM_FOR_MARKERS && fieldNotes.map((note) => {
            // Skip if this is the currently selected marker
            if (fieldNoteId === note.id) return null;

            const notePosition = L.latLng(note.location.lat, note.location.lon);
            
            // Find the field for this note
            const field = fields.find(f => f.field_id === note.field_id);

            return (
              <Marker 
                key={note.id} 
                position={notePosition}
                eventHandlers={{
                  click: () => {
                    // Set this field note as selected
                    setMarkerPosition(notePosition);
                    setSelectedField({
                      field_id: note.field_id,
                      name: note.field_name || field?.name || 'Unknown Field',
                      farm_name: note.farm_name || field?.farm_name || 'Unknown Farm',
                    });
                    setFieldNoteId(note.id);
                  },
                }}
              >
                <Popup 
                  className="custom-popup" 
                  minWidth={280}
                  eventHandlers={{
                    add: () => {
                      setPopupInteractionActive(true);
                    },
                    remove: () => {
                      setTimeout(() => setPopupInteractionActive(false), 100);
                    },
                  }}
                >
                  <div 
                    className="p-3"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="mb-4">
                      <p className="text-xs text-farm-muted mb-1">
                        {note.farm_name || 'Unknown Farm'}
                      </p>
                      <h3 className="text-lg font-semibold text-foreground">
                        {note.field_name || 'Unknown Field'}
                      </h3>
                      {note.created_at && (
                        <p className="text-xs text-farm-muted mt-1">
                          {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    {/* Existing Note Actions */}
                    <div className="space-y-2">
                      {/* View Details Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewDetails(note);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-farm-accent text-white hover:bg-farm-accent/90 rounded-lg transition-colors font-medium"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <span>View Details</span>
                      </button>

                      {/* Delete Location Note Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Set the field note to delete and show confirmation dialog
                          setFieldNoteId(note.id);
                          setShowDeleteDialog(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors font-medium"
                      >
                        <Trash2 className="h-5 w-5 flex-shrink-0" />
                        <span>Delete Location Note</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          
          {/* Render NDVI layer - only when marker is placed */}
          {showNDVI && markerPosition && (() => {
            const { startDate, endDate } = getNDVIDateRange();
            // Memoize centerPoint to prevent infinite re-renders
            const centerPoint = { lat: markerPosition.lat, lng: markerPosition.lng };
            return (
              <NDVIMapLayer
                startDate={startDate}
                endDate={endDate}
                centerPoint={centerPoint}
                bufferKm={5}
                opacity={ndviOpacity}
                visible={showNDVI}
                onLoading={setNDVILoading}
                onLegendData={setNDVILegendData}
                onError={(error) => {
                  console.error('NDVI Error:', error);
                  // Show user-friendly error message (error.message already contains formatted text)
                  const errorMsg = error?.message || 'Failed to load NDVI layer. Try placing the marker in a different location.';
                  toast.error(errorMsg, {
                    duration: 6000, // Show for 6 seconds to allow reading
                  });
                }}
              />
            );
          })()}
          
          {/* Render Precipitation layer */}
          {showPrecip && (() => {
            const { startDate, endDate } = getPrecipDateRange();
            return (
              <PrecipMapLayer
                startDate={startDate}
                endDate={endDate}
                opacity={precipOpacity}
                visible={showPrecip}
                onLoading={setPrecipLoading}
                onLegendData={setPrecipLegendData}
                onError={(error) => {
                  console.error('Precipitation Error:', error);
                  toast.error('Failed to load precipitation layer');
                }}
              />
            );
          })()}
        </MapContainer>
      )}
      
      {/* NDVI Legend */}
      {showNDVI && !loading && (
        <NDVILegend 
          legendData={ndviLegendData}
          onClose={() => {
            setShowNDVI(false);
            setNDVILegendData(null);
          }}
        />
      )}
      
      {/* Precipitation Legend */}
      {showPrecip && !loading && (
        <PrecipLegend 
          legendData={precipLegendData}
          onClose={() => {
            setShowPrecip(false);
            setPrecipLegendData(null);
          }}
        />
      )}

      {/* Empty State */}
      {!loading && fields.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-center px-6">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold mb-2 text-farm-text">No Fields with Boundaries</h2>
            <p className="text-farm-muted mb-6">
              Import fields from John Deere to see them on the map
            </p>
          </div>
        </div>
      )}

      {/* Legend - Collapsible */}
      {!loading && fields.length > 0 && (
        <div className="absolute bottom-6 right-4 bg-farm-card border border-farm-accent/20 rounded-lg shadow-lg z-[1000] overflow-hidden max-w-xs">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full flex items-center justify-between p-3 hover:bg-farm-accent/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-farm-accent" />
              <h4 className="text-xs font-semibold text-farm-text">Layers</h4>
            </div>
            {showLegend ? (
              <ChevronUp className="h-4 w-4 text-farm-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-farm-muted" />
            )}
          </button>
          
          {showLegend && (
            <div className="px-3 pb-3 space-y-2.5">
              {/* Field Boundaries Toggle */}
              <div className="pt-1.5 border-t">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs">Boundaries</span>
                  <Switch
                    checked={showFieldBoundaries}
                    onCheckedChange={setShowFieldBoundaries}
                    className="scale-75"
                  />
                </div>
                {showFieldBoundaries && (
                  <div className="space-y-0.5 mt-1.5 pl-0.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#FDB913" }} />
                      <span className="text-farm-muted text-[10px]">Corn</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#2196F3" }} />
                      <span className="text-farm-muted text-[10px]">Soybeans</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#EF4444" }} />
                      <span className="text-farm-muted text-[10px]">Other</span>
                    </div>
                  </div>
                )}
              </div>


              {/* NDVI Toggle */}
              <div className="pt-1.5 border-t">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs">NDVI Layer</span>
                    {!markerPosition && (
                      <span className="text-[9px] text-amber-600 mt-0.5">
                        📍 Place a marker first
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={showNDVI}
                    onCheckedChange={(checked) => {
                      if (checked && !markerPosition) {
                        toast.info('Place a marker on the map first to enable NDVI');
                        return;
                      }
                      setShowNDVI(checked);
                    }}
                    disabled={!markerPosition}
                    className="scale-75"
                  />
                </div>
                {showNDVI && markerPosition && (
                  <div className="mt-1.5">
                    <div className="text-[10px] text-farm-muted mb-2">
                      (5km radius, last 15 days)
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-farm-muted">Opacity</span>
                        <span className="text-[10px] text-farm-muted">{Math.round(ndviOpacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[ndviOpacity]}
                        onValueChange={(value) => setNDVIOpacity(value[0])}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                      {ndviLoading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-farm-muted">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Loading NDVI tiles...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Precipitation Toggle */}
              <div className="pt-1.5 border-t">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs">Precipitation</span>
                  <Switch
                    checked={showPrecip}
                    onCheckedChange={setShowPrecip}
                    className="scale-75"
                  />
                </div>
                {showPrecip && (
                  <div className="mt-1.5">
                    <div className="text-[10px] text-farm-muted mb-2">
                      (Last 7 days)
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-farm-muted">Opacity</span>
                        <span className="text-[10px] text-farm-muted">{Math.round(precipOpacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[precipOpacity]}
                        onValueChange={(value) => setPrecipOpacity(value[0])}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                      {precipLoading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-farm-muted">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Loading precipitation...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Document Upload Modal */}
      {(() => {
        const metadata = markerPosition && selectedField && fieldNoteId ? {
          field_id: selectedField.field_id,
          field_note_id: fieldNoteId,
          location: {
            lat: markerPosition.lat,
            lon: markerPosition.lng,
          },
        } : null;
        
        return uploadModalOpen && markerPosition && selectedField && fieldNoteId && (
          <DocumentUploadModal
            open={uploadModalOpen}
            onClose={() => {
              setUploadModalOpen(false);
            }}
            onUploadComplete={() => {
              toast.success("Photo uploaded successfully");
              setUploadModalOpen(false);
            }}
            additionalMetadata={metadata!}
            disableCamera={true}
          />
        );
      })()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location Marker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the location marker from the map. Don't worry - any photos, recordings, or documents linked to this location will be preserved and remain accessible from their respective pages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFieldNote}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFieldNote}
              disabled={deletingFieldNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFieldNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FieldsMap;
