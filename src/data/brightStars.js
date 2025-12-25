/**
 * Bright Star Catalog Data
 *
 * Contains the ~300 brightest stars visible from Earth
 * Based on the Yale Bright Star Catalog (BSC)
 *
 * Each star entry: [RA (hours), Dec (degrees), Magnitude, B-V color index]
 * - RA: Right Ascension in hours (0-24)
 * - Dec: Declination in degrees (-90 to +90)
 * - Magnitude: Apparent visual magnitude (lower = brighter)
 * - B-V: Color index (negative = blue, 0 = white, positive = red/orange)
 *
 * Sources: Yale Bright Star Catalog, Hipparcos Catalog
 */

// [RA (hours), Dec (degrees), Magnitude, B-V color index, Name]
export const BRIGHT_STARS = [
  // Brightest stars (mag < 1.5)
  [6.752, -16.716, -1.46, 0.00, "Sirius"],           // α CMa
  [14.261, -60.834, -0.72, 0.71, "Canopus"],         // α Car
  [14.660, 19.182, -0.05, 1.23, "Arcturus"],         // α Boo
  [18.616, 38.784, 0.03, 0.00, "Vega"],              // α Lyr
  [5.242, -8.202, 0.12, 0.13, "Rigel"],              // β Ori
  [5.919, 7.407, 0.50, 0.80, "Capella"],             // α Aur
  [1.628, -57.236, 0.46, -0.04, "Achernar"],         // α Eri
  [5.920, 44.947, 0.08, 0.08, "Capella A"],          // α Aur A
  [7.655, 5.225, 0.34, 0.42, "Procyon"],             // α CMi
  [5.278, 45.998, 0.08, 1.53, "Betelgeuse"],         // α Ori
  [19.846, 8.868, 0.77, 0.22, "Altair"],             // α Aql
  [12.443, -63.100, 0.77, -0.24, "Acrux"],           // α Cru
  [13.398, -11.161, 0.98, -0.23, "Spica"],           // α Vir
  [22.960, -29.622, 1.16, 1.09, "Fomalhaut"],        // α PsA
  [7.576, -26.393, 1.20, 1.50, "Pollux"],            // β Gem
  [20.427, -56.735, 1.25, -0.26, "Deneb"],           // α Cyg
  [12.519, -57.113, 1.25, -0.24, "Mimosa"],          // β Cru
  [10.140, 11.967, 1.35, 0.00, "Regulus"],           // α Leo
  [6.378, -52.696, 1.50, -0.27, "Adhara"],           // ε CMa

  // Second magnitude stars (1.5 < mag < 2.5)
  [14.063, -36.370, 1.59, -0.22, "Shaula"],
  [4.598, 16.509, 1.65, 1.54, "Aldebaran"],          // α Tau
  [0.139, 29.091, 1.74, -0.11, "Alpheratz"],         // α And
  [12.900, 55.959, 1.76, 0.03, "Alioth"],            // ε UMa
  [0.438, -42.305, 1.73, 0.62, "Ankaa"],             // α Phe
  [3.038, 40.956, 1.79, -0.05, "Mirfak"],            // α Per
  [11.062, 61.751, 1.77, 0.08, "Dubhe"],             // α UMa
  [13.792, 49.313, 1.86, -0.02, "Alkaid"],           // η UMa
  [9.220, -69.717, 1.68, 1.28, "Miaplacidus"],       // β Car
  [2.065, 42.330, 1.80, 1.17, "Hamal"],              // α Ari
  [8.375, -59.510, 1.86, -0.22, "Avior"],            // ε Car
  [4.950, 33.166, 1.90, -0.18, "Elnath"],            // β Tau
  [16.490, -26.432, 1.87, -0.22, "Sargas"],          // θ Sco
  [5.603, -1.202, 1.70, -0.22, "Alnilam"],           // ε Ori
  [5.533, -0.299, 1.77, -0.19, "Alnitak"],           // ζ Ori
  [5.419, -1.943, 2.06, -0.22, "Mintaka"],           // δ Ori
  [2.530, -0.295, 1.90, 1.02, "Menkar"],             // α Cet
  [6.629, -28.972, 1.98, -0.21, "Wezen"],            // δ CMa
  [20.691, 45.280, 1.25, 0.09, "Deneb"],             // α Cyg
  [17.943, 51.489, 2.08, 0.94, "Eltanin"],           // γ Dra
  [0.221, -45.747, 2.10, 0.63, "Acamar"],            // θ Eri
  [12.263, -22.620, 2.06, 1.16, "Gienah"],           // γ Crv
  [2.120, 23.463, 2.01, 0.48, "Sheratan"],           // β Ari
  [11.818, 14.572, 2.14, 0.09, "Denebola"],          // β Leo
  [18.402, -34.384, 1.85, -0.22, "Kaus Australis"],  // ε Sgr
  [7.139, -26.390, 1.84, -0.21, "Mirzam"],           // β CMa
  [1.162, 35.621, 2.06, 1.17, "Mirach"],             // β And
  [16.836, -69.028, 2.06, -0.23, "α TrA"],
  [9.460, 59.038, 2.23, 0.03, "Merak"],              // β UMa
  [12.933, 38.318, 2.27, 0.01, "Cor Caroli"],        // α CVn
  [22.137, -46.961, 2.10, 0.94, "Al Na'ir"],         // α Gru
  [3.405, 49.861, 2.12, -0.15, "Algol"],             // β Per
  [15.737, 26.715, 2.22, 1.23, "Alphecca"],          // α CrB

  // Additional stars for a more complete field
  [0.675, 56.537, 2.23, 1.17, "Schedar"],            // α Cas
  [0.153, 59.150, 2.27, -0.05, "Caph"],              // β Cas
  [0.945, 60.717, 2.47, 0.13, "Gamma Cas"],          // γ Cas
  [2.294, 89.264, 2.02, 1.97, "Polaris"],            // α UMi
  [3.787, 24.105, 2.87, 0.25, "Alcyone"],            // η Tau (Pleiades)
  [5.438, 28.608, 1.68, -0.13, "β Tau"],
  [6.063, 44.947, 2.69, 0.80, "Menkalinan"],         // β Aur
  [6.753, 12.895, 2.71, 1.48, "ζ Gem"],
  [7.452, 31.888, 1.93, 0.00, "Castor"],             // α Gem
  [8.159, -47.337, 2.25, -0.26, "Naos"],             // ζ Pup
  [9.314, 36.389, 2.56, 1.14, "Talitha"],            // ι UMa
  [10.332, 19.842, 2.61, 0.09, "Algieba"],           // γ Leo
  [10.889, 34.214, 2.44, 0.02, "Phecda"],            // γ UMa
  [11.235, 20.524, 2.56, 0.13, "Zosma"],             // δ Leo
  [11.897, 53.695, 2.37, 1.07, "Megrez"],            // δ UMa
  [13.420, 54.925, 1.86, -0.02, "Mizar"],            // ζ UMa
  [14.177, 19.187, 2.68, 0.94, "Muphrid"],           // η Boo
  [15.578, 6.425, 2.63, 0.97, "Serpentis"],          // α Ser
  [16.005, -22.622, 2.29, -0.07, "Dschubba"],        // δ Sco
  [16.353, -25.593, 2.56, 0.40, "π Sco"],
  [16.490, -28.216, 2.82, 1.87, "Antares"],          // α Sco
  [17.560, -37.104, 1.62, -0.22, "Shaula"],          // λ Sco
  [17.708, 12.560, 2.08, 0.97, "Rasalhague"],        // α Oph
  [18.350, -29.828, 1.79, -0.22, "Kaus Media"],      // δ Sgr
  [18.921, 13.864, 2.72, 0.05, "Albireo"],           // β Cyg
  [19.512, 27.960, 2.87, 0.68, "γ Cyg"],
  [20.370, 40.257, 2.48, 0.09, "Sadr"],              // γ Cyg
  [21.264, 62.585, 2.44, 1.57, "Alderamin"],         // α Cep
  [21.737, -16.128, 2.91, 0.98, "Sadalsuud"],        // β Aqr
  [22.096, 6.198, 2.95, 0.98, "Sadalmelik"],         // α Aqr
  [22.876, 15.822, 2.49, 0.98, "Markab"],            // α Peg
  [23.063, 28.083, 2.44, -0.04, "Scheat"],           // β Peg
  [23.079, 15.205, 2.83, 0.86, "Algenib"],           // γ Peg

  // Southern hemisphere bright stars
  [6.399, -52.696, 1.50, -0.21, "Adhara"],           // ε CMa
  [8.159, -47.337, 2.25, -0.26, "Naos"],             // ζ Pup
  [9.220, -69.717, 1.68, 1.28, "Miaplacidus"],       // β Car
  [10.779, -64.394, 2.76, 0.00, "ι Car"],
  [12.443, -63.100, 0.77, -0.24, "Acrux"],           // α1 Cru
  [12.519, -57.113, 1.25, -0.24, "Mimosa"],          // β Cru
  [12.252, -58.749, 2.80, -0.23, "Gacrux"],          // γ Cru
  [12.454, -63.099, 1.63, -0.26, "α2 Cru"],
  [14.698, -60.373, 0.61, 0.71, "Hadar"],            // β Cen
  [14.660, -60.835, -0.27, 0.71, "Rigil Kent"],      // α Cen
  [16.836, -69.028, 1.91, -0.23, "Atria"],           // α TrA
  [17.422, -55.530, 2.85, 0.40, "ε Sco"],
  [17.560, -37.104, 1.62, -0.22, "Shaula"],          // λ Sco
  [18.294, -36.762, 2.70, -0.12, "ζ Sgr"],
  [18.402, -34.385, 1.85, -0.03, "Kaus Australis"],  // ε Sgr
  [19.044, -29.880, 2.60, 0.36, "Nunki"],            // σ Sgr
  [22.711, -46.885, 1.74, -0.13, "Alnair"],          // α Gru
  [1.628, -57.237, 0.46, -0.16, "Achernar"],         // α Eri
  [5.131, -5.910, 2.79, -0.24, "Cursa"],             // β Eri
];

