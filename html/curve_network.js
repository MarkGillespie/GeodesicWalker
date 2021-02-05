import { Vector3 } from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { LineSegments2 } from "https://unpkg.com/three@0.125.1/examples/jsm/lines/LineSegments2.js";
import { LineMaterial } from "https://unpkg.com/three@0.125.1/examples/jsm/lines/LineMaterial.js";
import { LineSegmentsGeometry } from "https://unpkg.com/three@0.125.1/examples/jsm/lines/LineSegmentsGeometry.js";

import { getNextUniqueColor } from "./color_utils.js";

class CurveNetwork {
  constructor(vertices, segments, maxLen, name, polyscopeEnvironment) {
    this.ps = polyscopeEnvironment;

    [this.mesh, this.geo] = this.constructThreeCurveNetwork(
      vertices,
      segments,
      maxLen
    );
    this.segments = segments;
    this.maxLen = maxLen;
    this.name = name;
    this.quantities = {};

    this.guiFields = undefined;
    this.guiFolder = undefined;
  }

  setEnabled(enabled) {
    this.guiFields[this.name + "#Enabled"] = enabled;
    if (enabled) {
      this.ps.scene.add(this.mesh);
    } else {
      this.ps.scene.remove(this.mesh);
    }
  }

  remove() {
    for (let q in this.quantities) {
      this.ps.scene.remove(this.quantities[q].mesh);
      this.quantities[q].remove();
    }
    this.quantities = {};
  }

  updateVertexPositions(newPositions) {
    // fill position buffer
    let positions = new Float32Array(this.segments.length * 2 * 3);
    for (let iS = 0; iS < this.segments.length; iS++) {
      for (let iV = 0; iV < 2; ++iV) {
        for (let iD = 0; iD < 3; ++iD) {
          positions[3 * 2 * iS + 3 * iV + iD] =
            newPositions[this.segments[iS][iV]][iD];
        }
      }
    }

    this.mesh.geometry.setPositions(positions, 3);

    this.mesh.geometry.attributes.instanceStart.needsUpdate = true;
    this.mesh.geometry.attributes.instanceEnd.needsUpdate = true;
  }

  setColor(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.color = c;
  }

  initGui(guiFields, guiFolder) {
    this.guiFields = guiFields;
    this.guiFolder = guiFolder;

    guiFields[this.name + "#Enabled"] = true;
    guiFolder
      .add(guiFields, this.name + "#Enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFields[this.name + "#Color"] = getNextUniqueColor();
    this.setColor(guiFields[this.name + "#Color"]);
    guiFolder
      .addColor(guiFields, this.name + "#Color")
      .onChange((c) => {
        this.setColor(c);
      })
      .listen()
      .name("Color");

    guiFields[this.name + "#Width"] = 5;
    guiFolder
      .add(guiFields, this.name + "#Width")
      .min(0)
      .max(50)
      .step(0.25)
      .onChange((width) => {
        this.mesh.material.linewidth = width / 1000;
      })
      .listen()
      .name("Edge Width");

    guiFolder.open();
  }

  constructThreeCurveNetwork(vertices, segments, maxLen) {
    // create geometry object
    let threeGeometry = new LineSegmentsGeometry();

    // fill position and color buffers
    let positions = new Float32Array(segments.length * 2 * 3);
    for (let iS = 0; iS < segments.length; iS++) {
      for (let iV = 0; iV < 2; ++iV) {
        for (let iD = 0; iD < 3; ++iD) {
          positions[3 * 2 * iS + 3 * iV + iD] = vertices[segments[iS][iV]][iD];
        }
      }
    }

    threeGeometry.setPositions(positions, 3);

    // create line material
    let lineMaterial = new LineMaterial({
      color: 0xff00ff,
      linewidth: 0.005,
    });

    // create mesh
    let threeMesh = new LineSegments2(threeGeometry, lineMaterial);
    // let threeMesh = new LineSegments2(threeGeometry);
    threeMesh.computeLineDistances();
    threeMesh.scale.set(1, 1, 1);
    return [threeMesh, threeGeometry];
  }
}

export { CurveNetwork };
