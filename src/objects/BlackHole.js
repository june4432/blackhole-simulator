/**
 * Black Hole 3D Visualization
 *
 * Renders the event horizon, photon sphere, and ISCO
 */

import * as THREE from 'three';
import { PHOTON_SPHERE, ISCO } from '../physics/constants.js';

export class BlackHole {
  constructor(schwarzschildRadius = 1) {
    this.rs = schwarzschildRadius;
    this.group = new THREE.Group();

    this.createEventHorizon();
    this.createPhotonSphere();
    this.createISCO();
    this.createDistortionEffect();
  }

  /**
   * Create the event horizon (black sphere)
   */
  createEventHorizon() {
    // Pure black sphere for event horizon
    const geometry = new THREE.SphereGeometry(this.rs, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.FrontSide
    });

    this.eventHorizon = new THREE.Mesh(geometry, material);
    this.group.add(this.eventHorizon);

    // Add a subtle glow around the event horizon
    const glowGeometry = new THREE.SphereGeometry(this.rs * 1.02, 64, 64);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x1a1a2e) },
        viewVector: { value: new THREE.Vector3() }
      },
      vertexShader: `
        uniform vec3 viewVector;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(0.6 - dot(vNormal, vNormel), 2.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4(glow, intensity * 0.5);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true
    });

    this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.group.add(this.glow);
  }

  /**
   * Create the photon sphere visualization
   * This is where light can orbit the black hole
   */
  createPhotonSphere() {
    const radius = this.rs * PHOTON_SPHERE;

    // Wireframe sphere to show photon sphere boundary
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });

    this.photonSphere = new THREE.Mesh(geometry, material);
    this.group.add(this.photonSphere);

    // Add orbital ring at equator
    const ringGeometry = new THREE.TorusGeometry(radius, 0.02 * this.rs, 8, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.5
    });

    this.photonRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.photonRing.rotation.x = Math.PI / 2;
    this.group.add(this.photonRing);
  }

  /**
   * Create ISCO (Innermost Stable Circular Orbit) visualization
   */
  createISCO() {
    const radius = this.rs * ISCO;

    // Dashed ring for ISCO
    const curve = new THREE.EllipseCurve(0, 0, radius, radius);
    const points = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, 0, p.y))
    );

    const material = new THREE.LineDashedMaterial({
      color: 0x4ecdc4,
      dashSize: 0.3,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.6
    });

    this.iscoRing = new THREE.Line(geometry, material);
    this.iscoRing.computeLineDistances();
    this.group.add(this.iscoRing);
  }

  /**
   * Create visual distortion effect near event horizon
   */
  createDistortionEffect() {
    // Gravitational lensing approximation using refraction sphere
    const geometry = new THREE.SphereGeometry(this.rs * 2.5, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        rs: { value: this.rs }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vPosition = position;
          vNormal = normal;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float rs;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          float dist = length(vPosition);
          float strength = 1.0 - smoothstep(rs, rs * 2.5, dist);

          // Dark gradient near event horizon
          vec3 color = vec3(0.0);
          float alpha = strength * 0.3;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.distortion = new THREE.Mesh(geometry, material);
    this.group.add(this.distortion);
  }

  /**
   * Update shader uniforms
   * @param {THREE.Camera} camera - The camera for view-dependent effects
   * @param {number} time - Current time for animations
   */
  update(camera, time) {
    if (this.glow && this.glow.material.uniforms) {
      this.glow.material.uniforms.viewVector.value =
        new THREE.Vector3().subVectors(camera.position, this.glow.position);
    }

    if (this.distortion && this.distortion.material.uniforms) {
      this.distortion.material.uniforms.time.value = time;
    }

    // Slowly rotate helper rings for visual interest
    if (this.photonRing) {
      this.photonRing.rotation.z += 0.001;
    }
  }

  /**
   * Update the Schwarzschild radius (when mass changes)
   * @param {number} newRs - New Schwarzschild radius
   */
  setSchwarzschildRadius(newRs) {
    const scale = newRs / this.rs;
    this.rs = newRs;

    // Scale all components
    this.eventHorizon.scale.setScalar(scale);
    this.glow.scale.setScalar(scale);
    this.photonSphere.scale.setScalar(scale);
    this.photonRing.scale.setScalar(scale);
    this.iscoRing.scale.setScalar(scale);
    this.distortion.scale.setScalar(scale);

    // Update shader uniform
    if (this.distortion.material.uniforms) {
      this.distortion.material.uniforms.rs.value = newRs;
    }
  }

  /**
   * Toggle visibility of helper visualizations
   */
  toggleHelpers(visible) {
    this.photonSphere.visible = visible;
    this.photonRing.visible = visible;
    this.iscoRing.visible = visible;
  }

  /**
   * Get the Three.js group for adding to scene
   */
  getObject() {
    return this.group;
  }

  /**
   * Dispose of all geometries and materials
   */
  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
