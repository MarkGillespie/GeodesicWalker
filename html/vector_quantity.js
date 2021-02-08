import {
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  CylinderGeometry,
  Vector3,
  Mesh,
  InstancedMesh,
  Color,
  Matrix4,
  Group,
  MeshPhongMaterial,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import {
  createMatCapMaterial,
  createInstancedMatCapMaterial,
} from "./shaders.js";

import { getNextUniqueColor } from "./color_utils.js";

class VertexVectorQuantity {
  constructor(name, values, parentMesh) {
    this.parent = parentMesh;
    this.ps = this.parent.ps;
    this.values = values;
    this.name = name;
    this.enabled = false;
    this.res = 4;
    this.rad = 0.5;
    this.len = 3;
    this.tipFrac = 0.3;
    this.widthFrac = 0.5;

    this.isDominantQuantity = false;

    // build a three.js mesh to visualize the function
    this.mesh = this.constructArrowMesh(this.parent.coords, values);
  }

  constructArrowMesh(bases, directions) {
    let torsoGeometry = new CylinderGeometry(
      this.rad * this.widthFrac,
      this.rad * this.widthFrac,
      this.len * (1 - this.tipFrac),
      this.res
    );

    // By default, the cylinder is vertically centered. But I want it to go upwards
    // from the origin, so I translate all of its vertices up by height/2
    let positions = torsoGeometry.attributes.position.array;
    let V = torsoGeometry.attributes.position.count;
    let minY = (-this.len * (1 - this.tipFrac)) / 2;
    for (let i = 0; i < V; i++) {
      positions[3 * i + 1] = positions[3 * i + 1] - minY;
    }

    let tipGeometry = new CylinderGeometry(
      0,
      this.rad,
      this.len * this.tipFrac,
      this.res
    );

    // By default, the tip is vertically centered. But I want it to be at the top
    // of the cylinder, so again I translate all of its vertices up
    positions = tipGeometry.attributes.position.array;
    V = tipGeometry.attributes.position.count;
    minY = (-this.len * this.tipFrac) / 2;
    for (let i = 0; i < V; i++) {
      positions[3 * i + 1] =
        positions[3 * i + 1] - minY + this.len * (1 - this.tipFrac);
    }

    let mat = new Matrix4();
    // prettier-ignore
    mat.set(0, 0, 1, 0,
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 0, 1);
    torsoGeometry.applyMatrix4(mat);
    tipGeometry.applyMatrix4(mat);

    // create matcap material
    let material = createInstancedMatCapMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );
    material.uniforms.scale.value = 0.05;

    let nV = this.parent.nV;
    this.torsoMesh = new InstancedMesh(torsoGeometry, material, nV);
    this.tipMesh = new InstancedMesh(tipGeometry, material, nV);

    mat = new Matrix4();
    for (let iV = 0; iV < nV; iV++) {
      let pos = this.parent.coords.get(iV);
      let v = directions.get(iV);
      mat.lookAt(v, new Vector3(0, 0, 0), new Vector3(0, 0, 1));
      mat.setPosition(pos[0], pos[1], pos[2]);
      this.torsoMesh.setMatrixAt(iV, mat);
      this.tipMesh.setMatrixAt(iV, mat);
    }

    let arrows = new Group();
    arrows.add(this.torsoMesh);
    arrows.add(this.tipMesh);

    return arrows;
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

    guiFields[this.name + "#Color"] = getNextUniqueColor();
    this.setColor(guiFields[this.name + "#Color"]);
    guiFolder
      .addColor(guiFields, this.name + "#Color")
      .onChange((c) => {
        this.setColor(c);
      })
      .listen()
      .name("Color");

    guiFields[this.name + "#Radius"] = 1;
    this.setRadius(guiFields[this.name + "#Radius"]);
    guiFolder
      .add(guiFields, this.name + "#Radius")
      .min(0)
      .max(5)
      .step(0.05)
      .onChange((c) => {
        this.setRadius(c);
      })
      .listen()
      .name("Radius");
  }

  setColor(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.torsoMesh.material.uniforms.color.value = c;
    this.tipMesh.material.uniforms.color.value = c;
  }

  setRadius(rad) {
    this.torsoMesh.material.uniforms.scale.value = rad * 0.05;
    this.tipMesh.material.uniforms.scale.value = rad * 0.05;
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

  getVertexValue(iV) {
    let vec = this.values.get(iV);
    let vecList = [vec.x, vec.y, vec.z];
    return this.ps.prettyVector(vecList);
  }
  getEdgeValue(iE) {
    return undefined;
  }
  getFaceValue(iE) {
    return undefined;
  }
}

export { VertexVectorQuantity };
