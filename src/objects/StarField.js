/**
 * Star Field Background
 *
 * Creates a realistic starfield for the background
 * Stars are positioned on a distant sphere
 */

import * as THREE from 'three';

export class StarField {
  constructor(options = {}) {
    this.starCount = options.starCount || 10000;
    this.radius = options.radius || 500;
    this.minSize = options.minSize || 0.5;
    this.maxSize = options.maxSize || 2.0;

    this.group = new THREE.Group();
    this.createStars();
    this.createMilkyWay();
  }

  /**
   * Create individual star particles
   */
  createStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);
    const sizes = new Float32Array(this.starCount);

    // Star color temperatures (simplified)
    const starColors = [
      new THREE.Color(0xffffff),  // White
      new THREE.Color(0xfff4e8),  // Warm white
      new THREE.Color(0xffe4c4),  // Yellow-white
      new THREE.Color(0xffd700),  // Yellow
      new THREE.Color(0xffb347),  // Orange
      new THREE.Color(0xff6b6b),  // Red
      new THREE.Color(0x87ceeb),  // Blue-white
    ];

    for (let i = 0; i < this.starCount; i++) {
      // Distribute stars on sphere using spherical coordinates
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = this.radius * Math.sin(phi) * Math.cos(theta);
      const y = this.radius * Math.sin(phi) * Math.sin(theta);
      const z = this.radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Random star color with bias toward white/yellow
      const colorIndex = Math.floor(Math.pow(Math.random(), 2) * starColors.length);
      const color = starColors[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Random size with bias toward smaller stars
      sizes[i] = this.minSize + Math.pow(Math.random(), 3) * (this.maxSize - this.minSize);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for stars with twinkling
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: window.devicePixelRatio }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        uniform float time;
        uniform float pixelRatio;

        void main() {
          vColor = color;
          vSize = size;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Subtle twinkling based on position hash
          float twinkle = sin(time * 2.0 + position.x * 100.0) * 0.2 + 0.8;

          gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z) * twinkle;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;

        void main() {
          // Circular star with soft edge
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          // Soft glow falloff
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.5);

          // Core brightness
          float core = 1.0 - smoothstep(0.0, 0.15, dist);

          vec3 finalColor = vColor * (0.7 + core * 0.3);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.stars = new THREE.Points(geometry, material);
    this.group.add(this.stars);
  }

  /**
   * Create a subtle Milky Way band effect
   */
  createMilkyWay() {
    const milkyWayCount = 5000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(milkyWayCount * 3);
    const colors = new Float32Array(milkyWayCount * 3);
    const sizes = new Float32Array(milkyWayCount);

    const milkyWayColor = new THREE.Color(0xc4b8ff);

    for (let i = 0; i < milkyWayCount; i++) {
      // Concentrate stars along a band (galactic plane)
      const theta = Math.random() * Math.PI * 2;
      // Narrow distribution around phi = PI/2 (equator)
      const phi = Math.PI / 2 + (Math.random() - 0.5) * 0.3;

      // Add some randomness to break up uniformity
      const r = this.radius * (0.98 + Math.random() * 0.04);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Slight color variation
      const colorVar = 0.8 + Math.random() * 0.2;
      colors[i * 3] = milkyWayColor.r * colorVar;
      colors[i * 3 + 1] = milkyWayColor.g * colorVar;
      colors[i * 3 + 2] = milkyWayColor.b * colorVar;

      // Smaller sizes for milky way
      sizes[i] = 0.3 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: window.devicePixelRatio }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pixelRatio;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pixelRatio * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = (1.0 - dist * 2.0) * 0.3;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.milkyWay = new THREE.Points(geometry, material);
    this.group.add(this.milkyWay);
  }

  /**
   * Update star animations
   * @param {number} time - Current time
   */
  update(time) {
    if (this.stars && this.stars.material.uniforms) {
      this.stars.material.uniforms.time.value = time;
    }
    if (this.milkyWay && this.milkyWay.material.uniforms) {
      this.milkyWay.material.uniforms.time.value = time;
    }
  }

  /**
   * Get positions of stars for gravitational lensing calculations
   * @returns {Float32Array} Star positions
   */
  getStarPositions() {
    return this.stars.geometry.attributes.position.array;
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
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    if (this.milkyWay) {
      this.milkyWay.geometry.dispose();
      this.milkyWay.material.dispose();
    }
  }
}
