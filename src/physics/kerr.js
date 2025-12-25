/**
 * Kerr Metric Calculations
 *
 * The Kerr metric describes spacetime around a rotating (spinning) black hole.
 *
 * Key parameters:
 * - M: mass (we use rs = 2M = 1 in our units)
 * - a: spin parameter = J/(Mc), where J is angular momentum
 *   - a = 0: Schwarzschild (non-rotating)
 *   - a = M: extremal Kerr (maximum rotation)
 *
 * Boyer-Lindquist coordinates (t, r, θ, φ):
 * ds² = -(1 - rs·r/Σ)dt² - (2a·rs·r·sin²θ/Σ)dtdφ
 *       + (Σ/Δ)dr² + Σdθ² + [(r² + a²)² - a²Δsin²θ]sin²θ/Σ dφ²
 *
 * Where:
 *   Σ = r² + a²cos²θ
 *   Δ = r² - rs·r + a²
 *
 * In our units where rs = 1:
 *   Σ = r² + a²cos²θ
 *   Δ = r² - r + a²
 */

/**
 * Compute Σ (Sigma) - key metric function
 * Σ = r² + a²cos²θ
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle (radians)
 * @param {number} a - Spin parameter (0 to 0.998)
 * @returns {number} Σ value
 */
export function sigma(r, theta, a) {
  const cosTheta = Math.cos(theta);
  return r * r + a * a * cosTheta * cosTheta;
}

/**
 * Compute Δ (Delta) - determines horizon locations
 * Δ = r² - r + a² (in units where rs = 1)
 *
 * Horizons are at Δ = 0: r± = (1 ± √(1 - 4a²))/2
 *
 * @param {number} r - Radial coordinate
 * @param {number} a - Spin parameter
 * @returns {number} Δ value
 */
export function delta(r, a) {
  return r * r - r + a * a;
}

/**
 * Calculate outer event horizon radius
 * r+ = (1 + √(1 - 4a²))/2 in our units
 *
 * For a = 0: r+ = 1 (Schwarzschild)
 * For a = 0.5: r+ ≈ 0.5 + √(0.75)/2 ≈ 0.933
 *
 * @param {number} a - Spin parameter (0 to 0.5 in our units where rs=1)
 * @returns {number} Outer horizon radius
 */
export function outerHorizon(a) {
  // In units where rs = 2M = 1, the formula is:
  // r+ = M + √(M² - a²) = 0.5 + √(0.25 - a²)
  // But we need to be careful with units...
  // Let's use: r+ = (1 + √(1 - 4a²))/2 for small a
  // Or more generally in rs=1 units: r+ = 0.5 * (1 + √(1 - (2a)²))
  const discriminant = 1 - 4 * a * a;
  if (discriminant < 0) return 0;  // No horizon (naked singularity, a > 0.5)
  return 0.5 * (1 + Math.sqrt(discriminant));
}

/**
 * Calculate inner (Cauchy) horizon radius
 * r- = (1 - √(1 - 4a²))/2
 *
 * @param {number} a - Spin parameter
 * @returns {number} Inner horizon radius
 */
export function innerHorizon(a) {
  const discriminant = 1 - 4 * a * a;
  if (discriminant < 0) return 0;
  return 0.5 * (1 - Math.sqrt(discriminant));
}

/**
 * Calculate static limit (ergosphere outer boundary)
 * r_static = (1 + √(1 - 4a²cos²θ))/2
 *
 * Between the static limit and outer horizon is the ergosphere,
 * where nothing can remain stationary.
 *
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} Static limit radius
 */
export function staticLimit(theta, a) {
  const cosTheta = Math.cos(theta);
  const cos2 = cosTheta * cosTheta;
  const discriminant = 1 - 4 * a * a * cos2;
  if (discriminant < 0) return 0;
  return 0.5 * (1 + Math.sqrt(discriminant));
}

/**
 * Check if point is inside ergosphere
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {boolean} True if inside ergosphere
 */
export function isInErgosphere(r, theta, a) {
  const rStatic = staticLimit(theta, a);
  const rHorizon = outerHorizon(a);
  return r < rStatic && r > rHorizon;
}

/**
 * Calculate frame-dragging angular velocity (ZAMO)
 * ω = -g_tφ / g_φφ = (a·r) / [(r² + a²)² - a²Δsin²θ]
 *
 * This is how fast spacetime itself is rotating
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} Frame dragging angular velocity
 */
export function frameDraggingOmega(r, theta, a) {
  if (a === 0) return 0;

  const sinTheta = Math.sin(theta);
  const sin2 = sinTheta * sinTheta;
  const r2 = r * r;
  const a2 = a * a;
  const del = delta(r, a);

  const r2pa2 = r2 + a2;
  const denominator = r2pa2 * r2pa2 - a2 * del * sin2;

  if (denominator < 1e-10) return 0;

  // In rs=1 units: ω = a·r / denominator (simplified)
  return a * r / denominator;
}

/**
 * Calculate ISCO (Innermost Stable Circular Orbit) for Kerr
 *
 * For prograde orbits (co-rotating with black hole):
 * r_ISCO decreases as spin increases (down to r = M for a = M)
 *
 * For retrograde orbits:
 * r_ISCO increases as spin increases (up to r = 9M for a = M)
 *
 * @param {number} a - Spin parameter
 * @param {boolean} prograde - True for co-rotating orbit
 * @returns {number} ISCO radius
 */
