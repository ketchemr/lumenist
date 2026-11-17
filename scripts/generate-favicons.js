const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');

// Lumenist Prominent Camera Sunset Favicon & App Icon
// Features an enlarged, bold platinum-silver camera body (~65% frame coverage)
// with a large dark optical lens against a radiant sunset for maximum tab-bar visibility
const lumenistSunsetSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <!-- Sunset sky gradient: twilight violet through crimson and amber to golden yellow -->
    <linearGradient id="sunsetSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1A0E2B"/>
      <stop offset="30%" stop-color="#551949"/>
      <stop offset="60%" stop-color="#9F1239"/>
      <stop offset="85%" stop-color="#EA580C"/>
      <stop offset="100%" stop-color="#FBBF24"/>
    </linearGradient>

    <!-- Radiant sun halo glow -->
    <radialGradient id="sunAura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#FEF08A"/>
      <stop offset="75%" stop-color="#F59E0B" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
    </radialGradient>

    <!-- Platinum / Silver Camera Body (High contrast against the sunset) -->
    <linearGradient id="silverBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D1D5DB"/>
    </linearGradient>

    <!-- Deep Optical Glass Well -->
    <radialGradient id="opticalGlass" cx="35%" cy="32%" r="65%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="45%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>

    <clipPath id="squircleMask">
      <rect x="2" y="2" width="60" height="60" rx="14"/>
    </clipPath>
  </defs>

  <!-- Frame Base: Sunset Sky clipped to squircle -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#sunsetSky)" stroke="#50163B" stroke-width="1.2"/>

  <g clip-path="url(#squircleMask)">
    <!-- Sun corona radiance behind camera -->
    <circle cx="32" cy="22" r="26" fill="url(#sunAura)"/>

    <!-- Setting Sun Disc: Cresting high behind the camera viewfinder -->
    <circle cx="32" cy="22" r="16" fill="#FFFDE7" stroke="#FEF08A" stroke-width="1.5"/>

    <!-- Bottom horizon atmospheric glow -->
    <ellipse cx="32" cy="54" rx="28" ry="6" fill="#FDE047" opacity="0.35"/>

    <!-- Ambient Shadow under/behind camera -->
    <rect x="5" y="18" width="54" height="33" rx="5" fill="#000000" opacity="0.45"/>

    <!-- ==================== PROMINENT BIG CAMERA ==================== -->
    <!-- Pentaprism Viewfinder Peak (Prominent, centered at x=32) -->
    <path d="M21.5 19 L26.5 9.5 L37.5 9.5 L42.5 19 Z" fill="url(#silverBody)" stroke="#94A3B8" stroke-width="0.9"/>
    <!-- Hot Shoe Mount -->
    <rect x="28.5" y="7.5" width="7" height="2.5" rx="0.6" fill="#334155"/>

    <!-- Controls: Raised Golden Shutter Button (Right) & Left Mode Dial -->
    <rect x="46.5" y="13" width="7.5" height="4.5" rx="1.2" fill="#F59E0B" stroke="#FEF08A" stroke-width="0.8"/>
    <rect x="10" y="14.5" width="6.5" height="3.5" rx="0.8" fill="#94A3B8"/>

    <!-- Main Camera Body (Scaled to 52px width, 30px height!) -->
    <rect x="6" y="18" width="52" height="30" rx="4.5" fill="url(#silverBody)" stroke="#94A3B8" stroke-width="1.1"/>

    <!-- Ergonomic Handgrip Detail (Left from front view) -->
    <rect x="8.5" y="21" width="5.5" height="24" rx="2" fill="#334155"/>

    <!-- ==================== LARGE BOLD LENS ==================== -->
    <!-- Outer Dark Metal Barrel Ring (Diameter 25px!) -->
    <circle cx="32" cy="33" r="12.5" fill="#090A0D" stroke="#1E293B" stroke-width="1.2"/>

    <!-- Outer Chrome Ring -->
    <circle cx="32" cy="33" r="10.8" fill="#13151D" stroke="#E2E8F0" stroke-width="0.9"/>

    <!-- Aperture Guide Ring (Lumenist Periwinkle Accent #9999FF) -->
    <circle cx="32" cy="33" r="9.2" fill="#0F172A" stroke="#9999FF" stroke-width="1.4"/>

    <!-- Deep Optical Glass Well -->
    <circle cx="32" cy="33" r="7.2" fill="url(#opticalGlass)"/>

    <!-- Multi-Coated Antireflective Sheen Arc (Cool Cyan) -->
    <path d="M27.5 29.5 A 5.5 5.5 0 0 1 36.5 29.5" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.95"/>

    <!-- Specular Optical Glints -->
    <circle cx="29.5" cy="30.5" r="1.6" fill="#FFFFFF"/>
    <circle cx="34.8" cy="35.5" r="0.8" fill="#C7D2FE" opacity="0.8"/>
  </g>
</svg>`;

async function main() {
  console.log('Generating Lumenist Prominent Sunset Favicon & Icon assets...');

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

  console.log('All Lumenist prominent sunset favicon and app icon assets generated successfully.');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
