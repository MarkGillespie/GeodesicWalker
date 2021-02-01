import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { TrackballControls } from "https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js";
import { WEBGL } from "https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js";

import { SurfaceMesh } from "./surface_mesh.js";
import { CurveNetwork } from "./curve_network.js";
import { getNextUniqueColor } from "./color_utils.js";

// https://stackoverflow.com/a/34452130
dat.GUI.prototype.removeFolder = function (name) {
  var folder = this.__folders[name];
  if (!folder) {
    return;
  }
  folder.close();
  this.__ul.removeChild(folder.domElement.parentNode);
  delete this.__folders[name];
  this.onResize();
};

class Polyscope {
  constructor() {
    this.input = undefined;

    this.renderer = undefined;
    this.camera = undefined;
    this.controls = undefined;
    this.shiftClick = false;
    this.scene = undefined;
    this.matcapTextures = undefined;

    this.surfaceMeshes = {};
    this.curveNetworks = {};

    this.mesh = undefined;
    this.geo = undefined;

    this.walkerPosition = undefined;
    this.walkerT = undefined;
    this.walkerB = undefined;
    this.walkerN = undefined;
    this.walkerSurfacePoint = undefined;
    this.walkerDirection = [1, 0];

    this.filename = "bunny.obj";

    this.structureGui = undefined;
    this.structureGuiFields = {};
    this.structureGuiMeshes = undefined;
    this.structureCurveNetworks = undefined;

    this.commandGui = undefined;
    this.commandGuiFields = {
      "Load Mesh": () => {
        this.input.click();
      },
      Speed: 1,
    };

    this.onMeshLoad = (text) => {};
    this.userCallback = () => {};
  }

  // must be called after onload
  initInput() {
    let inputContainer = document.createElement("div");
    this.input = document.createElement("input");
    inputContainer.appendChild(this.input);
    document.body.appendChild(inputContainer);
    this.input.id = "fileInput";
    this.input.style.display = "none";
    this.input.type = "file";
  }

  // Must call after window is loaded
  init() {
    this.initInput();
    this.input.addEventListener("change", function (e) {
      // remove any previously loaded mesh from scene
      polyscope.clearAllStructures();

      // show spinner
      document.getElementById("spinner").style.display = "inline-block";

      let file = polyscope.input.files[0];
      let filename = file.name;

      if (filename.endsWith(".obj")) {
        let reader = new FileReader();
        reader.onload = function (e) {
          polyscope.onMeshLoad(reader.result);
        };

        reader.onerror = function (e) {
          alert("Unable to load OBJ file");
        };

        reader.readAsText(file);
      } else {
        alert("Please load an OBJ file");
      }
    });

    this.container = document.createElement("div");
    this.container.classList.add("container");
    document.body.appendChild(this.container);

    this.initRenderer(this.container);
    this.initMatcap();
    this.initGUI();
    this.initCamera();
    this.initScene();
    this.initLights();
    this.onMeshLoad(bunny);
    this.initControls();
    this.addEventListeners();
  }

  initMatcap() {
    this.matcapTextures = {
      r: undefined,
      g: undefined,
      b: undefined,
      k: undefined,
    };
    this.matcapTextures.r = new THREE.TextureLoader().load("img/clay_r.png");
    this.matcapTextures.g = new THREE.TextureLoader().load("img/clay_g.png");
    this.matcapTextures.b = new THREE.TextureLoader().load("img/clay_b.png");
    this.matcapTextures.k = new THREE.TextureLoader().load("img/clay_k.png");
  }

