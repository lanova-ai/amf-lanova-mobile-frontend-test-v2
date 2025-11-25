/**
 * Color Utilities
 * 
 * Centralized color management for the application.
 * All colors reference CSS variables defined in index.css
 */

/**
 * Get the computed HSL value from a CSS variable
 */
function getHSLValue(variable: string): string {
  if (typeof window === 'undefined') return '';
  const root = document.documentElement;
  return getComputedStyle(root).getPropertyValue(variable).trim();
}

/**
 * Convert HSL CSS variable to hex color
 * @param variable CSS variable name (e.g., '--primary')
 * @returns Hex color string (e.g., '#559E73')
 */
export function cssVarToHex(variable: string): string {
  const hslValue = getHSLValue(variable);
  if (!hslValue) return '#559E73'; // Fallback to sage green
  
  const [h, s, l] = hslValue.split(' ').map(v => parseFloat(v));
  return hslToHex(h, s, l);
}

/**
 * Convert HSL to Hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Semantic color constants for map markers and crop colors
 * Professional Slate/Emerald AgTech Theme
 */
export const MapColors = {
  // Primary brand color (Emerald 500)
  primary: '#10b981',
  
  // Secondary accent (Amber 500)
  secondary: '#f59e0b',
  
  // Location marker (blue for GPS)
  locationMarker: '#2196F3',
  
  // Crop-specific colors
  corn: '#FDB913',      // John Deere Yellow/Gold
  soybeans: '#2196F3',  // Blue
  wheat: '#D4A574',     // Tan
  default: '#EF4444',   // Red
} as const;

/**
 * Get crop-specific color
 */
export function getCropColor(cropType: string): string {
  const crop = cropType?.toLowerCase() || "";
  if (crop.includes("corn")) return MapColors.corn;
  if (crop.includes("soy")) return MapColors.soybeans;
  if (crop.includes("wheat")) return MapColors.wheat;
  return MapColors.default;
}

/**
 * Get the primary brand color (Sage Green)
 */
export function getPrimaryColor(): string {
  return MapColors.primary;
}

/**
 * Get the secondary accent color (Warm Gold)
 */
export function getSecondaryColor(): string {
  return MapColors.secondary;
}

