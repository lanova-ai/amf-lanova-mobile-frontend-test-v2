import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { ndviAPI } from '@/lib/api';

interface TileLayer {
  url_template: string;
  description: string;
  zoom_range: [number, number];
}

interface NDVIResponse {
  tile_layers: {
    smooth?: TileLayer;
    native?: TileLayer;
    detail?: TileLayer;
  };
  legend: {
    min_value: number;
    max_value: number;
    original_min?: number;
    original_max?: number;
    palette: string[];
    stretch_applied: boolean;
    title: string;
  };
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
  };
}

// Multi-Resolution NDVI Layer Manager
class NDVILayerManager {
  private map: L.Map;
  private tileLayers: NDVIResponse['tile_layers'];
  private currentLayer: {
    url_template: string;
    leafletLayer: L.TileLayer;
    layerName: string;
  } | null = null;
  private opacity: number;
  private zoomHandler: () => void;
  legend: NDVIResponse['legend'];
  statistics: NDVIResponse['statistics'];

  constructor(map: L.Map, ndviResponse: NDVIResponse, opacity: number = 0.7) {
    this.map = map;
    this.tileLayers = ndviResponse.tile_layers;
    this.opacity = opacity;
    this.legend = ndviResponse.legend;
    this.statistics = ndviResponse.statistics;
    
    console.log('🎯 Initializing NDVI Layer Manager with:', {
      smooth: this.tileLayers.smooth?.zoom_range,
      native: this.tileLayers.native?.zoom_range,
      detail: this.tileLayers.detail?.zoom_range
    });
    
    // Set initial layer based on current zoom
    this.updateLayerForZoom(map.getZoom());
    
    // Listen for zoom changes
    this.zoomHandler = () => {
      this.updateLayerForZoom(map.getZoom());
    };
    map.on('zoomend', this.zoomHandler);
  }
  
  updateLayerForZoom(zoom: number) {
    let targetLayer: TileLayer | undefined;
    let layerName: string;
    
    if (zoom >= 8 && zoom < 12) {
      targetLayer = this.tileLayers.smooth;
      layerName = 'smooth';
    } else if (zoom >= 12 && zoom < 15) {
      targetLayer = this.tileLayers.native;
      layerName = 'native';
    } else if (zoom >= 15) {
      targetLayer = this.tileLayers.detail;
      layerName = 'detail';
    } else {
      return;
    }
    
    // Only update if layer actually changed
    if (this.currentLayer?.url_template !== targetLayer?.url_template) {
      this.switchToLayer(targetLayer, layerName);
    }
  }
  
  switchToLayer(layer: TileLayer | undefined, layerName: string) {
    if (!layer?.url_template) return;
    
    // Remove current layer
    if (this.currentLayer?.leafletLayer) {
      console.log('🗑️ Removing previous NDVI layer');
      this.map.removeLayer(this.currentLayer.leafletLayer);
    }
    
    // Add new layer with optimized settings for each resolution
    const layerOptions: L.TileLayerOptions = {
      attribution: 'Google Earth Engine | Sentinel-2',
      opacity: this.opacity,
      maxZoom: 22,
      updateWhenZooming: false,
      updateWhenIdle: true,
    };
    
    // Optimize based on layer type
    if (layerName === 'smooth') {
      layerOptions.className = 'ndvi-layer-smooth';
    } else if (layerName === 'native') {
      layerOptions.className = 'ndvi-layer-native';
    } else if (layerName === 'detail') {
      layerOptions.className = 'ndvi-layer-detail';
      layerOptions.tileSize = 256;
    }
    
    const leafletLayer = L.tileLayer(layer.url_template, layerOptions);
    this.map.addLayer(leafletLayer);
    
    this.currentLayer = { 
      url_template: layer.url_template,
      leafletLayer, 
      layerName,
    };
    
    console.log(`🎯 Switched to ${layer.description} (${layerName}) at zoom ${this.map.getZoom()}`);
  }
  