export function kerrISCO(a, prograde = true) {
  // Approximate formulas for ISCO
  // For a = 0: r_ISCO = 6M = 3 (in rs=1 units)
  // For a = M (extremal): r_ISCO = M (prograde) or 9M (retrograde)

  const a2 = a * a;

  // Z1 and Z2 auxiliary functions
  const Z1 = 1 + Math.pow(1 - 4 * a2, 1/3) * (
    Math.pow(1 + 2 * a, 1/3) + Math.pow(1 - 2 * a, 1/3)
  );
  const Z2 = Math.sqrt(3 * a2 + Z1 * Z1);

  // ISCO radius
  if (prograde) {
    return 0.5 * (3 + Z2 - Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));
  } else {
    return 0.5 * (3 + Z2 + Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));
  }
}

/**
 * Calculate photon sphere radius for Kerr (equatorial)
 *
 * For Schwarzschild: r = 1.5 (in rs=1 units)
 * For Kerr, there are two photon spheres (prograde and retrograde)
 *
 * @param {number} a - Spin parameter
 * @param {boolean} prograde - True for prograde photon orbit
 * @returns {number} Photon sphere radius
 */
export function kerrPhotonSphere(a, prograde = true) {
  // Approximate formula for equatorial photon orbits
  // r = 2M(1 + cos(2/3 * arccos(∓a/M)))
  // In rs=1 units (M = 0.5):

  const aOverM = 2 * a;  // a/M where M = 0.5
  const sign = prograde ? -1 : 1;
  const arg = Math.max(-1, Math.min(1, sign * aOverM));

  return (1 + Math.cos(2/3 * Math.acos(arg)));
}

/**
 * Metric component g_tt
 * g_tt = -(1 - r/Σ)
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} g_tt component
 */
export function g_tt_kerr(r, theta, a) {
  const sig = sigma(r, theta, a);
  if (sig < 1e-10) return 0;
  return -(1 - r / sig);
}

/**
 * Metric component g_tφ (frame dragging term)
 * g_tφ = -a·r·sin²θ/Σ
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} g_tφ component
 */
export function g_tphi_kerr(r, theta, a) {
  const sig = sigma(r, theta, a);
  if (sig < 1e-10) return 0;
  const sinTheta = Math.sin(theta);
  return -a * r * sinTheta * sinTheta / sig;
}

/**
 * Metric component g_rr
 * g_rr = Σ/Δ
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} g_rr component
 */
export function g_rr_kerr(r, theta, a) {
  const sig = sigma(r, theta, a);
  const del = delta(r, a);
  if (Math.abs(del) < 1e-10) return Infinity;
  return sig / del;
}

/**
 * Metric component g_θθ
 * g_θθ = Σ
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} g_θθ component
 */
export function g_thth_kerr(r, theta, a) {
  return sigma(r, theta, a);
}

/**
 * Metric component g_φφ
 * g_φφ = [(r² + a²)² - a²Δsin²θ]sin²θ/Σ
 *
 * @param {number} r - Radial coordinate
 * @param {number} theta - Polar angle
 * @param {number} a - Spin parameter
 * @returns {number} g_φφ component
 */
export function g_phph_kerr(r, theta, a) {
  const sig = sigma(r, theta, a);
  if (sig < 1e-10) return 0;

  const sinTheta = Math.sin(theta);
  const sin2 = sinTheta * sinTheta;
  const r2 = r * r;
  const a2 = a * a;
  const del = delta(r, a);

  const r2pa2 = r2 + a2;
  return (r2pa2 * r2pa2 - a2 * del * sin2) * sin2 / sig;
}

/**
 * Generate ergosphere boundary points for visualization
 *
 * @param {number} a - Spin parameter
 * @param {number} numPoints - Number of points
 * @returns {Array} Array of {r, theta} points
 */
export function ergosphereBoundary(a, numPoints = 100) {
  const points = [];

  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * Math.PI;
    const rStatic = staticLimit(theta, a);
    points.push({ r: rStatic, theta });
  }

  return points;
}

/**
 * Generate outer horizon boundary points
 * (Horizon is spherical in Boyer-Lindquist coordinates)
 *
 * @param {number} a - Spin parameter
 * @returns {number} Horizon radius
 */
export function horizonRadius(a) {
  return outerHorizon(a);
}

/**
 * Calculate Penrose process efficiency limit
 * Maximum energy extraction from ergosphere
 *
 * For extremal Kerr (a = M): η_max ≈ 20.7%
 *
 * @param {number} a - Spin parameter
 * @returns {number} Maximum efficiency (0 to ~0.29)
 */
export function penroseEfficiency(a) {
  const rH = outerHorizon(a);
  if (rH <= 0) return 0;

  // η = 1 - √(r_H / 2) approximately
  return 1 - Math.sqrt(rH / 2);
}

/**
 * Physical constants for Kerr black holes
 */
export const KERR_CONSTANTS = {
  MAX_SPIN: 0.998,  // Maximum allowed spin (Thorne limit for astrophysical BHs)
  EXTREMAL_SPIN: 0.5,  // a = M in our units where rs = 1, M = 0.5
};

export default {
  sigma,
  delta,
  outerHorizon,
  innerHorizon,
  staticLimit,
  isInErgosphere,
  frameDraggingOmega,
  kerrISCO,
  kerrPhotonSphere,
  g_tt_kerr,
  g_tphi_kerr,
  g_rr_kerr,
  g_thth_kerr,
  g_phph_kerr,
  ergosphereBoundary,
  horizonRadius,
  penroseEfficiency,
  KERR_CONSTANTS
};
