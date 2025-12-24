/**
 * Schwarzschild Metric Calculations
 *
 * The Schwarzschild metric describes spacetime around a non-rotating black hole:
 * ds² = -(1-rs/r)c²dt² + (1-rs/r)⁻¹dr² + r²(dθ² + sin²θ dφ²)
 *
 * We work in units where rs = 1 and c = 1
 */

import { PHOTON_SPHERE, ISCO } from './constants.js';

/**
 * Metric component g_tt (time-time component)
 * g_tt = -(1 - rs/r) = -(1 - 1/r) in our units
 * @param {number} r - Radial coordinate (in units of rs)
 * @returns {number} g_tt component
 */
export function g_tt(r) {
  if (r <= 1) return 0;  // At or inside event horizon
  return -(1 - 1 / r);
}

/**
 * Metric component g_rr (radial-radial component)
 * g_rr = 1/(1 - rs/r) = 1/(1 - 1/r) in our units
 * @param {number} r - Radial coordinate (in units of rs)
 * @returns {number} g_rr component
 */
export function g_rr(r) {
  if (r <= 1) return Infinity;
  return 1 / (1 - 1 / r);
}

/**
 * Metric component g_φφ (angular component)
 * g_φφ = r²
 * @param {number} r - Radial coordinate
 * @returns {number} g_φφ component
 */
export function g_phiphi(r) {
  return r * r;
}

/**
 * Effective potential for massive particles
 * V_eff(r) = (1 - 1/r)(1 + L²/r²)
 * where L is specific angular momentum (in units of rs*c)
 *
 * @param {number} r - Radial coordinate (in units of rs)
 * @param {number} L - Specific angular momentum
 * @returns {number} Effective potential
 */
export function effectivePotential(r, L) {
  if (r <= 0) return Infinity;
  const f = 1 - 1 / r;
  return f * (1 + (L * L) / (r * r));
}

/**
 * Derivative of effective potential (for finding extrema)
 * dV/dr = 1/r² - L²(2r-3)/(r⁴)
 *
 * @param {number} r - Radial coordinate
 * @param {number} L - Specific angular momentum
 * @returns {number} dV/dr
 */
export function effectivePotentialDerivative(r, L) {
  if (r <= 0) return -Infinity;
  const r2 = r * r;
  const r4 = r2 * r2;
  const L2 = L * L;
  return 1 / r2 - L2 * (2 * r - 3) / r4;
}

/**
 * Calculate specific angular momentum for circular orbit at radius r
 * L_circ = r / √(r - 1.5) for r > 1.5
 *
 * @param {number} r - Orbital radius (in units of rs)
 * @returns {number} Specific angular momentum for circular orbit
 */
export function circularOrbitAngularMomentum(r) {
  if (r <= PHOTON_SPHERE) return Infinity;  // No circular orbits inside photon sphere
  return r / Math.sqrt(r - PHOTON_SPHERE);
}

/**
 * Calculate specific energy for circular orbit at radius r
 * E_circ = (1 - 1/r) / √(1 - 1.5/r)
 *
 * @param {number} r - Orbital radius (in units of rs)
 * @returns {number} Specific energy for circular orbit
 */
export function circularOrbitEnergy(r) {
  if (r <= PHOTON_SPHERE) return Infinity;
  return (1 - 1 / r) / Math.sqrt(1 - PHOTON_SPHERE / r);
}

/**
 * Check if orbit is bound (E < 1)
 * @param {number} E - Specific energy
 * @returns {boolean} True if orbit is bound
 */
export function isBoundOrbit(E) {
  return E < 1;
}

/**
 * Check if orbit will plunge into black hole
 * @param {number} r - Current radius
 * @param {number} E - Specific energy
 * @param {number} L - Specific angular momentum
 * @returns {boolean} True if particle will plunge
 */
