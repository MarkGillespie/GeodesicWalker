import {
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Matrix4,
  Euler,
  Mesh,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { createMatCapMaterial } from "./shaders.js";
import { getNextUniqueColor } from "./color_utils.js";

class SurfaceMesh {
  constructor(coords, faces, name, polyscopeEnvironment) {
    this.ps = polyscopeEnvironment;
    this.nV = coords.size();
    this.faces = faces;
    this.name = name;
    this.enabled = this.ps.structureGuiFields[this.name + "#Enabled"];

    // build three.js mesh
    [this.mesh, this.geo] = this.constructThreeMesh(coords, faces);
    this.quantities = {};

    this.setSmoothShading(true);
  }

  initGui(guiFields, guiFolder) {
    guiFields[this.name + "#Enabled"] = true;
    guiFolder
      .add(guiFields, this.name + "#Enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFields[this.name + "#Smooth"] = true;
    guiFolder
      .add(guiFields, this.name + "#Smooth")
      .onChange((c) => {
        this.setSmoothShading(c);
      })
      .listen()
      .name("Smooth");

    guiFields[this.name + "#Color"] = getNextUniqueColor();
    this.setColor(guiFields[this.name + "#Color"]);
    guiFolder
      .addColor(guiFields, this.name + "#Color")
      .onChange((c) => {
        this.setMeshColor(c);
      })
      .listen()
      .name("Color");
    guiFields[this.name + "#Edge Width"] = 0;
    guiFolder
      .add(guiFields, this.name + "#Edge Width")
      .min(0)
      .max(2)
      .step(0.05)
      .onChange((width) => {
        this.mesh.material.uniforms.edgeWidth.value = width;
      })
      .listen()
      .name("Edge Width");
    guiFolder.open();

    guiFields[this.name + "#Edge Color"] = [0, 0, 0];
    guiFolder
      .addColor(guiFields, this.name + "#Edge Color")
      .onChange((c) => {
        this.setEdgeColor(c);
      })
      .listen()
      .name("Edge Color");
  }

  setSmoothShading(shadeSmooth) {
    if (shadeSmooth) {
      this.mesh.geometry.setAttribute(
        "normal",
        new BufferAttribute(this.computeSmoothNormals(), 3)
      );
    } else {
      this.mesh.geometry.computeVertexNormals();
    }
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }

  setColor(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color.value = c;
  }

  setEdgeColor(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.edgeColor.value = c;
  }

  setEnabled(enabled) {
    if (enabled) {
      this.ps.scene.add(this.mesh);
    } else {
      this.ps.scene.remove(this.mesh);
    }
  }

  remove() {
    for (let q in this.quantities) {
      this.quantities[q].remove();
    }
    this.quantities = {};
  }

  computeSmoothNormals() {
    // TODO: handle non-triangular face
    let V = this.nV;
    let F = this.faces.size();
    let vertexNormals = new Float32Array(V * 3);
    for (let iV = 0; iV < V; ++iV) {
      vertexNormals[3 * iV + 0] = 0;
      vertexNormals[3 * iV + 1] = 0;
      vertexNormals[3 * iV + 2] = 0;
    }

    const currNormals = this.mesh.geometry.attributes.normal.array;
    for (let iF = 0; iF < F; iF++) {
      let face = this.faces.get(iF);
      for (let iV = 0; iV < 3; iV++) {
        let v = face.get(iV);
        for (let iD = 0; iD < 3; ++iD) {
          vertexNormals[3 * v + iD] += currNormals[3 * 3 * iF + 3 * iV + iD];
        }
      }
    }

    for (let iV = 0; iV < V; ++iV) {
      let n = new Vector3(
        vertexNormals[3 * iV + 0],
        vertexNormals[3 * iV + 1],
        vertexNormals[3 * iV + 2]
      );
      n.normalize();
      vertexNormals[3 * iV + 0] = n.x;
      vertexNormals[3 * iV + 1] = n.y;
      vertexNormals[3 * iV + 2] = n.z;
    }

    let normals = new Float32Array(F * 3 * 3);
    for (let iF = 0; iF < F; iF++) {
      let face = this.faces.get(iF);
      for (let iV = 0; iV < 3; iV++) {
        for (let iD = 0; iD < 3; ++iD) {
          normals[3 * 3 * iF + 3 * iV + iD] =
            vertexNormals[3 * face.get(iV) + iD];
        }
      }
    }
    return normals;
  }

  setPosition(pos) {
    // First, undo the mesh's rotation so that we translate in the global coordinate frame
    let oldRot = new Euler(
      this.mesh.rotation.x,
      this.mesh.rotation.y,
      this.mesh.rotation.z
    );
    this.mesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
    let oldPos = this.mesh.position;
    this.mesh.translateX(pos.x - oldPos.x, 1);
    this.mesh.translateY(pos.y - oldPos.y, 1);
    this.mesh.translateZ(pos.z - oldPos.z, 1);

    // After translating, we re-apply the old rotation
    this.mesh.setRotationFromEuler(oldRot);
  }

  setOrientationFromMatrix(mat) {
    this.mesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
    this.mesh.setRotationFromMatrix(mat);
  }

  setOrientationFromFrame(T, N, B) {
    let mat = new Matrix4();
    // prettier-ignore
    mat.set(
          -T.x, N.x, -B.x, 0,
          -T.y, N.y, -B.y, 0,
          -T.z, N.z, -B.z, 0,
          0,    0,   0,    1
      );

    this.setOrientationFromMatrix(mat);
  }

  constructThreeMesh(coords, faces) {
    // create geometry object
    let threeGeometry = new BufferGeometry();

    // fill position and barycoord buffers
    let F = faces.size();
    let positions = new Float32Array(F * 3 * 3);
    let normals = new Float32Array(F * 3 * 3);
    let barycoords = new Float32Array(F * 3 * 3);
    for (let iF = 0; iF < F; iF++) {
      let face = faces.get(iF);
      for (let iV = 0; iV < 3; iV++) {
        for (let iD = 0; iD < 3; ++iD) {
          positions[3 * 3 * iF + 3 * iV + iD] = coords.get(face.get(iV))[iD];
          barycoords[3 * 3 * iF + 3 * iV + iD] = iD == iV ? 1 : 0;
        }
      }
    }

    threeGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    threeGeometry.setAttribute("barycoord", new BufferAttribute(barycoords, 3));
    threeGeometry.computeVertexNormals();

    // create matcap material
    let matcapMaterial = createMatCapMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );

    // create mesh
    let threeMesh = new Mesh(threeGeometry, matcapMaterial);
    return [threeMesh, threeGeometry];
  }
}

export { SurfaceMesh };
