/**
 * API Client with Authentication
 * Handles all backend API calls with JWT token management
 */

import env from '@/config/env';

// Types
export interface APIError {
  message: string;
  status: number;
  details?: any;
}

// Helper to check if error is a session expiry
export const isSessionExpiredError = (error: any): boolean => {
  return error?.status === 401 || error?.details?.sessionExpired === true;
};

// Helper to check if error is likely due to being offline
export const isOfflineError = (error: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  
  // Check common offline error patterns
  if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
    return true;
  }
  if (error?.message?.toLowerCase()?.includes('network')) {
    return true;
  }
  if (error?.message?.toLowerCase()?.includes('offline')) {
    return true;
  }
  
  return false;
};

// Helper for consistent error handling in pages
export const handlePageError = (error: any, defaultMessage: string): string | null => {
  // If session expired, return null to indicate no toast should be shown
  // (the API layer will redirect to login)
  if (isSessionExpiredError(error)) {
    return null;
  }
  
  // Check if offline and provide helpful message
  if (isOfflineError(error)) {
    return "You're offline. Please check your internet connection.";
  }
  
  // Return the error message for the toast
  return error?.message || defaultMessage;
};

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

// Token Management
const TOKEN_KEY = 'amf_access_token';
const REFRESH_TOKEN_KEY = 'amf_refresh_token';

export const tokenManager = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (tokens: AuthTokens) => {
    localStorage.setItem(TOKEN_KEY, tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    }
  },

  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  hasToken: (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000 // 30 second default timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. The server is taking too long to respond.');
    }
    throw error;
  }
}

// Base fetch wrapper with auth
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const url = `${env.API_BASE_URL}${endpoint}`;
  const token = tokenManager.getAccessToken();

  const headers: HeadersInit = {
    ...options.headers,
  };

  // Only set Content-Type for JSON if body is not FormData
  // FormData needs browser to set Content-Type with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetchWithTimeout(url, config, timeoutMs);

    // Handle 401 Unauthorized - token expired
    if (response.status === 401 && token) {
      // Don't try to refresh if we're offline - just throw offline error
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlineError: APIError = {
          message: "You're offline. Please check your internet connection.",
          status: 0,
          details: { offline: true }
        };
        throw offlineError;
      }
      
      // Try to refresh token
      const refreshResult = await refreshAccessToken();
      if (refreshResult.success) {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${tokenManager.getAccessToken()}`;
        const retryResponse = await fetchWithTimeout(url, { ...config, headers }, timeoutMs);
        if (!retryResponse.ok) {
          throw await handleErrorResponse(retryResponse);
        }
        return await retryResponse.json();
      } else if (refreshResult.reason === 'offline') {
        // Network error during refresh - don't logout, just show offline message
        const offlineError: APIError = {
          message: "You're offline. Please check your internet connection.",
          status: 0,
          details: { offline: true }
        };
        throw offlineError;
      } else {
        // Refresh failed due to invalid token - clear tokens and redirect to welcome page
        tokenManager.clearTokens();
        // Use a small delay to allow any pending operations to complete
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
        // Throw a recognizable error for UI handling
        const sessionError: APIError = {
          message: 'Session expired. Please login again.',
          status: 401,
          details: { sessionExpired: true }
        };
        throw sessionError;
      }
    }

    if (!response.ok) {
      throw await handleErrorResponse(response);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return await response.json();
  } catch (error) {
    // Re-throw APIError objects as-is
    if (error && typeof error === 'object' && 'status' in error) {
      throw error;
    }
    
    // Check if offline and provide helpful error
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineError: APIError = {
        message: "You're offline. This action requires an internet connection.",
        status: 0,
        details: { offline: true }
      };
      throw offlineError;
    }
    
    // Re-throw Error instances with better message
    if (error instanceof Error) {
      // Check for fetch errors that indicate network issues
      if (error.message?.includes('Failed to fetch')) {
        throw new Error('Unable to connect. Please check your internet connection.');
      }
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
}

// Handle API error responses
async function handleErrorResponse(response: Response): Promise<APIError> {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  let errorDetails = null;

  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.detail || errorMessage;
    errorDetails = errorData;
  } catch {
    // Response is not JSON
  }

  const error: APIError = {
    message: errorMessage,
    status: response.status,
    details: errorDetails,
  };

  return error;
}

// Refresh access token
// Returns { success: true } if refreshed, { success: false, reason: 'offline' | 'invalid' } if failed
async function refreshAccessToken(): Promise<{ success: boolean; reason?: 'offline' | 'invalid' | 'no_token' }> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) return { success: false, reason: 'no_token' };

  try {
    const response = await fetch(`${env.API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const tokens: AuthTokens = await response.json();
      tokenManager.setTokens(tokens);
      return { success: true };
    }
    
    // Server rejected the refresh token - it's invalid
    return { success: false, reason: 'invalid' };
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Network error - likely offline
    if (error instanceof TypeError && (error.message?.includes('Failed to fetch') || error.message?.includes('Network'))) {
      return { success: false, reason: 'offline' };
    }
    // Check navigator.onLine as fallback
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, reason: 'offline' };
    }
    return { success: false, reason: 'invalid' };
  }
}

// ================================
// AUTH APIs
// ================================

