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
import { OptimizedRaytracer } from './effects/OptimizedRaytracer.js';
import { KerrRaytracer } from './effects/KerrRaytracer.js';

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
    this.particleVelocity = 0.25;  // Fraction of c (lower = more curved orbits)
    this.simulationSpeed = 1;  // Time multiplier (1x to 20x)
    this.language = 'en';
    this.raytracerMode = true;  // Start with raytracer mode (Interstellar style)
    this.useOptimizedRaytracer = false;  // Toggle for Bruneton optimization
    this.useKerrRaytracer = false;  // Toggle for Kerr (rotating) black hole
    this.kerrSpin = 0.4;  // Default spin parameter (0 to ~0.998)

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
    // Create a separate scene for particles (for overlay rendering in raytracer mode)
    this.particleScene = new THREE.Scene();
    this.particleManager = new ParticleManager(this.particleScene);

    // Also add particles to main scene for standard mode
    // We'll handle visibility switching
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
    // Original raytracer (iterative)
    this.raytracer = new BlackHoleRaytracer({
      schwarzschildRadius: this.rs,
      diskInnerRadius: this.rs * 3,
      diskOuterRadius: this.rs * 12
    });

    // Optimized raytracer (Bruneton precomputed deflection)
    // Initialize lazily to avoid startup delay
    this.optimizedRaytracer = null;

    // Hide standard objects when raytracer is active
    this.updateRaytracerMode();
  }

  /**
   * Initialize optimized raytracer (lazy loading)
   */
  initOptimizedRaytracer() {
    if (!this.optimizedRaytracer) {
      console.log('Initializing Bruneton optimized raytracer...');
      this.optimizedRaytracer = new OptimizedRaytracer({
        schwarzschildRadius: this.rs,
        diskInnerRadius: this.rs * 3,
        diskOuterRadius: this.rs * 12,
        textureResolution: 512
      });
      console.log('Optimized raytracer ready.');
    }
  }

  /**
   * Initialize Kerr (rotating) raytracer (lazy loading)
   */
  initKerrRaytracer() {
    if (!this.kerrRaytracer) {
      console.log('Initializing Kerr (rotating) black hole raytracer...');
      this.kerrRaytracer = new KerrRaytracer({
        schwarzschildRadius: this.rs,
        spin: this.kerrSpin,
        diskOuterRadius: this.rs * 12
      });
      console.log(`Kerr raytracer ready. Spin = ${this.kerrSpin}`);
    }
  }

  /**
   * Toggle between original and optimized raytracer
   */
  toggleOptimizedRaytracer() {
    this.useOptimizedRaytracer = !this.useOptimizedRaytracer;

    if (this.useOptimizedRaytracer) {
      this.initOptimizedRaytracer();
    }

    console.log(`Raytracer mode: ${this.useOptimizedRaytracer ? 'Optimized (Bruneton)' : 'Original'}`);
    return this.useOptimizedRaytracer;
  }

  /**
   * Toggle Kerr (rotating) black hole mode
   */
  toggleKerrRaytracer() {
    this.useKerrRaytracer = !this.useKerrRaytracer;

    if (this.useKerrRaytracer) {
      this.useOptimizedRaytracer = false;  // Disable optimized when using Kerr
      this.initKerrRaytracer();
    }

    console.log(`Black hole type: ${this.useKerrRaytracer ? 'Kerr (rotating)' : 'Schwarzschild (non-rotating)'}`);
    return this.useKerrRaytracer;
  }

  /**
   * Adjust Kerr spin parameter
   */
  adjustKerrSpin(delta) {
    this.kerrSpin = Math.max(0, Math.min(0.998, this.kerrSpin + delta));
    if (this.kerrRaytracer) {
      this.kerrRaytracer.setSpin(this.kerrSpin);
    }
    console.log(`Kerr spin: ${this.kerrSpin.toFixed(3)}`);
    return this.kerrSpin;
  }

  /**
   * Get the active raytracer instance
   */
  getActiveRaytracer() {
    if (this.useKerrRaytracer && this.kerrRaytracer) {
      return this.kerrRaytracer;
    }
    if (this.useOptimizedRaytracer && this.optimizedRaytracer) {
      return this.optimizedRaytracer;
    }
    return this.raytracer;
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

    // Speed slider
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      this.simulationSpeed = parseFloat(e.target.value) / 5;  // 1-20 → 0.2x-4x
      document.getElementById('speed-slider-value').textContent =
        this.simulationSpeed.toFixed(1) + 'x';
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

    // Kerr black hole controls
    document.getElementById('toggle-kerr').addEventListener('click', () => {
      const isKerr = this.toggleKerrRaytracer();
      const btn = document.getElementById('toggle-kerr');
      btn.style.background = isKerr ? '#ff6b35' : 'rgba(255, 255, 255, 0.1)';
      document.getElementById('spin-group').style.display = isKerr ? 'block' : 'none';
      document.getElementById('toggle-ergosphere').style.display = isKerr ? 'inline-block' : 'none';
    });

    document.getElementById('toggle-ergosphere').addEventListener('click', () => {
      if (this.useKerrRaytracer && this.kerrRaytracer) {
        const enabled = this.kerrRaytracer.toggleErgosphere();
        const btn = document.getElementById('toggle-ergosphere');
        btn.style.background = enabled ? '#ff6b35' : 'rgba(255, 255, 255, 0.1)';
      }
    });

    document.getElementById('spin-slider').addEventListener('input', (e) => {
      const spin = parseFloat(e.target.value) / 1000;
      this.kerrSpin = spin;
      if (this.kerrRaytracer) {
        this.kerrRaytracer.setSpin(spin);
      }
      document.getElementById('spin-slider-value').textContent = spin.toFixed(3);
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
        case 'o':
          // Toggle optimized raytracer (Bruneton)
          if (this.raytracerMode) {
            this.toggleOptimizedRaytracer();
          }
          break;
        case 'm':
          // Toggle multiple images in optimized raytracer
          if (this.useOptimizedRaytracer && this.optimizedRaytracer) {
            const enabled = this.optimizedRaytracer.toggleMultipleImages();
            console.log(`Multiple images: ${enabled ? 'ON' : 'OFF'}`);
          }
          break;
        case 'k':
          // Toggle Kerr (rotating) black hole
          if (this.raytracerMode) {
            const isKerr = this.toggleKerrRaytracer();
            const btn = document.getElementById('toggle-kerr');
            btn.style.background = isKerr ? '#ff6b35' : 'rgba(255, 255, 255, 0.1)';
            document.getElementById('spin-group').style.display = isKerr ? 'block' : 'none';
            document.getElementById('toggle-ergosphere').style.display = isKerr ? 'inline-block' : 'none';
          }
          break;
        case 'e':
          // Toggle ergosphere visualization (Kerr only)
          if (this.useKerrRaytracer && this.kerrRaytracer) {
            const enabled = this.kerrRaytracer.toggleErgosphere();
            console.log(`Ergosphere: ${enabled ? 'ON' : 'OFF'}`);
          }
          break;
        case '[':
          // Decrease Kerr spin
          if (this.useKerrRaytracer) {
            const spin = this.adjustKerrSpin(-0.05);
            document.getElementById('spin-slider').value = spin * 1000;
            document.getElementById('spin-slider-value').textContent = spin.toFixed(3);
          }
          break;
        case ']':
          // Increase Kerr spin
          if (this.useKerrRaytracer) {
            const spin = this.adjustKerrSpin(0.05);
            document.getElementById('spin-slider').value = spin * 1000;
            document.getElementById('spin-slider-value').textContent = spin.toFixed(3);
          }
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
    const startRadius = 6 + Math.random() * 3;  // Start at 6-9 rs (closer to black hole)

    // Velocity angle with significant tangential component for visible orbits
    // Range: 0.3π to 0.7π (mostly tangential, some inward)
    const velocityAngle = 0.3 * Math.PI + Math.random() * 0.4 * Math.PI;

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

    // Update raytracers
    if (this.raytracer) {
      this.raytracer.onResize(window.innerWidth, window.innerHeight);
    }
    if (this.optimizedRaytracer) {
      this.optimizedRaytracer.onResize(window.innerWidth, window.innerHeight);
    }
    if (this.kerrRaytracer) {
      this.kerrRaytracer.onResize(window.innerWidth, window.innerHeight);
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
    // Keep time step small for numerical stability, increase iterations for speed
    const baseTimeStep = 0.01;  // Small fixed step for accuracy
    const physicsStepsPerFrame = Math.round(10 * this.simulationSpeed);

    for (let i = 0; i < physicsStepsPerFrame; i++) {
      this.particleManager.update(baseTimeStep);
    }

    // Periodically update UI
    if (Math.floor(elapsedTime * 10) % 5 === 0) {
      this.updateUI();
    }

    // Render based on mode
    if (this.raytracerMode) {
      // Update and render active raytracer
      const activeRaytracer = this.getActiveRaytracer();
      if (activeRaytracer) {
        activeRaytracer.update(this.camera, deltaTime);
        activeRaytracer.render(this.renderer);
      }

      // Overlay particles on top of raytracer
      if (this.particleManager.getCount() > 0) {
        // Clear only depth buffer, preserve color (raytracer output)
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.particleScene, this.camera);
        this.renderer.autoClear = true;
      }
    } else if (this.gravitationalLens && this.gravitationalLens.enabled) {
      this.gravitationalLens.render();
      // Also render particles
      if (this.particleManager.getCount() > 0) {
        this.renderer.autoClear = false;
        this.renderer.render(this.particleScene, this.camera);
        this.renderer.autoClear = true;
      }
    } else {
      // Standard mode: render main scene
      this.renderer.render(this.scene, this.camera);
      // Particles are in particleScene, render them too
      if (this.particleManager.getCount() > 0) {
        this.renderer.autoClear = false;
        this.renderer.render(this.particleScene, this.camera);
        this.renderer.autoClear = true;
      }
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

    if (this.optimizedRaytracer) {
      this.optimizedRaytracer.dispose();
    }

    if (this.kerrRaytracer) {
      this.kerrRaytracer.dispose();
    }

    this.renderer.dispose();
    this.controls.dispose();

    this.container.removeChild(this.renderer.domElement);
  }
}
