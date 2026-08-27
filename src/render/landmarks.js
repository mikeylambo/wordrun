/**
 * Landmarks — retired in WORD RUN Phase 7.
 *
 * The authored ski-resort set pieces (bridge, towers, arches, distance
 * boards) were downhill vocabulary; the flat winding track carries none.
 * The class keeps its streaming interface so the frame loop is untouched.
 */

export class Landmarks {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.entries = [];
  }

  reset() {}
  update() {}
}

export default Landmarks;
