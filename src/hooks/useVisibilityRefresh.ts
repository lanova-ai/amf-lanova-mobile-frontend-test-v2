import { useEffect, useRef } from 'react';

/**
 * Custom hook that triggers a callback when the app returns to foreground.
 * Useful for PWA/mobile apps where background processes may complete while the app is hidden.
 * 
 * Uses useRef pattern to always call the latest callback without re-attaching listeners.
 * Also listens to 'focus' event for better iOS/desktop compatibility.
 * 
 * @param onVisible - Callback function to execute when app becomes visible
 * 
 * @example
 * // Basic usage - check sync status when app returns
 * useVisibilityRefresh(() => {
 *   checkSyncStatus();
 * });
 * 
 * @example
 * // With async callback
 * useVisibilityRefresh(async () => {
 *   const status = await api.getSyncStatus();
 *   if (status.completed) setSyncComplete(true);
 * });
 */
export function useVisibilityRefresh(onVisible: () => void | Promise<void>) {
  // Keep the latest callback in a Ref
  // This ensures we always call the freshest version of the function
  // without needing to detach/reattach the event listener
  const savedCallback = useRef(onVisible);

  // Update ref when callback changes
  useEffect(() => {
    savedCallback.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const handleVisibility = () => {
      // Only trigger when coming INTO view (not leaving)
      if (document.visibilityState === 'visible') {
        console.log('[PWA] App returned to foreground, refreshing data...');
        savedCallback.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    
    // Also listen for 'focus' (helps on Desktop, sometimes needed on iOS)
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []); // Empty dependency array = only attach listener once
}

export default useVisibilityRefresh;

