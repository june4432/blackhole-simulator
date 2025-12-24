/**
 * Geodesic Integration for Schwarzschild Spacetime
 *
 * Solves the equations of motion for particles and light rays
 * using 4th order Runge-Kutta integration (RK4)
 */

import { effectivePotential, particleVelocities, toCoordinateVelocities } from './schwarzschild.js';

/**
 * State vector for particle motion in equatorial plane (θ = π/2)
 * State: [r, φ, dr/dt, dφ/dt]
 */

/**
 * Calculate derivatives for RK4 integration
 * Using coordinate time parameterization
 *
 * The equations of motion in Schwarzschild spacetime:
 * d²r/dt² = (1-rs/r)[(rs/2r²)(dr/dt)²/(1-rs/r)² - (rs/2r²) + (1-rs/r)r(dφ/dt)²]
 * d²φ/dt² = -2(dr/dt)(dφ/dt)/r
 *
 * @param {Array} state - [r, φ, dr_dt, dφ_dt]
 * @param {number} rs - Schwarzschild radius (default 1 in our units)
 * @returns {Array} [dr_dt, dφ_dt, d²r/dt², d²φ/dt²]
 */
export function geodesicDerivatives(state, rs = 1) {
  const [r, phi, dr_dt, dphi_dt] = state;

  // Prevent singularity
  if (r <= rs) {
    return [dr_dt, dphi_dt, -1e10, 0];  // Force inward acceleration
  }

  const f = 1 - rs / r;          // Metric factor (1 - rs/r)
  const r2 = r * r;
  const rs_2r2 = rs / (2 * r2);  // rs/(2r²)

  // d²r/dt² = f * [rs/(2r²) * (dr/dt)²/f² - rs/(2r²) + f * r * (dφ/dt)²]
  const dr_dt_sq = dr_dt * dr_dt;
  const dphi_dt_sq = dphi_dt * dphi_dt;

  const d2r_dt2 = f * (
    rs_2r2 * dr_dt_sq / (f * f) -
    rs_2r2 +
    f * r * dphi_dt_sq
  );

  // d²φ/dt² = -2 * (dr/dt) * (dφ/dt) / r
  const d2phi_dt2 = -2 * dr_dt * dphi_dt / r;

  return [dr_dt, dphi_dt, d2r_dt2, d2phi_dt2];
}

/**
 * Single RK4 integration step
 * @param {Array} state - Current state [r, φ, dr_dt, dφ_dt]
 * @param {number} dt - Time step
 * @param {number} rs - Schwarzschild radius
 * @returns {Array} New state after time step
 */
export function rk4Step(state, dt, rs = 1) {
  const k1 = geodesicDerivatives(state, rs);

  const state2 = state.map((s, i) => s + 0.5 * dt * k1[i]);
  const k2 = geodesicDerivatives(state2, rs);

  const state3 = state.map((s, i) => s + 0.5 * dt * k2[i]);
  const k3 = geodesicDerivatives(state3, rs);

  const state4 = state.map((s, i) => s + dt * k3[i]);
  const k4 = geodesicDerivatives(state4, rs);

  // Combine: state_new = state + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
  return state.map((s, i) =>
    s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );
}

/**
 * Adaptive RK4 step with error control
 * Uses step doubling to estimate error
 * @param {Array} state - Current state
 * @param {number} dt - Initial time step
 * @param {number} rs - Schwarzschild radius
 * @param {number} tolerance - Error tolerance
 * @returns {Object} {newState, actualDt, error}
 */
export function adaptiveRK4Step(state, dt, rs = 1, tolerance = 1e-6) {
  // Two half steps
  const half = rk4Step(state, dt / 2, rs);
  const twoHalf = rk4Step(half, dt / 2, rs);

  // One full step
  const full = rk4Step(state, dt, rs);

  // Error estimate (difference between methods)
  const error = Math.sqrt(
    twoHalf.reduce((sum, val, i) => sum + Math.pow(val - full[i], 2), 0)
  );

  if (error < tolerance || dt < 1e-10) {
    return {
      newState: twoHalf,  // Use more accurate result
      actualDt: dt,
      error
    };
  }

  // Step too large, reduce and retry
  return adaptiveRK4Step(state, dt / 2, rs, tolerance);
}

/**
 * Integrate geodesic for multiple steps
 * @param {Array} initialState - [r, φ, dr_dt, dφ_dt]
 * @param {number} totalTime - Total coordinate time to integrate
 * @param {number} dt - Time step
 * @param {number} rs - Schwarzschild radius
 * @returns {Array} Array of states at each time step
 */
