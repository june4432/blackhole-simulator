/**
 * Black Hole Raytracer
 *
 * GPU-based raytracing for accurate black hole visualization
 * Traces light paths through Schwarzschild spacetime
 *
 * This creates the "Interstellar" style bent accretion disk effect
 */

import * as THREE from 'three';
import { generateStarTexture } from '../utils/StarTexture.js';

/**
 * Raytraced Black Hole with Accretion Disk
 *
 * Key physics:
 * - Light bends around black hole following null geodesics
 * - Accretion disk appears "wrapped" around the black hole
 * - Multiple images form as light orbits the photon sphere
 * - Doppler beaming and gravitational redshift
 */
export class BlackHoleRaytracer {
  constructor(options = {}) {
    this.rs = options.schwarzschildRadius || 1;
    this.diskInnerRadius = options.diskInnerRadius || this.rs * 3;  // ISCO
    this.diskOuterRadius = options.diskOuterRadius || this.rs * 12;
    this.useRealStars = options.useRealStars !== false;

    this.time = 0;

    // Generate real star texture if enabled
    if (this.useRealStars) {
      console.log('BlackHoleRaytracer: Generating star texture...');
      this.starTexture = generateStarTexture(2048, 1024);
    }

    this.createRaytracedMesh();
  }

  createRaytracedMesh() {
    // Full-screen quad for raytracing
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        cameraPos: { value: new THREE.Vector3(0, 5, 20) },
        cameraTarget: { value: new THREE.Vector3(0, 0, 0) },
        cameraUp: { value: new THREE.Vector3(0, 1, 0) },
        fov: { value: 60.0 },
        rs: { value: this.rs },
        diskInner: { value: this.diskInnerRadius },
        diskOuter: { value: this.diskOuterRadius },
        showDisk: { value: true },
        diskRotation: { value: 0.0 },
        starTexture: { value: this.starTexture || null },
        useRealStars: { value: this.useRealStars }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float time;
        uniform vec2 resolution;
        uniform vec3 cameraPos;
        uniform vec3 cameraTarget;
        uniform vec3 cameraUp;
        uniform float fov;
        uniform float rs;
        uniform float diskInner;
        uniform float diskOuter;
        uniform bool showDisk;
        uniform float diskRotation;
        uniform sampler2D starTexture;
        uniform bool useRealStars;

        varying vec2 vUv;

        #define PI 3.14159265359
        #define TWO_PI 6.28318530718
        #define MAX_STEPS 300
        #define STEP_SIZE 0.12

        // Pseudo-random for star background
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Procedural star field
        vec3 starFieldProcedural(vec3 dir, vec2 uv) {
          vec3 stars = vec3(0.0);

          for (float i = 1.0; i <= 3.0; i++) {
            vec2 starUv = uv * (100.0 * i);
            vec2 starId = floor(starUv);
            vec2 starPos = fract(starUv) - 0.5;

            float starRand = hash(starId);
            float starSize = 0.03 / i;

            if (starRand > 0.97) {
              float dist = length(starPos);
              float brightness = smoothstep(starSize, 0.0, dist);
              brightness *= 0.5 + 0.5 * sin(time * 2.0 + starRand * 100.0);

              vec3 starColor = mix(
                vec3(1.0, 0.8, 0.6),  // Warm
                vec3(0.8, 0.9, 1.0),  // Cool
                starRand
              );

              stars += starColor * brightness * (0.5 + starRand);
            }
          }

          // Add milky way band
          float milkyway = smoothstep(0.3, 0.0, abs(dir.y));
          milkyway *= 0.1 * hash(uv * 50.0);
          stars += vec3(0.6, 0.7, 1.0) * milkyway;

          return stars;
        }

        // Star field background (supports real or procedural)
        vec3 starField(vec3 dir) {
          float theta = atan(dir.z, dir.x);
          float phi = asin(clamp(dir.y, -1.0, 1.0));
          vec2 uv = vec2(theta / TWO_PI + 0.5, phi / PI + 0.5);

          if (useRealStars) {
            // Sample from precomputed star texture
            vec3 texColor = texture2D(starTexture, uv).rgb;

            // Add subtle twinkling to bright stars
            float brightness = max(texColor.r, max(texColor.g, texColor.b));
            float twinkle = 0.85 + 0.15 * sin(time * 2.0 + theta * 10.0 + phi * 5.0);
            texColor *= (brightness > 0.3) ? twinkle : 1.0;

            // Add milky way
            float milkyway = smoothstep(0.3, 0.0, abs(dir.y));
            milkyway *= 0.08 * hash(uv * 50.0);
            texColor += vec3(0.6, 0.7, 1.0) * milkyway;

            return texColor;
          } else {
            return starFieldProcedural(dir, uv);
          }
        }

        // Accretion disk color based on radius and angle
        // Interstellar-style: hot white-yellow inner, orange-red outer (blackbody radiation)
        vec3 diskColor(float r, float angle, vec3 viewDir) {
          // Temperature decreases with radius (T ∝ r^(-3/4))
          float temp = pow((diskInner / r), 0.75);

          // Interstellar-style blackbody color palette
          vec3 hotColor = vec3(1.0, 0.95, 0.85);   // Bright white-yellow (innermost, ~10000K)
          vec3 warmColor = vec3(1.0, 0.75, 0.35);  // Golden yellow-orange (~5000K)
          vec3 coolColor = vec3(1.0, 0.45, 0.15);  // Deep orange-red (outer, ~3000K)

          vec3 baseColor;
          if (temp > 0.6) {
            baseColor = mix(warmColor, hotColor, (temp - 0.6) / 0.4);
          } else {
            baseColor = mix(coolColor, warmColor, temp / 0.6);
          }

          // Orbital velocity for Doppler effect
          // v = sqrt(rs / (2r - 3rs)) for circular orbit
          float v = sqrt(rs / max(0.001, 2.0 * r - 3.0 * rs));
          v = min(v, 0.9);  // Cap at 0.9c

          // Velocity direction (tangential, counterclockwise when viewed from above)
          vec3 velocityDir = vec3(-sin(angle), 0.0, cos(angle));

          // Doppler factor
          float doppler = dot(velocityDir, viewDir) * v;

          // Relativistic Doppler beaming
          float gamma = 1.0 / sqrt(1.0 - v * v);
          float dopplerFactor = gamma * (1.0 - doppler);
          float beaming = 1.0 / (dopplerFactor * dopplerFactor * dopplerFactor);
          beaming = clamp(beaming, 0.1, 5.0);

          // Gravitational redshift
          float gravRedshift = sqrt(1.0 - rs / r);

          // Apply Doppler color shift (enhances the warm palette)
          if (doppler > 0.0) {
            // Blueshifted (approaching) - brighter yellow-white
            baseColor = mix(baseColor, vec3(1.0, 0.95, 0.7), doppler * 0.3);
          } else {
            // Redshifted (receding) - deeper orange-red
            baseColor = mix(baseColor, vec3(1.0, 0.35, 0.1), -doppler * 0.4);
          }

          // Turbulence/noise
          float noise = 0.85 + 0.3 * hash(vec2(r * 10.0, angle * 5.0 + time * 0.5));

          return baseColor * temp * beaming * gravRedshift * noise * 2.0;
        }

        // Check if ray intersects the disk plane (y = 0)
        // Returns: x = intersection distance, y = 1 if hit disk ring, z = radius at intersection
        vec3 intersectDisk(vec3 ro, vec3 rd, float prevY) {
          // Ray-plane intersection at y = 0
          if (abs(rd.y) < 0.0001) return vec3(-1.0);

          float t = -ro.y / rd.y;
          if (t < 0.0) return vec3(-1.0);

          vec3 hitPos = ro + rd * t;
          float r = length(hitPos.xz);

          // Check if crossing plane (sign change in y)
          float newY = ro.y + rd.y * STEP_SIZE;
          bool crossing = (prevY * newY < 0.0) || (abs(ro.y) < 0.1 && abs(rd.y) > 0.01);

          if (r >= diskInner && r <= diskOuter && crossing) {
            return vec3(t, 1.0, r);
          }

          return vec3(t, 0.0, r);
        }

        // Raytrace through Schwarzschild spacetime
        // Key: Allow multiple disk intersections for proper gravitational lensing
        vec4 raytrace(vec3 ro, vec3 rd) {
          vec3 pos = ro;
          vec3 dir = normalize(rd);
          vec3 color = vec3(0.0);
          float alpha = 0.0;

          float prevY = pos.y;
          int diskHits = 0;
          float lastDiskHitR = 0.0;  // Track last hit to avoid double counting

          for (int i = 0; i < MAX_STEPS; i++) {
            float r = length(pos);

            // Check event horizon
            if (r < rs * 1.01) {
              // Fell into black hole - show black
              return vec4(color, 1.0);
            }

            // Check disk intersection - ALLOW MULTIPLE HITS for lensing effect
            if (showDisk) {
              float newY = pos.y + dir.y * STEP_SIZE;

              // Check if we crossed the disk plane (y changes sign)
              if (prevY * newY <= 0.0 || (abs(pos.y) < 0.05 && abs(dir.y) > 0.01)) {
                // Find exact intersection point
                float t = -pos.y / max(abs(dir.y), 0.001);
                if (dir.y < 0.0) t = -t;
                t = max(0.0, t);

                vec3 diskHit = pos + dir * t;
                float diskR = length(diskHit.xz);

                // Avoid hitting same spot twice (need minimum movement)
                bool validHit = diskR >= diskInner && diskR <= diskOuter;
                bool differentLocation = abs(diskR - lastDiskHitR) > 0.5 || diskHits == 0;

                if (validHit && differentLocation) {
                  float angle = atan(diskHit.z, diskHit.x) + diskRotation;
                  vec3 diskCol = diskColor(diskR, angle, dir);

                  // Multiple images get progressively dimmer
                  // Primary (front): 100%, Secondary (wrapped over top): ~30%, Tertiary: ~10%
                  float brightness = 1.0 / pow(3.0, float(diskHits));

                  // Einstein ring enhancement: brighter near photon sphere
                  float photonSphereProximity = smoothstep(rs * 2.0, rs * 1.5, r);
                  brightness *= (1.0 + photonSphereProximity * 0.5);

                  color += diskCol * brightness;
                  alpha = min(alpha + brightness * 0.7, 1.0);

                  lastDiskHitR = diskR;
                  diskHits++;

                  // Stop after 3 disk hits (primary, secondary, tertiary images)
                  if (diskHits >= 3) {
                    break;
                  }
                }
              }
              prevY = newY;
            }

            // Check escape
            if (r > 50.0) {
              // Escaped - sample star field
              vec3 stars = starField(normalize(dir));
              color += stars * (1.0 - alpha);
              alpha = 1.0;
              break;
            }

            // Gravitational light bending
            // The key equation: a = -1.5 * rs / r^3 * pos
            // This causes light to curve around the black hole
            float r3 = r * r * r;
            vec3 accel = -1.5 * rs / r3 * pos;

            // Adaptive step size - SMALLER near black hole for accuracy
            float stepSize = STEP_SIZE;
            if (r < rs * 3.0) {
              stepSize *= 0.25;  // Very fine steps near photon sphere
            } else if (r < rs * 6.0) {
              stepSize *= 0.5;
            } else {
              stepSize *= (0.5 + r / 10.0);
            }
            stepSize = clamp(stepSize, 0.02, 0.4);

            // Update position and direction (Euler integration)
            pos += dir * stepSize;
            dir += accel * stepSize;
            dir = normalize(dir);
          }

          // If we didn't escape, show stars anyway (max iterations reached)
          if (alpha < 1.0) {
            vec3 stars = starField(normalize(dir));
            color += stars * (1.0 - alpha);
          }

          return vec4(color, 1.0);
        }

        void main() {
          // Setup camera
          vec3 forward = normalize(cameraTarget - cameraPos);
          vec3 right = normalize(cross(forward, cameraUp));
          vec3 up = cross(right, forward);

          // Calculate ray direction for this pixel
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= resolution.x / resolution.y;

          float fovRad = fov * PI / 180.0;
          float scale = tan(fovRad * 0.5);

          vec3 rd = normalize(forward + right * uv.x * scale + up * uv.y * scale);

          // Raytrace!
          vec4 color = raytrace(cameraPos, rd);

          // Tone mapping
          color.rgb = color.rgb / (color.rgb + vec3(1.0));

          // Gamma correction
          color.rgb = pow(color.rgb, vec3(1.0 / 2.2));

          gl_FragColor = color;
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;

    // Create a separate scene and camera for the raytraced quad
    this.rtScene = new THREE.Scene();
    this.rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rtScene.add(this.mesh);
  }

  /**
   * Update uniforms from the main camera
   */
  update(camera, deltaTime) {
    this.time += deltaTime;

    const uniforms = this.mesh.material.uniforms;
    uniforms.time.value = this.time;
    uniforms.cameraPos.value.copy(camera.position);

    // Get camera target (where it's looking)
    const target = new THREE.Vector3(0, 0, -1);
    target.applyQuaternion(camera.quaternion);
    target.add(camera.position);
    uniforms.cameraTarget.value.set(0, 0, 0);  // Always look at origin (black hole)

    uniforms.cameraUp.value.copy(camera.up);
    uniforms.fov.value = camera.fov;

    // Rotate the disk
    uniforms.diskRotation.value = this.time * 0.2;
  }

  /**
   * Render the raytraced black hole
   */
  render(renderer) {
    renderer.render(this.rtScene, this.rtCamera);
  }

  /**
   * Handle resize
   */
  onResize(width, height) {
    this.mesh.material.uniforms.resolution.value.set(width, height);
  }

  /**
   * Toggle disk visibility
   */
  toggleDisk() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.showDisk.value = !uniforms.showDisk.value;
    return uniforms.showDisk.value;
  }

  /**
   * Set Schwarzschild radius
   */
  setSchwarzschildRadius(rs) {
    this.rs = rs;
    this.mesh.material.uniforms.rs.value = rs;
    this.mesh.material.uniforms.diskInner.value = rs * 3;
    this.mesh.material.uniforms.diskOuter.value = rs * 12;
  }

  /**
   * Get mesh for adding to scene
   */
  getObject() {
    return this.mesh;
  }

  /**
   * Dispose
   */
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
