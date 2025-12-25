/**
 * Particle System for Black Hole Simulation
 *
 * Handles particles that fall into the black hole,
 * including trajectory visualization and spaghettification effects
 */

import * as THREE from 'three';
import { rk4Step, createInitialState, conservedQuantities } from '../physics/geodesic.js';
import { timeDilationFactor, gravitationalRedshift } from '../physics/constants.js';

export class Particle {
  constructor(options = {}) {
    this.id = options.id || Math.random().toString(36).substr(2, 9);

    // Initial conditions
    this.r = options.r || 10;           // Initial radius (in rs units)
    this.phi = options.phi || 0;        // Initial angle
    this.velocity = options.velocity || 0.3;  // Initial velocity (fraction of c)
    this.angle = options.angle || 0;    // Velocity direction (0 = radial inward)

    // Physical state
    this.state = createInitialState(this.r, this.phi, this.velocity, this.angle);
    this.properTime = 0;
    this.coordinateTime = 0;
    this.alive = true;
    this.terminated = null;

    // Calculate conserved quantities
    const { E, L } = conservedQuantities(this.state);
    this.energy = E;
    this.angularMomentum = L;

    // Visual properties
    this.baseSize = options.size || 0.1;
    this.color = options.color || new THREE.Color(0x4ecdc4);
    this.trailLength = options.trailLength || 500;

    // Three.js objects
    this.group = new THREE.Group();
    this.trajectory = [];

    this.createMesh();
    this.createTrail();
  }

  /**
   * Create the particle mesh
   */
  createMesh() {
    // Main particle sphere
    const geometry = new THREE.SphereGeometry(this.baseSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 1.0
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(this.baseSize * 2, 16, 16);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: this.color },
        intensity: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec3 vNormal;
        void main() {
          float glow = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(glowColor * intensity, glow * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });

    this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.mesh.add(this.glow);

    // Set initial position after all meshes are created
    this.updatePosition();
  }

  /**
   * Create the trajectory trail
   */
  createTrail() {
    // Trail geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.trailLength * 3);
    const colors = new Float32Array(this.trailLength * 3);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.trail = new THREE.Line(geometry, material);
    this.group.add(this.trail);
  }

  /**
   * Update particle position from state vector
   */
  updatePosition() {
    const [r, phi] = this.state;

    // Convert polar to Cartesian (in equatorial plane)
    const x = r * Math.cos(phi);
    const z = r * Math.sin(phi);  // Note: z in 3D corresponds to y in 2D equatorial plane

    this.mesh.position.set(x, 0, z);

    // Apply spaghettification effect (stretch toward black hole)
    this.applySpaghettification();

    // Apply gravitational redshift to color
    this.applyRedshift();
  }

  /**
   * Apply spaghettification (stretching) effect
   */
  applySpaghettification() {
    const r = this.state[0];

    // Tidal stretching increases dramatically as r → rs
    // Stretch factor: roughly proportional to 1/r³
    const stretchFactor = Math.min(5, 1 + 2 / (r * r * r));

    // Direction toward black hole
    const phi = this.state[1];
    const dirX = -Math.cos(phi);
    const dirZ = -Math.sin(phi);

    // Reset scale first
    this.mesh.scale.set(1, 1, 1);

    // Apply stretch along radial direction
    // Create a scale matrix that stretches toward the black hole
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();

    // Align stretch direction
    const up = new THREE.Vector3(0, 1, 0);
    const stretchDir = new THREE.Vector3(dirX, 0, dirZ).normalize();

    // Scale: stretched along radial, compressed perpendicular
    const compression = 1 / Math.sqrt(stretchFactor);
    this.mesh.scale.set(
      stretchFactor * Math.abs(dirX) + compression * (1 - Math.abs(dirX)),
      compression,
      stretchFactor * Math.abs(dirZ) + compression * (1 - Math.abs(dirZ))
    );
  }

