/**
 * Generate all PWA icons from a source image
 * 
 * Usage:
 * 1. Place your source icon (PNG or SVG) in the root directory
 * 2. Name it: source-icon.png or source-icon.svg
 * 3. Run: node generate-icons-from-source.js
 * 
 * Requirements:
 * - Source image should be at least 512x512px
 * - Square aspect ratio recommended
 * - PNG or SVG format
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Directories
const iconsDir = path.join(__dirname, 'public', 'icons');
const distIconsDir = path.join(__dirname, 'dist', 'icons');

// Find source icon
function findSourceIcon() {
  const possibleNames = ['source-icon.png', 'source-icon.svg', 'logo.png', 'logo.svg'];
  
  for (const name of possibleNames) {
    const filepath = path.join(__dirname, name);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
  }
  
  throw new Error('❌ Source icon not found! Please add source-icon.png or source-icon.svg to the root directory.');
}

async function generateIcons() {
  console.log('🎨 AskMyFarm Icon Generator\n');
  console.log('━'.repeat(50));
  
  try {
    // Find source icon
    const sourceIcon = findSourceIcon();
    console.log(`✅ Found source icon: ${path.basename(sourceIcon)}\n`);
    
    // Ensure directories exist
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    if (!fs.existsSync(distIconsDir)) {
      fs.mkdirSync(distIconsDir, { recursive: true });
    }
    
    // Get source image metadata
    const metadata = await sharp(sourceIcon).metadata();
    console.log(`📏 Source dimensions: ${metadata.width}x${metadata.height}\n`);
    
    if (metadata.width < 512 || metadata.height < 512) {
      console.warn('⚠️  Warning: Source image is smaller than 512x512px. Quality may be reduced.\n');
    }
    
    console.log('🔄 Generating icons...\n');
    
    // Generate PNG icons for each size
    for (const size of sizes) {
      const filename = `icon-${size}x${size}.png`;
      const publicPath = path.join(iconsDir, filename);
      const distPath = path.join(distIconsDir, filename);
      
      try {
        // Generate for /public/icons/
        await sharp(sourceIcon)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
          })
          .png({
            quality: 100,
            compressionLevel: 9
          })
          .toFile(publicPath);
        
        // Copy to /dist/icons/ for immediate use
        if (fs.existsSync(distPath)) {
          fs.unlinkSync(distPath);
        }
        await sharp(sourceIcon)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png({
            quality: 100,
            compressionLevel: 9
          })
          .toFile(distPath);
        
        console.log(`  ✅ ${filename}`);
      } catch (error) {
        console.error(`  ❌ Failed ${filename}:`, error.message);
      }
    }
    
    // Generate favicon.ico (32x32)
    console.log('\n🔄 Generating favicon...\n');
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    
    await sharp(sourceIcon)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    
    // Rename to .ico (browsers accept PNG with .ico extension)
    fs.renameSync(faviconPath.replace('.ico', '.png'), faviconPath);
    console.log('  ✅ favicon.ico');
    
    console.log('\n━'.repeat(50));
    console.log('🎉 All icons generated successfully!\n');
    console.log('📍 Locations:');
    console.log('   • public/icons/ (development)');
    console.log('   • dist/icons/ (production build)');
    console.log('   • public/favicon.ico (browser tab)\n');
    console.log('💡 Next steps:');
    console.log('   1. Check public/icons/ to verify icons');
    console.log('   2. Rebuild app: npm run build');
    console.log('   3. Test locally: npm run preview');
    console.log('   4. Commit and push to deploy to Vercel\n');
    
  } catch (error) {
    console.error('\n❌ Error generating icons:', error.message);
    console.error('\n💡 Make sure you have:');
    console.error('   • Added source-icon.png or source-icon.svg to the root directory');
    console.error('   • Installed sharp: npm install -D sharp');
    process.exit(1);
  }
}

generateIcons().catch(console.error);

