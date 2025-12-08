import { Smartphone } from "lucide-react";

interface MobileFirstIndicatorProps {
  /** Use compact variant for smaller spaces */
  compact?: boolean;
  /** Additional className for positioning */
  className?: string;
}

/**
 * Mobile-first indicator component for desktop view
 * Shows a phone icon with "Mobile first" text to indicate the app is optimized for mobile
 * Hidden on mobile (lg: breakpoint and above only)
 */
export const MobileFirstIndicator = ({ compact = false, className = "" }: MobileFirstIndicatorProps) => {
  if (compact) {
    // Compact version - just icon and small text
    return (
      <div className={`hidden lg:flex flex-col items-center justify-center px-6 opacity-40 ${className}`}>
        <div className="border border-farm-accent/30 rounded-lg p-2 mb-2">
          <Smartphone className="h-5 w-5 text-farm-accent/60" />
        </div>
        <span className="text-[10px] text-farm-muted whitespace-nowrap">Mobile first</span>
      </div>
    );
  }

  // Full version - phone outline with descriptive text
  return (
    <div className={`hidden lg:flex flex-1 items-center justify-center px-8 ${className}`}>
      <div className="text-center space-y-3 max-w-xs opacity-60">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-28 bg-farm-card/30 border border-farm-accent/20 rounded-[1.5rem] p-2 shadow-lg">
              <div className="w-full h-full bg-farm-dark/50 rounded-[1.2rem] flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-farm-accent/40" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-farm-muted/80">
          This application is designed for mobile first experience
        </p>
      </div>
    </div>
  );
};

export default MobileFirstIndicator;

