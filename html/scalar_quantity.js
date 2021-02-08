import {
  BufferAttribute,
  InstancedBufferAttribute,
  IcosahedronGeometry,
  Vector3,
  Mesh,
  InstancedMesh,
  Color,
  Matrix4,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import {
  createVertexScalarFunctionMaterial,
  createInstancedScalarFunctionMaterial,
} from "./shaders.js";
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

    this.isDominantQuantity = true;

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

    // Copy some attributes from parent
    this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
    this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
    this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
    this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;
  }

  initGui(guiFields, guiFolder) {
    this.prefix = this.parent.name + "#" + this.name;
    this.guiFields = guiFields;

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
  }

  setEnabled(enabled) {
    this.guiFields[this.prefix + "#Enabled"] = enabled;
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

  getVertexValue(iV) {
    return this.values[iV];
  }
  getEdgeValue(iE) {
    return undefined;
  }
  getFaceValue(iE) {
    return undefined;
  }

  remove() {}
}

class PointCloudScalarQuantity {
  constructor(name, values, parentCloud) {
    this.parent = parentCloud;
    this.ps = this.parent.ps;
    this.values = values;
    this.name = name;
    this.enabled = false;

    this.isDominantQuantity = true;

    [this.dataMin, this.dataMax] = computeMinMax(values);

    // create a new mesh material
    let functionMaterial = createInstancedScalarFunctionMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );

    // create matcap material
    let matcapMaterial = createInstancedScalarFunctionMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );

    // create mesh
    this.mesh = new InstancedMesh(
      this.parent.mesh.geometry.clone(),
      matcapMaterial,
      this.parent.nV
    );

    // Copy some attributes from parent
    this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
    this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
    this.mesh.material.uniforms.scale = this.parent.mesh.material.uniforms.scale;
    this.mesh.instanceMatrix = this.parent.mesh.instanceMatrix;

    this.initializeColorMap();
  }

  initGui(guiFields, guiFolder) {
    this.prefix = this.parent.name + "#" + this.name;
    this.guiFields = guiFields;

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
  }

  setEnabled(enabled) {
    this.guiFields[this.prefix + "#Enabled"] = enabled;
    this.enabled = enabled;
    if (enabled) {
      this.parent.enableQuantity(this);
    } else {
      this.parent.disableQuantity(this);
    }
  }

  initializeColorMap() {
    let V = this.parent.nV;
    let colors = new Float32Array(V * 3);
    this.mesh.geometry.setAttribute(
      "color",
      new InstancedBufferAttribute(colors, 3)
    );
  }

  applyColorMap(cm) {
    // update color buffer
    const colors = this.mesh.geometry.attributes.color.array;

    let V = this.parent.nV;
    for (let iV = 0; iV < V; iV++) {
      let value = this.values[iV];
      let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

      colors[3 * iV + 0] = color.r;
      colors[3 * iV + 1] = color.g;
      colors[3 * iV + 2] = color.b;
    }

    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  getVertexValue(iV) {
    return this.values[iV];
  }
  getEdgeValue(iE) {
    return undefined;
  }
  getFaceValue(iE) {
    return undefined;
  }

  remove() {}
}

export { VertexScalarQuantity, PointCloudScalarQuantity };
