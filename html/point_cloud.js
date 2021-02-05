import {
  InstancedMesh,
  IcosahedronGeometry,
  Vector3,
  Matrix4,
  MeshBasicMaterial,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { requestPickBufferRange, pickIndToVector } from "./pick.js";

import {
  createInstancedMatCapMaterial,
  createSurfaceMeshPickMaterial,
} from "./shaders.js";
import { getNextUniqueColor } from "./color_utils.js";
import { PointCloudScalarQuantity } from "./scalar_quantity.js";

class PointCloud {
  constructor(coords, name, polyscopeEnvironment) {
    this.ps = polyscopeEnvironment;
    this.nV = coords.size();
    this.coords = coords;
    this.name = name;
    this.enabled = true;

    // build three.js mesh
    this.mesh = this.constructThreeMesh(coords);

    this.pickMesh = this.constructThreePickMesh(coords);

    this.quantities = {};

    this.guiFields = undefined;
    this.guiFolder = undefined;
  }

  addScalarQuantity(name, values) {
    this.quantities[name] = new PointCloudScalarQuantity(name, values, this);

    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(this.guiFields, quantityGui);
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

    guiFolder.open();
  }

  setColor(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color.value = c;
  }

  setRadius(rad) {
    this.mesh.material.uniforms.scale.value = rad;
  }

  setEnabled(enabled) {
    this.guiFields[this.name + "#Enabled"] = enabled;
    this.enabled = enabled;
    if (enabled) {
      let enabledQuantity = false;
      for (let q in this.quantities) {
        if (this.quantities[q].enabled) {
          this.ps.scene.add(this.quantities[q].mesh);
          enabledQuantity = true;
        }
      }
      if (!enabledQuantity) {
        this.ps.scene.add(this.mesh);
      }
      // this.ps.pickScene.add(this.pickMesh);
    } else {
      for (let q in this.quantities) {
        this.ps.scene.remove(this.quantities[q].mesh);
      }
      this.ps.scene.remove(this.mesh);
      // this.ps.pickScene.remove(this.pickMesh);
    }
  }

  enableQuantity(q) {
    for (let pName in this.quantities) {
      if (pName != q.name) {
        let p = this.quantities[pName];
        this.guiFields[p.prefix + "#Enabled"] = false;
        p.enabled = false;
      }
    }

    if (this.enabled) {
      this.ps.scene.remove(this.mesh);
      for (let pName in this.quantities) {
        this.ps.scene.remove(this.quantities[pName].mesh);
      }
      this.ps.scene.add(q.mesh);
    }
  }

  disableQuantity(q) {
    if (this.enabled) {
      this.ps.scene.remove(q.mesh);
      this.ps.scene.add(this.mesh);
    }
  }

  remove() {
    for (let q in this.quantities) {
      this.ps.scene.remove(this.quantities[q].mesh);
      this.quantities[q].remove();
    }
    this.quantities = {};
  }

  constructThreeMesh(coords) {
    let sphereGeometry = new IcosahedronGeometry(0.025, 2);

    // create matcap material
    let matcapMaterial = createInstancedMatCapMaterial(
      this.ps.matcapTextures.r,
      this.ps.matcapTextures.g,
      this.ps.matcapTextures.b,
      this.ps.matcapTextures.k
    );

    // create mesh
    let threeMesh = new InstancedMesh(sphereGeometry, matcapMaterial, this.nV);

    // set instance positions
    let mat = new Matrix4();
    let positions = new Float32Array(3 * this.nV);
    for (let iV = 0; iV < this.nV; iV++) {
      let pos = coords.get(iV);
      mat.setPosition(pos[0], pos[1], pos[2]);
      threeMesh.setMatrixAt(iV, mat);
    }

    return threeMesh;
  }

  pickElement(localInd) {
    this.ps.setDataHeader("Vertex " + localInd);

    this.ps.clearDataFields();
    this.ps.showDataField(
      "position",
      this.ps.prettyVector(this.coords.get(localInd))
    );

    for (let qName in this.quantities) {
      let qVal = this.quantities[qName].getVertexValue(localInd);
      if (qVal) {
        this.ps.showDataField(qName, qVal);
      }
    }
  }

  // must be called after constructThreeMesh
  constructThreePickMesh(coords) {
    /*
    let pickGeo = new BufferGeometry();

    let totalPickElements = this.nV;

    // In "global" indices, indexing all elements in the scene, used to fill buffers for drawing here

    // 3 dimensions
    let vertexColors = new Float32Array(3 * this.nV);

    // Build all quantities in each face
    for (let iF = 0; iF < F; iF++) {
      let face = faces.get(iF);
      let fColor = pickIndToVector(iF + faceGlobalPickIndStart);

      let vColors = [0, 1, 2].map((i) =>
        pickIndToVector(pickStart + face.get(i))
      );
      let eColors = [1, 2, 0].map((i) => {
        let edgeHash = minmax(face.get(i), face.get((i + 1) % 3));
        return pickIndToVector(edgeGlobalPickIndStart + edgeIndex[edgeHash]);
      });

      for (let iV = 0; iV < 3; iV++) {
        let vertex = face.get(iV);

        for (let iD = 0; iD < 3; ++iD) {
          faceColors[3 * 3 * iF + 3 * iV + iD] = fColor[iD];

          vertexColors0[3 * 3 * iF + 3 * iV + iD] = vColors[0][iD];
          vertexColors1[3 * 3 * iF + 3 * iV + iD] = vColors[1][iD];
          vertexColors2[3 * 3 * iF + 3 * iV + iD] = vColors[2][iD];
          edgeColors0[3 * 3 * iF + 3 * iV + iD] = eColors[2][iD];
          edgeColors1[3 * 3 * iF + 3 * iV + iD] = eColors[0][iD];
          edgeColors2[3 * 3 * iF + 3 * iV + iD] = eColors[1][iD];
        }
      }
    }

    // Positions and barycoords are copied from this.mesh.geometry
    // This ensures that moving the vertex positions of the mesh also moves the pick mesh's vertices
    pickGeo.setAttribute("position", this.mesh.geometry.attributes.position);

    pickGeo.setAttribute("vertex_color", new BufferAttribute(vertexColors, 3));

    // create matcap material
    let pickMaterial = createSurfaceMeshPickMaterial();

    // create mesh
    return new Mesh(pickGeo, pickMaterial);
        */
    return this.mesh;
  }

  updatePositions() {}
}

export { PointCloud };
