import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { TrackballControls } from "https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js";
import { WEBGL } from "https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js";
import { Reflector } from "https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js";

import {
  groundPlaneVertexShader,
  groundPlaneFragmentShader,
} from "./shaders.js";
import { SurfaceMesh } from "./surface_mesh.js";
import { evaluatePickQuery } from "./pick.js";
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
    if (!WEBGL.isWebGLAvailable()) alert(WEBGL.getWebGLErrorMessage());

    this.input = undefined;

    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.controls = undefined;
    this.shiftClick = false;
    this.matcapTextures = undefined;

    this.pickRenderer = undefined;
    this.pickScene = undefined;

    this.surfaceMeshes = {};
    this.curveNetworks = {};

    this.mesh = undefined;
    this.geo = undefined;

    this.structureGui = undefined;
    this.structureGuiFields = {};
    this.structureGuiMeshes = undefined;
    this.structureCurveNetworks = undefined;

    this.commandGui = new dat.GUI();
    this.commandGuiFields = {};

    this.groundPlane = undefined;

    this.onMeshLoad = (text) => {};
    this.userCallback = () => {};

    this.sceneMin = new THREE.Vector3(0, 0, 0);
    this.sceneMax = new THREE.Vector3(0, 0, 0);
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

    this.input.addEventListener(
      "change",
      function (e) {
        // show spinner
        document.getElementById("spinner").style.display = "inline-block";

        let file = this.input.files[0];
        let filename = file.name;

        if (filename.endsWith(".obj")) {
          let reader = new FileReader();
          reader.onload = function (e) {
            this.onMeshLoad(reader.result);
            document.getElementById("spinner").style.display = "none";
          }.bind(this);

          reader.onerror = function (e) {
            alert("Unable to load OBJ file");
            document.getElementById("spinner").style.display = "none";
          };

          reader.readAsText(file);
        } else {
          alert("Please load an OBJ file");
          document.getElementById("spinner").style.display = "none";
        }
      }.bind(this)
    );

    this.container = document.createElement("div");
    this.container.classList.add("container");
    document.body.appendChild(this.container);

    this.initRenderer(this.container);
    this.initMatcap();
    this.initGUI();
    this.initCamera();
    this.initScene();
    this.initLights();
    this.initControls();
    this.initGroundPlane();
    this.addEventListeners();
  }

  initGroundPlane() {
    let tex = new THREE.TextureLoader().load("img/concrete.png");
    this.groundPlane = new Reflector(new THREE.PlaneGeometry(100, 100), {
      clipBias: 0.003,
      textureWidth: window.innerWidth * window.devicePixelRatio,
      textureHeight: window.innerHeight * window.devicePixelRatio,
      color: 0x777777,
    });
    this.groundPlane.material.vertexShader = groundPlaneVertexShader;
    this.groundPlane.material.fragmentShader = groundPlaneFragmentShader;
    this.groundPlane.material.uniforms.tex = { value: tex };
    this.groundPlane.material.uniforms.alpha = { value: 0.5 };
    let uvs = new Float32Array(4 * 2);
    this.groundPlane.geometry.setAttribute(
      "texture_uv",
      new THREE.BufferAttribute(Float32Array.from([0, 0, 0, 1, 1, 0, 1, 1]), 2)
    );
    this.groundPlane.rotateX(-Math.PI / 2);
    this.scene.add(this.groundPlane);
  }

  loadMesh(callback) {
    this.onMeshLoad = callback;
    this.input.click();
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

    this.pickRenderer = new THREE.WebGLRenderer({
      antialias: false, // turn antialiasing off for color based picking
    });
    this.pickRenderer.setPixelRatio(window.devicePixelRatio);
    this.pickRenderer.setClearColor(0xffffff, 1.0);
    this.pickRenderer.setSize(window.innerWidth, window.innerHeight);
    // TODO: do I need to do this?
    container.appendChild(this.pickRenderer.domElement);
  }

  initGUI() {
    this.structureGui = new dat.GUI({ autoPlace: false });

    let structureGuiWrapper = document.createElement("div");
    document.body.appendChild(structureGuiWrapper);
    structureGuiWrapper.id = "structure-gui";
    structureGuiWrapper.appendChild(this.structureGui.domElement);

    this.polyscopeOptions = this.structureGui.addFolder("Polyscope");
    this.polyscopeOptions.open();
    this.structureGuiFields["GroundPlane#Enabled"] = true;
    this.polyscopeOptions
      .add(this.structureGuiFields, "GroundPlane#Enabled")
      .onChange((e) => {
        if (e) {
          this.scene.add(this.groundPlane);
        } else {
          this.scene.remove(this.groundPlane);
        }
      })
      .listen()
      .name("Ground Plane");
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

    this.pickScene = new THREE.Scene();
    this.pickScene.background = new THREE.Color(0xffffff);
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
    // this.scene.add(meshStructure.pickMesh);
    this.pickScene.add(meshStructure.pickMesh);

    let bbox = new THREE.Box3().setFromObject(meshStructure.mesh);

    this.sceneMin.min(bbox.min);
    this.sceneMax.max(bbox.max);

    let oldPos = this.groundPlane.position;
    this.groundPlane.translateZ(this.sceneMin.y - oldPos.y, 1);

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
    this.scene.remove(this.curveNetworks[name].mesh);
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

  pick(clickX, clickY) {
    let pickResult = evaluatePickQuery(
      this.pickRenderer,
      this.pickScene,
      this.camera,
      clickX,
      clickY
    );
    if (pickResult.structure) {
      pickResult.structure.pickElement(pickResult.localInd);
    }
  }

  addEventListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this), false);

    // attacking the eventListener to the renderer instead of the window ensures
    // that clicking on the GUI doesn't trigger polyscope's mouseClick handler
    this.renderer.domElement.addEventListener(
      "click",
      this.onMouseClick.bind(this),
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

  onMouseClick(event) {
    if (
      event.clientX >= 0 &&
      event.clientX <= window.innerWidth &&
      event.clientY >= 0 &&
      event.clientY <= window.innerHeight
    ) {
      this.pick(event.clientX, event.clientY);
    }
  }

  animate() {
    requestAnimationFrame(
      function () {
        this.animate();
      }.bind(this)
    );
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

  message(str) {
    let message = document.createElement("div");
    let messageBuffer = document.getElementById("messages");
    messageBuffer.insertBefore(message, messageBuffer.firstChild);
    message.innerHTML = str;
  }
}

export { Polyscope };
