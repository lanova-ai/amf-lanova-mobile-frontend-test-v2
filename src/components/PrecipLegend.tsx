import { CloudRain, X } from 'lucide-react';

interface PrecipLegendProps {
  legendData: {
    min_precip: number;
    max_precip: number;
    actual_min?: number;
    actual_max?: number;
    unit: string;
    colormap: string[];
  } | null;
  onClose?: () => void;
}

const PrecipLegend: React.FC<PrecipLegendProps> = ({ legendData, onClose }) => {
  if (!legendData) return null;

  const { min_precip, max_precip, actual_min, actual_max, unit, colormap } = legendData;

  // Create gradient from the palette colors
  const gradientStops = colormap.map((color, index) => {
    const percentage = (index / (colormap.length - 1)) * 100;
    return `${color} ${percentage}%`;
  }).join(', ');

  const gradientStyle = {
    background: `linear-gradient(to right, ${gradientStops})`
  };

  return (
    <div 
      className="absolute bottom-10 left-4 bg-card border rounded-lg text-sm shadow-lg pointer-events-auto z-[1001]"
      style={{ minWidth: '140px', maxWidth: '240px' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium">Precipitation</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Hide Precipitation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="px-3 py-2">
        <div 
          className="w-full h-3 rounded border mb-1.5"
          style={gradientStyle}
        />
        
        {/* Display scale range and unit in one line */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>{min_precip?.toFixed(1) || '0.0'}</span>
          <span>{unit || 'inches'}</span>
          <span>{max_precip?.toFixed(1) || '2.0'}</span>
        </div>
      </div>
    </div>
  );
};

export default PrecipLegend;