  setOpacity(opacity: number) {
    this.opacity = opacity;
    if (this.currentLayer?.leafletLayer) {
      this.currentLayer.leafletLayer.setOpacity(opacity);
    }
  }
  
  cleanup() {
    console.log('🧹 Cleaning up NDVI Layer Manager');
    
    // Remove zoom event listener
    if (this.map && this.zoomHandler) {
      this.map.off('zoomend', this.zoomHandler);
    }
    
    // Remove current layer
    if (this.currentLayer?.leafletLayer) {
      this.map.removeLayer(this.currentLayer.leafletLayer);
    }
    
    // Clean up references
    this.currentLayer = null;
  }
}

interface NDVIMapLayerProps {
  startDate: string;
  endDate: string;
  centerPoint?: { lat: number; lng: number }; // Optional center point for focused NDVI
  bufferKm?: number; // Buffer radius in km (default: 5km)
  opacity?: number;
  visible?: boolean;
  onLoading?: (loading: boolean) => void;
  onLoaded?: (data: NDVIResponse) => void;
  onError?: (error: any) => void;
  onLegendData?: (legend: NDVIResponse['legend'] | null) => void;
}

const NDVIMapLayer: React.FC<NDVIMapLayerProps> = ({ 
  startDate,
  endDate,
  centerPoint,
  bufferKm = 5,
  opacity = 0.7,
  visible = true,
  onLoading,
  onLoaded,
  onError,
  onLegendData,
}) => {
  const map = useMap();
  const layerManagerRef = useRef<NDVILayerManager | null>(null);

  // Enhanced cleanup function using LayerManager
  const cleanupLayer = () => {
    if (layerManagerRef.current) {
      layerManagerRef.current.cleanup();
      layerManagerRef.current = null;
      onLegendData?.(null);
    }
  };

  // Effect to handle showing/hiding the layer
  useEffect(() => {
    if (!visible || !map) {
      // Remove layer if not visible
      cleanupLayer();
      return;
    }

    const loadNDVILayer = async () => {
      try {
        onLoading?.(true);

        // CRITICAL: Always remove previous NDVI layer before loading new one
        console.log(`🧹 Cleaning up previous NDVI layer before loading new tiles`);
        cleanupLayer();
        
        // Add small delay to ensure cleanup is complete before loading new layer
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log(`🛰️ Loading NDVI tiles`);
        console.log(`📅 Date range: ${startDate} to ${endDate}`);
        
        // Call NDVI API - use point-based endpoint if center point is provided
        let ndviData: NDVIResponse;
        if (centerPoint) {
          console.log(`📍 Using center point: ${centerPoint.lat}, ${centerPoint.lng} with ${bufferKm}km buffer`);
          const bufferMiles = bufferKm * 0.621371; // Convert km to miles
          ndviData = await ndviAPI.generateTilesForPoint(
            startDate, 
            endDate, 
            centerPoint.lat, 
            centerPoint.lng, 
            bufferMiles,
            'max'
          ) as NDVIResponse;
        } else {
          console.log(`🗺️ Using all fields bounding box`);
          ndviData = await ndviAPI.generateTiles(startDate, endDate, 'max') as NDVIResponse;
        }

        console.log('📡 NDVI API Response:', ndviData);

        // Check if the response is an error
        if (ndviData && (ndviData as any).status === 'error') {
          const errorResponse = ndviData as any;
          console.error('❌ NDVI API Error:', errorResponse);
          
          // Provide user-friendly error messages based on error type
          let errorMessage = errorResponse.message || 'Failed to load NDVI data';
          
          if (errorResponse.error_type === 'future_dates_requested') {
            errorMessage = `Satellite imagery not yet available. Latest data is from ${errorResponse.latest_available || 'a recent date'}.`;
          } else if (errorResponse.error_type === 'no_imagery_available' || errorResponse.error_type === 'no_images_found' || errorResponse.error_type === 'no_clear_images') {
            errorMessage = 'No clear satellite imagery available for the last 7 days. Cloud cover may be blocking the view. Try again in a few days or place the marker in a different location.';
          }
          
          throw new Error(errorMessage);
        }

        // Handle single url_template response (from point-based endpoint)
        if (ndviData && (ndviData as any).url_template && !(ndviData as any).tile_layers) {
          console.log('🔄 Converting single tile URL to multi-resolution format');
          const singleTileResponse = ndviData as any;
          
          // Convert to expected multi-resolution format
          ndviData = {
            tile_layers: {
              native: {
                url_template: singleTileResponse.url_template,
                description: 'NDVI layer',
                zoom_range: [singleTileResponse.min_zoom || 8, singleTileResponse.max_zoom || 20] as [number, number]
              }
            },
            legend: singleTileResponse.legend || {
              min_value: 0,
              max_value: 1,
              palette: ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'],
              stretch_applied: false,
              title: 'NDVI'
            },
            statistics: singleTileResponse.statistics || {
              min: 0,
              max: 1,
              mean: 0.5,
              median: 0.5,
              std: 0.2
            }
          } as NDVIResponse;
        }

        if (ndviData && ndviData.tile_layers && Object.keys(ndviData.tile_layers).length > 0) {
          // Use multi-resolution tile system
          console.log('🎯 Creating multi-resolution NDVI layer system');
          console.log('📊 Available layers:', Object.keys(ndviData.tile_layers));
          
          // Initialize the layer manager with the response
          layerManagerRef.current = new NDVILayerManager(map, ndviData, opacity);

          onLoaded?.(ndviData); // Pass full NDVI data to parent
          onLegendData?.(ndviData.legend); // Pass legend data to parent
          console.log(`✅ Multi-resolution NDVI layers loaded from GEE`);
          console.log(`📈 NDVI Statistics:`, ndviData.statistics);
        } else {
          console.error('❌ Invalid NDVI response structure:', {
            hasData: !!ndviData,
            hasTileLayers: !!(ndviData && ndviData.tile_layers),
            tileLayersKeys: ndviData?.tile_layers ? Object.keys(ndviData.tile_layers) : [],
            fullResponse: ndviData
          });
          throw new Error('No tile layers in NDVI response. The satellite imagery may not be available for this date range.');
        }

      } catch (error: any) {
        console.error('Error loading NDVI layer:', error);
        
        // Extract user-friendly message from API error
        let errorMessage = 'Failed to load NDVI layer';
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.details?.message) {
          errorMessage = error.details.message;
        } else if (error?.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        }
        
        // Provide user-friendly messages for common error scenarios
        if (errorMessage.includes('No satellite imagery') || 
            errorMessage.includes('No Sentinel-2 images') ||
            errorMessage.includes('No clear satellite') ||
            errorMessage.includes('no images found')) {
          errorMessage = 'No satellite imagery available for this location and date range. This can happen due to:\n\n• Cloud cover blocking the view\n• No satellite passes over this area\n• Data processing delays\n\nTry placing the marker in a different location or check back in a few days.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
          errorMessage = 'The satellite imagery request is taking longer than expected. Please try again in a moment.';
        } else if (errorMessage.includes('Try a different date range')) {
          errorMessage = 'No satellite imagery found for the selected date range. Try placing the marker in a different location or check back later.';
        }
        
        onError?.(new Error(errorMessage));
      } finally {
        onLoading?.(false);
      }
    };

    loadNDVILayer();

    // Cleanup function
    return () => {
      console.log('🧹 NDVI useEffect cleanup triggered');
      cleanupLayer();
    };
  }, [startDate, endDate, centerPoint?.lat, centerPoint?.lng, bufferKm, visible, map]);

  // Update opacity when changed
  useEffect(() => {
    if (layerManagerRef.current) {
      layerManagerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null; // This component doesn't render anything directly
};

export default NDVIMapLayer;

