/**
 * Physical Constants and Units for Black Hole Simulation
 *
 * We use a scaled unit system for numerical stability:
 * - Length: Schwarzschild radii (rs)
 * - Time: rs/c
 * - Mass: Solar masses (M☉)
 */

// Fundamental constants (SI units)
export const G = 6.67430e-11;        // Gravitational constant (m³/kg/s²)
export const c = 299792458;           // Speed of light (m/s)
export const M_SUN = 1.989e30;        // Solar mass (kg)

// Derived constants
export const SCHWARZSCHILD_FACTOR = 2 * G / (c * c);  // 2G/c² ≈ 1.485e-27 m/kg

/**
 * Calculate Schwarzschild radius for a given mass
 * @param {number} M - Mass in solar masses
 * @returns {number} Schwarzschild radius in meters
 */
export function schwarzschildRadius(M) {
  return SCHWARZSCHILD_FACTOR * M * M_SUN;
}

/**
 * Calculate Schwarzschild radius in kilometers
 * @param {number} M - Mass in solar masses
 * @returns {number} Schwarzschild radius in km
 */
export function schwarzschildRadiusKm(M) {
  return schwarzschildRadius(M) / 1000;
}

// For a 10 solar mass black hole:
// rs = 2 * G * M / c² ≈ 29.5 km

/**
 * Key orbital radii (in units of rs)
 */
export const PHOTON_SPHERE = 1.5;     // r = 1.5 * rs (unstable photon orbits)
export const ISCO = 3.0;              // r = 3 * rs (innermost stable circular orbit)
export const MARGINALLY_BOUND = 2.0;  // r = 2 * rs (marginally bound orbit)

/**
 * Simulation scaling factors
 * We scale everything relative to rs for numerical stability
 */
export const SIM_SCALE = 1;  // 1 unit = 1 rs in simulation

/**
 * Time scaling for simulation
 * Real black hole events happen on very short timescales
 * We slow them down for visualization
 */
export const TIME_SCALE = 0.01;  // Simulation seconds per real physics time unit

/**
 * Calculate gravitational time dilation factor
 * τ/t = √(1 - rs/r)
 * @param {number} r - Distance from center (in units of rs)
 * @returns {number} Time dilation factor (0 at horizon, 1 at infinity)
 */
export function timeDilationFactor(r) {
  if (r <= 1) return 0;  // At or inside event horizon
  return Math.sqrt(1 - 1 / r);
}

/**
 * Calculate gravitational redshift
 * z = 1/√(1 - rs/r) - 1
 * @param {number} r - Distance from center (in units of rs)
 * @returns {number} Redshift factor (infinite at horizon, 0 at infinity)
 */
export function gravitationalRedshift(r) {
  if (r <= 1) return Infinity;
  return 1 / Math.sqrt(1 - 1 / r) - 1;
}

/**
 * Calculate escape velocity at radius r
 * v_escape = c * √(rs/r)
 * @param {number} r - Distance from center (in units of rs)
 * @returns {number} Escape velocity as fraction of c
 */
export function escapeVelocity(r) {
  if (r <= 1) return 1;  // At event horizon, escape velocity = c
  return Math.sqrt(1 / r);
}

/**
 * Calculate orbital velocity for circular orbit
 * For Schwarzschild: v = c * √(rs / (2r - 3rs)) for r > 1.5rs
 * @param {number} r - Orbital radius (in units of rs)
 * @returns {number} Orbital velocity as fraction of c
 */
export function circularOrbitVelocity(r) {
  if (r <= PHOTON_SPHERE) return 1;  // No stable circular orbits inside photon sphere
  return Math.sqrt(1 / (2 * r - 3));
}

/**
 * Calculate tidal acceleration (spaghettification)
 * a_tidal = 2GM * Δr / r³
 * In scaled units: a = 2 * Δr / r³ (in units of c²/rs)
 * @param {number} r - Distance from center (in units of rs)
 * @param {number} deltaR - Size of object (in units of rs)
 * @returns {number} Tidal acceleration in c²/rs units
 */
export function tidalAcceleration(r, deltaR) {
  if (r <= 0) return Infinity;
  return 2 * deltaR / (r * r * r);
}

/**
 * i18n translations
 */
export const translations = {
  en: {
    title: 'Black Hole Simulator',
    mass: 'Mass',
    schwarzschild: 'Schwarzschild Radius',
    photonSphere: 'Photon Sphere',
    isco: 'ISCO',
    distance: 'Distance',
    timeDilation: 'Time Dilation',
    count: 'Count',
    blackholeMass: 'Black Hole Mass (M☉)',
    particleVelocity: 'Particle Initial Velocity',
    launchParticle: 'Launch Particle',
    clearAll: 'Clear All',
    toggleAccretion: 'Toggle Accretion Disk',
    instruction1: 'Click: Launch particle towards cursor',
    instruction2: 'Drag: Rotate camera',
    instruction3: 'Scroll: Zoom in/out',
    blackholeSection: 'Black Hole Properties',
    observerSection: 'Observer',
    particlesSection: 'Active Particles',
    controlsTitle: 'Controls'
  },
  ko: {
    title: '블랙홀 시뮬레이터',
    mass: '질량',
    schwarzschild: '슈바르츠실트 반지름',
    photonSphere: '광자구',
    isco: '최내측 안정 궤도',
    distance: '거리',
    timeDilation: '시간 지연',
    count: '개수',
    blackholeMass: '블랙홀 질량 (M☉)',
    particleVelocity: '입자 초기 속도',
    launchParticle: '입자 발사',
    clearAll: '전체 삭제',
    toggleAccretion: '강착원반 토글',
    instruction1: '클릭: 커서 방향으로 입자 발사',
    instruction2: '드래그: 카메라 회전',
    instruction3: '스크롤: 줌 인/아웃',
    blackholeSection: '블랙홀 속성',
    observerSection: '관측자',
    particlesSection: '활성 입자',
    controlsTitle: '컨트롤'
  }
};