export const authAPI = {
  sendMagicLink: async (data: {
    phone_number: string;
    first_name: string;
    last_name: string;
    farm_name: string;
    email?: string;
    password?: string; // Optional password for hybrid auth
  }) => {
    return apiFetch<{ 
      verification_id: string; 
      expires_at: string; 
      code_sent: boolean; 
      sms_sent: boolean;
      email_sent: boolean;
      message: string;
    }>(
      '/api/v1/auth/send-magic-link',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },
  
  sendLoginCode: async (data: {
    phone_number?: string;
    email?: string;
  }) => {
    return apiFetch<{ 
      verification_id: string; 
      expires_at: string; 
      sms_sent: boolean;
      email_sent: boolean;
      message: string;
    }>(
      '/api/v1/auth/send-login-code',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  verifyMagicLink: async (verificationId: string, code: string) => {
    return apiFetch<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      user: {
        id: string;
        phone_number: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        is_new_user: boolean;
        onboarding_completed_at: string | null;
        jd_connected: boolean;
      };
    }>('/api/v1/auth/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ verification_id: verificationId, code }),
    });
  },

  login: async (email: string, password: string) => {
    return apiFetch<AuthTokens & { user: any }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  foundingFarmerSignup: async (data: {
    approval_code: string;
    email: string;
    phone_number: string;
    first_name: string;
    last_name: string;
    farm_name: string;
    password?: string;
  }) => {
    return apiFetch<AuthTokens & { user: any }>('/api/v1/auth/founding-farmer-signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: () => {
    tokenManager.clearTokens();
  },

  getCurrentUser: async () => {
    // Use the profile endpoint to get current user data
    const profile = await apiFetch<UserProfile>('/api/v1/users/me/profile');
    // Return a subset for AuthContext compatibility
    return {
      id: profile.id,
      email: profile.email,
      operation_id: profile.operation_id,
      phone_number: profile.phone_number,
      first_name: profile.first_name,
      last_name: profile.last_name,
      farm_name: profile.farm_name,
      farm_logo_url: profile.farm_logo_url,
      onboarding_completed_at: profile.onboarding_completed_at ? profile.onboarding_completed_at.toString() : null,
      is_new_user: !profile.onboarding_completed_at,
    };
  },
};

// ================================
// USER APIs
// ================================

// User Profile Types
export interface UserProfile {
  id: string;
  email: string;
  operation_id?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  profile_photo_url?: string;
  farm_name?: string;
  farm_logo_url?: string;
  total_acres_range?: string;
  primary_crops?: string[];
  operation_type?: string;
  current_planning_year?: number;
  planning_approach?: string;
  mailing_address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  preferences?: {
    units: string;
    language: string;
    timezone: string;
  };
  notification_preferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  last_login_at?: string;
  onboarding_completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectionStatus {
  provider: string;
  connected: boolean;
  last_sync_at?: string;
  connection_status?: string;
  sync_status?: string; // pending, in_progress, completed, failed
  error_message?: string;
  fields_synced?: number;
  fields_with_boundaries?: number;
  jd_sync_enabled?: boolean;
  organization_name?: string;
}

export const userAPI = {
  updateProfile: async (data: { first_name: string; last_name: string; farm_name: string }) => {
    return apiFetch<any>('/api/v1/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateOnboarding: async (data: {
    total_acres_range: string;
    primary_crops: string[];
    onboarding_completed_at?: string;
  }) => {
    return apiFetch<any>('/api/v1/users/onboarding', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Get full user profile for Settings page
  getProfile: async (): Promise<UserProfile> => {
    return apiFetch('/api/v1/users/me/profile');
  },

  // Update full profile
  updateFullProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    return apiFetch('/api/v1/users/me/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update preferences
  updatePreferences: async (preferences: { units?: string; language?: string; timezone?: string }): Promise<any> => {
    return apiFetch('/api/v1/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Update notification preferences
  updateNotifications: async (notifications: { email?: boolean; sms?: boolean; push?: boolean }): Promise<any> => {
    return apiFetch('/api/v1/users/me/notifications', {
      method: 'PUT',
      body: JSON.stringify(notifications),
    });
  },

  // Get user connections (John Deere, etc.)
  getConnections: async (): Promise<{ connections: ConnectionStatus[] }> => {
    return apiFetch('/api/v1/users/me/connections');
  },

  // Disconnect from provider
  disconnectProvider: async (provider: string): Promise<any> => {
    return apiFetch(`/api/v1/users/me/connections/${provider}`, {
      method: 'DELETE',
    });
  },

  // Logout
  logout: async (): Promise<any> => {
    return apiFetch('/api/v1/users/me/logout', {
      method: 'POST',
    });
  },

  // Upload farm logo
  // Uses fetchWithTimeout directly (like document upload) for better Android compatibility
  // Accepts File or Blob with explicit filename for HEIC support on Android
  // Includes retry logic for slow mobile networks
  uploadFarmLogo: async (file: File | Blob, fileName?: string): Promise<{ message: string; farm_logo_url: string }> => {
    const maxRetries = 2;
    const timeout = 60000; // 60 seconds - plenty for a logo
    let lastError: Error | null = null;
    // Get filename - use provided name, or extract from File, or default
    const name = fileName || (file instanceof File ? file.name : 'image.jpg');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create fresh FormData for each attempt
        const formData = new FormData();
        // Pass filename explicitly as 3rd argument - critical for Blob uploads on Android
        formData.append('file', file, name);
        
        const token = tokenManager.getAccessToken();
        
        const response = await fetchWithTimeout(`${env.API_BASE_URL}/api/v1/users/me/farm-logo`, {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            // Don't set Content-Type - let browser set it with boundary
          },
          body: formData,
        }, timeout);

        if (!response.ok) {
          throw await handleErrorResponse(response);
        }

        return await response.json();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on auth errors or server rejections
        if (error.status === 401 || error.status === 403 || error.status === 400) {
          throw error;
        }
        
        // Only retry on network/timeout errors
        const isRetryable = !error.status || 
          error.message?.includes('timeout') || 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('Unable to connect');
        
        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff: 2s, 4s)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw lastError || new Error('Upload failed after retries');
  },

  // Delete farm logo
  deleteFarmLogo: async (): Promise<{ message: string }> => {
    return apiFetch('/api/v1/users/me/farm-logo', {
      method: 'DELETE',
    });
  },

  // Change password
  changePassword: async (data: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> => {
    return apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Set password (for token-authenticated users, no current password needed)
  setPassword: async (data: { new_password: string }): Promise<{ success: boolean; message: string }> => {
    return apiFetch('/api/v1/auth/set-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ================================
// JOHN DEERE ONBOARDING APIs (during onboarding)
// ================================

export const jdOnboardingAPI = {
  // Get OAuth URL for onboarding
  getOAuthUrl: async () => {
    return apiFetch<{
      auth_url: string;
      state: string;
      expires_at: string;
      message: string;
    }>('/api/v1/auth/jdops/oauth-url');
  },

  // Check import status during onboarding
  getImportStatus: async () => {
    return apiFetch<{
      connected: boolean;
      provider: string;
      sync_status: string;
      last_sync_at?: string;
      fields_imported?: number;
      total_acres?: number;
    }>('/api/v1/auth/jdops/status');
  },
};

// ================================
// CONNECTIONS APIs (post-onboarding management)
// ================================

export const connectionAPI = {
  // Get OAuth connection URL (backend will redirect)
  initiateJohnDeere: (userId: string): string => {
    return `${env.API_BASE_URL}/api/v1/connections/johndeere/connect?user_id=${userId}`;
  },

  // Check connection status
  getJohnDeereStatus: async () => {
    return apiFetch<{
      connected: boolean;
      provider: string;
      created_at?: string;
      last_sync_at?: string;
      sync_status?: string;
    }>('/api/v1/connections/johndeere/status');
  },

  // Manually trigger field sync
  syncJohnDeereFields: async () => {
    return apiFetch<{
      status: string;
      provider: string;
      message: string;
      check_status_at: string;
    }>('/api/v1/connections/johndeere/sync-fields', {
      method: 'POST',
    });
  },

  // List all connections
  listConnections: async () => {
    return apiFetch<any[]>('/api/v1/connections');
  },

  // Disconnect provider
  disconnect: async (provider: string) => {
    return apiFetch<{ status: string; message: string }>(
      `/api/v1/connections/${provider}`,
      {
        method: 'DELETE',
      }
    );
  },
};

// ================================
// FEED & CONTENT APIs
// ================================

export const contentAPI = {
  getFeed: async (limit = 20, offset = 0) => {
    return apiFetch<any[]>(`/api/v1/feed?limit=${limit}&offset=${offset}`);
  },

  getObservations: async (limit = 20, offset = 0) => {
    return apiFetch<any[]>(`/api/v1/observations?limit=${limit}&offset=${offset}`);
  },

  getFieldPlans: async (params?: { field_id?: string; plan_year?: number; plan_status?: string; limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.plan_year) queryParams.append('plan_year', params.plan_year.toString());
    if (params?.plan_status) queryParams.append('plan_status', params.plan_status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const queryString = queryParams.toString();
    return apiFetch<any[]>(`/api/v1/field-plans/${queryString ? `?${queryString}` : ''}`);
  },

  getFieldPlan: async (planId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}`);
  },

  deleteFieldPlan: async (planId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}`, {
      method: 'DELETE',
    });
  },

  getTasks: async () => {
    return apiFetch<any[]>('/api/v1/tasks');
  },
};

// ================================
// VOICE APIs
// ================================

export const voiceAPI = {
  uploadVoiceNote: async (audioBlob: Blob | File, metadata?: any) => {
    const formData = new FormData();
    
    // Backend expects 'file' as the field name
    // If it's a File object (uploaded), preserve original filename
    // If it's a Blob (recorded), use webm extension
    let filename: string;
    if (audioBlob instanceof File) {
      filename = audioBlob.name;
    } else {
      filename = `voice-note-${Date.now()}.webm`;
    }
    
    formData.append('file', audioBlob, filename);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const token = tokenManager.getAccessToken();
    const response = await fetch(`${env.API_BASE_URL}/api/v1/voice-notes/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type - let browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      throw await handleErrorResponse(response);
    }

    return await response.json();
  },

  getVoiceNotes: async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    field_note_id?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.field_note_id) queryParams.append('field_note_id', params.field_note_id);
    
    const queryString = queryParams.toString();
    return apiFetch<{
      voice_notes: any[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/v1/voice-notes/${queryString ? '?' + queryString : ''}`);
  },

  getVoiceNoteStatus: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}`);
  },

  getAudioUrl: async (voiceNoteId: string) => {
    return apiFetch<{ audio_url: string }>(`/api/v1/voice-notes/${voiceNoteId}/audio`);
  },

  deleteVoiceNote: async (voiceNoteId: string) => {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/v1/voice-notes/${voiceNoteId}`,
      { method: 'DELETE' }
    );
  },

  updateTranscript: async (voiceNoteId: string, transcript: string) => {
    return apiFetch<any>(
      `/api/v1/voice-notes/${voiceNoteId}/transcript`,
      {
        method: 'PUT',
        body: JSON.stringify({ transcript }),
      }
    );
  },

  updateFieldMapping: async (voiceNoteId: string, originalFieldName: string, mapping: { field_name: string; field_id: string; confidence_override: number }) => {
    return apiFetch<any>(
      `/api/v1/voice-notes/${voiceNoteId}/field-mapping?field_name=${encodeURIComponent(originalFieldName)}`,
      {
        method: 'PUT',
        body: JSON.stringify(mapping),
      }
    );
  },

  updateTitle: async (voiceNoteId: string, title: string) => {
    return apiFetch<any>(
      `/api/v1/voice-notes/${voiceNoteId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ title }),
      }
    );
  },

  processVoiceNote: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/process`, {
      method: 'POST',
    });
  },

  startReview: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/start-review`, {
      method: 'POST',
    });
  },

  approveVoiceNote: async (voiceNoteId: string, options: { generate_observations: boolean; generate_tasks: boolean }) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/approve`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  rejectVoiceNote: async (voiceNoteId: string, options: { action_notes: string }) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/reject`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  reprocessVoiceNote: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/reprocess`, {
      method: 'POST',
    });
  },

  createFieldPlan: async (voiceNoteId: string) => {
    // Longer timeout for field plan creation (180 seconds)
    // Multi-field plans with Gemini product detection can take longer
    return apiFetch<any>(
      `/api/v1/voice-notes/${voiceNoteId}/create-field-plan`, 
      { method: 'POST' },
      180000 // 180 seconds (3 minutes) timeout
    );
  },

  recreateFieldPlan: async (voiceNoteId: string) => {
    // Recreate field plans (deletes existing plans first)
    return apiFetch<any>(
      `/api/v1/voice-notes/${voiceNoteId}/recreate-field-plan`, 
      { method: 'POST' },
      180000 // 180 seconds (3 minutes) timeout
    );
  },

  getVoiceNoteFieldPlans: async (voiceNoteId: string) => {
    return apiFetch<{ field_plans: any[] }>(
      `/api/v1/voice-notes/${voiceNoteId}/field-plans`
    );
  },

  createTasks: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/create-tasks`, {
      method: 'POST',
    });
  },

  createObservations: async (voiceNoteId: string, draftMode: boolean = true) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/create-observations?draft_mode=${draftMode}`, {
      method: 'POST',
    });
  },

  analyzeFieldPlanning: async (voiceNoteId: string) => {
    return apiFetch<any>(`/api/v1/voice-notes/${voiceNoteId}/analyze-field-planning`, {
      method: 'POST',
    });
  },
};

export interface Field {
  field_id: string;
  name: string;
  farm_id: string;
  farm_name?: string;
  operation_id: string;
  operation_name?: string;
  acres?: number;
  boundary?: any;
  external_source?: string;
  external_id?: string;
}

export const fieldsAPI = {
  // Get lightweight summary (total_fields, total_acres only) - fast for dashboards
  getFieldsSummary: async () => {
    return apiFetch<{
      total_fields: number;
      total_acres: number;
    }>('/api/v1/fields/summary');
  },

  // Get all fields for the authenticated user
  // include_geometry: Set to true only for map views that need field boundaries (large payload)
  getFields: async (options?: { include_geometry?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.include_geometry) {
      params.append('include_geometry', 'true');
    }
    const queryString = params.toString();
    return apiFetch<{
      total_fields: number;
      total_acres: number;
      crop_distribution: any;
      farms_count: number;
      fields: Field[];
    }>(`/api/v1/fields/${queryString ? `?${queryString}` : ''}`);
  },

  // Detect which field contains a given lat/lon coordinate
  detectFieldFromLocation: async (latitude: number, longitude: number) => {
    return apiFetch<{
      field_detected: boolean;
      field: {
        field_id: string;
        name: string;
        farm_name: string | null;
      } | null;
    }>(`/api/v1/fields/detect-field?latitude=${latitude}&longitude=${longitude}`);
  },

  // Get field document timeline summary
  // Get timeline by summary ID (preferred method once summary exists)
  getDocumentTimelineById: async (summaryId: string) => {
    return apiFetch<{
      id: string;
      field_id: string;
      field_name: string;
      farm_name: string;
      time_period: string;
      year: number;
      total_documents: number;
      summary_text: string;
      key_observations: string[];
      trends: string[];
      recommendations: string[];
      custom_title?: string | null;
      generation_status: 'generating' | 'completed' | 'failed';
      last_computed_at?: string | null;
      included_document_ids?: string[];
      cached: boolean;
    }>(`/api/v1/fields/document-timeline/${summaryId}`);
  },

  // Get timeline by field/year/document_ids (for generation or when summary_id not available)
  getFieldDocumentTimeline: async (
    fieldId: string,
    timePeriod: 'weekly' | 'monthly' | 'full_season' = 'full_season',
    year?: number,
    regenerate: boolean = false,
    startDate?: string,
    endDate?: string,
    documentIds?: string  // Comma-separated string of document IDs (e.g., "id1,id2,id3" or "id1" for single)
  ) => {
    const yearParam = year ? `&year=${year}` : '';
    const startDateParam = startDate ? `&start_date=${startDate}` : '';
    const endDateParam = endDate ? `&end_date=${endDate}` : '';
    const documentIdsParam = documentIds ? `&document_ids=${documentIds}` : '';
    return apiFetch<{
      field_id: string;
      field_name: string;
      time_period: string;
      year: number;
      total_documents?: number;
      summary_text?: string;
      key_observations?: string[];
      trends?: string[];
      recommendations?: string[];
      custom_title?: string | null;
      generation_status?: 'generating' | 'completed' | 'failed';
      message?: string;
      last_computed_at?: string | null;
      cached?: boolean;
      id?: string; // Summary ID when available
    }>(`/api/v1/fields/${fieldId}/document-timeline?time_period=${timePeriod}${yearParam}${startDateParam}${endDateParam}${documentIdsParam}&regenerate=${regenerate}`);
  },

  // List all document timeline summaries for current user (lightweight)
  listDocumentTimelines: async () => {
    return apiFetch<{
      summaries: Array<{
        id: string;
        field_id: string;
        field_name: string;
        farm_name: string;
        time_period: string;
        year: number;
        total_documents: number;
        summary_preview: string;
        last_computed_at: string | null;
        created_at: string | null;
        cached: boolean;
      }>;
      total: number;
    }>('/api/v1/fields/document-timelines');
  },
};

// ================================
// FIELD NOTES APIs
// ================================

export interface FieldNote {
  id: string;
  user_id: string;
  field_id: string;
  location: { lat: number; lon: number };
  text?: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  voice_note_count: number;
  field_name?: string;
  farm_name?: string;
}

export interface FieldNoteCreate {
  field_id: string;
  location: { lat: number; lon: number };
  text?: string;
}

export interface FieldNoteUpdate {
  text?: string;
  location?: { lat: number; lon: number };
}

export const fieldNotesAPI = {
  // Create a new field note
  createFieldNote: async (data: FieldNoteCreate): Promise<FieldNote> => {
    return apiFetch<FieldNote>('/api/v1/field-notes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // List field notes (optionally filtered by field)
  listFieldNotes: async (params?: {
    field_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ field_notes: FieldNote[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const url = `/api/v1/field-notes/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiFetch<{ field_notes: FieldNote[]; total: number }>(url);
  },

  // Get a specific field note
  getFieldNote: async (fieldNoteId: string): Promise<FieldNote> => {
    return apiFetch<FieldNote>(`/api/v1/field-notes/${fieldNoteId}`);
  },

  // Update a field note
  updateFieldNote: async (fieldNoteId: string, data: FieldNoteUpdate): Promise<FieldNote> => {
    return apiFetch<FieldNote>(`/api/v1/field-notes/${fieldNoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Delete a field note
  deleteFieldNote: async (fieldNoteId: string): Promise<void> => {
    return apiFetch<void>(`/api/v1/field-notes/${fieldNoteId}`, {
      method: 'DELETE',
    });
  },
};

// ================================
// TASKS APIs
// ================================

export const tasksAPI = {
  // List tasks with optional filters
  getTasks: async (params?: {
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date_from?: string;
    due_date_to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.due_date_from) queryParams.append('due_date_from', params.due_date_from);
    if (params?.due_date_to) queryParams.append('due_date_to', params.due_date_to);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    return apiFetch<{
      tasks: any[];
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    }>(`/api/v1/tasks/${queryString ? '?' + queryString : ''}`);
  },

  // Get a specific task
  getTask: async (taskId: string) => {
    return apiFetch<any>(`/api/v1/tasks/${taskId}`);
  },

  // Create a new task
  createTask: async (taskData: {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    related_field_id?: string;
    related_farm_id?: string;
    metadata?: any;
  }) => {
    return apiFetch<any>('/api/v1/tasks/', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  // Update a task
  updateTask: async (taskId: string, updates: {
    title?: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    notes?: string;
    related_field_id?: string;
  }) => {
    return apiFetch<any>(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Delete a task
  deleteTask: async (taskId: string) => {
    return apiFetch<{ success: boolean; message: string; task_id: string }>(
      `/api/v1/tasks/${taskId}`,
      { method: 'DELETE' }
    );
  },

  // Toggle task completion
  toggleComplete: async (taskId: string, completed: boolean) => {
    return apiFetch<any>(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: completed ? 'completed' : 'pending',
      }),
    });
  },
};

// ================================
// OBSERVATIONS APIs
// ================================

export const observationsAPI = {
  // List all user observations
  getAllObservations: async (params?: {
    limit?: number;
    offset?: number;
    field_id?: string;
    status?: string;
    type?: string;
    has_voice?: boolean;
    voice_status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.has_voice !== undefined) queryParams.append('has_voice', params.has_voice.toString());
    if (params?.voice_status) queryParams.append('voice_status', params.voice_status);

    const queryString = queryParams.toString();
    return apiFetch<{
      observations: any[];
      total: number;
      has_more: boolean;
    }>(`/api/v1/observations/${queryString ? '?' + queryString : ''}`);
  },

  // List observations for a field
  getFieldObservations: async (fieldId: string, params?: {
    limit?: number;
    offset?: number;
    observation_type?: string;
    has_voice?: boolean;
    has_images?: boolean;
    date_from?: string;
    date_to?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.observation_type) queryParams.append('observation_type', params.observation_type);
    if (params?.has_voice !== undefined) queryParams.append('has_voice', params.has_voice.toString());
    if (params?.has_images !== undefined) queryParams.append('has_images', params.has_images.toString());
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);

    const queryString = queryParams.toString();
    return apiFetch<{
      observations: any[];
      total: number;
      has_more: boolean;
    }>(`/api/v1/fields/${fieldId}/observations/${queryString ? '?' + queryString : ''}`);
  },

  // Get observation detail
  getObservationDetail: async (observationId: string) => {
    return apiFetch<any>(`/api/v1/observations/${observationId}`);
  },

  // Create a new observation
  createObservation: async (fieldId: string, observationData: {
    title?: string;
    description?: string;
    type: string;
    text: string;
    score?: string;
    location?: { lat: number; lng: number };
    observed_at?: string;
    voice_note_id?: string;
    status?: string;
  }) => {
    return apiFetch<any>(`/api/v1/fields/${fieldId}/observations/`, {
      method: 'POST',
      body: JSON.stringify(observationData),
    });
  },

  // Update an observation
  updateObservation: async (observationId: string, updates: {
    title?: string;
    description?: string;
    type?: string;
    text?: string;
    score?: string;
    location?: { lat: number; lng: number };
    observed_at?: string;
    status?: string;
  }) => {
    return apiFetch<any>(`/api/v1/observations/${observationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete an observation
  deleteObservation: async (observationId: string) => {
    return apiFetch<any>(`/api/v1/observations/${observationId}`, {
      method: 'DELETE',
    });
  },
};

// ================================
// DOCUMENTS APIs
// ================================

export interface Document {
  id: string;
  original_filename: string;
  title?: string;
  document_type: string;
  mime_type?: string;
  file_size_bytes?: number;
  storage_url?: string;
  file_url?: string;
  processing_status: string;
  ai_analyzed: boolean;
  ai_summary?: string;
  text_content?: string;
  
  // Visual Analysis (NEW)
  visual_analysis?: {
    description: string;
    agricultural_insights: string;
    detected_elements: string[];
    condition_assessment: string;
    recommended_actions: string[];
    confidence: number;
    is_agricultural?: boolean;  // Flag for non-farm content detection
    metadata?: {
      document_date?: string;
      document_date_confidence?: number;
      crop_stage?: string;
      issues?: string[];
      severity?: string;
    };
  };
  analysis_type?: 'text' | 'visual' | 'hybrid' | 'none';
  detected_elements?: string[];
  
  // Metadata extraction (Phase 1)
  document_date?: string;
  document_date_confidence?: number;
  ai_extracted_data?: {
    document_date?: string;
    document_date_confidence?: number;
    [key: string]: any;
  };
  location_extracted?: string;
  crop_stage_extracted?: string;
  issues_extracted?: string[];
  severity_extracted?: string;
  action_items?: Array<{
    action: string;
    reason: string;
    priority: string;
    timing: string;
  }>;
  
  field_id?: string;
  observation_id?: string;
  voice_note_id?: string;
  task_id?: string;
  field_plan_id?: string;
  field_plan_pass_id?: string;
  field_plan_creation_status?: 'creating' | 'completed' | 'failed' | null;
  created_at: string;
  updated_at: string;
}

export const documentsAPI = {
  // Upload a document (photo, PDF, etc.)
  uploadDocument: async (file: File, metadata: {
    document_type: 'photo' | 'pdf' | 'document' | 'receipt' | 'invoice' | 'report' | 'other';
    field_id?: string;
    observation_id?: string;
    voice_note_id?: string;
    task_id?: string;
    field_plan_id?: string;
    field_plan_pass_id?: string;
    field_note_id?: string;
    document_date?: string;
    location?: { lat: number; lon: number };
  }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', metadata.document_type);
    
    if (metadata.field_id) formData.append('field_id', metadata.field_id);
    if (metadata.observation_id) formData.append('observation_id', metadata.observation_id);
    if (metadata.voice_note_id) formData.append('voice_note_id', metadata.voice_note_id);
    if (metadata.task_id) formData.append('task_id', metadata.task_id);
    if (metadata.field_plan_id) formData.append('field_plan_id', metadata.field_plan_id);
    if (metadata.field_plan_pass_id) formData.append('field_plan_pass_id', metadata.field_plan_pass_id);
    if (metadata.field_note_id) formData.append('field_note_id', metadata.field_note_id);
    if (metadata.document_date) formData.append('document_date', metadata.document_date);
    if (metadata.location) formData.append('location', JSON.stringify(metadata.location));

    const token = tokenManager.getAccessToken();
    const response = await fetchWithTimeout(`${env.API_BASE_URL}/api/v1/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type - let browser set it with boundary
      },
      body: formData,
    }, 60000); // 60 second timeout for document upload (processing happens in background)

    if (!response.ok) {
      throw await handleErrorResponse(response);
    }

    return await response.json();
  },

  // List documents with optional filters
  getDocuments: async (params?: {
    document_type?: string;
    field_id?: string;
    observation_id?: string;
    voice_note_id?: string;
    task_id?: string;
    field_plan_id?: string;
    field_note_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.document_type) queryParams.append('document_type', params.document_type);
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.observation_id) queryParams.append('observation_id', params.observation_id);
    if (params?.voice_note_id) queryParams.append('voice_note_id', params.voice_note_id);
    if (params?.task_id) queryParams.append('task_id', params.task_id);
    if (params?.field_plan_id) queryParams.append('field_plan_id', params.field_plan_id);
    if (params?.field_note_id) queryParams.append('field_note_id', params.field_note_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    return apiFetch<{
      total_count: number;
      documents: any[];
    }>(`/api/v1/documents${queryString ? '?' + queryString : ''}`, {}, 60000); // 60 second timeout for large document lists
  },

  // Get a specific document
  getDocument: async (documentId: string) => {
    return apiFetch<any>(`/api/v1/documents/${documentId}`);
  },

  // Delete a document
  deleteDocument: async (documentId: string) => {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/v1/documents/${documentId}`,
      { method: 'DELETE' }
    );
  },

  // Get documents for a specific observation
  getObservationDocuments: async (observationId: string) => {
    return apiFetch<{
      observation_id: string;
      documents: any[];
      total_count: number;
    }>(`/api/v1/observations/${observationId}/documents`);
  },

  // Get documents for a field plan
  getFieldPlanDocuments: async (fieldPlanId: string) => {
    return apiFetch<{
      documents: any[];
      total_count: number;
      page: number;
      page_size: number;
    }>(`/api/v1/field-plans/${fieldPlanId}/documents`);
  },

  // Get documents for a field plan pass
  getFieldPlanPassDocuments: async (passId: string) => {
    return apiFetch<{
      documents: any[];
      total_count: number;
      page: number;
      page_size: number;
    }>(`/api/v1/field-plan-passes/${passId}/documents`);
  },

  // Reprocess a document (retry AI analysis)
  reprocessDocument: async (documentId: string) => {
    return apiFetch<{ message: string; document_id: string; previous_status: string }>(
      `/api/v1/documents/${documentId}/reprocess`,
      { method: 'POST' }
    );
  },

  // Update a document
  updateDocument: async (documentId: string, updates: {
    title?: string;
    document_type?: string;
    ai_summary?: string;
    field_id?: string | null;
    document_date?: string | null;
  }) => {
    return apiFetch<Document>(
      `/api/v1/documents/${documentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  },

  // Generate share message preview for a single document
  generateSharePreview: async (documentId: string, params: {
    recipient_name: string;
    recipient_type: string;
    communication_method: 'sms' | 'email';
    user_context?: string;
  }): Promise<{
    subject?: string;
    body: string;
    share_link: string;
    share_token: string;
    metadata: Record<string, any>;
  }> => {
    return apiFetch(`/api/v1/documents/${documentId}/share/preview`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Share a document with contacts
  shareDocument: async (documentId: string, params: {
    contact_ids: string[];
    communication_method: 'sms' | 'email';
    message: { subject?: string; body: string };
  }): Promise<{
    share_id: string;
    share_link: string;
    delivery_results: Array<{ contact_id: string; contact_name: string; status: string; error?: string; reason?: string }>;
    success_count: number;
    total_count: number;
  }> => {
    return apiFetch(`/api/v1/documents/${documentId}/share`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Get document share history
  getShareHistory: async (): Promise<{
    shares: Array<{
      id: string;
      document_id: string;
      document_title: string;
      document_type: string;
      field_name: string | null;
      share_link: string;
      communication_method: string;
      message_subject: string | null;
      message_body: string | null;
      recipient_names: string[];
      view_count: number;
      last_viewed_at: string | null;
      shared_at: string;
      share_type: 'document';
    }>;
    total: number;
  }> => {
    return apiFetch('/api/v1/documents/shares/history');
  },

  // Delete a document share
  deleteShare: async (shareId: string): Promise<{ message: string; id: string }> => {
    return apiFetch(`/api/v1/documents/shares/${shareId}`, {
      method: 'DELETE',
    });
  },
};

// ================================
// FIELD PLANS APIs
// ================================

export interface ProductSummaryItem {
  product_name: string;
  product_type: string | null;
  product_brand: string | null;
  total_quantity: number;
  quantity_unit: string;
  total_cost: number | null;
  passes: string[];
  is_variable_rate: boolean;
}

export interface FieldPlanProductSummary {
  field_plan_id: string;
  plan_name: string;
  field_name: string | null;
  total_acres: number | null;
  products: ProductSummaryItem[];
  summary_by_type: Record<string, ProductSummaryItem[]>;
  total_estimated_cost: number;
  total_products_count: number;
}

export const fieldPlansAPI = {
  getFieldPlans: async (params?: { 
    field_id?: string; 
    plan_year?: number; 
    plan_status?: string; 
    source_document_id?: string;
    source_voice_note_id?: string;
    limit?: number; 
    offset?: number 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.plan_year) queryParams.append('plan_year', params.plan_year.toString());
    if (params?.plan_status) queryParams.append('plan_status', params.plan_status);
    if (params?.source_document_id) queryParams.append('source_document_id', params.source_document_id);
    if (params?.source_voice_note_id) queryParams.append('source_voice_note_id', params.source_voice_note_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const queryString = queryParams.toString();
    return apiFetch<any[]>(`/api/v1/field-plans/${queryString ? `?${queryString}` : ''}`);
  },

  getFieldPlan: async (planId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}`);
  },

  getProductSummary: async (planId: string) => {
    return apiFetch<FieldPlanProductSummary>(`/api/v1/field-plans/${planId}/products-summary`);
  },

  // Create a new field plan manually
  createFieldPlanManual: async (planData: {
    plan_name: string;
    field_id: string;
    crop_type?: string | null;
    plan_year: number;
    plan_status?: string;
    notes?: string | null;
  }) => {
    return apiFetch<any>('/api/v1/field-plans/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planData),
    });
  },

  // Update field plan basics (name, status, field, crop, year)
  updateFieldPlan: async (planId: string, updates: {
    plan_name?: string;
    field_id?: string | null;
    crop_type?: string;
    plan_year?: number;
    plan_status?: string;
    notes?: string;
  }) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteFieldPlan: async (planId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}`, {
      method: 'DELETE',
    });
  },

  // Pass management
  updatePass: async (planId: string, passId: string, updates: {
    pass_name?: string;
    pass_type?: string;
    pass_status?: string;
    pass_order?: number;
  }) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}/passes/${passId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  updatePassStatus: async (planId: string, passId: string, status: string, actual_date?: string) => {
    const body: any = { pass_status: status };
    if (actual_date) {
      body.actual_date = actual_date;
    }
    return apiFetch<any>(`/api/v1/field-plans/${planId}/passes/${passId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  createPass: async (planId: string, passData: {
    pass_name: string;
    pass_type: string;
    pass_order?: number;
    sequence_order?: number;
  }) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}/passes`, {
      method: 'POST',
      body: JSON.stringify(passData),
    });
  },

  deletePass: async (planId: string, passId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/${planId}/passes/${passId}`, {
      method: 'DELETE',
    });
  },

  // Prescription generation
  generatePrescription: async (passId: string, request: {
    rate: number;
    rate_unit?: string;
    product_name?: string;
    variety?: string;
    push_to_jd?: boolean;
  }) => {
    return apiFetch<{
      prescription_id: string;
      status: string;
      file_url?: string;
      preview_url?: string;
      jd_work_plan_id?: string;
      jd_work_plan_url?: string;
      message: string;
    }>(`/api/v1/field-plans/passes/${passId}/generate-prescription`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getPrescription: async (passId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/passes/${passId}/prescription`);
  },

  // Delete prescription
  deletePrescription: async (prescriptionId: string) => {
    return apiFetch(`/api/v1/field-plans/prescriptions/${prescriptionId}`, {
      method: 'DELETE',
    });
  },

  // Upload prescription to John Deere
  uploadPrescriptionToJD: async (prescriptionId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/prescriptions/${prescriptionId}/upload-to-jd`, {
      method: 'POST',
    });
  },

  // List all prescriptions
  getPrescriptions: async (params?: { limit?: number; offset?: number; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const queryString = queryParams.toString();
    return apiFetch<any[]>(`/api/v1/field-plans/prescriptions${queryString ? `?${queryString}` : ''}`);
  },

  // Product management
  updateProduct: async (passId: string, productId: string, updates: {
    product_name?: string;
    rate?: number;
    rate_unit?: string;
    total_quantity?: number;
    quantity_unit?: string;
  }) => {
    return apiFetch<any>(`/api/v1/field-plans/passes/${passId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  createProduct: async (passId: string, productData: {
    product_name: string;
    rate: number;
    rate_unit: string;
    total_quantity?: number;
    quantity_unit?: string;
  }) => {
    return apiFetch<any>(`/api/v1/field-plans/passes/${passId}/products`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  deleteProduct: async (passId: string, productId: string) => {
    return apiFetch<any>(`/api/v1/field-plans/passes/${passId}/products/${productId}`, {
      method: 'DELETE',
    });
  },

  // ============================================
  // PHOTO/DOCUMENT IMPORT
  // ============================================

  // Analyze a document for field planning content (preview before creating)
  // Analyze a document for field planning content (preview before creating)
  // Uses longer timeout - AI processing can take time
  analyzeDocumentForFieldPlan: async (documentId: string) => {
    return apiFetch<{
      success: boolean;
      content_type: string;
      confidence: number;
      plan_name?: string;
      field_name?: string;
      crop?: string;
      year?: number;
      passes?: any[];
      variable_rate_zones?: any[];
      field_matching?: any;
      extraction_notes?: string;
      reason?: string;
    }>(`/api/v1/field-plans/import/photo/analyze`, {
      method: 'POST',
      body: (() => {
        const formData = new FormData();
        formData.append('document_id', documentId);
        return formData;
      })(),
    }, 120000); // 120 seconds - AI analysis can take time
  },

  // Create field plan from an already-analyzed document
  // Uses longer timeout (180s) - 2-step AI process: structured insights + field planning analysis
  createFieldPlanFromDocument: async (documentId: string, planName?: string) => {
    const formData = new FormData();
    formData.append('document_id', documentId);
    if (planName) {
      formData.append('plan_name', planName);
    }

    return apiFetch<{
      success: boolean;
      document_id: string;
      plans_created?: { 
        id: string; 
        plan_name?: string; 
        field_name?: string;
        plan_year?: number;
        total_passes?: number;
      }[];
      message?: string;
      error?: string;
      existing_plan?: {
        id: string;
        plan_name: string;
        field_name: string;
        crop_type: string;
        plan_year: number;
      };
      existing_plans?: {
        field_name: string;
        plan_name: string;
        plan_id: string;
      }[];
    }>(`/api/v1/field-plans/import/photo/create`, {
      method: 'POST',
      body: formData,
    }, 180000); // 180 seconds (3 minutes) - same as voice note field plan creation
  },
};

// Planning Seasons API
export interface PlanningSeason {
  id: string;
  farmer_id: string;
  planning_year: number;
  season_status: string;
  started_at: string;
  first_draft_completed_at?: string;
  advisor_meeting_date?: string;
  prescriptions_generated: number;
  created_at: string;
  updated_at: string;
}

export interface PlanningSeasonStats {
  planning_year: number;
  season_status: string;
  total_fields: number;
  fields_with_plans: number;
  planning_progress_percent: number;
  total_passes: number;
  completed_passes: number;
  high_priority_tasks: number;
  advisor_questions: number;
  first_draft_complete: boolean;
}

export interface CurrentPlanningContext {
  current_year: number;
  has_active_season: boolean;
  season_id?: string;
  started_at?: string;
  progress?: PlanningSeasonStats;
}

export const planningAPI = {
  // Start a new planning season
  startSeason: async (year: number) => {
    return apiFetch<PlanningSeason>(`/api/v1/planning/start-season/${year}`, {
      method: 'POST',
    });
  },

  // Get current active season
  getCurrentSeason: async () => {
    return apiFetch<CurrentPlanningContext>('/api/v1/planning/current-season');
  },

  // Get stats for a specific year
  getSeasonStats: async (year: number) => {
    return apiFetch<PlanningSeasonStats>(`/api/v1/planning/stats/${year}`);
  },

  // List all seasons
  listSeasons: async () => {
    return apiFetch<PlanningSeason[]>('/api/v1/planning/seasons');
  },

  // Update a season
  updateSeason: async (seasonId: string, updates: {
    season_status?: string;
    first_draft_completed_at?: string;
    advisor_meeting_date?: string;
    prescriptions_generated?: number;
  }) => {
    return apiFetch<PlanningSeason>(`/api/v1/planning/${seasonId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

// Briefings API
export interface Briefing {
  id: string;
  user_id: string;
  title?: string;
  plan_ids: string[];
  content?: string;
  status: 'generating' | 'ready' | 'shared' | 'failed';
  share_token: string;
  error_message?: string;
  generated_at?: string;
  shared_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BriefingPublicView {
  id: string;
  title?: string;
  content: string;
  generated_at?: string;
}

export const briefingsAPI = {
  // Generate a new briefing from selected plans
  generateBriefing: async (planIds: string[], title?: string) => {
    return apiFetch<Briefing>('/api/v1/briefings/generate', {
      method: 'POST',
      body: JSON.stringify({ plan_ids: planIds, title }),
    });
  },

  // List all briefings
  listBriefings: async (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return apiFetch<Briefing[]>(`/api/v1/briefings${params}`);
  },

  // Get a specific briefing (authenticated)
  getBriefing: async (briefingId: string) => {
    return apiFetch<Briefing>(`/api/v1/briefings/${briefingId}`);
  },

  // Get a briefing by public share token (no auth required)
  getPublicBriefing: async (shareToken: string) => {
    return apiFetch<BriefingPublicView>(`/api/v1/briefings/public/${shareToken}`);
  },

  // Delete a briefing
  deleteBriefing: async (briefingId: string) => {
    return apiFetch<void>(`/api/v1/briefings/${briefingId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// SHARE PLANS API
// ============================================

export interface ShareMessageRequest {
  plan_ids: string[];
  recipient_name: string;
  recipient_type: string;
  communication_method: 'sms' | 'email';
  user_context: string;
}

export interface ShareMessageResponse {
  subject?: string;
  body: string;
  share_link: string;
  metadata: {
    method: string;
    estimated_length: number;
    generated_by: string;
  };
}

export interface SharePlansRequest {
  plan_ids: string[];
  contact_ids: string[];
  communication_method: 'sms' | 'email';
  message: {
    subject?: string;
    body: string;
  };
  share_link: string;
}

export interface ShareDeliveryResult {
  contact_id: string;
  contact_name: string;
  status: string;
  delivery_method: string;
  message_id?: string;
  error?: string;
  sent_at?: string;
}

export interface SharePlansResponse {
  share_record_id: string;
  total_recipients: number;
  results: ShareDeliveryResult[];
  success_count: number;
  failed_count: number;
}

export interface ShareHistoryItem {
  id: string;
  plan_ids?: string[];
  plan_names?: string[];
  field_id?: string;
  field_name?: string;
  field_names?: string[];
  farm_name?: string;
  year?: number;
  time_period?: string;
  custom_title?: string;
  recipient_names: string;
  share_link?: string;
  communication_method: 'sms' | 'email';
  message_subject?: string;
  message_body: string;
  created_at: string;
  view_count: number;
  last_viewed_at?: string;
}

export interface ShareHistoryResponse {
  shares: ShareHistoryItem[];
  total_count: number;
}

export const sharePlansAPI = {
  // Generate AI message for sharing
  generateMessage: async (request: ShareMessageRequest) => {
    return apiFetch<ShareMessageResponse>('/api/v1/plans/generate-message', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Share plans with contacts
  sharePlans: async (request: SharePlansRequest) => {
    return apiFetch<SharePlansResponse>('/api/v1/plans/share', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Get share history
  getShareHistory: async () => {
    return apiFetch<ShareHistoryResponse>('/api/v1/plans/history');
  },

  // Delete shared plan
  deleteSharedPlan: async (shareId: string) => {
    return apiFetch<{message: string}>(`/api/v1/plans/${shareId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// FIELD PLAN SUMMARIES API
// ============================================

export interface ProductAggregate {
  product_name: string;
  quantity_unit: string;  // Unit for the total quantity (e.g., 'tons', 'lbs', 'gallons')
  total_quantity: number;
  used_in_fields: string[];
  used_in_plans: number;
  plan_ids: string[];
}

export interface FieldPlanSummaryResponse {
  id: string;
  user_id: string;
  summary_name?: string;
  year: number;
  plan_ids: string[];
  aggregated_products: ProductAggregate[];
  summary_text?: string;  // AI-generated summary text
  total_fields: number;
  total_plans: number;
  total_products: number;
  created_at: string;
  updated_at: string;
}

export interface FieldPlanSummaryListItem {
  id: string;
  summary_name?: string;
  year: number;
  total_fields: number;
  total_plans: number;
  total_products: number;
  created_at: string;
}

export interface CreateFieldPlanSummaryRequest {
  plan_ids: string[];
  summary_name?: string;
}

export const fieldPlanSummariesAPI = {
  // Generate and save a summary from selected plans
  generateSummary: async (request: CreateFieldPlanSummaryRequest) => {
    return apiFetch<FieldPlanSummaryResponse>('/api/v1/field-plans/summary', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // List all summaries for the user
  listSummaries: async () => {
    return apiFetch<FieldPlanSummaryListItem[]>('/api/v1/field-plans/summaries');
  },

  // Get a specific summary by ID
  getSummary: async (summaryId: string) => {
    return apiFetch<FieldPlanSummaryResponse>(`/api/v1/field-plans/summary/${summaryId}`);
  },

  // Delete a summary
  deleteSummary: async (summaryId: string) => {
    return apiFetch<{success: boolean; message: string}>(
      `/api/v1/field-plans/summary/${summaryId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Update a summary (name and/or summary text)
  updateSummary: async (summaryId: string, request: {
    summary_name?: string;
    summary_text?: string;
  }) => {
    return apiFetch<{success: boolean; message: string}>(
      `/api/v1/field-plans/summary/${summaryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(request),
      }
    );
  },

  // Generate share message for a summary
  generateShareMessage: async (summaryId: string, request: {
    contact_ids: string[];
    communication_method: 'sms' | 'email';
    user_context?: string;
  }) => {
    return apiFetch<ShareMessageResponse>(`/api/v1/field-plans/summary/${summaryId}/share/preview`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Share a summary
  shareSummary: async (summaryId: string, request: {
    contact_ids: string[];
    communication_method: 'sms' | 'email';
    user_context?: string;
    message_subject?: string;
  }) => {
    return apiFetch<{success: boolean; share_id: string; message: string; share_link?: string}>(
      `/api/v1/field-plans/summary/${summaryId}/share`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },

  // Get shared summaries history
  getSharedSummariesHistory: async () => {
    return apiFetch<{shares: any[]; total: number}>('/api/v1/field-plans/summary/shared/history');
  },
};

// ============================================
// TIMELINE SHARING API
// ============================================

export interface ShareTimelineMessageRequest {
  summary_id?: string; // Preferred - use summary_id if available
  field_id?: string; // Fallback for backward compatibility
  year?: number; // Fallback for backward compatibility
  time_period?: string; // Fallback for backward compatibility
  recipient_name: string;
  recipient_type: string;
  communication_method: 'sms' | 'email';
  user_context: string;
}

export interface ShareTimelineRequest {
  summary_id?: string; // Preferred - use summary_id if available
  field_id?: string; // Fallback for backward compatibility
  year?: number; // Fallback for backward compatibility
  time_period?: string; // Fallback for backward compatibility
  contact_ids: string[];
  communication_method: 'sms' | 'email';
  message: {
    subject?: string;
    body: string;
  };
  share_link?: string;
}

export const shareTimelinesAPI = {
  // Generate AI message for sharing timeline
  generateMessage: async (request: ShareTimelineMessageRequest) => {
    return apiFetch<ShareMessageResponse>('/api/v1/share-timelines/generate-message', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 120000); // 120 second timeout - timeline generation + AI message generation can take time
  },

  // Share timeline with contacts
  shareTimeline: async (request: ShareTimelineRequest) => {
    return apiFetch<SharePlansResponse>('/api/v1/share-timelines/share', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 60000); // 60 second timeout for sending messages
  },

  // Get share history
  getShareHistory: async () => {
    return apiFetch<ShareHistoryResponse>('/api/v1/share-timelines/history');
  },

  // Delete shared timeline
  deleteSharedTimeline: async (shareId: string) => {
    return apiFetch(`/api/v1/share-timelines/${shareId}`, {
      method: 'DELETE'
    });
  },
  
  // Update document timeline title
  // Can be called with summaryId (preferred) or with year/timePeriod (backward compatibility for shared timelines)
  updateTimelineTitle: async (
    summaryIdOrFieldId: string, 
    fieldIdOrYear: string | number, 
    timePeriodOrTitle?: string, 
    customTitle?: string
  ) => {
    // If 3 arguments: summaryId, fieldId, customTitle (new preferred method)
    if (customTitle !== undefined && typeof fieldIdOrYear === 'string') {
      return apiFetch(`/api/v1/fields/${fieldIdOrYear}/document-timeline?summary_id=${summaryIdOrFieldId}&custom_title=${encodeURIComponent(customTitle)}`, {
        method: 'PATCH'
      });
    }
    // If 4 arguments: fieldId, year, timePeriod, customTitle (backward compatibility for shared timelines)
    else if (customTitle !== undefined && typeof fieldIdOrYear === 'number' && timePeriodOrTitle) {
      return apiFetch(`/api/v1/fields/${summaryIdOrFieldId}/document-timeline?year=${fieldIdOrYear}&time_period=${timePeriodOrTitle}&custom_title=${encodeURIComponent(customTitle)}`, {
        method: 'PATCH'
      });
    }
    else {
      throw new Error('Invalid arguments for updateTimelineTitle');
    }
  },
  
  // Update document timeline content
  updateTimelineContent: async (
    summaryId: string,
    fieldId: string,
    updates: {
      summary_text?: string;
      key_observations?: string[];
      trends?: string[];
      recommendations?: string[];
    }
  ) => {
    const params = new URLSearchParams({
      summary_id: summaryId
    });
    
    if (updates.summary_text !== undefined) {
      params.append('summary_text', updates.summary_text);
    }
    if (updates.key_observations !== undefined) {
      updates.key_observations.forEach(obs => params.append('key_observations', obs));
    }
    if (updates.trends !== undefined) {
      updates.trends.forEach(trend => params.append('trends', trend));
    }
    if (updates.recommendations !== undefined) {
      updates.recommendations.forEach(rec => params.append('recommendations', rec));
    }
    
    return apiFetch(`/api/v1/fields/${fieldId}/document-timeline?${params.toString()}`, {
      method: 'PATCH'
    });
  },
  
  // Delete document timeline
  deleteTimeline: async (summaryId: string, fieldId: string) => {
    return apiFetch(`/api/v1/fields/${fieldId}/document-timeline?summary_id=${summaryId}`, {
      method: 'DELETE'
    });
  },
  
  // Get public timeline summary (no auth required)
  getPublicSummary: async (shareToken: string): Promise<TimelinePublicView> => {
    const url = `${env.API_BASE_URL}/api/v1/share-timelines/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load timeline summary');
    }
    return response.json();
  },
};

// Public view types for shared content
export interface TimelinePublicView {
  field_name: string | null;
  farm_name: string | null;
  year: number | null;
  time_period: string | null;
  custom_title: string | null;
  summary_text: string | null;
  key_observations: string[];
  trends: string[];
  recommendations: string[];
  total_documents: number;
  shared_by: string;
  shared_at: string | null;
}

export interface FieldPlanSummaryPublicView {
  summary_name: string;
  year: number;
  total_plans: number;
  total_fields: number;
  summary_text: string | null;
  product_totals: any[];
  plans: Array<{
    id: string;
    plan_name: string | null;
    year: number;
    crop: string | null;
    field_name: string | null;
    farm_name: string | null;
  }>;
  shared_by: string;
  shared_at: string | null;
}

export interface DocumentPublicView {
  document_name: string | null;
  document_type: string | null;
  file_size: number | null;
  field_name: string | null;
  farm_name: string | null;
  ai_summary: string | null;
  document_date: string | null;
  preview_url: string | null;
  download_url: string | null;
  shared_by: string;
  shared_at: string | null;
}

// Public APIs (no auth required)
export const publicAPI = {
  // Get public field plan summary
  getFieldPlanSummary: async (shareToken: string): Promise<FieldPlanSummaryPublicView> => {
    const url = `${env.API_BASE_URL}/api/v1/field-plans/summary/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load field plan summary');
    }
    return response.json();
  },
  
  // Get public timeline summary
  getTimelineSummary: async (shareToken: string): Promise<TimelinePublicView> => {
    const url = `${env.API_BASE_URL}/api/v1/share-timelines/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load timeline summary');
    }
    return response.json();
  },
  
  // Get public document summary
  getDocumentSummary: async (shareToken: string): Promise<DocumentPublicView> => {
    const url = `${env.API_BASE_URL}/api/v1/documents/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load document');
    }
    return response.json();
  },
};

// ============================================
// CONTACTS API
// ============================================

export interface Contact {
  id: string;
  farmer_id: string;
  name: string;
  contact_type: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_primary: boolean;
  relationship_strength: number;
  services?: string[];
  fields_covered?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  name: string;
  contact_type: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_primary?: boolean;
  relationship_strength?: number;
  services?: string[];
  fields_covered?: string[];
}

export interface ContactUpdate {
  name?: string;
  contact_type?: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_primary?: boolean;
  relationship_strength?: number;
  services?: string[];
  fields_covered?: string[];
}

export const contactsAPI = {
  // List contacts
  listContacts: async (filters?: { contact_type?: string; status?: string }): Promise<Contact[]> => {
    const params = new URLSearchParams();
    if (filters?.contact_type) params.append('contact_type', filters.contact_type);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return apiFetch(`/api/v1/contacts/${queryString ? `?${queryString}` : ''}`);
  },

  // Get single contact
  getContact: async (contactId: string): Promise<Contact> => {
    return apiFetch(`/api/v1/contacts/${contactId}/`);
  },

  // Create contact
  createContact: async (data: ContactCreate): Promise<Contact> => {
    return apiFetch('/api/v1/contacts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update contact
  updateContact: async (contactId: string, data: ContactUpdate): Promise<Contact> => {
    return apiFetch(`/api/v1/contacts/${contactId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete contact
  deleteContact: async (contactId: string): Promise<void> => {
    return apiFetch(`/api/v1/contacts/${contactId}/`, {
      method: 'DELETE',
    });
  },
};

// ================================
// MANAGEMENT ZONES APIs
// ================================

export interface ManagementZone {
  zone_key: string;
  field_id: string;
  source_type: string;
  zone_id: number;
  zone_polygon_id: number;
  zone_class: 'low' | 'medium' | 'high';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  zone_area_acres: number;
  mean_stability: number | null;
  created_at: string;
}

export interface ManagementZonesSummary {
  field_id: string;
  source_type: string;
  zones: ManagementZone[];
  summary: {
    field_id: string;
    source_type: string;
    total_zones: number;
    total_field_acres: number;
    zones_by_class: {
      [key: string]: {
        count: number;
        acres: number;
      };
    };
  };
}

export const managementZonesAPI = {
  // Get management zones for a field
  getForField: async (
    fieldId: string,
    sourceType: string = 'sentinel2_ndvi_7yr'
  ): Promise<ManagementZonesSummary> => {
    return apiFetch<ManagementZonesSummary>(
      `/api/v1/fields/${fieldId}/management-zones?source_type=${sourceType}`
    );
  },

  // Get available zone sources for user's fields
  getAvailableSources: async () => {
    return apiFetch<any>('/api/v1/management-zones/sources/available');
  },

  // Get single zone by key
  getZone: async (zoneKey: string): Promise<ManagementZone> => {
    return apiFetch<ManagementZone>(`/api/v1/management-zones/${zoneKey}`);
  },
};

// ================================
// Farm Memory API
// ================================

export const farmMemoryAPI = {
  // Search farm memory
  search: async (request: {
    query: string;
    limit?: number;
    source_types?: string[];
    field_id?: string;
    use_ai_ranking?: boolean;
  }) => {
    return apiFetch<any>('/api/v1/farm-memory/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
  },

  // Get suggested searches
  getSuggestedSearches: async () => {
    return apiFetch<any>('/api/v1/farm-memory/suggested-searches');
  },

  // Get farm memory stats
  getStats: async () => {
    return apiFetch<any>('/api/v1/farm-memory/stats');
  },
};

// ============================================================================
// NDVI API - Satellite Imagery
// ============================================================================

export const ndviAPI = {
  // Generate NDVI tiles for user fields
  generateTiles: async (startDate: string, endDate: string, statisticType: string = 'max') => {
    return apiFetch(`/api/v1/phenology/ndvi-fields/generate?start_date=${startDate}&end_date=${endDate}&statistic_type=${statisticType}`, {
      method: 'POST'
    });
  },
  
  // Generate NDVI tiles for a specific point with buffer
  generateTilesForPoint: async (
    startDate: string, 
    endDate: string, 
    lat: number, 
    lng: number, 
    bufferMiles: number = 3.1, // ~5km
    statisticType: string = 'max'
  ) => {
    // Calculate simple bounding box with buffer (approximate)
    const latBuffer = bufferMiles / 69; // 1 degree lat ≈ 69 miles
    const lngBuffer = bufferMiles / (69 * Math.cos(lat * Math.PI / 180)); // Adjust for latitude
    
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      west: String(lng - lngBuffer),
      south: String(lat - latBuffer),
      east: String(lng + lngBuffer),
      north: String(lat + latBuffer),
      buffer_miles: String(bufferMiles),
      statistic_type: statisticType
    });
    
    return apiFetch(`/api/v1/phenology/ndvi/generate?${params.toString()}`, {
      method: 'POST'
    });
  }
};

// ============================================================================
// Precipitation API - RTMA (Real-Time Mesoscale Analysis)
// ============================================================================

export const precipAPI = {
  // Generate 7-day precipitation accumulation tiles
  generateTiles: async (startDate: string, endDate: string) => {
    return apiFetch(`/api/v1/phenology/precip-rtma/generate?start_date=${startDate}&end_date=${endDate}`, {
      method: 'POST'
    });
  }
};

// ============================================================================
// FIELD OPERATIONS API - Historical Field Operations Data
// ============================================================================

export interface FieldOperationYearlySummary {
  field_id: string;
  field_name: string;
  crop_season: number;
  total_operations: number;
  operations_by_type: Record<string, number>;
  unique_varieties: string[];
  unique_products: Record<string, string[]>;
  earliest_date: string | null;
  latest_date: string | null;
  summary_text: string | null;
  last_computed_at: string;
}

export interface OperationTimelineSummary {
  operation_id: string;
  crop_season: number;
  total_fields_with_operations: number;
  total_operations_count: number;
  fields_by_crop: Record<string, number>;
  summary_text: string;
  last_computed_at: string;
}

export interface SyncOperationsResponse {
  success: boolean;
  message: string;
  synced_count: number;  // Backend returns 'synced_count', not 'operations_synced'
  affected_years: number[];
  field_summary_updated: boolean;
}

export const fieldOperationsAPI = {
  // Sync field operations from John Deere (optionally for a specific year)
  // Uses a longer timeout (1 minute) since sync operations can take a while
  syncFieldOperations: async (fieldId: string, year?: number, forceRefresh: boolean = true): Promise<SyncOperationsResponse> => {
    let url = `/api/v1/fields/${fieldId}/operations/sync?force_refresh=${forceRefresh}`;
    if (year) {
      url += `&year=${year}`;
    }
    return apiFetch(url, {
      method: 'POST'
    }, 60000); // 1 minute timeout for sync operations
  },

  // Get yearly summary for a field
  getYearlySummary: async (fieldId: string, year?: number): Promise<FieldOperationYearlySummary[]> => {
    const url = year 
      ? `/api/v1/fields/${fieldId}/operations/yearly-summary/${year}`
      : `/api/v1/fields/${fieldId}/operations/yearly-summary`;
    return apiFetch(url);
  },

  // Get all-time field summary
  getFieldSummary: async (fieldId: string): Promise<any> => {
    return apiFetch(`/api/v1/fields/${fieldId}/operations/field-summary`);
  },

  // Get operation timeline summary (farm-wide)
  // Uses 5-minute timeout for initial generation (large operations use chunked processing)
  // - Small ops (<15 fields): ~30-60s
  // - Large ops (30+ fields): 2-4 minutes (chunked processing)
  // Subsequent calls are instant (cached in DB)
  getOperationTimeline: async (operationId: string, year: number): Promise<OperationTimelineSummary> => {
    return apiFetch(`/api/v1/operations/${operationId}/timeline-summary?year=${year}`, {}, 300000); // 5 minutes
  },

  // Regenerate operation timeline summary
  // Uses 5-minute timeout for large operations with chunked processing
  regenerateOperationTimeline: async (operationId: string, year: number): Promise<OperationTimelineSummary> => {
    return apiFetch(`/api/v1/operations/${operationId}/timeline-summary/${year}/regenerate`, {
      method: 'POST'
    }, 300000); // 5 minutes
  },

  // Sync all fields for an operation for a specific year
  syncAllFieldsForOperation: async (operationId: string, year: number, forceRefresh: boolean = false): Promise<{
    success: boolean;
    message: string;
    operation_id: string;
    operation_name: string;
    year: number;
    total_fields: number;
    status: string;
    estimated_duration_minutes: number;
    note: string;
  }> => {
    return apiFetch(`/api/v1/operations/${operationId}/sync-all-fields?year=${year}&force_refresh=${forceRefresh}`, {
      method: 'POST'
    });
  },

  // Get sync status for an operation
  getSyncStatus: async (operationId: string, year: number): Promise<{
    status: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'idle';
    current: number;
    total: number;
    percentage: number;
    operation_id: string;
    operation_name: string;
    year: number;
  }> => {
    return apiFetch(`/api/v1/operations/${operationId}/sync-status?year=${year}`);
  },

  // Cancel ongoing sync for an operation
  cancelSync: async (operationId: string, year: number): Promise<{
    success: boolean;
    message: string;
    operation_id: string;
    year: number;
  }> => {
    return apiFetch(`/api/v1/operations/${operationId}/sync-all-fields?year=${year}`, {
      method: 'DELETE'
    });
  },

  // Get recent field operations summaries (for Home page Recent Activity)
  getRecentSummaries: async (limit: number = 3): Promise<FieldOperationYearlySummary[]> => {
    return apiFetch(`/api/v1/field-operations/recent-summaries?limit=${limit}`);
  },

  // Get condensed activity passes for a field/year (for Field Plan Detail page)
  getActivityPasses: async (fieldId: string, year: number): Promise<ActivityPassesResponse> => {
    return apiFetch(`/api/v1/fields/${fieldId}/operations/activity-passes?year=${year}`);
  },
};

// Activity Passes interfaces
export interface ActivityPass {
  pass_type: string;
  icon: string;
  title: string;
  dates: string[];
  summary: string;
  details: string[];
  has_data: boolean;
}

export interface ActivityPassesResponse {
  field_id: string;
  field_name: string;
  year: number;
  total_operations: number;
  passes: ActivityPass[];
  has_jd_data: boolean;
  summary_text?: string;  // Pre-computed season summary for display
}

// ============================================================================
// Scouting Notes API
// ============================================================================

export interface ScoutingNote {
  id: string;
  user_id: string;
  field_id?: string | null;
  field_name?: string | null;
  farm_name?: string | null;
  latitude: number;
  longitude: number;
  location_accuracy?: number | null;
  location_description?: string | null;
  scouting_date: string;
  growth_stage?: string | null;
  plant_height_inches?: number | null;
  // NEW ARCHITECTURE: Voice recordings from voice_notes table
  voice_recordings?: Array<{
    id: string;
    url: string;
    transcript?: string | null;
    created_at: string;
  }>;
  // NEW ARCHITECTURE: Photos from documents table
  photos?: Array<{
    id: string;
    url: string;
    filename: string;
    created_at: string;
  }>;
  ai_summary?: string | null;
  issues_detected?: Array<{
    type: string;
    name: string;
    severity: string;
    confidence: number;
    source: string;
    symptoms?: string[];
    location_on_plant?: string;
  }>;
  recommendations?: string[];
  user_notes?: string | null;
  weather_conditions?: Record<string, any> | null;
  shared_with?: string[];
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  ai_status: 'pending' | 'processing' | 'completed' | 'failed';
  status: 'draft' | 'ai_processed' | 'completed' | 'shared';
  created_at: string;
  updated_at: string;
}

export interface CreateScoutingNoteRequest {
  id?: string; // Client-generated UUID for offline support
  field_id?: string | null;
  latitude: number;
  longitude: number;
  location_accuracy?: number | null;
  location_description?: string | null;
  scouting_date: string;
  growth_stage?: string | null;
  plant_height_inches?: number | null;
  user_notes?: string | null;
}

export interface UpdateScoutingNoteRequest {
  field_id?: string | null;
  location_description?: string | null;
  scouting_date?: string;
  growth_stage?: string | null;
  plant_height_inches?: number | null;
  user_notes?: string | null;
  voice_transcript?: string | null;
  ai_summary?: string | null;
  issues_detected?: Array<Record<string, any>> | null;
  recommendations?: string[] | null;
  sync_status?: 'pending' | 'syncing' | 'synced' | 'error';
}

export interface ListScoutingNotesParams {
  limit?: number;
  offset?: number;
  sync_status?: 'pending' | 'syncing' | 'synced' | 'error';
  ai_status?: 'pending' | 'processing' | 'completed' | 'failed';
  field_id?: string;
  date_from?: string;
  date_to?: string;
}

export const scoutingNotesAPI = {
  // Create a new scouting note
  createScoutingNote: async (note: CreateScoutingNoteRequest): Promise<{
    id: string;
    message: string;
    sync_status: string;
    ai_status: string;
    created_at: string;
  }> => {
    return apiFetch('/api/v1/scouting-notes/', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  },

  // List scouting notes with filters
  listScoutingNotes: async (params?: ListScoutingNotesParams): Promise<{
    notes: ScoutingNote[];
    total: number;
    limit: number;
    offset: number;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.sync_status) queryParams.append('sync_status', params.sync_status);
    if (params?.ai_status) queryParams.append('ai_status', params.ai_status);
    if (params?.field_id) queryParams.append('field_id', params.field_id);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    
    const url = `/api/v1/scouting-notes/?${queryParams.toString()}`;
    return apiFetch(url);
  },

  // Get a single scouting note by ID
  getScoutingNote: async (noteId: string): Promise<ScoutingNote> => {
    return apiFetch(`/api/v1/scouting-notes/${noteId}`);
  },

  // Update a scouting note
  updateScoutingNote: async (noteId: string, updates: UpdateScoutingNoteRequest): Promise<{
    id: string;
    message: string;
    updated_at: string;
  }> => {
    return apiFetch(`/api/v1/scouting-notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Delete a scouting note
  deleteScoutingNote: async (noteId: string): Promise<{ message: string }> => {
    return apiFetch(`/api/v1/scouting-notes/${noteId}`, {
      method: 'DELETE',
    });
  },

  clearAISummary: async (noteId: string): Promise<{ message: string }> => {
    return apiFetch(`/api/v1/scouting-notes/${noteId}/summary`, {
      method: 'DELETE',
    });
  },

  // Upload voice recording - NEW ARCHITECTURE: Uses voice-notes endpoint
  uploadVoiceRecording: async (noteId: string, audioFile: File | Blob, fieldId?: string | null): Promise<{
    message: string;
    voice_recording_url: string;
  }> => {
    const formData = new FormData();
    
    // If it's a File object (uploaded), preserve original filename
    // If it's a Blob (recorded), use webm extension
    let filename: string;
    if (audioFile instanceof File) {
      filename = audioFile.name;
    } else {
      filename = `scouting-voice-${Date.now()}.webm`;
    }
    
    formData.append('file', audioFile, filename);
    
    // Add metadata with scouting_note_id and field_id
    const metadata: any = {
      scouting_note_id: noteId,
      source: 'scouting_note',
      created_at: new Date().toISOString()
    };
    
    // Add field_id if available
    if (fieldId) {
      metadata.field_id = fieldId;
    }
    
    formData.append('metadata', JSON.stringify(metadata));
    
    // Use existing voice-notes upload endpoint
    const response = await apiFetch<{ id: string; file_url: string; message: string }>(
      '/api/v1/voice-notes/upload',
      {
        method: 'POST',
        body: formData,
        headers: undefined, // Let browser set Content-Type with boundary
      },
      120000 // 120 second timeout for uploads
    );
    
    return {
      message: response.message,
      voice_recording_url: response.file_url
    };
  },

  // Upload photos (max 10) - NEW ARCHITECTURE: Uses documents endpoint
  uploadPhotos: async (noteId: string, photoFiles: File[] | Blob[], fieldId?: string | null): Promise<{
    message: string;
    photo_ids: string[];
  }> => {
    const photoIds: string[] = [];
    
    // Upload each photo individually to documents endpoint
    for (let index = 0; index < photoFiles.length; index++) {
      const file = photoFiles[index];
      const formData = new FormData();
      
      // If it's a File, preserve original name; if Blob, generate name
      let filename: string;
      if (file instanceof File) {
        filename = file.name;
      } else {
        // Determine extension from blob type
        const blobType = (file as Blob).type || 'image/jpeg';
        const ext = blobType === 'image/png' ? 'png' : 'jpg';
        filename = `scouting-photo-${Date.now()}-${index}.${ext}`;
      }
      
      formData.append('file', file, filename);
      formData.append('document_type', 'photo');
      formData.append('scouting_note_id', noteId);
      
      // Add field_id if available
      if (fieldId) {
        formData.append('field_id', fieldId);
      }
      
      // Use existing documents upload endpoint
      const response = await apiFetch<{ id: string; message: string }>(
        '/api/v1/documents/upload',
        {
          method: 'POST',
          body: formData,
          headers: undefined, // Let browser set Content-Type with boundary
        },
        120000 // 120 second timeout for uploads
      );
      
      photoIds.push(response.id);
    }
    
    return {
      message: `Successfully uploaded ${photoIds.length} photo(s)`,
      photo_ids: photoIds
    };
  },

  // Delete voice recording - DEPRECATED: Use voiceNotesAPI.deleteVoiceNote directly
  // The GET endpoint now returns voice_recordings array with proper IDs
  deleteVoiceRecording: async (voiceNoteId: string): Promise<{ message: string }> => {
    return apiFetch(`/api/v1/voice-notes/${voiceNoteId}`, {
      method: 'DELETE',
    });
  },

  // Delete photo - DEPRECATED: Use documentsAPI.deleteDocument directly
  // The GET endpoint now returns photos array with proper IDs
  deletePhoto: async (documentId: string): Promise<{ message: string }> => {
    return apiFetch(`/api/v1/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // Trigger AI analysis
  triggerAIAnalysis: async (noteId: string, force: boolean = false): Promise<{
    id: string;
    message: string;
    ai_status: string;
  }> => {
    return apiFetch(`/api/v1/scouting-notes/${noteId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  },
};

// ============================================================================
// Scouting Summary Sharing API
// ============================================================================

export interface ShareScoutingSummaryMessageRequest {
  note_id: string;
  recipient_name: string;
  recipient_type: string;
  communication_method: 'sms' | 'email';
  user_context: string;
}

export interface ShareScoutingSummaryRequest {
  note_id: string;
  contact_ids: string[];
  communication_method: 'sms' | 'email';
  message: {
    subject?: string;
    body: string;
  };
  share_link?: string;
}

export interface ScoutingSummaryPublicView {
  field_name?: string;
  farm_name?: string;
  scouting_date?: string;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  gps_link?: string;
  ai_summary?: string;
  issues_detected?: Array<{
    type?: string;
    description?: string;
    severity?: string;
    location?: string;
    evidence_source?: string;
  }>;
  recommendations?: string[];
  overall_assessment?: string;
  growth_stage?: string;
  shared_by: string;
  photos?: string[];
  voice_recordings?: string[];
}

export const shareScoutingSummariesAPI = {
  // Generate AI message for sharing scouting summary
  generateMessage: async (request: ShareScoutingSummaryMessageRequest) => {
    return apiFetch<ShareMessageResponse>('/api/v1/share-scouting-summaries/generate-message', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Share scouting summary with contacts
  shareScoutingSummary: async (request: ShareScoutingSummaryRequest) => {
    return apiFetch<SharePlansResponse>('/api/v1/share-scouting-summaries/share', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Get share history
  getShareHistory: async () => {
    return apiFetch<ShareHistoryResponse>('/api/v1/share-scouting-summaries/history');
  },

  // Delete a share
  deleteShare: async (shareId: string) => {
    return apiFetch<void>(`/api/v1/share-scouting-summaries/${shareId}`, {
      method: 'DELETE',
    });
  },

  // Get public scouting summary (no auth required)
  getPublicSummary: async (shareToken: string) => {
    const url = `${env.API_BASE_URL}/api/v1/share-scouting-summaries/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load scouting summary');
    }
    return response.json() as Promise<ScoutingSummaryPublicView>;
  },
};

// ============================================================================
// Founding Farmer API
// ============================================================================

export interface FoundingFarmerApplication {
  first_name: string;
  last_name: string;
  email: string;
  has_jd_ops: boolean;
}

export interface FoundingFarmerApplicationResponse {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  has_jd_ops: boolean;
  status: string;
  applied_at: string;
}

export const foundingFarmerAPI = {
  // Submit application
  submitApplication: async (application: FoundingFarmerApplication): Promise<FoundingFarmerApplicationResponse> => {
    return apiFetch('/api/v1/founding-farmer/applications', {
      method: 'POST',
      body: JSON.stringify(application),
    });
  },

  // Validate approval code (requires email)
  validateCode: async (code: string, email: string): Promise<{ valid: boolean; email: string; message: string }> => {
    return apiFetch('/api/v1/founding-farmer/validate-code', {
      method: 'POST',
      body: JSON.stringify({ code, email }),
    });
  },

  // Lookup approval code (returns email - used for token entry)
  lookupCode: async (code: string): Promise<{ valid: boolean; email: string; message: string }> => {
    return apiFetch('/api/v1/founding-farmer/lookup-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  // Mark code as used (called after successful signup)
  markCodeUsed: async (code: string, email: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch('/api/v1/founding-farmer/mark-code-used', {
      method: 'POST',
      body: JSON.stringify({ code, email }),
    });
  },
};

// ============================================================================
// Field Reports API (AMF Reports)
// ============================================================================

export interface FieldReportDataItem {
  id: string;
  title?: string;
  date?: string;
  summary?: string;
  type?: string;
}

export interface FieldReportDataSection {
  count: number;
  items: FieldReportDataItem[];
}

export interface FieldReportJDOpsSection {
  count: number;
  last_sync?: string;
  has_summary: boolean;
  summary_preview?: string;
}

export interface FieldReportSummary {
  field_id: string;
  field_name: string;
  farm_name?: string;
  operation_name?: string;
  year: number;
  acreage?: number;
  jd_ops: FieldReportJDOpsSection;
  voice_notes: FieldReportDataSection;
  documents: FieldReportDataSection;
  scouting_notes: FieldReportDataSection;
  field_plans: FieldReportDataSection;
  generated_report?: {
    exists: boolean;
    report_id?: string;
    generated_at?: string;
    is_stale?: boolean;
  };
}

export interface FieldReportTimelineEvent {
  date: string;
  event: string;
  source: 'jd_ops' | 'recording' | 'document' | 'scouting' | 'plan';
  category: 'planting' | 'application' | 'scouting' | 'harvest' | 'planning' | 'other';
}

export interface FieldReportGenerated {
  id: string;
  field_id: string;
  field_name: string;
  farm_name?: string;
  year: number;
  executive_summary?: string;
  season_timeline?: string;
  timeline_events?: FieldReportTimelineEvent[];
  key_highlights: string[];
  issues_encountered: string[];
  recommendations: string[];
  full_report_markdown?: string;
  source_counts: {
    voice_notes: number;
    documents: number;
    scouting_notes: number;
    field_plans: number;
    jd_ops_operations: number;
  };
  generated_at?: string;
  is_stale: boolean;
}

export interface FieldReportPublic {
  field_name: string;
  farm_name?: string;
  acreage?: number;
  year: number;
  custom_title?: string;
  executive_summary?: string;
  season_timeline?: string;
  timeline_events?: FieldReportTimelineEvent[];
  key_highlights: string[];
  issues_encountered: string[];
  recommendations: string[];
  source_counts: {
    voice_notes: number;
    documents: number;
    scouting_notes: number;
    field_plans: number;
    jd_ops_operations: number;
  };
  shared_by: string;
  shared_at?: string;
  generated_at?: string;
}

export interface FieldReportListItem {
  id: string;
  field_id: string;
  field_name: string;
  farm_name?: string;
  acreage?: number;
  year: number;
  executive_summary?: string;
  key_highlights: string[];
  generated_at?: string;
  source_counts: {
    voice_notes: number;
    documents: number;
    scouting_notes: number;
    field_plans: number;
    jd_ops_operations: number;
  };
}

export const fieldReportsAPI = {
  // List all generated reports for the user
  listReports: async (year?: number): Promise<{ reports: FieldReportListItem[]; total: number }> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    const queryString = params.toString();
    return apiFetch(`/api/v1/field-reports/${queryString ? `?${queryString}` : ''}`);
  },

  // Get aggregated field report summary
  getReportSummary: async (fieldId: string, year?: number): Promise<FieldReportSummary> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    const queryString = params.toString();
    return apiFetch(`/api/v1/field-reports/${fieldId}/report-summary${queryString ? `?${queryString}` : ''}`);
  },

  // Generate AI field report
  generateReport: async (fieldId: string, year?: number, regenerate?: boolean): Promise<{
    status: string;
    message: string;
    report_id: string;
    field_id?: string;
    year?: number;
    generated_at?: string;
  }> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (regenerate) params.append('regenerate', 'true');
    const queryString = params.toString();
    return apiFetch(`/api/v1/field-reports/${fieldId}/generate-report${queryString ? `?${queryString}` : ''}`, {
      method: 'POST',
    });
  },

  // Get generated field report
  getReport: async (fieldId: string, year?: number): Promise<FieldReportGenerated | {
    status: string;
    message: string;
    report_id: string;
  }> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    const queryString = params.toString();
    return apiFetch(`/api/v1/field-reports/${fieldId}/report${queryString ? `?${queryString}` : ''}`);
  },

  // Get public field report (no auth)
  getPublicReport: async (shareToken: string): Promise<FieldReportPublic> => {
    const url = `${env.API_BASE_URL}/api/v1/field-reports/public/${shareToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to load field report');
    }
    return response.json();
  },

  // Generate AI-powered share message
  generateShareMessage: async (params: {
    field_id: string;
    year: number;
    recipient_name: string;
    recipient_type: string;
    communication_method: string;
    user_context: string;
  }): Promise<{
    subject?: string;
    body: string;
    share_link: string;
    metadata: Record<string, unknown>;
  }> => {
    return apiFetch('/api/v1/field-reports/generate-share-message', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Get share history
  getShareHistory: async (): Promise<{
    shares: Array<{
      id: string;
      field_id: string;
      field_name: string;
      farm_name?: string;
      year: number;
      recipient_names: string;
      communication_method: string;
      share_link: string;
      message_subject?: string;
      message_body?: string;
      view_count: number;
      last_viewed_at?: string;
      shared_at: string;
    }>;
    total_count: number;
  }> => {
    return apiFetch('/api/v1/field-reports/share-history');
  },

  // Delete a share
  deleteShare: async (shareId: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch(`/api/v1/field-reports/shares/${shareId}`, {
      method: 'DELETE',
    });
  },

  // Delete a report
  deleteReport: async (reportId: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch(`/api/v1/field-reports/reports/${reportId}`, {
      method: 'DELETE',
    });
  },

  // Send share message (email/SMS)
  sendShareMessage: async (params: {
    field_id: string;
    year: number;
    recipient_ids: string[];
    communication_method: string;
    subject?: string;
    body: string;
    share_link: string;
  }): Promise<{
    success: boolean;
    sent_count: number;
    total_count: number;
    results: Array<{
      contact_id: string;
      contact_name: string;
      status: string;
      message: string;
    }>;
  }> => {
    return apiFetch('/api/v1/field-reports/send-share-message', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

export default apiFetch;

