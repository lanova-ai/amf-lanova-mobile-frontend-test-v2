/**
 * Network Status Hook
 * Tracks online/offline status across the app
 */

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean; // True if user went offline during this session
  lastOnline: Date | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnline: null,
  });

  const handleOnline = useCallback(() => {
    setStatus(prev => ({
      isOnline: true,
      wasOffline: prev.wasOffline, // Keep track that user was offline
      lastOnline: new Date(),
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus(prev => ({
      isOnline: false,
      wasOffline: true,
      lastOnline: prev.lastOnline,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return status;
}

/**
 * Check if an error is likely due to being offline
 */
export function isOfflineError(error: any): boolean {
  if (!navigator.onLine) return true;
  
  // Check common offline error patterns
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true;
  }
  if (error?.message?.toLowerCase().includes('network')) {
    return true;
  }
  if (error?.message?.toLowerCase().includes('offline')) {
    return true;
  }
  
  return false;
}

/**
 * Get a user-friendly error message that acknowledges offline status
 */
export function getOfflineAwareErrorMessage(error: any, defaultMessage: string): string {
  if (!navigator.onLine) {
    return "You're offline. This action requires an internet connection.";
  }
  
  if (isOfflineError(error)) {
    return "Unable to connect. Please check your internet connection.";
  }
  
  return error?.message || defaultMessage;
}