export function willPlunge(r, E, L) {
  // Calculate the peak of the effective potential
  // For L > L_crit ≈ 2√3, there's a potential barrier
  const L_crit = 2 * Math.sqrt(3);

  if (Math.abs(L) < L_crit) {
    return true;  // No angular momentum barrier, will plunge
  }

  // Find the peak of effective potential
  // V_peak is at r_peak where dV/dr = 0
  // Numerically find r_peak and V_peak
  const r_peak = findPotentialPeak(L);
  if (r_peak && r < r_peak) {
    return true;  // Already inside potential barrier
  }

  const V_peak = r_peak ? effectivePotential(r_peak, L) : Infinity;

  // If E² > V_peak, particle can overcome barrier
  return E * E > V_peak;
}

/**
 * Find the radius of the peak of the effective potential
 * @param {number} L - Specific angular momentum
 * @returns {number|null} Radius of potential peak, or null if none exists
 */
function findPotentialPeak(L) {
  const L2 = L * L;

  // dV/dr = 0 gives: r² - L²(2r-3)/r² = 0
  // This is a cubic: r³ - L²(2r - 3) = 0
  // r³ - 2L²r + 3L² = 0

  // Use Newton-Raphson iteration starting from r = 2
  let r = 2;
  for (let i = 0; i < 20; i++) {
    const f = r * r * r - 2 * L2 * r + 3 * L2;
    const df = 3 * r * r - 2 * L2;
    if (Math.abs(df) < 1e-10) break;
    const dr = f / df;
    r -= dr;
    if (Math.abs(dr) < 1e-10) break;
  }

  if (r <= 1) return null;  // Peak inside event horizon
  return r;
}

/**
 * Calculate coordinate velocity components from conserved quantities
 *
 * For a particle with energy E and angular momentum L:
 * dt/dτ = E / (1 - 1/r)
 * dφ/dτ = L / r²
 * dr/dτ = ±√(E² - V_eff)
 *
 * @param {number} r - Radial coordinate
 * @param {number} E - Specific energy
 * @param {number} L - Specific angular momentum
 * @param {boolean} inward - True if moving toward black hole
 * @returns {Object} {dr_dtau, dphi_dtau, dt_dtau}
 */
export function particleVelocities(r, E, L, inward = true) {
  if (r <= 1) {
    return { dr_dtau: -Infinity, dphi_dtau: L, dt_dtau: Infinity };
  }

  const f = 1 - 1 / r;
  const V_eff = effectivePotential(r, L);
  const E2_minus_V = E * E - V_eff;

  // dr/dτ = ±√(E² - V_eff)
  const dr_dtau_squared = Math.max(0, E2_minus_V);
  const dr_dtau = (inward ? -1 : 1) * Math.sqrt(dr_dtau_squared);

  // dφ/dτ = L/r²
  const dphi_dtau = L / (r * r);

  // dt/dτ = E/(1 - 1/r)
  const dt_dtau = E / f;

  return { dr_dtau, dphi_dtau, dt_dtau };
}

/**
 * Convert proper time derivatives to coordinate time derivatives
 * @param {Object} velocities - {dr_dtau, dphi_dtau, dt_dtau}
 * @returns {Object} {dr_dt, dphi_dt}
 */
export function toCoordinateVelocities(velocities) {
  const { dr_dtau, dphi_dtau, dt_dtau } = velocities;
  if (dt_dtau === 0) {
    return { dr_dt: 0, dphi_dt: 0 };
  }
  return {
    dr_dt: dr_dtau / dt_dtau,
    dphi_dt: dphi_dtau / dt_dtau
  };
}

/**
 * Check if a radius is inside important boundaries
 */
export const boundaries = {
  isInsideEventHorizon: (r) => r <= 1,
  isInsidePhotonSphere: (r) => r <= PHOTON_SPHERE,
  isInsideISCO: (r) => r <= ISCO,
  isOutsideSafeZone: (r) => r > 10  // Far enough for Newtonian approximation
};
