import { SignalHigh, X } from 'lucide-react';

interface NDVILegendProps {
  legendData: {
    min_value: number;
    max_value: number;
    original_min?: number;
    original_max?: number;
    palette: string[];
    stretch_applied: boolean;
    title: string;
  } | null;
  onClose?: () => void;
}

const NDVILegend: React.FC<NDVILegendProps> = ({ legendData, onClose }) => {
  if (!legendData) return null;

  const { min_value, max_value, original_min, original_max, palette, stretch_applied, title } = legendData;

  // Create gradient from the palette colors
  const gradientStops = palette.map((color, index) => {
    const percentage = (index / (palette.length - 1)) * 100;
    return `${color} ${percentage}%`;
  }).join(', ');

  const gradientStyle = {
    background: `linear-gradient(to right, ${gradientStops})`
  };

  return (
    <div 
      className="absolute bottom-10 left-4 bg-card border rounded-lg text-sm shadow-lg pointer-events-auto z-[1001]"
      style={{ minWidth: stretch_applied ? '200px' : '140px', maxWidth: '240px' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <SignalHigh className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium">{title || 'NDVI'}</span>
          {stretch_applied && (
            <span className="text-xs bg-primary px-1 rounded text-primary-foreground">Enhanced</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Hide NDVI"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="px-3 py-2">
        <div 
          className="w-full h-3 rounded border mb-2"
          style={gradientStyle}
        />
        
        {/* Display range values */}
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{min_value?.toFixed(2) || '0.0'}</span>
          <span>{max_value?.toFixed(2) || '1.0'}</span>
        </div>
        
        {/* Show original range if stretched */}
        {stretch_applied && (original_min !== undefined && original_max !== undefined) && (
          <div className="border-t pt-2 mt-2">
            <div className="text-xs text-muted-foreground mb-1">Original Range:</div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{original_min?.toFixed(2)}</span>
              <span>{original_max?.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NDVILegend;

