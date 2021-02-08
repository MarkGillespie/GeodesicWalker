import {
  InstancedMesh,
  InstancedBufferAttribute,
  IcosahedronGeometry,
  Vector3,
  Matrix4,
  MeshBasicMaterial,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { requestPickBufferRange, pickIndToVector } from "./pick.js";

import {
  createInstancedMatCapMaterial,
  createInstancedScalarFunctionMaterial,
  createPointCloudPickMaterial,
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
    this.pickMesh.material.uniforms.scale.value = rad;
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
      this.ps.pickScene.add(this.pickMesh);
    } else {
      for (let q in this.quantities) {
        this.ps.scene.remove(this.quantities[q].mesh);
      }
      this.ps.scene.remove(this.mesh);
      this.ps.pickScene.remove(this.pickMesh);
    }
  }

  enableQuantity(q) {
    if (q.isDominantQuantity) {
      for (let pName in this.quantities) {
        let p = this.quantities[pName];
        if (p.isDominantQuantity && pName != q.name) {
          this.guiFields[p.prefix + "#Enabled"] = false;
          p.enabled = false;
          this.ps.scene.remove(p.mesh);
        }
      }
    }

    if (this.enabled) {
      if (q.isDominantQuantity) {
        this.ps.scene.remove(this.mesh);
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
    this.ps.setDataHeader(`Point Cloud ${this.name} Vertex ${localInd}`);

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
    let totalPickElements = this.nV;

    // 3 dimensions
    let colors = new Float32Array(3 * this.nV);

    // In "global" indices, indexing all elements in the scene, used to fill buffers for drawing here
    let pickStart = requestPickBufferRange(this, totalPickElements);

    // compute colors in each face
    for (let iV = 0; iV < this.nV; iV++) {
      let vColor = pickIndToVector(iV + pickStart);
      for (let iD = 0; iD < 3; ++iD) {
        colors[3 * iV + +iD] = vColor[iD];
      }
    }

    // create matcap material
    let pickMaterial = createPointCloudPickMaterial();
    let pickMesh = new InstancedMesh(
      this.mesh.geometry.clone(),
      pickMaterial,
      this.nV
    );
    pickMesh.geometry.setAttribute(
      "color",
      new InstancedBufferAttribute(colors, 3)
    );

    // Positions are copied from this.mesh.geometry
    // This ensures that moving the vertex positions of the mesh also moves the pick mesh's vertices
    pickMesh.geometry.attributes.position = this.mesh.geometry.attributes.position;
    pickMesh.material.uniforms.scale = this.mesh.material.uniforms.scale;
    pickMesh.instanceMatrix = this.mesh.instanceMatrix;

    return pickMesh;
  }

  updatePositions() {}
}

export { PointCloud };
