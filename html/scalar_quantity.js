import {
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Mesh,
  Color,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { createVertexScalarFunctionMaterial } from "./shaders.js";
import { applyColorMap } from "./color_maps.js";

function computeMinMax(values) {
  let min = values[0];
  let max = values[0];
  values.forEach((v) => {
    min = Math.min(min, v);
    max = Math.max(max, v);
  });
  return [min, max];
}

class VertexScalarQuantity {
  constructor(name, values, parentMesh) {
    this.parent = parentMesh;
    this.ps = this.parent.ps;
    this.values = values;
    this.name = name;
    this.enabled = false;

    [this.dataMin, this.dataMax] = computeMinMax(values);

    // create a new mesh material
    let functionMaterial = createVertexScalarFunctionMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );

    // build a three.js mesh to visualize the function
    this.mesh = new Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
    this.initializeColorMap();

    this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
    this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;
  }

  initGui(guiFields, guiFolder) {
    this.prefix = this.parent.name + "#" + this.name;
    guiFields[this.prefix + "#Enabled"] = false;
    guiFolder
      .add(guiFields, this.prefix + "#Enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFields[this.prefix + "#ColorMap"] = "viridis";
    this.applyColorMap(guiFields[this.prefix + "#ColorMap"]);
    guiFolder
      .add(guiFields, this.prefix + "#ColorMap", [
        "viridis",
        "coolwarm",
        "plasma",
        "magma",
        "inferno",
      ])
      .onChange((cm) => {
        this.applyColorMap(cm);
      })
      .listen()
      .name("Color Map");

    guiFolder.open();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.parent.enableQuantity(this);
    } else {
      this.parent.disableQuantity(this);
    }
  }

  initializeColorMap() {
    let F = this.parent.faces.size();
    let colors = new Float32Array(F * 3 * 3);
    this.mesh.geometry.setAttribute("color", new BufferAttribute(colors, 3));
  }

  applyColorMap(cm) {
    // update color buffer
    const colors = this.mesh.geometry.attributes.color.array;

    let F = this.parent.faces.size();
    for (let iF = 0; iF < F; iF++) {
      let face = this.parent.faces.get(iF);
      for (let iV = 0; iV < 3; iV++) {
        let value = this.values[face.get(iV)];
        let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

        colors[3 * 3 * iF + 3 * iV + 0] = color.r;
        colors[3 * 3 * iF + 3 * iV + 1] = color.g;
        colors[3 * 3 * iF + 3 * iV + 2] = color.b;
      }
    }

    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  remove() {}
}

export { VertexScalarQuantity };
