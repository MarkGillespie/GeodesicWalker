import {
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Mesh,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Lut } from "https://unpkg.com/three@0.125.1/examples/jsm/math/Lut.js";

import { createMatCapMaterial } from "./shaders.js";

class VertexScalarQuantity {
  constructor(name, values, parentMesh) {
    this.parent = parentMesh;
    this.ps = this.parent.ps;
    this.nV = coords.size();
    this.faces = faces;
    this.name = name;
    this.enabled = this.ps.structureGuiFields[this.name + "#Enabled"];

    // build three.js mesh
    [this.mesh, this.geo] = this.constructThreeMesh(coords, faces);
    this.quantities = {};
  }
}

export { VertexScalarQuantity };