  initRenderer(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0xffffff, 1.0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  initGUI() {
    this.structureGui = new dat.GUI({ autoPlace: false });

    let structureGuiWrapper = document.createElement("div");
    document.body.appendChild(structureGuiWrapper);
    structureGuiWrapper.id = "structure-gui";
    structureGuiWrapper.appendChild(this.structureGui.domElement);

    this.commandGui = new dat.GUI();
    let io = this.commandGui.addFolder("IO");
    io.add(this.commandGuiFields, "Load Mesh");
    io.close();
    this.commandGui
      .add(this.commandGuiFields, "Speed")
      .min(0)
      .max(10)
      .step(0.1);
  }

  updateDisplayText() {
    let element = document.getElementById("meta");
    element.textContent = "";
  }

  initCamera() {
    const fov = 45.0;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.01;
    const far = 1000;
    const eyeZ = 3.5;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.z = eyeZ;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
  }

  initLights() {
    let ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.camera.add(ambient);

    let point = new THREE.PointLight(0xffffff);
    point.position.set(2, 20, 15);
    this.camera.add(point);

    this.scene.add(this.camera);
  }

  registerSurfaceMesh(name, vertexCoordinates, faces, scale = 1) {
    if (!this.structureGuiMeshes) {
      this.structureGuiMeshes = this.structureGui.addFolder("Surface Meshes");
      this.structureGuiMeshes.open();
    }

    let meshStructure = new SurfaceMesh(vertexCoordinates, faces, name, this);
    this.surfaceMeshes[name] = meshStructure;

    let meshGui = this.structureGuiMeshes.addFolder(name);

    meshStructure.initGui(this.structureGuiFields, meshGui);

    this.scene.add(meshStructure.mesh);

    return meshStructure;
  }

  registerCurveNetwork(name, vertexCoordinates, edges) {
    if (!this.structureGuiCurveNetworks) {
      this.structureGuiCurveNetworks = this.structureGui.addFolder(
        "Curve Networks"
      );
      this.structureGuiCurveNetworks.open();
    }

    if (!edges) {
      edges = [];
      for (let iV = 0; iV + 1 < vertexCoordinates.length; iV++) {
        edges.push([iV, iV + 1]);
      }
    }

    // TODO: allocate extra space?
    let maxLen = vertexCoordinates.length;

    let curveStructure = new CurveNetwork(
      vertexCoordinates,
      edges,
      maxLen,
      name,
      this
    );
    this.curveNetworks[name] = curveStructure;

    let curveGui = this.structureGuiCurveNetworks.addFolder(name);
    curveStructure.initGui(this.structureGuiFields, curveGui);

    this.scene.add(curveStructure.mesh);

    return curveStructure;
  }

  deregisterSurfaceMesh(name) {
    if (!(name in this.surfaceMeshes)) return;

    this.structureGuiMeshes.removeFolder(name);
    this.surfaceMeshes[name].remove();
    this.scene.remove(this.surfaceMeshes[name].mesh);
    delete this.surfaceMeshes[name];
  }

  deregisterCurveNetwork(name) {
    if (!(name in this.curveNetworks)) return;

    this.structureGuiCurveNetworks.removeFolder(name);
    this.curveNetworks[name].remove();
    delete this.curveNetworks[name];
  }

  clearAllStructures() {
    let names = Object.keys(this.surfaceMeshes);
    names.forEach((name) => {
      this.deregisterSurfaceMesh(name);
    });
    names = Object.keys(this.curveNetworks);
    names.forEach((name) => {
      this.deregisterCurveNetwork(name);
    });
  }

  initControls() {
    this.controls = new TrackballControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.rotateSpeed = 5.0;
  }

  addEventListeners() {
    window.addEventListener(
      "resize",
      () => {
        this.onWindowResize();
      },
      false
    );
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.controls.handleResize();
    this.render();
  }

  animate() {
    requestAnimationFrame(() => {
      this.animate();
    });
    this.userCallback();
    if (this.controls) this.controls.update();
    this.render();
  }

  render() {
    // set viewport and render mesh
    let width = window.innerWidth;

    this.renderer.setViewport(0.0, 0.0, width, window.innerHeight);
    this.renderer.setScissor(0.0, 0.0, width, window.innerHeight);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }
}

let polyscope = new Polyscope();

if (!WEBGL.isWebGLAvailable()) alert(WEBGL.getWebGLErrorMessage());

export { polyscope };
