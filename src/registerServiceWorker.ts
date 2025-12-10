/**
 * Service Worker Registration
 * Handles PWA installation, updates, and offline functionality
 */

import { registerSW } from 'virtual:pwa-register';

// Store the update function globally so React components can trigger it
let updateSWCallback: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateAvailableListeners: Array<(available: boolean) => void> = [];
let isUpdatePending = false;

export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // New version available
      console.log('[SW] New version available');
      isUpdatePending = true;
      updateSWCallback = updateSW;
      
      // Notify all listeners
      updateAvailableListeners.forEach(listener => listener(true));
    },
    
    onOfflineReady() {
      console.log('[SW] App ready for offline use');
    },
    
    onRegistered(registration) {
      console.log('[SW] Registered successfully');
    },
    
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    }
  });

  updateSWCallback = updateSW;
  return updateSW;
}

// Called by React components to trigger the update
export function triggerAppUpdate(): void {
  if (updateSWCallback) {
    updateSWCallback(true);
  } else {
    // Fallback: just reload the page
    window.location.reload();
  }
}

// Subscribe to update availability changes
export function subscribeToUpdates(callback: (available: boolean) => void): () => void {
  updateAvailableListeners.push(callback);
  
  // Immediately notify if update is already pending
  if (isUpdatePending) {
    callback(true);
  }
  
  // Return unsubscribe function
  return () => {
    updateAvailableListeners = updateAvailableListeners.filter(l => l !== callback);
  };
}

// Check if an update is pending
export function isUpdateAvailable(): boolean {
  return isUpdatePending;
}

// Force check for updates by re-registering service worker
export async function checkForUpdates(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        console.log('[SW] Manual update check triggered');
        return true;
      }
    } catch (error) {
      console.error('[SW] Failed to check for updates:', error);
    }
  }
  return false;
}
