import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { precipAPI } from '@/lib/api';

interface TileLayer {
  url: string;
  zoom_range: [number, number];
  description: string;
}

interface PrecipResponse {
  tile_layers: {
    smooth?: TileLayer;
    native?: TileLayer;
    detail?: TileLayer;
  };
  legend_data: {
    min_precip: number;
    max_precip: number;
    unit: string;
    colormap: string[];
  };
  processing_info: {
    start_date: string;
    end_date: string;
    days: number;
    resolution: string;
  };
}

// Multi-Resolution Precipitation Layer Manager
class PrecipLayerManager {
  private map: L.Map;
  private tileLayers: PrecipResponse['tile_layers'];
  private currentLayer: {
    url: string;
    leafletLayer: L.TileLayer;
    layerName: string;
  } | null = null;
  private opacity: number;
  private zoomHandler: () => void;
  legendData: PrecipResponse['legend_data'];
  processingInfo: PrecipResponse['processing_info'];

  constructor(map: L.Map, precipResponse: PrecipResponse, opacity: number = 0.7) {
    this.map = map;
    this.tileLayers = precipResponse.tile_layers;
    this.opacity = opacity;
    this.legendData = precipResponse.legend_data;
    this.processingInfo = precipResponse.processing_info;
    
    console.log('🌧️ Initializing Precipitation Layer Manager with:', {
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
    if (this.currentLayer?.url !== targetLayer?.url) {
      this.switchToLayer(targetLayer, layerName);
    }
  }
  
  switchToLayer(layer: TileLayer | undefined, layerName: string) {
    if (!layer?.url) return;
    
    // Remove current layer
    if (this.currentLayer?.leafletLayer) {
      console.log('🗑️ Removing previous precipitation layer');
      this.map.removeLayer(this.currentLayer.leafletLayer);
    }
    
    // Add new layer with optimized settings for each resolution
    const layerOptions: L.TileLayerOptions = {
      attribution: 'NOAA/NWS/RTMA',
      opacity: this.opacity,
      maxZoom: 22,
      updateWhenZooming: false,
      updateWhenIdle: true,
    };
    
    // Optimize based on layer type
    if (layerName === 'smooth') {
      layerOptions.className = 'precip-layer-smooth';
    } else if (layerName === 'native') {
      layerOptions.className = 'precip-layer-native';
    } else if (layerName === 'detail') {
      layerOptions.className = 'precip-layer-detail';
      layerOptions.tileSize = 256;
    }
    
    const leafletLayer = L.tileLayer(layer.url, layerOptions);
    this.map.addLayer(leafletLayer);
    
    this.currentLayer = { 
      url: layer.url,
      leafletLayer, 
      layerName,
    };
    
    console.log(`🌧️ Switched to ${layer.description} (${layerName}) at zoom ${this.map.getZoom()}`);
  }
  
  setOpacity(opacity: number) {
    this.opacity = opacity;
    if (this.currentLayer?.leafletLayer) {
      this.currentLayer.leafletLayer.setOpacity(opacity);
    }
  }
  
  cleanup() {
    console.log('🧹 Cleaning up Precipitation Layer Manager');
    
    // Remove zoom event listener
    if (this.map && this.zoomHandler) {
      this.map.off('zoomend', this.zoomHandler);
    }
    
    // Remove current layer
    if (this.currentLayer?.leafletLayer) {
      try {
        this.map.removeLayer(this.currentLayer.leafletLayer);
      } catch (error) {
        console.warn('Could not remove precipitation layer:', error);
      }
    }
    
    this.currentLayer = null;
  }
}

interface PrecipMapLayerProps {
  startDate: string;
  endDate: string;
  opacity: number;
  visible: boolean;
  onLoading: (loading: boolean) => void;
  onLegendData: (data: PrecipResponse['legend_data'] | null) => void;
  onError?: (error: Error) => void;
}

const PrecipMapLayer: React.FC<PrecipMapLayerProps> = ({ 
  startDate, 
  endDate, 
  opacity, 
  visible,
  onLoading,
  onLegendData,
  onError 
}) => {
  const map = useMap();
  const layerManagerRef = useRef<PrecipLayerManager | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      // Cleanup when toggled off
      if (layerManagerRef.current) {
        layerManagerRef.current.cleanup();
        layerManagerRef.current = null;
      }
      onLegendData(null);
      onLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // Prevent duplicate requests
    if (isLoadingRef.current || layerManagerRef.current) {
      return;
    }

    let isMounted = true;
    isLoadingRef.current = true;

    const fetchPrecipData = async () => {
      try {
        onLoading(true);
        console.log('🌧️ Fetching precipitation tiles...', { startDate, endDate });
        
        const response = await precipAPI.generateTiles(startDate, endDate);
        
        if (!isMounted) {
          console.log('⚠️ Component unmounted, skipping precipitation layer creation');
          return;
        }

        const precipData = response as any;
        
        if (precipData.status === 'success' && precipData.tile_layers) {
          console.log('✅ Precipitation tiles generated successfully');
          
          // Initialize layer manager with multi-resolution support
          const manager = new PrecipLayerManager(map, precipData as PrecipResponse, opacity);
          layerManagerRef.current = manager;
          
          // Set legend data
          onLegendData(manager.legendData);
          
          console.log('🎯 Precipitation layer active');
        } else {
          throw new Error(precipData.message || 'Failed to generate precipitation tiles');
        }
      } catch (error: any) {
        console.error('❌ Error loading precipitation data:', error);
        if (isMounted && onError) {
          onError(error);
        }
        onLegendData(null);
      } finally {
        if (isMounted) {
          onLoading(false);
          isLoadingRef.current = false;
        }
      }
    };

    fetchPrecipData();

    return () => {
      console.log('🧹 PrecipMapLayer cleanup called');
      isMounted = false;
      if (layerManagerRef.current) {
        layerManagerRef.current.cleanup();
        layerManagerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [startDate, endDate, visible, map]);

  // Update opacity when it changes
  useEffect(() => {
    if (layerManagerRef.current) {
      layerManagerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
};

export default PrecipMapLayer;