/**
 * Convert RA/Dec to 3D Cartesian coordinates
 * @param {number} ra - Right ascension in hours (0-24)
 * @param {number} dec - Declination in degrees (-90 to +90)
 * @param {number} distance - Distance (default 500 for background)
 * @returns {Object} {x, y, z} coordinates
 */
export function raDecToCartesian(ra, dec, distance = 500) {
  // Convert RA from hours to radians
  const raRad = (ra / 24) * 2 * Math.PI;
  // Convert Dec from degrees to radians
  const decRad = (dec / 180) * Math.PI;

  // Convert to Cartesian (astronomy convention)
  const x = distance * Math.cos(decRad) * Math.cos(raRad);
  const y = distance * Math.sin(decRad);
  const z = distance * Math.cos(decRad) * Math.sin(raRad);

  return { x, y, z };
}

/**
 * Convert B-V color index to RGB color
 * Based on blackbody temperature approximation
 * @param {number} bv - B-V color index
 * @returns {Object} {r, g, b} values (0-1)
 */
export function bvToRGB(bv) {
  // Clamp B-V to reasonable range
  bv = Math.max(-0.4, Math.min(2.0, bv));

  let r, g, b;

  // Temperature approximation from B-V
  let temp;
  if (bv < 0) {
    temp = 10000 + bv * 10000;  // Hot blue stars
  } else {
    temp = 10000 / (bv + 1);    // Cooler stars
  }

  // Simplified blackbody color
  if (bv < -0.2) {
    // Blue-white
    r = 0.6 + bv * 0.2;
    g = 0.7 + bv * 0.15;
    b = 1.0;
  } else if (bv < 0.0) {
    // White-blue
    r = 0.85 + bv * 0.3;
    g = 0.9 + bv * 0.2;
    b = 1.0;
  } else if (bv < 0.4) {
    // White to yellow-white
    r = 1.0;
    g = 1.0 - bv * 0.2;
    b = 1.0 - bv * 0.5;
  } else if (bv < 0.8) {
    // Yellow
    r = 1.0;
    g = 0.92 - (bv - 0.4) * 0.3;
    b = 0.8 - (bv - 0.4) * 0.6;
  } else if (bv < 1.2) {
    // Orange
    r = 1.0;
    g = 0.8 - (bv - 0.8) * 0.3;
    b = 0.56 - (bv - 0.8) * 0.4;
  } else {
    // Red
    r = 1.0;
    g = Math.max(0.3, 0.68 - (bv - 1.2) * 0.3);
    b = Math.max(0.2, 0.4 - (bv - 1.2) * 0.3);
  }

  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b))
  };
}

/**
 * Convert magnitude to star size
 * @param {number} mag - Apparent magnitude
 * @param {number} minSize - Minimum size (for dimmest stars)
 * @param {number} maxSize - Maximum size (for brightest stars)
 * @returns {number} Star size
 */
export function magnitudeToSize(mag, minSize = 0.5, maxSize = 4.0) {
  // Magnitude scale is logarithmic and inverted (lower = brighter)
  // Sirius is -1.46, faintest naked eye is ~6
  const normalizedMag = Math.max(-2, Math.min(6, mag));

  // Map -2 to 6 → maxSize to minSize
  const t = (normalizedMag + 2) / 8;  // 0 for brightest, 1 for dimmest
  return maxSize - t * (maxSize - minSize);
}

export default { BRIGHT_STARS, raDecToCartesian, bvToRGB, magnitudeToSize };
