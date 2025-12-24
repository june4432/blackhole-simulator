/**
 * Gravitational Lensing Effect
 *
 * Implements gravitational lensing as a post-processing effect
 * Based on the light bending formula: α = 4GM/(c²b)
 *
 * This creates the characteristic "Einstein ring" effect around black holes
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Custom gravitational lensing shader
 */
const GravitationalLensingShader = {
  uniforms: {
    tDiffuse: { value: null },
    blackHolePosition: { value: new THREE.Vector2(0.5, 0.5) },  // Screen space position
    schwarzschildRadius: { value: 0.05 },  // Screen space radius
    lensStrength: { value: 1.0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 }
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 blackHolePosition;
    uniform float schwarzschildRadius;
    uniform float lensStrength;
    uniform vec2 resolution;
    uniform float time;

    varying vec2 vUv;

    // Light bending calculation
    // For a light ray passing at distance b from the black hole center:
    // deflection angle α ≈ 2 * rs / b (in weak field limit)
    // In strong field, light can orbit at r = 1.5 * rs (photon sphere)

    vec2 gravitationalLens(vec2 uv, vec2 center, float rs) {
      vec2 delta = uv - center;

      // Account for aspect ratio
      float aspect = resolution.x / resolution.y;
      delta.x *= aspect;

      float dist = length(delta);

      // Skip if too far (no significant lensing)
      if (dist > rs * 15.0) return uv;

      // Skip if inside event horizon (black)
      if (dist < rs) return center;

      // Normalized direction from black hole to sample point
      vec2 dir = normalize(delta);

      // Calculate deflection using approximate relativistic formula
      // α = 2 * rs / b for weak field, stronger near photon sphere

      float photonSphere = rs * 1.5;
      float deflection;

      if (dist < photonSphere * 1.1) {
        // Strong field - dramatic bending, light spirals
        deflection = rs * 2.0 / dist;
        deflection *= 1.0 + 5.0 * pow(photonSphere / dist, 4.0);
      } else {
        // Weak field approximation
        deflection = rs * 2.0 / dist;
      }

      // Apply deflection - light bends TOWARD the black hole
      // But we're doing inverse mapping, so we sample AWAY from it
      vec2 lensedUv = uv + dir * deflection * lensStrength;

      // Correct for aspect ratio
      lensedUv.x -= dir.x * deflection * lensStrength;
      lensedUv.x += (dir.x / aspect) * deflection * lensStrength;

      return lensedUv;
    }

    void main() {
      vec2 lensedUv = gravitationalLens(vUv, blackHolePosition, schwarzschildRadius);

      // Sample the texture at the lensed position
      vec4 color = texture2D(tDiffuse, lensedUv);

      // Calculate distance for additional effects
      vec2 delta = vUv - blackHolePosition;
      float aspect = resolution.x / resolution.y;
      delta.x *= aspect;
      float dist = length(delta);

      // Event horizon - pure black
      if (dist < schwarzschildRadius) {
        color = vec4(0.0, 0.0, 0.0, 1.0);
      }

      // Photon sphere glow
      float photonSphere = schwarzschildRadius * 1.5;
      if (dist > schwarzschildRadius && dist < photonSphere * 1.2) {
        float glowStrength = smoothstep(photonSphere * 1.2, photonSphere, dist);
        glowStrength *= smoothstep(schwarzschildRadius, photonSphere, dist);

        // Add orange glow at photon sphere
        vec3 glowColor = vec3(1.0, 0.4, 0.1) * glowStrength * 0.5;
        color.rgb += glowColor;
      }

      // Einstein ring effect - brightening at critical angle
      float einsteinRadius = schwarzschildRadius * 2.6;  // Approximate Einstein radius
      float ringWidth = 0.02;
      float ringStrength = smoothstep(ringWidth, 0.0, abs(dist - einsteinRadius));
      color.rgb *= 1.0 + ringStrength * 0.5;

      gl_FragColor = color;
    }
  `
};

/**
 * Gravitational Lens Post-Processing Effect
 */
export class GravitationalLens {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.enabled = true;
    this.blackHoleWorldPosition = new THREE.Vector3(0, 0, 0);

    this.initComposer();
  }

  /**
   * Initialize the effect composer with all passes
   */
  initComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Create composer
    this.composer = new EffectComposer(this.renderer);

    // Render pass - renders the scene
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Gravitational lensing pass
    this.lensPass = new ShaderPass(GravitationalLensingShader);
    this.lensPass.uniforms.resolution.value.set(size.x, size.y);
    this.composer.addPass(this.lensPass);

    // Bloom pass for glow effects
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.5,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  /**
   * Update black hole screen position for the shader
   * @param {THREE.Vector3} worldPosition - Black hole world position
   */
  updateBlackHolePosition(worldPosition = new THREE.Vector3(0, 0, 0)) {
    this.blackHoleWorldPosition.copy(worldPosition);

    // Project to screen space
    const screenPos = worldPosition.clone().project(this.camera);

    // Convert from NDC (-1 to 1) to UV (0 to 1)
    const uv = new THREE.Vector2(
      (screenPos.x + 1) / 2,
      (screenPos.y + 1) / 2
    );

    this.lensPass.uniforms.blackHolePosition.value.copy(uv);

    // Calculate screen-space Schwarzschild radius
    // This depends on camera distance and FOV
    const distance = this.camera.position.length();
    const fov = this.camera.fov * Math.PI / 180;
    const screenHeight = 2 * Math.tan(fov / 2) * distance;
    const rsScreen = 1 / screenHeight;  // rs = 1 in world units

    this.lensPass.uniforms.schwarzschildRadius.value = rsScreen * 0.8;
  }

  /**
   * Set lensing strength
   * @param {number} strength - Lensing strength (0 to 2)
   */
  setStrength(strength) {
    this.lensPass.uniforms.lensStrength.value = strength;
  }

  /**
   * Set bloom parameters
   */
  setBloom(strength, radius, threshold) {
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  /**
   * Handle resize
   */
  onResize(width, height) {
    this.composer.setSize(width, height);
    this.lensPass.uniforms.resolution.value.set(width, height);
  }

  /**
   * Update time for animated effects
   */
  update(time) {
    this.lensPass.uniforms.time.value = time;
    this.updateBlackHolePosition(this.blackHoleWorldPosition);
  }

  /**
   * Render with effects
   */
  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Toggle effect on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.composer.dispose();
  }
}
