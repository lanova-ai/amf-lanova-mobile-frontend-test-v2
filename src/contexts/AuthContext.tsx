/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, tokenManager } from '@/lib/api';
import type { AuthTokens } from '@/lib/api';

interface User {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  farm_name?: string | null;
  farm_logo_url?: string | null;
  operation_id?: string;
  is_new_user?: boolean;
  onboarding_completed_at?: string | null;
  jd_connected?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyPhone: (verificationId: string, code: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const initAuth = async () => {
      if (tokenManager.hasToken()) {
        try {
          const currentUser = await authAPI.getCurrentUser();
          setUser(currentUser);
        } catch (error: any) {
          console.error('Failed to fetch current user:', error);
          // Only clear tokens on authentication errors (401), not network/offline errors
          const isOffline = error?.details?.offline === true || 
                           (typeof navigator !== 'undefined' && !navigator.onLine) ||
                           error?.message?.toLowerCase()?.includes('offline') ||
                           error?.message?.includes('Failed to fetch');
          
          if (isOffline) {
            console.log('Offline or network error, keeping tokens for retry');
            // User stays "logged in" but can't load data
          } else if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.details?.sessionExpired) {
            console.log('Token expired or invalid, clearing tokens');
            tokenManager.clearTokens();
          } else {
            console.log('Other error, keeping tokens for retry');
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    tokenManager.setTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: response.token_type,
    });
    setUser(response.user);
    // Fetch full profile to get farm_logo_url and other complete user data
    await refreshUser();
  };

  const verifyPhone = async (verificationId: string, code: string) => {
    const response = await authAPI.verifyMagicLink(verificationId, code);
    tokenManager.setTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: response.token_type,
    });
    setUser(response.user);
    // Fetch full profile to get farm_logo_url and other complete user data
    await refreshUser();
    return response.user; // Return user data for redirect logic
  };

  const logout = () => {
    tokenManager.clearTokens(); // Explicitly clear tokens
    setUser(null); // Clear user state
    // Note: authAPI.logout() also calls tokenManager.clearTokens() but we do it here too for safety
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authAPI.getCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      console.error('Failed to refresh user:', error);
      // Only logout on authentication errors (401), not network/offline errors
      const isOffline = error?.details?.offline === true || 
                       (typeof navigator !== 'undefined' && !navigator.onLine) ||
                       error?.message?.toLowerCase()?.includes('offline') ||
                       error?.message?.includes('Failed to fetch');
      
      if (isOffline) {
        console.log('Offline or network error during refresh, keeping session');
      } else if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.details?.sessionExpired) {
        console.log('Token expired or invalid during refresh, logging out');
        logout();
      } else {
        console.log('Other error during refresh, keeping session');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        verifyPhone,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// useAuth hook moved to @/hooks/useAuth.ts for better Fast Refresh compatibility
