/**
 * Black Hole Simulator - Main Application Class
 *
 * Coordinates all components of the simulation:
 * - Three.js scene management
 * - Physics simulation
 * - User interaction
 * - UI updates
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { BlackHole } from './objects/BlackHole.js';
import { StarField } from './objects/StarField.js';
import { AccretionDisk } from './objects/AccretionDisk.js';
import { ParticleManager } from './objects/Particle.js';
import { GravitationalLens } from './effects/GravitationalLens.js';
import { TimeDilationField } from './effects/TimeDilation.js';
import { BlackHoleRaytracer } from './effects/BlackHoleRaytracer.js';

import {
  schwarzschildRadiusKm,
  PHOTON_SPHERE,
  ISCO,
  timeDilationFactor,
  translations
} from './physics/constants.js';

export class BlackHoleSimulator {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.running = true;

    // Simulation parameters
    this.blackHoleMass = 10;  // Solar masses
    this.rs = 1;  // Schwarzschild radius in simulation units
    this.particleVelocity = 0.5;  // Fraction of c
    this.language = 'en';
    this.raytracerMode = true;  // Start with raytracer mode (Interstellar style)

    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initControls();
    this.initLights();

    // Initialize simulation objects
    this.initBlackHole();
    this.initStarField();
    this.initAccretionDisk();
    this.initParticleManager();
    this.initTimeDilationField();
    this.initGravitationalLens();
    this.initRaytracer();

    // Initialize UI
    this.initUI();

    // Event listeners
    this.initEventListeners();

    // Start animation loop
    this.animate();

    // Hide loading screen
    document.getElementById('loading').style.display = 'none';
  }

  /**
   * Initialize WebGL renderer
   */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Initialize scene
   */
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.001);
  }

  /**
   * Initialize camera
   */
  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // Position camera at a good viewing distance
    this.camera.position.set(15, 8, 15);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Initialize orbit controls
   */
  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.target.set(0, 0, 0);
  }

  /**
   * Initialize lights (minimal, since black hole doesn't need much)
   */
  initLights() {
    // Ambient light for slight visibility
    const ambient = new THREE.AmbientLight(0x111122, 0.5);
    this.scene.add(ambient);
  }

  /**
   * Initialize black hole object
   */
  initBlackHole() {
    this.blackHole = new BlackHole(this.rs);
    this.scene.add(this.blackHole.getObject());
  }

  /**
   * Initialize star field background
   */
  initStarField() {
    this.starField = new StarField({
      starCount: 15000,
      radius: 500
    });
    this.scene.add(this.starField.getObject());
  }

  /**
   * Initialize accretion disk
   */
  initAccretionDisk() {
    this.accretionDisk = new AccretionDisk({
      schwarzschildRadius: this.rs,
      outerRadius: this.rs * 15
    });
    this.scene.add(this.accretionDisk.getObject());
  }

  /**
   * Initialize particle manager
   */
  initParticleManager() {
    this.particleManager = new ParticleManager(this.scene);
  }

  /**
   * Initialize time dilation field visualization
   */
  initTimeDilationField() {
    this.timeDilationField = new TimeDilationField({
      schwarzschildRadius: this.rs,
      size: 30
    });
    this.timeDilationField.setVisible(false);  // Hidden by default
    this.scene.add(this.timeDilationField.getObject());
  }

  /**
   * Initialize gravitational lensing effect
   */
  initGravitationalLens() {
    this.gravitationalLens = new GravitationalLens(
      this.renderer,
      this.scene,
      this.camera
    );
    this.gravitationalLens.enabled = false;  // Disabled when raytracer is on
  }

  /**
   * Initialize raytracer for accurate black hole visualization
   */
  initRaytracer() {
    this.raytracer = new BlackHoleRaytracer({
      schwarzschildRadius: this.rs,
      diskInnerRadius: this.rs * 3,
      diskOuterRadius: this.rs * 12
    });

    // Hide standard objects when raytracer is active
    this.updateRaytracerMode();
  }

  /**
   * Update visibility based on raytracer mode
   */
  updateRaytracerMode() {
    const standardMode = !this.raytracerMode;

    // Standard objects only visible in standard mode
    this.blackHole.getObject().visible = standardMode;
    this.starField.getObject().visible = standardMode;
    this.accretionDisk.getObject().visible = standardMode;

    // Gravitational lens only in standard mode
    if (this.gravitationalLens) {
      this.gravitationalLens.enabled = standardMode;
    }
  }

  /**
   * Toggle between raytracer and standard mode
   */
  toggleRaytracerMode() {
    this.raytracerMode = !this.raytracerMode;
    this.updateRaytracerMode();
    return this.raytracerMode;
  }

  /**
   * Initialize UI elements and event handlers
   */
  initUI() {
    // Mass slider
    this.massSlider = document.getElementById('mass-slider');
    this.massSlider.addEventListener('input', (e) => {
      this.setBlackHoleMass(parseFloat(e.target.value));
    });

    // Velocity slider
    this.velocitySlider = document.getElementById('velocity-slider');
    this.velocitySlider.addEventListener('input', (e) => {
      this.particleVelocity = parseFloat(e.target.value) / 100;
      this.updateUI();
    });

    // Buttons
    document.getElementById('launch-particle').addEventListener('click', () => {
      this.launchParticle();
    });

    document.getElementById('clear-particles').addEventListener('click', () => {
      this.particleManager.clear();
      this.updateUI();
    });

    document.getElementById('toggle-accretion').addEventListener('click', () => {
      this.accretionDisk.toggle();
    });

    document.getElementById('language-toggle').addEventListener('click', () => {
      this.toggleLanguage();
    });

    this.updateUI();
  }

  /**
   * Initialize event listeners
   */
  initEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.onResize());

    // Click to launch particle
    this.renderer.domElement.addEventListener('click', (e) => {
      // Only launch if not dragging camera
      if (!this.isDragging) {
        this.launchParticleToward(e.clientX, e.clientY);
      }
    });

    // Track dragging state
    this.isDragging = false;
    this.renderer.domElement.addEventListener('mousedown', () => {
      this.isDragging = false;
    });
    this.renderer.domElement.addEventListener('mousemove', () => {
      this.isDragging = true;
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.launchParticle();
          break;
        case 'c':
          this.particleManager.clear();
          break;
        case 'a':
          this.accretionDisk.toggle();
          break;
        case 'h':
          this.blackHole.toggleHelpers(
            !this.blackHole.photonSphere.visible
          );
          break;
        case 'l':
          // Toggle gravitational lensing
          if (this.gravitationalLens) {
            this.gravitationalLens.toggle();
          }
          break;
        case 't':
          // Toggle time dilation field
          if (this.timeDilationField) {
            this.timeDilationField.setVisible(!this.timeDilationField.mesh.visible);
          }
          break;
        case 'r':
          // Toggle raytracer mode
          this.toggleRaytracerMode();
          break;
      }
    });
  }

  /**
   * Set black hole mass and update all related objects
   */
  setBlackHoleMass(mass) {
    this.blackHoleMass = mass;

    // In simulation units, rs = 1 always
    // But we need to update UI displays
    this.updateUI();
  }

  /**
   * Launch a particle from a random position
   */
  launchParticle() {
    const angle = Math.random() * Math.PI * 2;
    const startRadius = 8 + Math.random() * 4;  // Start at 8-12 rs

    // Random velocity angle (mostly inward with some tangential)
    const velocityAngle = (Math.random() - 0.5) * Math.PI * 0.8;

    this.particleManager.createParticle({
      r: startRadius,
      phi: angle,
      velocity: this.particleVelocity,
      angle: velocityAngle,
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6)
    });

    this.updateUI();
  }

  /**
   * Launch particle toward a screen position
   */
  launchParticleToward(screenX, screenY) {
    // Convert screen coordinates to world direction
    const mouse = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Find where ray intersects the XZ plane (y=0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);

    if (target) {
      // Calculate angle to target from camera direction
      const targetAngle = Math.atan2(target.z, target.x);

      // Start particle from opposite side, heading toward target
      const startAngle = targetAngle + Math.PI;
      const startRadius = 10;

      // Calculate velocity angle to head toward target
      const velocityAngle = Math.PI * 0.1 * (Math.random() - 0.5);  // Slight random variation

      this.particleManager.createParticle({
        r: startRadius,
        phi: startAngle,
        velocity: this.particleVelocity,
        angle: velocityAngle,
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6)
      });

      this.updateUI();
    }
  }

  /**
   * Toggle language between English and Korean
   */
  toggleLanguage() {
    this.language = this.language === 'en' ? 'ko' : 'en';
    this.updateUI();
  }

  /**
   * Update all UI elements
   */
  updateUI() {
    const t = translations[this.language];

    // Update title
    document.getElementById('title').textContent = t.title;

    // Update black hole properties
    const rsKm = schwarzschildRadiusKm(this.blackHoleMass);
    document.getElementById('mass-value').textContent = `${this.blackHoleMass} M☉`;
    document.getElementById('rs-value').textContent = `${rsKm.toFixed(1)} km`;
    document.getElementById('photon-sphere-value').textContent =
      `${(rsKm * PHOTON_SPHERE).toFixed(1)} km`;
    document.getElementById('isco-value').textContent =
      `${(rsKm * ISCO).toFixed(1)} km`;

    // Update observer info
    const observerDist = this.camera.position.length();
    const observerDistRs = observerDist / this.rs;
    const timeDilation = timeDilationFactor(observerDistRs);

    document.getElementById('observer-distance').textContent =
      `${(observerDistRs * rsKm).toFixed(0)} km`;
    document.getElementById('time-dilation').textContent =
      `${timeDilation.toFixed(4)}x`;

    // Update particle count
    document.getElementById('particle-count').textContent =
      this.particleManager.getActiveCount();

    // Update slider displays
    document.getElementById('mass-slider-value').textContent =
      `${this.blackHoleMass} M☉`;
    document.getElementById('velocity-slider-value').textContent =
      `${this.particleVelocity.toFixed(2)}c`;

    // Update all i18n labels
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        el.textContent = t[key];
      }
    });

    // Update section headers
    document.getElementById('blackhole-section').textContent = t.blackholeSection || 'Black Hole Properties';
    document.getElementById('observer-section').textContent = t.observerSection || 'Observer';
    document.getElementById('particles-section').textContent = t.particlesSection || 'Active Particles';
    document.getElementById('controls-title').textContent = t.controlsTitle || 'Controls';
  }

  /**
   * Handle window resize
   */
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Update gravitational lens composer
    if (this.gravitationalLens) {
      this.gravitationalLens.onResize(window.innerWidth, window.innerHeight);
    }

    // Update raytracer
    if (this.raytracer) {
      this.raytracer.onResize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.running) return;

    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Update controls
    this.controls.update();

    // Update simulation objects
    this.blackHole.update(this.camera, elapsedTime);
    this.starField.update(elapsedTime);
    this.accretionDisk.update(deltaTime, this.camera);

    // Update time dilation field
    if (this.timeDilationField) {
      this.timeDilationField.update(elapsedTime);
    }

    // Update gravitational lens
    if (this.gravitationalLens) {
      this.gravitationalLens.update(elapsedTime);
    }

    // Update particles (physics simulation)
    const physicsStepsPerFrame = 5;
    const physicsTimeStep = 0.02;

    for (let i = 0; i < physicsStepsPerFrame; i++) {
      this.particleManager.update(physicsTimeStep);
    }

    // Periodically update UI
    if (Math.floor(elapsedTime * 10) % 5 === 0) {
      this.updateUI();
    }

    // Render based on mode
    if (this.raytracerMode && this.raytracer) {
      // Update and render raytracer
      this.raytracer.update(this.camera, deltaTime);
      this.raytracer.render(this.renderer);
    } else if (this.gravitationalLens && this.gravitationalLens.enabled) {
      this.gravitationalLens.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Pause simulation
   */
  pause() {
    this.running = false;
  }

  /**
   * Resume simulation
   */
  resume() {
    if (!this.running) {
      this.running = true;
      this.clock.start();
      this.animate();
    }
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    this.running = false;

    this.blackHole.dispose();
    this.starField.dispose();
    this.accretionDisk.dispose();
    this.particleManager.clear();

    if (this.timeDilationField) {
      this.timeDilationField.dispose();
    }

    if (this.gravitationalLens) {
      this.gravitationalLens.dispose();
    }

    if (this.raytracer) {
      this.raytracer.dispose();
    }

    this.renderer.dispose();
    this.controls.dispose();

    this.container.removeChild(this.renderer.domElement);
  }
}
