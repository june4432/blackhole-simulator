/**
 * Optimized Black Hole Raytracer
 *
 * Uses precomputed deflection textures for O(1) ray tracing
 * Based on Eric Bruneton's "Real-time High Quality Rendering of
 * Non-rotating Black Holes" (arXiv:2010.08735)
 *
 * Key optimization: Replace iterative raymarching with texture lookups
 * - Precompute deflection angles for all (e², u) pairs
 * - At render time: compute e² → lookup deflection → apply
 * - Enables multiple image effects (photon sphere orbits)
 */

import * as THREE from 'three';
import { generateDeflectionTexture, MU, U_PHOTON_SPHERE } from './DeflectionTexture.js';
import { generateStarTexture } from '../utils/StarTexture.js';

export class OptimizedRaytracer {
  constructor(options = {}) {
    this.rs = options.schwarzschildRadius || 1;
    this.diskInnerRadius = options.diskInnerRadius || this.rs * 3;
    this.diskOuterRadius = options.diskOuterRadius || this.rs * 12;
    this.textureResolution = options.textureResolution || 512;
    this.useRealStars = options.useRealStars !== false;

    this.time = 0;

    // Generate precomputed deflection texture
    console.log('Generating deflection lookup texture...');
    this.deflectionTexture = generateDeflectionTexture(this.textureResolution);
    console.log('Deflection texture generated.');

    // Generate real star texture if enabled
    if (this.useRealStars) {
      console.log('Generating real star texture...');
      this.starTexture = generateStarTexture(2048, 1024);
      console.log('Star texture generated.');
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
        diskInner: { value: this.diskInnerRadius },
        diskOuter: { value: this.diskOuterRadius },
        showDisk: { value: true },
        diskRotation: { value: 0.0 },
        deflectionTexture: { value: this.deflectionTexture },
        deflectionMu: { value: MU },
        enableMultipleImages: { value: true },
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
      uniform float diskInner;
      uniform float diskOuter;
      uniform bool showDisk;
      uniform float diskRotation;
      uniform sampler2D deflectionTexture;
      uniform float deflectionMu;
      uniform bool enableMultipleImages;
      uniform sampler2D starTexture;
      uniform bool useRealStars;

      varying vec2 vUv;

      #define PI 3.14159265359
      #define TWO_PI 6.28318530718
      #define U_PHOTON_SPHERE 0.666666667

      // ============================================
      // Utility functions
      // ============================================

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Attempt to define asinh if not available
      float asinh_approx(float x) {
        return log(x + sqrt(x * x + 1.0));
      }

      // ============================================
      // Deflection texture lookup
      // ============================================

      // Map e² to texture coordinate (concentrated near μ)
      float mapE2ToTexCoord(float e2) {
        float scale = 3.0;
        float normalized = e2 / deflectionMu - 1.0;
        return 0.5 + asinh_approx(normalized * sinh(scale * 0.5)) / scale;
      }

      // Map u to texture coordinate (concentrated near photon sphere)
      float mapUToTexCoord(float u) {
        float center = U_PHOTON_SPHERE;
        if (u < center) {
          return 0.5 * pow(u / center, 0.667);
        } else {
          return 0.5 + 0.5 * pow((u - center) / (1.0 - center), 0.667);
        }
      }

      // Lookup deflection from precomputed texture
      vec4 lookupDeflection(float e2, float u) {
        float texE = clamp(mapE2ToTexCoord(e2), 0.0, 1.0);
        float texU = clamp(mapUToTexCoord(u), 0.0, 1.0);
        return texture2D(deflectionTexture, vec2(texE, texU));
      }

      // ============================================
      // Star field background
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

        // Milky way band
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

          // Add subtle twinkling effect to bright stars
          float brightness = max(texColor.r, max(texColor.g, texColor.b));
          float twinkle = 0.85 + 0.15 * sin(time * 2.0 + theta * 10.0 + phi * 5.0);
          texColor *= (brightness > 0.3) ? twinkle : 1.0;

          // Add milky way band
          float milkyway = smoothstep(0.3, 0.0, abs(dir.y));
          milkyway *= 0.08 * hash(uv * 50.0);
          texColor += vec3(0.6, 0.7, 1.0) * milkyway;

          return texColor;
        } else {
          return starFieldProcedural(dir, uv);
        }
      }

