/**
 * Deflection Texture Generator
 *
 * Based on Eric Bruneton's paper "Real-time High Quality Rendering of
 * Non-rotating Black Holes" (arXiv:2010.08735)
 *
 * Precomputes light deflection around a Schwarzschild black hole
 * to replace iterative raymarching with O(1) texture lookups.
 *
 * Key equations:
 * - u = 1/r (inverse radius, where r is in units of rs/2)
 * - e² = u̇² + u²(1-u) (energy parameter from geodesic)
 * - Δ = φ - arctan2(u, u̇) (deflection angle)
 * - μ = 4/27 (critical value at photon sphere)
 */

import * as THREE from 'three';

// Critical value at photon sphere (u = 2/3)
const MU = 4 / 27;

// Photon sphere radius in our u coordinates
const U_PHOTON_SPHERE = 2 / 3;

/**
 * Generate deflection lookup texture
 *
 * Stores (e², deflection) pairs for ray tracing
 *
 * @param {number} resolution - Texture resolution (default 512)
 * @returns {THREE.DataTexture} Deflection lookup texture
 */
export function generateDeflectionTexture(resolution = 512) {
  const data = new Float32Array(resolution * resolution * 4);

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const idx = (j * resolution + i) * 4;

      // Map texture coordinates to physical parameters
      // i → e² (energy parameter squared), range [0, 2*MU] with focus near MU
      // j → u (inverse radius), range [0, 1]

      // Non-linear mapping to concentrate samples near critical values
      const t_e = i / (resolution - 1);
      const t_u = j / (resolution - 1);

      // e² mapping: concentrate near μ = 4/27 ≈ 0.148
      // Use sinh mapping for better resolution near critical value
      const e2 = mapEnergy(t_e);

      // u mapping: focus near photon sphere (u = 2/3)
      const u = mapRadius(t_u);

      // Compute deflection for this (e², u) pair
      const result = computeDeflection(e2, u);

      // Store: R = deflection angle, G = t (affine parameter), B = ray type, A = valid
      data[idx + 0] = result.deflection;
      data[idx + 1] = result.t;
      data[idx + 2] = result.rayType;
      data[idx + 3] = result.valid ? 1.0 : 0.0;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    resolution,
    resolution,
    THREE.RGBAFormat,
    THREE.FloatType
  );

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Map normalized coordinate to e² (energy parameter squared)
 * Uses sinh mapping to concentrate samples near μ
 */
function mapEnergy(t) {
  // Map [0,1] → [0, ~0.5] with concentration near μ = 4/27
  const scale = 3.0;
  return MU * (1 + Math.sinh(scale * (t - 0.5)) / Math.sinh(scale * 0.5));
}

/**
 * Inverse of mapEnergy for shader use
 */
export function inverseMapEnergy(e2) {
  const scale = 3.0;
  const normalized = e2 / MU - 1;
  return 0.5 + Math.asinh(normalized * Math.sinh(scale * 0.5)) / scale;
}

/**
 * Map normalized coordinate to u (inverse radius)
 * Concentrates samples near photon sphere u = 2/3
 */
function mapRadius(t) {
  // Map [0,1] → [0, 1] with concentration near 2/3
  // Using cubic interpolation centered at photon sphere
  const center = U_PHOTON_SPHERE;
  const spread = 0.5;

  if (t < 0.5) {
    // Below photon sphere
    return center * Math.pow(2 * t, 1.5);
  } else {
    // Above photon sphere
    return center + (1 - center) * Math.pow(2 * (t - 0.5), 1.5);
  }
}

/**
 * Compute deflection by integrating the geodesic equation
 *
 * Geodesic equation: ü = (3/2)u² - u
 * where u̇ = du/dφ
 *
 * @param {number} e2 - Energy parameter squared
 * @param {number} u_target - Target inverse radius
 * @returns {Object} {deflection, t, rayType, valid}
 */
