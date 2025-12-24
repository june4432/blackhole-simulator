/**
 * Black Hole Simulator - Entry Point
 *
 * Interactive 3D visualization of a Schwarzschild black hole
 * based on General Relativity physics
 */

import { BlackHoleSimulator } from './BlackHoleSimulator.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  // Create and start the simulator
  const simulator = new BlackHoleSimulator(container);

  // Expose for debugging
  window.simulator = simulator;

  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🌑 Black Hole Simulator 🌑                     ║
║                                                          ║
║   Based on Schwarzschild metric from General Relativity  ║
║                                                          ║
║   Controls:                                              ║
║   • Click: Launch particle toward cursor                 ║
║   • Space: Launch random particle                        ║
║   • Drag: Rotate camera                                  ║
║   • Scroll: Zoom in/out                                  ║
║   • A: Toggle accretion disk                             ║
║   • H: Toggle helper visualizations                      ║
║   • C: Clear all particles                               ║
║                                                          ║
║   Physics implemented:                                   ║
║   • Geodesic motion (RK4 integration)                    ║
║   • Gravitational time dilation                          ║
║   • Gravitational redshift                               ║
║   • Tidal forces (spaghettification)                     ║
║   • Doppler beaming in accretion disk                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
