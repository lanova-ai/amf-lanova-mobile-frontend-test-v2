/**
 * Network Status Indicator
 * Shows online/offline status in the app header
 */

import { Wifi, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

interface NetworkStatusIndicatorProps {
  className?: string;
  showOnlineStatus?: boolean; // Whether to show indicator when online (default: false - only show offline)
  compact?: boolean; // Just icon, no text (default: false)
}

export function NetworkStatusIndicator({ 
  className,
  showOnlineStatus = false,
  compact = false
}: NetworkStatusIndicatorProps) {
  const { isOnline } = useNetworkStatus();

  // Don't show anything if online and showOnlineStatus is false
  if (isOnline && !showOnlineStatus) {
    return null;
  }

  // Compact mode - just the icon
  if (compact || showOnlineStatus) {
    return (
      <div 
        className={cn(
          "p-1.5 rounded-lg transition-all",
          isOnline 
            ? "text-green-500" 
            : "text-orange-500 bg-orange-500/10 animate-pulse",
          className
        )}
        title={isOnline ? "Connected to internet" : "No internet connection - some features may be limited"}
      >
        {isOnline ? (
          <Wifi className="h-5 w-5" />
        ) : (
          <WifiOff className="h-5 w-5" />
        )}
      </div>
    );
  }

  // Full mode with text (for offline banner style)
  return (
    <div 
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all",
        isOnline 
          ? "bg-green-500/10 text-green-600 dark:text-green-400" 
          : "bg-orange-500/20 text-orange-600 dark:text-orange-400 animate-pulse",
        className
      )}
      title={isOnline ? "Connected to internet" : "No internet connection - some features may be limited"}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}

/**
 * Compact version - just an icon with tooltip
 */
export function NetworkStatusIcon({ className }: { className?: string }) {
  const { isOnline } = useNetworkStatus();

  return (
    <div 
      className={cn(
        "p-1.5 rounded-full transition-all",
        isOnline 
          ? "text-green-500" 
          : "text-orange-500 animate-pulse bg-orange-500/10",
        className
      )}
      title={isOnline ? "Connected" : "Offline - some features limited"}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
    </div>
  );
}