  /**
   * Apply gravitational redshift to particle color
   */
  applyRedshift() {
    const r = this.state[0];
    const redshift = gravitationalRedshift(r);

    // Shift color toward red as redshift increases
    // Original color → red shift
    const shiftedColor = this.color.clone();

    if (redshift > 0 && redshift < 100) {
      // Simple redshift approximation
      const factor = Math.min(1, redshift / 2);
      shiftedColor.r = Math.min(1, this.color.r + factor * 0.5);
      shiftedColor.g = Math.max(0, this.color.g * (1 - factor * 0.5));
      shiftedColor.b = Math.max(0, this.color.b * (1 - factor * 0.7));
    }

    this.mesh.material.color.copy(shiftedColor);
    if (this.glow.material.uniforms) {
      this.glow.material.uniforms.glowColor.value.copy(shiftedColor);
    }

    // Dim as approaching event horizon (light escapes less)
    const dimFactor = timeDilationFactor(r);
    this.mesh.material.opacity = dimFactor;
    if (this.glow.material.uniforms) {
      this.glow.material.uniforms.intensity.value = dimFactor;
    }
  }

  /**
   * Update trail visualization
   */
  updateTrail() {
    const positions = this.trail.geometry.attributes.position.array;
    const colors = this.trail.geometry.attributes.color.array;

    // Shift existing points back
    for (let i = this.trailLength - 1; i > 0; i--) {
      positions[i * 3] = positions[(i - 1) * 3];
      positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
      positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];

      // Fade color along trail
      const fade = 1 - i / this.trailLength;
      colors[i * 3] = this.color.r * fade;
      colors[i * 3 + 1] = this.color.g * fade;
      colors[i * 3 + 2] = this.color.b * fade;
    }

    // Add new point at start
    positions[0] = this.mesh.position.x;
    positions[1] = this.mesh.position.y;
    positions[2] = this.mesh.position.z;
    colors[0] = this.color.r;
    colors[1] = this.color.g;
    colors[2] = this.color.b;

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * Integrate equations of motion for one time step
   * @param {number} dt - Coordinate time step
   * @returns {boolean} True if particle is still alive
   */
  step(dt) {
    if (!this.alive) return false;

    // Store current position for trail
    this.trajectory.push([...this.state]);

    // RK4 integration step
    this.state = rk4Step(this.state, dt);
    this.coordinateTime += dt;

    // Update proper time (approximate)
    const r = this.state[0];
    const dilationFactor = timeDilationFactor(r);
    this.properTime += dt * dilationFactor;

    // Check termination conditions
    if (r <= 1.5) {  // Close to event horizon (terminate before numerical instability)
      this.alive = false;
      this.terminated = 'horizon';
      return false;
    }

    if (r > 100 && this.state[2] > 0) {  // Escaped
      this.alive = false;
      this.terminated = 'escaped';
      return false;
    }

    // Update visual representation
    this.updatePosition();
    this.updateTrail();

    return true;
  }

  /**
   * Get current radius
   */
  getRadius() {
    return this.state[0];
  }

  /**
   * Get current velocity magnitude
   */
  getVelocity() {
    const [r, phi, dr_dt, dphi_dt] = this.state;
    return Math.sqrt(dr_dt * dr_dt + r * r * dphi_dt * dphi_dt);
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
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}

/**
 * Particle Manager - handles multiple particles
 */
export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = new Map();
  }

  /**
   * Create and add a new particle
   */
  createParticle(options) {
    const particle = new Particle(options);
    this.particles.set(particle.id, particle);
    this.scene.add(particle.getObject());
    return particle;
  }

  /**
   * Update all particles
   * @param {number} dt - Time step
   */
  update(dt) {
    const toRemove = [];

    this.particles.forEach((particle, id) => {
      if (!particle.step(dt)) {
        // Particle terminated
        if (particle.terminated === 'horizon') {
          // Could add visual effect here
        }
        toRemove.push(id);
      }
    });

    // Remove dead particles after a delay for visual effect
    // For now, keep them for trail visibility
  }

  /**
   * Remove a particle
   */
  removeParticle(id) {
    const particle = this.particles.get(id);
    if (particle) {
      this.scene.remove(particle.getObject());
      particle.dispose();
      this.particles.delete(id);
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles.forEach((particle, id) => {
      this.scene.remove(particle.getObject());
      particle.dispose();
    });
    this.particles.clear();
  }

  /**
   * Get particle count
   */
  getCount() {
    return this.particles.size;
  }

  /**
   * Get active (alive) particle count
   */
  getActiveCount() {
    let count = 0;
    this.particles.forEach(p => { if (p.alive) count++; });
    return count;
  }
}
