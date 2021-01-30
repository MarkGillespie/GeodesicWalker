if (!Detector.webgl) Detector.addGetWebGLMessage();

let input = document.getElementById("fileInput");
let renderer = undefined;
let camera = undefined;
let controls = undefined;
let shiftClick = false;
let showWireframe = false;
let scene = undefined;
let threeMesh = undefined;
let threeGeometry = undefined;
let wireframe = undefined;
let threeWalkerMesh = undefined;
let threeWalkerGeometry = undefined;
let walkerWireframe = undefined;
let selectedVertex = undefined;
let materialSettings = {
  vertexColors: THREE.VertexColors,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  side: THREE.DoubleSide,
};

let positions = undefined;
let uvs = undefined;
let normals = undefined;
let colors = undefined;
let uvColors = undefined;
let indices = undefined;

let meshFile = undefined;
let mesh = undefined;
let geo = undefined;

let walkerPosition = undefined;
let walkerT = undefined;
let walkerB = undefined;
let walkerN = undefined;
let walkerSurfacePoint = undefined;
let walkerDirection = [1, 0];

let filename = "bunny.obj";

const ORANGE = new THREE.Vector3(1.0, 0.5, 0.0);
const PURPLE = new THREE.Vector3(0.75, 0.25, 1.0);
let guiFields = {
  "Load Mesh": function () {
    input.click();
  },
  Speed: 1,
  Reset: function () {
    selectedVertex = undefined;
  },
  "Show Wireframe": showWireframe,
};

function init() {
  let container = document.createElement("div");
  document.body.appendChild(container);

  initRenderer(container);
  initGUI();
  initCamera();
  initScene();
  initLights();
  initMesh(bunny);
  initControls();
  addEventListeners();
}

function initRenderer(container) {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xffffff, 1.0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
}

function initGUI() {
  let gui = new dat.GUI();

  let io = gui.addFolder("IO");
  io.add(guiFields, "Load Mesh");
  io.close();
  gui.add(guiFields, "Speed");
  gui.add(guiFields, "Show Wireframe").onChange(toggleWireframe).listen();
}

window.onload = function () {
  console.log("adding event listener");
  input.addEventListener("change", function (e) {
    console.log("picked new file");
    let file = input.files[0];
    filename = file.name;

    if (filename.endsWith(".obj")) {
      console.log("reading obj file");
      let reader = new FileReader();
      reader.onload = function (e) {
        console.log("read input file");
        initMesh(reader.result);
      };

      reader.onerror = function (e) {
        alert("Unable to load OBJ file");
      };

      reader.readAsText(file);
    } else {
      alert("Please load an OBJ file");
    }
  });
};