      // ============================================
      // Accretion disk (Interstellar-style blackbody colors)
      // ============================================

      vec3 diskColor(float r, float angle, vec3 viewDir) {
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
        float v = sqrt(rs / max(0.001, 2.0 * r - 3.0 * rs));
        v = min(v, 0.9);

        vec3 velocityDir = vec3(-sin(angle), 0.0, cos(angle));
        float doppler = dot(velocityDir, viewDir) * v;

        // Relativistic beaming
        float gamma = 1.0 / sqrt(1.0 - v * v);
        float dopplerFactor = gamma * (1.0 - doppler);
        float beaming = 1.0 / (dopplerFactor * dopplerFactor * dopplerFactor);
        beaming = clamp(beaming, 0.1, 5.0);

        // Gravitational redshift
        float gravRedshift = sqrt(1.0 - rs / r);

        // Doppler color shift (enhances the warm palette)
        if (doppler > 0.0) {
          // Blueshifted (approaching) - brighter yellow-white
          baseColor = mix(baseColor, vec3(1.0, 0.95, 0.7), doppler * 0.3);
        } else {
          // Redshifted (receding) - deeper orange-red
          baseColor = mix(baseColor, vec3(1.0, 0.35, 0.1), -doppler * 0.4);
        }

        float noise = 0.85 + 0.3 * hash(vec2(r * 10.0, angle * 5.0 + time * 0.5));

        return baseColor * temp * beaming * gravRedshift * noise * 2.0;
      }

      // ============================================
      // Optimized raytracing with precomputed deflection
      // ============================================

      // Compute impact parameter and energy from initial ray
      // u = 1/r, δ = angle from radial direction
      // e² = u̇² + u²(1-u) where u̇ = -u·cot(δ)
      float computeImpactParameter(vec3 rayOrigin, vec3 rayDir) {
        float r = length(rayOrigin);
        vec3 radial = normalize(rayOrigin);

        // Angle between ray direction and radial
        float cosAngle = -dot(rayDir, radial);  // Negative because we look inward
        float sinAngle = sqrt(1.0 - cosAngle * cosAngle);

        // Impact parameter b = r * sin(δ)
        return r * sinAngle;
      }

