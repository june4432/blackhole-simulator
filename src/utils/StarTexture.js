/**
 * Star Texture Generator
 *
 * Creates an equirectangular texture from real star data
 * for use in raytracer shaders
 */

import * as THREE from 'three';
import { BRIGHT_STARS, bvToRGB, magnitudeToSize } from '../data/brightStars.js';

/**
 * Generate an equirectangular star texture from real star data
 * @param {number} width - Texture width (default 2048)
 * @param {number} height - Texture height (default 1024)
 * @returns {THREE.DataTexture} Star texture
 */
export function generateStarTexture(width = 2048, height = 1024) {
  // Create RGBA data array
  const data = new Uint8Array(width * height * 4);

  // Fill with dark background
  for (let i = 0; i < width * height * 4; i += 4) {
    data[i] = 0;     // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  // Add each star to the texture
  for (const star of BRIGHT_STARS) {
    const [ra, dec, mag, bv] = star;

    // Convert RA (hours 0-24) and Dec (degrees -90 to +90) to texture coordinates
    // RA -> x: 0-24 hours maps to 0-1 (then to 0-width)
    // Dec -> y: -90 to +90 degrees maps to 0-1 (then to 0-height)
    const u = ra / 24;
    const v = (dec + 90) / 180;

    const texX = Math.floor(u * width) % width;
    const texY = Math.floor(v * height) % height;

    // Get star color from B-V index
    const color = bvToRGB(bv);

    // Get brightness from magnitude (lower = brighter)
    // Map magnitude -1.5 to 3.0 → brightness 1.0 to 0.1
    const normalizedMag = Math.max(-1.5, Math.min(3.0, mag));
    const brightness = Math.pow(10, (1.5 - normalizedMag) / 2.5);

    // Calculate star radius based on magnitude (for glow effect)
    const baseRadius = magnitudeToSize(mag, 1, 6);

    // Draw star with glow
    const radius = Math.ceil(baseRadius);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        // Gaussian falloff for glow
        const falloff = Math.exp(-(dist * dist) / (baseRadius * baseRadius * 0.5));

        const px = (texX + dx + width) % width;
        const py = (texY + dy + height) % height;
        const idx = (py * width + px) * 4;

        // Additive blending
        const r = Math.min(255, data[idx] + Math.floor(color.r * brightness * falloff * 255));
        const g = Math.min(255, data[idx + 1] + Math.floor(color.g * brightness * falloff * 255));
        const b = Math.min(255, data[idx + 2] + Math.floor(color.b * brightness * falloff * 255));

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
    }
  }

  // Add procedural dim stars for background density
  addProceduralStars(data, width, height, 5000);

  // Create texture
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Add procedural dim stars to fill the background
 */
function addProceduralStars(data, width, height, count) {
  const seededRandom = createSeededRandom(42);

  for (let i = 0; i < count; i++) {
    const u = seededRandom();
    const v = seededRandom();

    const texX = Math.floor(u * width);
    const texY = Math.floor(v * height);
    const idx = (texY * width + texX) * 4;

    // Random dim color
    const brightness = 0.1 + seededRandom() * 0.3;
    const colorTemp = seededRandom();

    let r, g, b;
    if (colorTemp < 0.3) {
      // Slightly blue
      r = 0.8 * brightness;
      g = 0.85 * brightness;
      b = 1.0 * brightness;
    } else if (colorTemp < 0.7) {
      // White
      r = brightness;
      g = brightness;
      b = brightness;
    } else {
      // Slightly yellow
      r = 1.0 * brightness;
      g = 0.95 * brightness;
      b = 0.8 * brightness;
    }

    data[idx] = Math.min(255, data[idx] + Math.floor(r * 255));
    data[idx + 1] = Math.min(255, data[idx + 1] + Math.floor(g * 255));
    data[idx + 2] = Math.min(255, data[idx + 2] + Math.floor(b * 255));
  }
}

/**
 * Create a seeded random number generator
 */
function createSeededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate a Milky Way texture (galactic plane)
 */
export function generateMilkyWayTexture(width = 2048, height = 1024) {
  const data = new Uint8Array(width * height * 4);

  const seededRandom = createSeededRandom(12345);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Convert to spherical coordinates
      const theta = (x / width) * Math.PI * 2;
      const phi = (y / height) * Math.PI - Math.PI / 2;

      // Galactic plane is roughly at the equator in RA/Dec
      // Add a band effect
      const galacticDist = Math.abs(phi);
      const bandWidth = 0.3;
      const intensity = Math.exp(-galacticDist * galacticDist / (bandWidth * bandWidth));

      // Add noise for cloud-like appearance
      const noise = seededRandom() * 0.5 + 0.5;

      const brightness = intensity * noise * 0.15;

      // Milky way color (slightly purple/blue)
      data[idx] = Math.floor(brightness * 0.6 * 255);
      data[idx + 1] = Math.floor(brightness * 0.7 * 255);
      data[idx + 2] = Math.floor(brightness * 1.0 * 255);
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

export default { generateStarTexture, generateMilkyWayTexture };
