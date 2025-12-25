/**
 * Kerr Black Hole Raytracer
 *
 * GPU-based raytracing for rotating (Kerr) black hole visualization.
 *
 * Key differences from Schwarzschild:
 * - Frame dragging: spacetime is dragged in rotation direction
 * - Ergosphere: region where nothing can remain stationary
 * - Asymmetric lensing: prograde vs retrograde light paths differ
 * - Disk appears brighter on approaching side (stronger Doppler + frame drag)
 *
 * Uses Boyer-Lindquist coordinates and integrates null geodesics.
 */

import * as THREE from 'three';
import {
  outerHorizon,
  staticLimit,
  kerrISCO,
  kerrPhotonSphere,
  KERR_CONSTANTS
} from '../physics/kerr.js';
import { generateStarTexture } from '../utils/StarTexture.js';

export class KerrRaytracer {
  constructor(options = {}) {
    this.rs = options.schwarzschildRadius || 1;
    this.spin = options.spin || 0.5;  // Spin parameter (0 to ~0.998)
    this.diskInnerRadius = options.diskInnerRadius || this.rs * kerrISCO(this.spin);
    this.diskOuterRadius = options.diskOuterRadius || this.rs * 12;
    this.useRealStars = options.useRealStars !== false;

    this.time = 0;

    // Generate real star texture if enabled
    if (this.useRealStars) {
      console.log('KerrRaytracer: Generating star texture...');
      this.starTexture = generateStarTexture(2048, 1024);
    }

    this.createRaytracedMesh();
  }

  createRaytracedMesh() {
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
        spin: { value: this.spin },
        diskInner: { value: this.diskInnerRadius },
        diskOuter: { value: this.diskOuterRadius },
        showDisk: { value: true },
        diskRotation: { value: 0.0 },
        showErgosphere: { value: true },
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
      fragmentShader: this.getFragmentShader(),
      depthTest: false,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;

    this.rtScene = new THREE.Scene();
    this.rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rtScene.add(this.mesh);
  }

