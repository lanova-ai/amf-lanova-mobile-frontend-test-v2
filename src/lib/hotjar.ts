/**
 * Hotjar Integration
 * Session recording and user behavior analytics
 * 
 * Hotjar (now part of ContentSquare) helps us understand how users
 * interact with the app through session recordings and heatmaps.
 */

// Hotjar Site ID from environment variable
const HOTJAR_ID = import.meta.env.VITE_HOTJAR_ID;

// Only enable in production or if explicitly set
const isEnabled = (): boolean => {
  if (!HOTJAR_ID) return false;
  
  // Disable in development unless explicitly enabled
  if (import.meta.env.DEV && !import.meta.env.VITE_HOTJAR_DEV_ENABLED) {
    return false;
  }
  
  return true;
};

/**
 * Initialize Hotjar tracking
 * Call this once in main.tsx or App.tsx
 */
export const initHotjar = (): void => {
  if (!isEnabled()) {
    console.log('[Hotjar] Disabled - no VITE_HOTJAR_ID or in development mode');
    return;
  }

  // Check if already initialized
  if ((window as any).hj) {
    console.log('[Hotjar] Already initialized');
    return;
  }

  try {
    // Create and inject the Hotjar script
    const script = document.createElement('script');
    script.src = `https://t.contentsquare.net/uxa/${HOTJAR_ID}.js`;
    script.async = true;
    
    script.onload = () => {
      console.log('[Hotjar] Loaded successfully');
    };
    
    script.onerror = () => {
      console.error('[Hotjar] Failed to load script');
    };
    
    document.head.appendChild(script);
    
    console.log('[Hotjar] Initializing...');
  } catch (error) {
    console.error('[Hotjar] Initialization error:', error);
  }
};

/**
 * Identify a logged-in user
 * Call this after successful login
 */
export const identifyUser = (userId: string, attributes?: Record<string, any>): void => {
  if (!isEnabled()) return;
  
  const hj = (window as any).hj;
  if (hj) {
    hj('identify', userId, attributes || {});
    console.log('[Hotjar] User identified:', userId);
  }
};

/**
 * Track a custom event
 * Use for key user actions
 */
export const trackEvent = (eventName: string): void => {
  if (!isEnabled()) return;
  
  const hj = (window as any).hj;
  if (hj) {
    hj('event', eventName);
    console.log('[Hotjar] Event tracked:', eventName);
  }
};

/**
 * Trigger a feedback survey
 * Use to collect user feedback at specific moments
 */
export const triggerSurvey = (surveyId: string): void => {
  if (!isEnabled()) return;
  
  const hj = (window as any).hj;
  if (hj) {
    hj('trigger', surveyId);
    console.log('[Hotjar] Survey triggered:', surveyId);
  }
};

/**
 * Tag the current recording
 * Use to categorize sessions for easier filtering
 */
export const tagRecording = (tags: string[]): void => {
  if (!isEnabled()) return;
  
  const hj = (window as any).hj;
  if (hj) {
    hj('tagRecording', tags);
    console.log('[Hotjar] Recording tagged:', tags);
  }
};

// Pre-defined events for AskMyFarm
export const HotjarEvents = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGOUT: 'logout',
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  
  // Voice Recording
  RECORDING_STARTED: 'recording_started',
  RECORDING_COMPLETED: 'recording_completed',
  RECORDING_UPLOADED: 'recording_uploaded',
  RECORDING_OFFLINE_QUEUED: 'recording_offline_queued',
  
  // John Deere
  JD_CONNECT_STARTED: 'jd_connect_started',
  JD_CONNECT_SUCCESS: 'jd_connect_success',
  JD_DISCONNECT: 'jd_disconnect',
  JD_SYNC_STARTED: 'jd_sync_started',
  JD_SYNC_COMPLETED: 'jd_sync_completed',
  
  // Field Plans
  FIELD_PLAN_CREATED: 'field_plan_created',
  FIELD_PLAN_SHARED: 'field_plan_shared',
  PRESCRIPTION_GENERATED: 'prescription_generated',
  
  // Scouting
  SCOUTING_NOTE_CREATED: 'scouting_note_created',
  SCOUTING_NOTE_SHARED: 'scouting_note_shared',
  
  // Documents
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_PROCESSED: 'document_processed',
  
  // Reports
  REPORT_GENERATED: 'report_generated',
  REPORT_SHARED: 'report_shared',
  
  // Map
  MAP_VIEWED: 'map_viewed',
  FIELD_SELECTED: 'field_selected',
  
  // Errors
  ERROR_DISPLAYED: 'error_displayed',
  OFFLINE_DETECTED: 'offline_detected',
};

