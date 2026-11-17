const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');

// Lumenist Sunset Camera Favicon & App Icon SVG
// Centered camera with multi-coated optical glass (no HAL effect) set against a golden-hour sunset
const lumenistSunsetSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <!-- Sunset sky gradient: twilight violet through crimson and amber to golden yellow -->
    <linearGradient id="sunsetSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#190F2A"/>
      <stop offset="28%" stop-color="#4A154B"/>
      <stop offset="55%" stop-color="#9F1239"/>
      <stop offset="78%" stop-color="#EA580C"/>
      <stop offset="100%" stop-color="#FBBF24"/>
    </linearGradient>

    <!-- Radiant sun halo glow -->
    <radialGradient id="sunAura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#FEF08A"/>
      <stop offset="70%" stop-color="#F59E0B" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
    </radialGradient>

    <!-- Camera body: precision dark graphite with subtle gradient -->
    <linearGradient id="camChassis" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2D313A"/>
      <stop offset="35%" stop-color="#1B1E24"/>
      <stop offset="100%" stop-color="#0E1013"/>
    </linearGradient>

    <!-- Golden sunset rim light for camera edges -->
    <linearGradient id="goldenRim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>

    <!-- Multi-coated Optical Glass (Zeiss T* / Leica style cool sapphire & cyan reflection, NO HAL ORANGE) -->
    <radialGradient id="opticalGlass" cx="35%" cy="32%" r="65%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="35%" stop-color="#0F172A"/>
      <stop offset="75%" stop-color="#090D16"/>
      <stop offset="100%" stop-color="#030712"/>
    </radialGradient>

    <!-- Antireflection coating sheen -->
    <linearGradient id="coatingSheen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#818CF8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#06B6D4" stop-opacity="0"/>
    </linearGradient>

    <clipPath id="squircleMask">
      <rect x="2" y="2" width="60" height="60" rx="14"/>
    </clipPath>
  </defs>

  <!-- Frame Base: Sunset Sky clipped to squircle -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#sunsetSky)" stroke="#5C1D42" stroke-width="1.2"/>

  <g clip-path="url(#squircleMask)">
    <!-- Sun corona radiance behind camera -->
    <circle cx="32" cy="30" r="23" fill="url(#sunAura)"/>

    <!-- Setting Sun Disc: Cresting behind the camera -->
    <circle cx="32" cy="30" r="14.5" fill="#FFFDE7" stroke="#FEF08A" stroke-width="1.5"/>

    <!-- Subtle atmospheric horizon mist -->
    <ellipse cx="32" cy="46.5" rx="30" ry="5.5" fill="#FDE047" opacity="0.25"/>

    <!-- ==================== CENTERED CAMERA ==================== -->
    <!-- Ambient Shadow under/behind camera -->
    <rect x="10.5" y="22" width="43" height="23" rx="4" fill="#000000" opacity="0.4"/>

    <!-- Pentaprism Viewfinder Housing (centered on optical axis x=32) -->
    <path d="M24 22.5 L28 17 L36 17 L40 22.5 Z" fill="url(#camChassis)" stroke="url(#goldenRim)" stroke-width="0.8"/>

    <!-- Hot Shoe Mount -->
    <rect x="29.5" y="16" width="5" height="1.8" rx="0.5" fill="#111317" stroke="#FEF08A" stroke-width="0.5"/>

    <!-- Shutter Button (Right) & Left Mode Dial -->
    <rect x="43" y="18.5" width="5.5" height="3.5" rx="1" fill="#F59E0B" stroke="#FEF08A" stroke-width="0.6"/>
    <rect x="15.5" y="19.5" width="4.5" height="2.5" rx="0.5" fill="#475569" stroke="#94A3B8" stroke-width="0.5"/>

    <!-- Main Camera Body -->
    <rect x="11" y="22" width="42" height="22" rx="3.5" fill="url(#camChassis)" stroke="#383D48" stroke-width="1"/>

    <!-- Top Plate Sunset Rim Light (Sun glinting on top edge of camera) -->
    <line x1="13" y1="22.5" x2="51" y2="22.5" stroke="url(#goldenRim)" stroke-width="0.9" stroke-linecap="round"/>

    <!-- Ergonomic Handgrip Detail (Left from front view) -->
    <rect x="13.5" y="24" width="4" height="18" rx="1.5" fill="#13151A"/>

    <!-- ==================== MULTI-COATED LENS OPTICS ==================== -->
    <!-- Outer Metal Barrel Ring -->
    <circle cx="32" cy="33" r="9" fill="#090A0D" stroke="#475569" stroke-width="1"/>

    <!-- Aperture Guide Ring (Lumenist Periwinkle Accent #9999FF) -->
    <circle cx="32" cy="33" r="7.5" fill="#111827" stroke="#9999FF" stroke-width="1"/>

    <!-- Deep Optical Glass Well -->
    <circle cx="32" cy="33" r="6" fill="url(#opticalGlass)"/>

    <!-- Aperture Diaphragm Ring / Blades -->
    <circle cx="32" cy="33" r="3.8" fill="#030712" stroke="#1E293B" stroke-width="0.8"/>

    <!-- Antireflective Multi-Coating Arc (Cool Cyan/Periwinkle Sheen) -->
    <path d="M28 29.5 A 5 5 0 0 1 36 29.5" stroke="url(#coatingSheen)" stroke-width="1.2" stroke-linecap="round" fill="none"/>

    <!-- Crisp Optical Glint / Specular Reflections -->
    <circle cx="29.8" cy="31" r="1.2" fill="#FFFFFF"/>
    <circle cx="34.2" cy="35.2" r="0.6" fill="#C7D2FE" opacity="0.8"/>
  </g>
</svg>`;

async function main() {
  console.log('Generating Lumenist Multi-Coated Sunset Favicon & Icon assets...');

  // 1. Write SVG to src/app/icon.svg
  fs.writeFileSync(path.join(appDir, 'icon.svg'), lumenistSunsetSvg.trim());
  console.log('✓ Written src/app/icon.svg');

  // 2. Generate PNG sizes
  const tempDir = '/tmp/lumenist-favicons';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 180, 256, 512];
  for (const s of sizes) {
    await sharp(Buffer.from(lumenistSunsetSvg))
      .resize(s, s)
      .png()
      .toFile(path.join(tempDir, `sunset_${s}.png`));
  }

  // 3. Apple Touch Icon (180x180)
  fs.copyFileSync(path.join(tempDir, 'sunset_180.png'), path.join(appDir, 'apple-icon.png'));
  console.log('✓ Written src/app/apple-icon.png (180x180)');

  // 4. Multi-resolution favicon.ico (16x16, 32x32, 48x48)
  const icoPath = path.join(appDir, 'favicon.ico');
  execSync(`magick "${tempDir}/sunset_16.png" "${tempDir}/sunset_32.png" "${tempDir}/sunset_48.png" "${icoPath}"`);
  console.log('✓ Generated multi-resolution src/app/favicon.ico');

  console.log('All Lumenist sunset favicon and app icon assets generated successfully.');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