export function integrateGeodesic(initialState, totalTime, dt, rs = 1) {
  const trajectory = [{ t: 0, state: [...initialState] }];
  let state = [...initialState];
  let t = 0;

  while (t < totalTime) {
    // Check if inside event horizon
    if (state[0] <= rs * 1.001) {
      trajectory.push({ t, state: [...state], terminated: 'horizon' });
      break;
    }

    // Check if escaped (very far away and moving outward)
    if (state[0] > 100 && state[2] > 0) {
      trajectory.push({ t, state: [...state], terminated: 'escaped' });
      break;
    }

    state = rk4Step(state, dt, rs);
    t += dt;

    trajectory.push({ t, state: [...state] });
  }

  return trajectory;
}

/**
 * Create initial state for particle launched from position with velocity
 * @param {number} r - Initial radius (in rs units)
 * @param {number} phi - Initial angle
 * @param {number} v - Initial velocity magnitude (fraction of c)
 * @param {number} angle - Velocity direction relative to radial (radians)
 * @returns {Array} Initial state [r, φ, dr_dt, dφ_dt]
 */
export function createInitialState(r, phi, v, angle) {
  // Velocity components
  // angle = 0 means purely radial inward
  // angle = π/2 means tangential (prograde)
  // angle = -π/2 means tangential (retrograde)

  const vr = -v * Math.cos(angle);  // Negative = inward
  const vphi = v * Math.sin(angle) / r;  // Angular velocity

  return [r, phi, vr, vphi];
}

/**
 * Calculate conserved quantities from state
 * @param {Array} state - [r, φ, dr_dt, dφ_dt]
 * @param {number} rs - Schwarzschild radius
 * @returns {Object} {E: energy, L: angular momentum}
 */
export function conservedQuantities(state, rs = 1) {
  const [r, phi, dr_dt, dphi_dt] = state;

  if (r <= rs) {
    return { E: Infinity, L: 0 };
  }

  const f = 1 - rs / r;

  // L = r² dφ/dt (specific angular momentum)
  const L = r * r * dphi_dt;

  // E² = f⁻¹(dr/dt)² + f + L²/r² (from metric normalization)
  // For massive particles: ds² = -1
  const E_squared = dr_dt * dr_dt / (f * f) + f + L * L / (r * r);
  const E = Math.sqrt(Math.max(0, E_squared));

  return { E, L };
}

/**
 * Calculate proper time elapsed along trajectory
 * dτ/dt = √(f - f⁻¹(dr/dt)² - r²(dφ/dt)²)
 * @param {Array} trajectory - Array of {t, state} objects
 * @returns {number} Total proper time
 */
export function calculateProperTime(trajectory, rs = 1) {
  let tau = 0;

  for (let i = 1; i < trajectory.length; i++) {
    const { t: t1, state: s1 } = trajectory[i - 1];
    const { t: t2, state: s2 } = trajectory[i];
    const dt = t2 - t1;

    // Use midpoint for derivative approximation
    const r = (s1[0] + s2[0]) / 2;
    const dr_dt = (s2[0] - s1[0]) / dt;
    const dphi_dt = (s2[1] - s1[1]) / dt;

    if (r <= rs) continue;

    const f = 1 - rs / r;
    const dtau_dt_sq = f - dr_dt * dr_dt / (f * f) - r * r * dphi_dt * dphi_dt;

    if (dtau_dt_sq > 0) {
      tau += Math.sqrt(dtau_dt_sq) * dt;
    }
  }

  return tau;
}

/**
 * Light ray geodesic (null geodesic)
 * For photons, we use impact parameter b = L/E
 * @param {number} r0 - Starting radius
 * @param {number} phi0 - Starting angle
 * @param {number} b - Impact parameter (in rs units)
 * @param {boolean} inward - Initial direction
 * @returns {Array} Trajectory of light ray
 */
export function tracePhoton(r0, phi0, b, inward = true, maxSteps = 1000) {
  // For photons: (dr/dλ)² = E² - (1-rs/r)L²/r²
  // Using affine parameter λ

  const trajectory = [{ r: r0, phi: phi0 }];
  let r = r0;
  let phi = phi0;
  let direction = inward ? -1 : 1;

  const b2 = b * b;
  const dphi = 0.01;  // Small angle step

  for (let i = 0; i < maxSteps; i++) {
    // Check termination conditions
    if (r <= 1.001) {
      trajectory.push({ r, phi, terminated: 'captured' });
      break;
    }
    if (r > 50) {
      trajectory.push({ r, phi, terminated: 'escaped' });
      break;
    }

    // dr/dφ = ±r²√(1/b² - (1-1/r)/r²)
    const term = 1 / b2 - (1 - 1 / r) / (r * r);

    if (term < 0) {
      // Turning point reached
      direction *= -1;
    }

    const dr_dphi = direction * r * r * Math.sqrt(Math.max(0, term));

    phi += dphi;
    r += dr_dphi * dphi;

    trajectory.push({ r, phi });
  }

  return trajectory;
}