function exportFile(text) {
  let element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function updateDisplayText() {
  let element = document.getElementById("meta");
  element.textContent = "";
}

function toggleWireframe(checked) {
  showWireframe = checked;
  if (showWireframe) {
    threeMesh.add(wireframe);
    threeWalkerMesh.add(walkerWireframe);
  } else {
    threeMesh.remove(wireframe);
    threeWalkerMesh.remove(walkerWireframe);
  }
}

function initCamera() {
  const fov = 45.0;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.01;
  const far = 1000;
  const eyeZ = 3.5;

  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = eyeZ;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
}

function initLights() {
  let ambient = new THREE.AmbientLight(0xffffff, 0.35);
  camera.add(ambient);

  let point = new THREE.PointLight(0xffffff);
  point.position.set(2, 20, 15);
  camera.add(point);

  scene.add(camera);
}

function initMesh(text) {
  meshFile = text;
  mesh = Module.readMesh(meshFile, "obj");
  geo = Module.readGeo(mesh, meshFile, "obj");
  walkerSurfacePoint = Module.getStartingPoint(geo);

  // remove any previously loaded mesh from scene
  scene.remove(threeMesh);
  scene.remove(threeWalkerMesh);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // create THREE.js mesh (and geometry) objects
  initThreeMesh();
  scene.add(threeMesh);

  initThreeWalkerMesh();
  scene.add(threeWalkerMesh);

  guiFields["Reset"]();

  // toggle wireframe
  toggleWireframe(showWireframe);

  // update metadata
  updateDisplayText();

  step();
}

function vec3ToTHREE(v) {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

function step() {
  if (threeWalkerMesh) {
    threeWalkerMesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);

    stepResult = Module.takeStep(
      walkerDirection,
      walkerSurfacePoint,
      geo,
      guiFields["Speed"] / 100
    );
    let m = new THREE.Matrix4();
    let T = vec3ToTHREE(stepResult.T);
    let N = vec3ToTHREE(stepResult.N);
    let B = vec3ToTHREE(stepResult.B);
    m.set(
      -T.x,
      N.x,
      -B.x,
      0,
      -T.y,
      N.y,
      -B.y,
      0,
      -T.z,
      N.z,
      -B.z,
      0,
      0,
      0,
      0,
      1
    );
    walkerDirection = stepResult.dir;
    walkerSurfacePoint = stepResult.surfacePos;

    let pos = vec3ToTHREE(stepResult.pos);
    let oldPos = threeWalkerMesh.position;
    threeWalkerMesh.translateX(pos.x - oldPos.x, 1);
    threeWalkerMesh.translateY(pos.y - oldPos.y, 1);
    threeWalkerMesh.translateZ(pos.z - oldPos.z, 1);
    threeWalkerMesh.setRotationFromMatrix(m);
  }
}

function initThreeMesh() {
  // create geometry object
  threeGeometry = new THREE.BufferGeometry();

  let coords = geo.vertexCoordinates();

  // fill position and color buffers
  let V = coords.size();
  positions = new Float32Array(V * 3);
  uvs = new Float32Array(V * 3);
  normals = new Float32Array(V * 3);
  colors = new Float32Array(V * 3);
  for (let i = 0; i < V; i++) {
    let position = coords.get(i);
    positions[3 * i + 0] = position[0];
    positions[3 * i + 1] = position[1];
    positions[3 * i + 2] = position[2];

    colors[3 * i + 0] = ORANGE.x;
    colors[3 * i + 1] = ORANGE.y;
    colors[3 * i + 2] = ORANGE.z;
  }

  // fill index buffer
  let faces = mesh.polygons();
  let F = faces.size();
  indices = new Uint32Array(F * 3);
  let maxIndex = 0;
  for (let iF = 0; iF < F; iF++) {
    // TODO: handle non-triangular face
    let face = faces.get(iF);
    for (let iV = 0; iV < 3; iV++) {
      indices[3 * iF + iV] = face.get(iV);
      maxIndex = Math.max(maxIndex, face.get(iV));
    }
  }

  // set geometry
  threeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  threeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  threeGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 3));
  threeGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  threeGeometry.computeVertexNormals();
  threeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  // create material
  let threeMaterial = new THREE.MeshPhongMaterial(materialSettings);

  // create wireframe
  wireframe = new THREE.LineSegments();
  wireframe.geometry = new THREE.WireframeGeometry(threeGeometry);
  wireframe.material = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 0.75,
  });

  // create mesh
  threeMesh = new THREE.Mesh(threeGeometry, threeMaterial);
}

function initThreeWalkerMesh() {
  // create geometry object
  threeWalkerGeometry = new THREE.BufferGeometry();

  let coords = geo.vertexCoordinates();
  let V = coords.size();

  let minY = coords.get(0)[1];
  for (let i = 1; i < V; i++) {
    let position = coords.get(i);
    minY = Math.min(minY, position[1]);
  }

  // fill position, normal and color buffers
  positions = new Float32Array(V * 3);
  uvs = new Float32Array(V * 3);
  normals = new Float32Array(V * 3);
  colors = new Float32Array(V * 3);
  let scale = 1 / 10;
  // let scale  = 1.;
  for (let i = 0; i < V; i++) {
    let position = coords.get(i);
    positions[3 * i + 0] = position[0] * scale;
    positions[3 * i + 1] = (position[1] - minY) * scale;
    positions[3 * i + 2] = position[2] * scale;

    colors[3 * i + 0] = PURPLE.x;
    colors[3 * i + 1] = PURPLE.y;
    colors[3 * i + 2] = PURPLE.z;
  }

  // set geometry
  threeWalkerGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  threeWalkerGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  threeWalkerGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 3));
  threeWalkerGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(colors, 3)
  );
  threeWalkerGeometry.computeVertexNormals();

  // create material
  let threeWalkerMaterial = new THREE.MeshPhongMaterial(materialSettings);

  // create wireframe
  walkerWireframe = new THREE.LineSegments();
  walkerWireframe.geometry = new THREE.WireframeGeometry(threeWalkerGeometry);
  walkerWireframe.material = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 0.75,
  });

  // create mesh
  threeWalkerMesh = new THREE.Mesh(threeWalkerGeometry, threeWalkerMaterial);
  threeWalkerMesh.translateX(-0.4);

  // threeWalkerGroup.add
}

function initControls() {
  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 5.0;
}

function addEventListeners() {
  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
  render();
}

function animate() {
  requestAnimationFrame(animate);
  step();
  controls.update();
  render();
}

function render() {
  // set viewport and render mesh
  let width = window.innerWidth;

  renderer.setViewport(0.0, 0.0, width, window.innerHeight);
  renderer.setScissor(0.0, 0.0, width, window.innerHeight);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);
}
// Initialize only after wasm is loaded
Module.onRuntimeInitialized = (_) => {
  init();
  animate();
};