  getFragmentShader() {
    return `
      precision highp float;

      uniform float time;
      uniform vec2 resolution;
      uniform vec3 cameraPos;
      uniform vec3 cameraTarget;
      uniform vec3 cameraUp;
      uniform float fov;
      uniform float rs;
      uniform float spin;  // Kerr spin parameter a
      uniform float diskInner;
      uniform float diskOuter;
      uniform bool showDisk;
      uniform float diskRotation;
      uniform bool showErgosphere;
      uniform sampler2D starTexture;
      uniform bool useRealStars;

      varying vec2 vUv;

      #define PI 3.14159265359
      #define TWO_PI 6.28318530718
      #define MAX_STEPS 250
      #define STEP_SIZE 0.1

      // ============================================
      // Kerr metric functions
      // ============================================

      // Σ = r² + a²cos²θ
      float kerrSigma(float r, float theta, float a) {
        float cosTheta = cos(theta);
        return r * r + a * a * cosTheta * cosTheta;
      }

      // Δ = r² - r + a² (in rs=1 units)
      float kerrDelta(float r, float a) {
        return r * r - r + a * a;
      }

      // Outer event horizon: r+ = (1 + √(1-4a²))/2
      float outerHorizon(float a) {
        float disc = 1.0 - 4.0 * a * a;
        if (disc < 0.0) return 0.0;
        return 0.5 * (1.0 + sqrt(disc));
      }

      // Static limit (ergosphere boundary)
      float staticLimit(float theta, float a) {
        float cosTheta = cos(theta);
        float cos2 = cosTheta * cosTheta;
        float disc = 1.0 - 4.0 * a * a * cos2;
        if (disc < 0.0) return 0.0;
        return 0.5 * (1.0 + sqrt(disc));
      }

      // Frame dragging angular velocity
      float frameDraggingOmega(float r, float theta, float a) {
        if (abs(a) < 0.001) return 0.0;

        float sinTheta = sin(theta);
        float sin2 = sinTheta * sinTheta;
        float r2 = r * r;
        float a2 = a * a;
        float del = kerrDelta(r, a);

        float r2pa2 = r2 + a2;
        float denom = r2pa2 * r2pa2 - a2 * del * sin2;

        if (denom < 0.001) return 0.0;
        return a * r / denom;
      }

      // ============================================
      // Utility functions
      // ============================================

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Convert Cartesian to spherical (r, θ, φ)
      vec3 cartesianToSpherical(vec3 p) {
        float r = length(p);
        float theta = acos(clamp(p.y / max(r, 0.001), -1.0, 1.0));
        float phi = atan(p.z, p.x);
        return vec3(r, theta, phi);
      }

      // ============================================
      // Star field
      // ============================================

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
              vec3(1.0, 0.8, 0.6),
              vec3(0.8, 0.9, 1.0),
              starRand
            );

            stars += starColor * brightness * (0.5 + starRand);
          }
        }

        float milkyway = smoothstep(0.3, 0.0, abs(dir.y));
        milkyway *= 0.1 * hash(uv * 50.0);
        stars += vec3(0.6, 0.7, 1.0) * milkyway;

        return stars;
      }

      vec3 starField(vec3 dir) {
        float theta = atan(dir.z, dir.x);
        float phi = asin(clamp(dir.y, -1.0, 1.0));
        vec2 uv = vec2(theta / TWO_PI + 0.5, phi / PI + 0.5);

        if (useRealStars) {
          // Sample from precomputed star texture
          vec3 texColor = texture2D(starTexture, uv).rgb;

          // Twinkling for bright stars
          float brightness = max(texColor.r, max(texColor.g, texColor.b));
          float twinkle = 0.85 + 0.15 * sin(time * 2.0 + theta * 10.0 + phi * 5.0);
          texColor *= (brightness > 0.3) ? twinkle : 1.0;

          // Milky way
          float milkyway = smoothstep(0.3, 0.0, abs(dir.y));
          milkyway *= 0.08 * hash(uv * 50.0);
          texColor += vec3(0.6, 0.7, 1.0) * milkyway;

          return texColor;
        } else {
          return starFieldProcedural(dir, uv);
        }
      }

      // ============================================
      // Accretion disk for Kerr (star-like colors)
      // ============================================

      vec3 kerrDiskColor(float r, float angle, vec3 viewDir, float a) {
        // Temperature profile
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

        // Orbital velocity in Kerr (prograde orbit)
        // v = (r² - 2r + a√r) / (r(r - 1.5) + a√r) approximately
        float sqrtR = sqrt(max(r, 0.1));
        float vNum = 1.0 / (sqrtR + a);
        float v = min(vNum, 0.95);

        // Frame dragging adds to apparent velocity
        float omega = frameDraggingOmega(r, PI * 0.5, a);
        float frameDragContribution = omega * r;

        // Velocity direction (counterclockwise in equatorial plane)
        vec3 velocityDir = vec3(-sin(angle), 0.0, cos(angle));

        // Total effective velocity including frame dragging
        float effectiveV = v + frameDragContribution * 0.3;
        effectiveV = clamp(effectiveV, 0.0, 0.95);

        float doppler = dot(velocityDir, viewDir) * effectiveV;

        // Relativistic beaming (enhanced for Kerr)
        float gamma = 1.0 / sqrt(max(0.01, 1.0 - effectiveV * effectiveV));
        float dopplerFactor = gamma * (1.0 - doppler);
        float beaming = 1.0 / (dopplerFactor * dopplerFactor * dopplerFactor);
        beaming = clamp(beaming, 0.05, 8.0);  // Stronger beaming for Kerr

        // Gravitational redshift (modified for Kerr)
        float del = kerrDelta(r, a);
        float sig = kerrSigma(r, PI * 0.5, a);
        float gravRedshift = sqrt(max(0.01, del / sig));

        // Doppler color shift (enhances the warm palette)
        if (doppler > 0.0) {
          // Blueshifted (approaching) - brighter yellow-white
          baseColor = mix(baseColor, vec3(1.0, 0.95, 0.7), doppler * 0.3);
        } else {
          // Redshifted (receding) - deeper orange-red
          baseColor = mix(baseColor, vec3(1.0, 0.35, 0.1), -doppler * 0.4);
        }

        // Turbulence
        float noise = 0.7 + 0.5 * hash(vec2(r * 10.0, angle * 5.0 + time * 0.3));

        // Spiral arm structure (more pronounced for Kerr)
        float spiral = 0.8 + 0.4 * sin(angle * 3.0 + log(r) * 5.0 - time * 2.0);

        return baseColor * temp * beaming * gravRedshift * noise * spiral * 2.5;
      }

      // ============================================
      // Kerr geodesic ray tracing
      // ============================================

      // Gravitational acceleration for Kerr null geodesics (approximate)
      vec3 kerrAcceleration(vec3 pos, vec3 dir, float a) {
        float r = length(pos);
        vec3 spherical = cartesianToSpherical(pos);
        float theta = spherical.y;

        // Schwarzschild-like radial acceleration
        float r3 = r * r * r;
        vec3 radialAccel = -1.5 * rs / r3 * pos;

        // Frame dragging contribution (simplified)
        // Adds tangential acceleration in φ direction
        if (abs(a) > 0.001) {
          float omega = frameDraggingOmega(r, theta, a);

          // Frame drag pulls light in rotation direction
          vec3 rotationAxis = vec3(0.0, 1.0, 0.0);
          vec3 tangent = normalize(cross(rotationAxis, pos));

          // Strength depends on proximity and spin
          float dragStrength = omega * 2.0 * rs / r;
          vec3 dragAccel = tangent * dragStrength;

          // Additional term for Kerr: modified radial force
          float kerrCorrection = a * a / (r * r) * 0.5;

          radialAccel *= (1.0 + kerrCorrection);
          radialAccel += dragAccel;
        }

        return radialAccel;
      }

      // ============================================
      // Main ray tracing
      // ============================================

      vec4 traceKerrRay(vec3 ro, vec3 rd) {
        vec3 color = vec3(0.0);
        float alpha = 0.0;

        vec3 pos = ro;
        vec3 dir = normalize(rd);
        float a = spin;

        float prevY = pos.y;
        int numImages = 0;

        // Horizon radius for this spin
        float rHorizon = outerHorizon(a);

        for (int i = 0; i < MAX_STEPS; i++) {
          vec3 spherical = cartesianToSpherical(pos);
          float r = spherical.x;
          float theta = spherical.y;

          // Check event horizon
          if (r < rHorizon * 1.02) {
            // Fell into black hole
            // Add subtle glow at horizon for Kerr
            float horizonGlow = smoothstep(rHorizon * 1.5, rHorizon, r);
            color += vec3(0.1, 0.05, 0.15) * horizonGlow * 0.5;
            return vec4(color, 1.0);
          }

          // Check ergosphere for visual effect
          if (showErgosphere) {
            float rStatic = staticLimit(theta, a);
            if (r < rStatic && r > rHorizon * 1.1) {
              // Inside ergosphere - add subtle purple tint
              float ergoFactor = smoothstep(rStatic, rHorizon * 1.1, r);
              color += vec3(0.05, 0.02, 0.1) * (1.0 - ergoFactor) * 0.1;
            }
          }

          // Check disk intersection
          if (showDisk) {
            float newY = pos.y + dir.y * STEP_SIZE;

            if (prevY * newY <= 0.0) {
              float t = -pos.y / dir.y;
              vec3 diskHit = pos + dir * t;
              float diskR = length(diskHit.xz);

              if (diskR >= diskInner && diskR <= diskOuter) {
                float angle = atan(diskHit.z, diskHit.x) + diskRotation;
                vec3 diskCol = kerrDiskColor(diskR, angle, dir, a);

                float imageFactor = 1.0 / pow(3.0, float(numImages));
                color += diskCol * imageFactor;
                numImages++;

                if (numImages >= 3) {
                  alpha = 1.0;
                  break;
                }
              }
            }
            prevY = newY;
          }

          // Check escape
          if (r > 50.0) {
            vec3 stars = starField(normalize(dir));
            color += stars * (1.0 - alpha);
            alpha = 1.0;
            break;
          }

          // Kerr geodesic integration
          vec3 accel = kerrAcceleration(pos, dir, a);

          // Adaptive step size
          float adaptiveStep = STEP_SIZE;
          if (r < rHorizon * 3.0) {
            adaptiveStep *= 0.3;
          } else if (r < rHorizon * 6.0) {
            adaptiveStep *= 0.5;
          } else {
            adaptiveStep *= (0.5 + r / 15.0);
          }
          adaptiveStep = clamp(adaptiveStep, 0.02, 0.4);

          pos += dir * adaptiveStep;
          dir += accel * adaptiveStep;
          dir = normalize(dir);
        }

        if (alpha < 1.0) {
          vec3 stars = starField(normalize(dir));
          color += stars * (1.0 - alpha);
        }

        return vec4(color, 1.0);
      }

      void main() {
        vec3 forward = normalize(cameraTarget - cameraPos);
        vec3 right = normalize(cross(forward, cameraUp));
        vec3 up = cross(right, forward);

        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= resolution.x / resolution.y;

        float fovRad = fov * PI / 180.0;
        float scale = tan(fovRad * 0.5);

        vec3 rd = normalize(forward + right * uv.x * scale + up * uv.y * scale);

        vec4 color = traceKerrRay(cameraPos, rd);

        // Tone mapping
        color.rgb = color.rgb / (color.rgb + vec3(1.0));

        // Gamma correction
        color.rgb = pow(color.rgb, vec3(1.0 / 2.2));

        gl_FragColor = color;
      }
    `;
  }

