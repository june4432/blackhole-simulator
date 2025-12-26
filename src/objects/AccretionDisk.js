/**
 * Accretion Disk Visualization
 *
 * Creates a realistic accretion disk with:
 * - Keplerian orbital velocities with relativistic corrections
 * - Doppler beaming (approaching = blue, receding = red)
 * - Gravitational redshift
 * - Temperature gradient (hotter near ISCO)
 */

import * as THREE from 'three';
import { ISCO, PHOTON_SPHERE, circularOrbitVelocity } from '../physics/constants.js';

export class AccretionDisk {
  constructor(options = {}) {
    this.rs = options.schwarzschildRadius || 1;
    this.innerRadius = this.rs * ISCO;  // Disk starts at ISCO
    this.outerRadius = options.outerRadius || this.rs * 15;
    this.thickness = options.thickness || 0.1;
    this.segments = options.segments || 128;
    this.rings = options.rings || 64;

    this.group = new THREE.Group();
    this.time = 0;

    this.createDisk();
    this.createGlow();
  }

  /**
   * Create the main accretion disk geometry with custom shader
   */
  createDisk() {
    // Create disk geometry (flat ring)
    const geometry = new THREE.RingGeometry(
      this.innerRadius,
      this.outerRadius,
      this.segments,
      this.rings
    );

    // Custom shader material for realistic accretion disk
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        rs: { value: this.rs },
        innerRadius: { value: this.innerRadius },
        outerRadius: { value: this.outerRadius },
        viewPosition: { value: new THREE.Vector3() },
        diskRotation: { value: 0 }
      },
      vertexShader: `
        uniform float time;
        uniform float rs;
        uniform float innerRadius;
        uniform float outerRadius;
        uniform float diskRotation;

        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying float vRadius;
        varying float vOrbitalVelocity;
        varying float vTemperature;

        void main() {
          vUv = uv;
          vPosition = position;

          // Calculate radius from center
          vRadius = length(position.xy);

          // Keplerian orbital velocity (with relativistic correction)
          // v = sqrt(rs / (2r - 3rs)) for r > 1.5rs
          float r_over_rs = vRadius / rs;
          if (r_over_rs > 1.5) {
            vOrbitalVelocity = sqrt(1.0 / (2.0 * r_over_rs - 3.0));
          } else {
            vOrbitalVelocity = 1.0;
          }

          // Temperature (hotter near inner edge, using simple T ∝ r^(-3/4) model)
          float normalizedR = (vRadius - innerRadius) / (outerRadius - innerRadius);
          vTemperature = pow(1.0 - normalizedR, 0.75);

          // Apply orbital motion - particles orbit at different speeds
          float angle = atan(position.y, position.x);
          float orbitalPeriod = 2.0 * 3.14159 * vRadius / (vOrbitalVelocity * 0.5);
          float newAngle = angle + time / orbitalPeriod + diskRotation;

          vec3 rotatedPos = vec3(
            vRadius * cos(newAngle),
            vRadius * sin(newAngle),
            position.z
          );

          vWorldPosition = (modelMatrix * vec4(rotatedPos, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(rotatedPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float rs;
        uniform float innerRadius;
        uniform float outerRadius;
        uniform vec3 viewPosition;

        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying float vRadius;
        varying float vOrbitalVelocity;
        varying float vTemperature;

        // Color temperature to RGB - Realistic accretion disk colors
        // Based on blackbody radiation and Interstellar-style visualization
        vec3 temperatureToColor(float t) {
          // t is normalized 0-1 (1 = hottest near ISCO)
          // Real accretion disks: innermost is ~10^7K (blue-white), outer ~10^4K (red-orange)
          
          vec3 innerHot = vec3(1.0, 1.0, 1.0);      // Brilliant white (hottest core)
          vec3 hot = vec3(0.95, 0.9, 1.0);          // Blue-white  
          vec3 warm = vec3(1.0, 0.7, 0.3);          // Golden orange
          vec3 cool = vec3(0.9, 0.3, 0.05);         // Deep red-orange
          vec3 outer = vec3(0.5, 0.1, 0.02);        // Dark red (cooler outer edge)
          
          if (t > 0.85) {
            // Innermost region - brilliant white core
            return mix(hot, innerHot, (t - 0.85) / 0.15);
          } else if (t > 0.5) {
            // Hot region - blue-white to golden
            return mix(warm, hot, (t - 0.5) / 0.35);
          } else if (t > 0.2) {
            // Warm region - golden to red-orange  
            return mix(cool, warm, (t - 0.2) / 0.3);
          } else {
            // Outer cool region
            return mix(outer, cool, t / 0.2);
          }
        }

        void main() {
          // View direction for Doppler effect
          vec3 viewDir = normalize(viewPosition - vWorldPosition);

          // Velocity direction (tangential to orbit)
          float angle = atan(vWorldPosition.y, vWorldPosition.x);
          vec3 velocityDir = vec3(-sin(angle), cos(angle), 0.0);

          // Doppler shift: approaching = blue, receding = red
          float doppler = dot(velocityDir, viewDir) * vOrbitalVelocity;

          // Gravitational redshift
          float r_over_rs = vRadius / rs;
          float gravRedshift = 1.0 / sqrt(max(0.001, 1.0 - 1.0 / r_over_rs)) - 1.0;

          // Combined redshift (negative doppler means approaching = blueshift)
          float totalShift = gravRedshift - doppler * 0.5;

          // Base color from temperature
          vec3 baseColor = temperatureToColor(vTemperature);

          // Apply Doppler color shift
          if (totalShift < 0.0) {
            // Blueshift - approaching side glows blue-white
            baseColor = mix(baseColor, vec3(0.7, 0.85, 1.0), min(1.0, -totalShift * 0.6));
          } else {
            // Redshift - receding side shifts to deep orange-red
            baseColor = mix(baseColor, vec3(1.0, 0.35, 0.05), min(1.0, totalShift * 0.4));
          }

          // Doppler beaming (approaching side is brighter)
          float beaming = 1.0 + doppler * 2.0;
          beaming = max(0.2, beaming);

          // Intensity based on temperature and beaming
          float intensity = vTemperature * beaming;

          // Gravitational dimming near event horizon
          float gravDim = sqrt(max(0.0, 1.0 - rs / vRadius));
          intensity *= gravDim;

          // Add some turbulence/noise
          float noise = fract(sin(dot(vWorldPosition.xy + time * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
          intensity *= 0.9 + noise * 0.2;

          // Edge fade
          float normalizedR = (vRadius - innerRadius) / (outerRadius - innerRadius);
          float edgeFade = smoothstep(0.0, 0.1, normalizedR) * smoothstep(1.0, 0.9, normalizedR);

          // Boost brightness for dramatic effect
          vec3 finalColor = baseColor * intensity * 2.0;
          
          // Add subtle bloom effect on hottest parts
          float bloom = pow(vTemperature, 3.0) * 0.3;
          finalColor += vec3(1.0, 0.9, 0.8) * bloom;

          gl_FragColor = vec4(finalColor, edgeFade * 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.disk = new THREE.Mesh(geometry, material);
    this.disk.rotation.x = -Math.PI / 2;  // Lay flat in XZ plane
    this.group.add(this.disk);
  }

  /**
   * Create outer glow effect
   */
  createGlow() {
    const geometry = new THREE.RingGeometry(
      this.innerRadius * 0.9,
      this.outerRadius * 1.2,
      64,
      1
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        innerRadius: { value: this.innerRadius },
        outerRadius: { value: this.outerRadius },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        void main() {
          vUv = uv;
          vRadius = length(position.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float innerRadius;
        uniform float outerRadius;
        uniform float time;
        varying vec2 vUv;
        varying float vRadius;

        void main() {
          float normalizedR = (vRadius - innerRadius * 0.9) / (outerRadius * 1.2 - innerRadius * 0.9);

          // Soft glow that fades at edges
          float glow = 1.0 - abs(normalizedR - 0.5) * 2.0;
          glow = pow(glow, 3.0);

          // Warmer golden glow with gradient
          vec3 innerGlow = vec3(1.0, 0.8, 0.5);   // Golden center
          vec3 outerGlow = vec3(1.0, 0.4, 0.1);   // Orange-red edge
          vec3 color = mix(outerGlow, innerGlow, 1.0 - normalizedR) * glow * 0.4;

          gl_FragColor = vec4(color, glow * 0.35);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.glow = new THREE.Mesh(geometry, material);
    this.glow.rotation.x = -Math.PI / 2;
    this.group.add(this.glow);
  }

  /**
   * Update the disk animation and shader uniforms
   * @param {number} deltaTime - Time since last update
   * @param {THREE.Camera} camera - Camera for view-dependent effects
   */
  update(deltaTime, camera) {
    this.time += deltaTime * 0.5;  // Slow down for visual effect

    if (this.disk.material.uniforms) {
      this.disk.material.uniforms.time.value = this.time;
      this.disk.material.uniforms.viewPosition.value.copy(camera.position);
    }

    if (this.glow.material.uniforms) {
      this.glow.material.uniforms.time.value = this.time;
    }
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    this.group.visible = visible;
  }

  /**
   * Toggle visibility
   */
  toggle() {
    this.group.visible = !this.group.visible;
    return this.group.visible;
  }

  /**
   * Update when Schwarzschild radius changes
   */
  setSchwarzschildRadius(newRs) {
    const scale = newRs / this.rs;
    this.rs = newRs;
    this.innerRadius = newRs * ISCO;
    this.outerRadius *= scale;

    // Recreate disk with new dimensions
    this.group.remove(this.disk);
    this.group.remove(this.glow);
    this.disk.geometry.dispose();
    this.disk.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();

    this.createDisk();
    this.createGlow();
  }

  /**
   * Get the Three.js group
   */
  getObject() {
    return this.group;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.disk.geometry.dispose();
    this.disk.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
  }
}
