/**
 * Update Status Indicator
 * Shows app update status in the header
 * - Green refresh icon = app is up to date
 * - Orange refresh icon = new version available, tap to update
 */

import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { subscribeToUpdates, triggerAppUpdate, isUpdateAvailable, checkForUpdates } from "@/registerServiceWorker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UpdateStatusIndicatorProps {
  className?: string;
}

export function UpdateStatusIndicator({ className }: UpdateStatusIndicatorProps) {
  const [updateAvailable, setUpdateAvailable] = useState(isUpdateAvailable());
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Subscribe to update notifications
    const unsubscribe = subscribeToUpdates((available) => {
      setUpdateAvailable(available);
      if (available) {
        toast.info("New version available! Tap the refresh icon to update.", {
          duration: 5000,
        });
      }
    });

    return unsubscribe;
  }, []);

  const handleClick = async () => {
    if (updateAvailable) {
      // Update available - trigger update
      setUpdating(true);
      toast.loading("Updating app...");
      setTimeout(() => {
        triggerAppUpdate();
      }, 500);
    } else if (!checking) {
      // No update - check for updates
      setChecking(true);
      toast.info("Checking for updates...", { duration: 2000 });
      
      await checkForUpdates();
      
      // Wait a moment for service worker to detect update
      setTimeout(() => {
        setChecking(false);
        if (!isUpdateAvailable()) {
          toast.success("App is up to date!", { duration: 2000 });
        }
      }, 1500);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={updating || checking}
      className={cn(
        "p-1 rounded-lg transition-all",
        updateAvailable
          ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20"
          : "text-green-500 hover:bg-green-500/10",
        (updating || checking) && "animate-spin",
        className
      )}
      title={
        updating
          ? "Updating..."
          : checking
          ? "Checking for updates..."
          : updateAvailable
          ? "New version available - tap to update"
          : "Tap to check for updates"
      }
    >
      <RefreshCw className={cn("h-3.5 w-3.5", updateAvailable && !updating && "animate-pulse")} strokeWidth={1.5} />
    </button>
  );
}