  update(camera, deltaTime) {
    this.time += deltaTime;

    const uniforms = this.mesh.material.uniforms;
    uniforms.time.value = this.time;
    uniforms.cameraPos.value.copy(camera.position);
    uniforms.cameraTarget.value.set(0, 0, 0);
    uniforms.cameraUp.value.copy(camera.up);
    uniforms.fov.value = camera.fov;

    // Disk rotates faster for Kerr (frame dragging)
    uniforms.diskRotation.value = this.time * 0.3;
  }

  render(renderer) {
    renderer.render(this.rtScene, this.rtCamera);
  }

  onResize(width, height) {
    this.mesh.material.uniforms.resolution.value.set(width, height);
  }

  setSpin(spin) {
    this.spin = Math.min(spin, KERR_CONSTANTS.MAX_SPIN);
    this.mesh.material.uniforms.spin.value = this.spin;

    // Update ISCO-based disk inner radius
    this.diskInnerRadius = this.rs * kerrISCO(this.spin);
    this.mesh.material.uniforms.diskInner.value = this.diskInnerRadius;

    console.log(`Kerr spin set to ${this.spin}, ISCO at ${this.diskInnerRadius.toFixed(2)} rs`);
  }

  toggleDisk() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.showDisk.value = !uniforms.showDisk.value;
    return uniforms.showDisk.value;
  }

  toggleErgosphere() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.showErgosphere.value = !uniforms.showErgosphere.value;
    return uniforms.showErgosphere.value;
  }

  setSchwarzschildRadius(rs) {
    this.rs = rs;
    this.mesh.material.uniforms.rs.value = rs;
    this.diskInnerRadius = rs * kerrISCO(this.spin);
    this.mesh.material.uniforms.diskInner.value = this.diskInnerRadius;
    this.mesh.material.uniforms.diskOuter.value = rs * 12;
  }

  getObject() {
    return this.mesh;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