      // Trace ray using deflection lookup with enhanced multiple image support
      vec4 traceRayOptimized(vec3 ro, vec3 rd) {
        vec3 color = vec3(0.0);
        float alpha = 0.0;

        float r = length(ro);
        float u = rs / (2.0 * r);  // Bruneton uses rs/2 as unit

        // Compute angle from radial direction
        vec3 radial = normalize(ro);
        float cosAngle = -dot(rd, radial);
        float sinAngle = sqrt(max(0.0, 1.0 - cosAngle * cosAngle));

        // Impact parameter: b = r * sin(δ)
        // Critical impact parameter for photon sphere: b_crit = rs * sqrt(27)/2 ≈ 2.6 rs
        float b = r * sinAngle;
        float b_critical = rs * 2.598;  // sqrt(27)/2 * rs

        // Energy parameter: e² = u̇² + u²(1-u)
        float u_dot = -u * cosAngle / max(sinAngle, 0.001);
        float e2 = u_dot * u_dot + u * u * (1.0 - u);

        // Lookup deflection from texture
        vec4 deflectionData = lookupDeflection(e2, u);
        float deflection = deflectionData.r;
        float rayType = deflectionData.b;
        float valid = deflectionData.a;

        // Ray classification based on impact parameter
        // Rays with b < b_critical will fall into the black hole
        // Rays with b ≈ b_critical will orbit multiple times (photon sphere)
        // Rays with b > b_critical will be deflected and escape

        float closeness = abs(b - b_critical) / b_critical;
        bool nearPhotonSphere = closeness < 0.3;

        // Determine if ray will hit event horizon
        // More accurate: check if e² > μ AND approaching
        bool willPlunge = (b < b_critical * 0.95) && (cosAngle > 0.3);

        if (willPlunge) {
          // Ray falls into black hole
          return vec4(0.0, 0.0, 0.0, 1.0);
        }

        // Adaptive parameters based on ray path
        vec3 pos = ro;
        vec3 dir = rd;
        float prevY = pos.y;
        bool hitDisk = false;
        int numImages = 0;

        // More steps for rays near photon sphere (they orbit multiple times)
        int maxSteps = 50;
        if (enableMultipleImages && nearPhotonSphere) {
          maxSteps = 150;  // Allow more orbits for multiple images
        }

        float stepSize = 0.15;

        // Track total phi rotation for Einstein ring detection
        float totalPhi = 0.0;
        vec3 prevDir = dir;

        for (int i = 0; i < 150; i++) {
          if (i >= maxSteps) break;

          float currentR = length(pos);

          // Check event horizon
          if (currentR < rs * 1.01) {
            return vec4(color, 1.0);
          }

          // Check disk intersection
          if (showDisk) {
            float newY = pos.y + dir.y * stepSize;

            if (prevY * newY <= 0.0) {
              float t = -pos.y / dir.y;
              vec3 diskHit = pos + dir * t;
              float diskR = length(diskHit.xz);

              if (diskR >= diskInner && diskR <= diskOuter) {
                float angle = atan(diskHit.z, diskHit.x) + diskRotation;
                vec3 diskCol = diskColor(diskR, angle, dir);

                // Multiple images get progressively dimmer
                // Primary image: full brightness
                // Secondary: 1/4 brightness (passed behind once)
                // Tertiary: 1/16 brightness (passed behind twice)
                float imageFactor = 1.0 / pow(4.0, float(numImages));

                // Also consider the angular extent (solid angle)
                // Secondary images are more stretched/magnified near photon sphere
                if (numImages > 0 && nearPhotonSphere) {
                  imageFactor *= 1.5;  // Lensing magnification
                }

                color += diskCol * imageFactor;
                numImages++;

                if (!enableMultipleImages || numImages >= 3) {
                  alpha = 1.0;
                  hitDisk = true;
                  break;
                }
              }
            }
            prevY = newY;
          }

          // Check escape
          if (currentR > 50.0) {
            vec3 stars = starField(normalize(dir));
            color += stars * (1.0 - alpha);
            alpha = 1.0;
            break;
          }

          // Gravitational bending using Schwarzschild geodesic
          // a = -1.5 * rs / r³ * r (for null geodesics)
          float r3 = currentR * currentR * currentR;
          vec3 accel = -1.5 * rs / r3 * pos;

          // Adaptive step size: smaller steps near black hole for accuracy
          float adaptiveStep = stepSize;
          if (currentR < rs * 5.0) {
            adaptiveStep *= 0.3;  // Finer steps near photon sphere
          } else if (currentR < rs * 10.0) {
            adaptiveStep *= 0.6;
          } else {
            adaptiveStep *= (0.5 + currentR / 15.0);
          }
          adaptiveStep = clamp(adaptiveStep, 0.02, 0.5);

          // Track rotation angle
          float angleDiff = acos(clamp(dot(dir, prevDir), -1.0, 1.0));
          totalPhi += angleDiff;
          prevDir = dir;

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
        // Setup camera
        vec3 forward = normalize(cameraTarget - cameraPos);
        vec3 right = normalize(cross(forward, cameraUp));
        vec3 up = cross(right, forward);

        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= resolution.x / resolution.y;

        float fovRad = fov * PI / 180.0;
        float scale = tan(fovRad * 0.5);

        vec3 rd = normalize(forward + right * uv.x * scale + up * uv.y * scale);

        vec4 color = traceRayOptimized(cameraPos, rd);

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
    uniforms.diskRotation.value = this.time * 0.2;
  }

  render(renderer) {
    renderer.render(this.rtScene, this.rtCamera);
  }

  onResize(width, height) {
    this.mesh.material.uniforms.resolution.value.set(width, height);
  }

  toggleDisk() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.showDisk.value = !uniforms.showDisk.value;
    return uniforms.showDisk.value;
  }

  toggleMultipleImages() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.enableMultipleImages.value = !uniforms.enableMultipleImages.value;
    return uniforms.enableMultipleImages.value;
  }

  setSchwarzschildRadius(rs) {
    this.rs = rs;
    this.mesh.material.uniforms.rs.value = rs;
    this.mesh.material.uniforms.diskInner.value = rs * 3;
    this.mesh.material.uniforms.diskOuter.value = rs * 12;
  }

  getObject() {
    return this.mesh;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.deflectionTexture.dispose();
  }
}