function computeDeflection(e2, u_target) {
  // Handle edge cases
  if (e2 < 1e-10 || u_target < 1e-10 || u_target >= 1) {
    return { deflection: 0, t: 0, rayType: 0, valid: false };
  }

  // Determine ray type based on e² vs μ
  let rayType;
  if (e2 > MU) {
    rayType = 1; // Crosses photon sphere (plunging or escaping)
  } else if (e2 < MU && u_target > U_PHOTON_SPHERE) {
    rayType = 2; // Above photon sphere, turns back
  } else {
    rayType = 3; // Below photon sphere, reflects at apsis
  }

  // Integrate geodesic from u=0 (infinity) to u_target
  // Initial conditions: u = 0, u̇ = e (from e² = u̇² at infinity)
  const dphi = 0.001;
  const maxSteps = 50000;

  let u = 1e-6;  // Start near infinity
  let u_dot = Math.sqrt(e2);  // Initial radial velocity
  let phi = 0;
  let t = 0;

  let minDist = Infinity;
  let deflectionAtTarget = 0;
  let tAtTarget = 0;
  let found = false;

  for (let i = 0; i < maxSteps; i++) {
    // Geodesic equation: ü = (3/2)u² - u
    const u_ddot = 1.5 * u * u - u;

    // Euler integration (small step for accuracy)
    u_dot += u_ddot * dphi;
    u += u_dot * dphi;

    // Affine parameter increment: dt = e·dφ/(u² - u³)
    const denom = u * u * (1 - u);
    if (denom > 1e-10) {
      t += Math.sqrt(e2) * dphi / denom;
    }

    phi += dphi;

    // Check for horizon crossing
    if (u >= 1) {
      break;
    }

    // Check if we've passed the target
    const dist = Math.abs(u - u_target);
    if (dist < minDist) {
      minDist = dist;
      // Deflection: Δ = φ - arctan2(u, u̇)
      deflectionAtTarget = phi - Math.atan2(u, u_dot);
      tAtTarget = t;

      if (dist < 0.01) {
        found = true;
      }
    }

    // Check for turning point (u̇ changes sign)
    if (u_dot < 0 && rayType === 3) {
      // Ray is turning back, may need to continue
    }

    // Check for escape
    if (u < 1e-6 && u_dot < 0) {
      break;
    }
  }

  return {
    deflection: deflectionAtTarget,
    t: tAtTarget,
    rayType: rayType,
    valid: found || minDist < 0.1
  };
}

/**
 * Generate GLSL code for texture lookup
 */
export function getDeflectionShaderCode() {
  return `
// Deflection texture lookup functions
// Based on Bruneton's precomputed deflection tables

uniform sampler2D deflectionTexture;
uniform float deflectionMu;  // μ = 4/27

// Map e² to texture coordinate
float mapE2ToTexCoord(float e2) {
  float scale = 3.0;
  float normalized = e2 / deflectionMu - 1.0;
  return 0.5 + asinh(normalized * sinh(scale * 0.5)) / scale;
}

// Map u to texture coordinate
float mapUToTexCoord(float u) {
  float center = 2.0 / 3.0;
  if (u < center) {
    return 0.5 * pow(u / center, 0.667);
  } else {
    return 0.5 + 0.5 * pow((u - center) / (1.0 - center), 0.667);
  }
}

// Lookup deflection from precomputed texture
vec4 lookupDeflection(float e2, float u) {
  vec2 uv = vec2(mapE2ToTexCoord(e2), mapUToTexCoord(u));
  return texture2D(deflectionTexture, uv);
}

// Compute e² from ray direction
// u = 1/r, u̇ = -u·cot(δ) where δ is angle from radial
float computeE2(float u, float u_dot) {
  return u_dot * u_dot + u * u * (1.0 - u);
}
`;
}

/**
 * Create a simple test visualization of the deflection texture
 */
export function createDeflectionVisualization(texture) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      deflectionTexture: { value: texture }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D deflectionTexture;
      varying vec2 vUv;

      void main() {
        vec4 data = texture2D(deflectionTexture, vUv);

        // Visualize: deflection as hue, validity as brightness
        float deflection = data.r;
        float valid = data.a;

        // Map deflection to color
        vec3 color = vec3(
          0.5 + 0.5 * sin(deflection),
          0.5 + 0.5 * sin(deflection + 2.094),
          0.5 + 0.5 * sin(deflection + 4.189)
        );

        color *= valid;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  return new THREE.Mesh(geometry, material);
}

export { MU, U_PHOTON_SPHERE };
