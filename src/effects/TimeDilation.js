/**
 * Time Dilation Visualization
 *
 * Visualizes gravitational time dilation effects:
 * - Proper time vs coordinate time comparison
 * - Visual representation of time slowing near the black hole
 * - Clock comparison at different distances
 */

import * as THREE from 'three';
import { timeDilationFactor, gravitationalRedshift } from '../physics/constants.js';

/**
 * Time Dilation Visualizer
 * Shows clocks at different distances from the black hole
 */
export class TimeDilationVisualizer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.rs = options.schwarzschildRadius || 1;

    this.group = new THREE.Group();
    this.clocks = [];
    this.coordinateTime = 0;

    // Create clocks at different distances
    this.createClocks();

    // Create time comparison display
    this.createTimeDisplay();

    scene.add(this.group);
  }

  /**
   * Create visual clocks at different distances
   */
  createClocks() {
    const distances = [2, 3, 5, 10];  // Distances in rs units
    const colors = [0xff3333, 0xff9933, 0xffff33, 0x33ff33];

    distances.forEach((dist, i) => {
      const clock = this.createClock(dist, colors[i]);
      this.clocks.push({
        mesh: clock,
        distance: dist,
        properTime: 0,
        hand: clock.children.find(c => c.name === 'hand')
      });

      // Position clocks in a vertical arrangement
      clock.position.set(this.rs * dist * 1.5, 3, 0);
      this.group.add(clock);
    });
  }

  /**
   * Create a single clock visualization
   */
  createClock(distance, color) {
    const group = new THREE.Group();

    // Clock face
    const faceGeometry = new THREE.CircleGeometry(0.5, 32);
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    group.add(face);

    // Clock rim
    const rimGeometry = new THREE.RingGeometry(0.48, 0.52, 32);
    const rimMaterial = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.z = 0.01;
    group.add(rim);

    // Hour markers
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const markerGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.01);
      const marker = new THREE.Mesh(
        markerGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      marker.position.x = Math.sin(angle) * 0.4;
      marker.position.y = Math.cos(angle) * 0.4;
      marker.position.z = 0.02;
      marker.rotation.z = -angle;
      group.add(marker);
    }

    // Clock hand
    const handGeometry = new THREE.BoxGeometry(0.03, 0.35, 0.02);
    handGeometry.translate(0, 0.15, 0);
    const handMaterial = new THREE.MeshBasicMaterial({ color: color });
    const hand = new THREE.Mesh(handGeometry, handMaterial);
    hand.position.z = 0.03;
    hand.name = 'hand';
    group.add(hand);

    // Distance label
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`r = ${distance} rs`, 64, 24);

    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true
    });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(1, 0.25, 1);
    label.position.y = -0.7;
    group.add(label);

    return group;
  }

  /**
   * Create time comparison display
   */
  createTimeDisplay() {
    // This would be a HTML overlay, handled separately
    // For now, we just update the DOM element if it exists
  }

  /**
   * Update all clocks based on elapsed coordinate time
   * @param {number} deltaTime - Coordinate time elapsed
   */
  update(deltaTime) {
    this.coordinateTime += deltaTime;

    this.clocks.forEach(clock => {
      // Calculate proper time at this distance
      const dilationFactor = timeDilationFactor(clock.distance);
      clock.properTime += deltaTime * dilationFactor;

      // Rotate clock hand based on proper time
      // One full rotation per 10 seconds of proper time
      if (clock.hand) {
        clock.hand.rotation.z = -(clock.properTime / 10) * Math.PI * 2;
      }

      // Visual feedback - pulse based on time rate
      const scale = 1 + Math.sin(clock.properTime * 5) * 0.02 * dilationFactor;
      clock.mesh.scale.setScalar(scale);
    });
  }

  /**
   * Get time comparison data for UI
   */
  getTimeData() {
    return {
      coordinateTime: this.coordinateTime,
      clocks: this.clocks.map(c => ({
        distance: c.distance,
        properTime: c.properTime,
        dilationFactor: timeDilationFactor(c.distance)
      }))
    };
  }

  /**
   * Toggle visibility
   */
  setVisible(visible) {
    this.group.visible = visible;
  }

  /**
   * Reset all clocks
   */
  reset() {
    this.coordinateTime = 0;
    this.clocks.forEach(clock => {
      clock.properTime = 0;
      if (clock.hand) {
        clock.hand.rotation.z = 0;
      }
    });
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}

/**
 * Time Dilation Field Visualization
 * Shows the time dilation as a color field around the black hole
 */
export class TimeDilationField {
  constructor(options = {}) {
    this.rs = options.schwarzschildRadius || 1;
    this.size = options.size || 30;

    this.mesh = this.createField();
  }

  createField() {
    const geometry = new THREE.PlaneGeometry(this.size, this.size, 128, 128);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        rs: { value: this.rs },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float rs;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          // Calculate distance from center
          float dist = length(vPosition.xy);
          float r = dist / rs;

          if (r <= 1.0) {
            // Inside event horizon - completely stopped time
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.8);
            return;
          }

          // Time dilation factor: sqrt(1 - rs/r)
          float dilation = sqrt(1.0 - 1.0/r);

          // Color based on dilation
          // 0 = red (time stopped), 1 = green (normal time)
          vec3 slowColor = vec3(1.0, 0.0, 0.0);   // Red - time stopped
          vec3 normalColor = vec3(0.0, 1.0, 0.0); // Green - normal time

          vec3 color = mix(slowColor, normalColor, dilation);

          // Fade out at edges
          float edgeFade = smoothstep(15.0, 10.0, dist);

          // Pulsing effect based on local time rate
          float pulse = sin(time * dilation * 3.0) * 0.1 + 0.9;

          float alpha = edgeFade * 0.3 * pulse;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.5;  // Slightly below the equatorial plane

    return mesh;
  }

  update(time) {
    if (this.mesh.material.uniforms) {
      this.mesh.material.uniforms.time.value = time;
    }
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  getObject() {
    return this.mesh;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
