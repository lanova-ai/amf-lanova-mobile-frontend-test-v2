/**
 * Environment Configuration
 * 
 * Create a .env file in the mobile-ui/ root with:
 * 
 * # Required
 * VITE_API_BASE_URL=http://localhost:8000
 * VITE_APP_ENV=development
 * 
 * # Optional - Analytics
 * VITE_HOTJAR_ID=e7de77d4c620a        # Hotjar/ContentSquare site ID
 * VITE_HOTJAR_DEV_ENABLED=false       # Enable Hotjar in dev (default: false)
 */

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  // JD_CALLBACK_URL: OAuth callback is handled by backend, not needed in frontend
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;

// Validate required environment variables
if (!env.API_BASE_URL) {
  console.warn('⚠️  VITE_API_BASE_URL is not set. Using default: http://localhost:8000');
}

export default env;

