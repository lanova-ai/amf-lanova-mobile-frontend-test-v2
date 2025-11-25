/**
 * Service Worker Registration
 * Handles PWA installation, updates, and offline functionality
 */

import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // New version available
      // Show toast notification (can integrate with your toast system)
      if (confirm('New version available! Reload to update?')) {
        updateSW(true);
      }
    },
    
    onOfflineReady() {
      // App is ready to work offline
      // Optional: Show toast that app is ready for offline use
      // toast.success('App ready to work offline!');
    },
    
    onRegistered(registration) {
      // Service Worker registered successfully
    },
    
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    }
  });

  return updateSW;
}

