/**
 * Script untuk generate PWA icons dari favicon.svg
 * 
 * Cara menggunakan:
 * 1. Install sharp: npm install -D sharp
 * 2. Run: npm run generate:pwa-icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
  console.error('❌ Error: favicon.svg tidak ditemukan di folder public/');
  process.exit(1);
}

// Icon sizes to generate
const iconSizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons from favicon.svg...\n');

  // Check if sharp is available
  let sharp;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
  } catch (error) {
    console.error('❌ Error: sharp tidak terinstall');
    console.log('📦 Install dengan: npm install -D sharp');
    process.exit(1);
  }

  try {
    // Read SVG
    const svgBuffer = fs.readFileSync(svgPath);
    console.log('✅ SVG file loaded');

    // Generate each icon
    for (const icon of iconSizes) {
      const outputPath = path.join(publicDir, icon.name);
      
      await sharp(svgBuffer)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated: ${icon.name} (${icon.size}x${icon.size})`);
    }

    console.log('\n🎉 All PWA icons generated successfully!');
    console.log('\n📋 Generated files:');
    iconSizes.forEach(icon => {
      console.log(`   - public/${icon.name}`);
    });
    console.log('\n✨ Next step: Run "npm run build:prod" to build PWA');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the generator
generateIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});

