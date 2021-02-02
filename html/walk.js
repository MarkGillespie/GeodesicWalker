import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { polyscope } from "./polyscope.js";

let mesh = undefined;
let geo = undefined;
let walkerSurfacePoint = undefined;
let walkerDirection = [1, 0];
let trajectoryLength = 2500;
let trajectory = [];

let psBaseMesh = undefined;
let psWalkerMesh = undefined;
let psTrajectory = undefined;

function vec3ToTHREE(v) {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

polyscope.onMeshLoad = (text) => {
  console.log("reading mesh combinatorics");
  mesh = Module.readMesh(text, "obj");
  console.log("reading mesh geometry");
  geo = Module.readGeo(mesh, text, "obj");
  walkerSurfacePoint = Module.getStartingPoint(geo);

  let stepResult = Module.takeStep(walkerDirection, walkerSurfacePoint, geo, 1);
  let startingPos = stepResult.pos;
  trajectory = Array(trajectoryLength).fill(startingPos);

  // remove any previously loaded mesh from scene
  polyscope.clearAllStructures();

  polyscope.camera.aspect = window.innerWidth / window.innerHeight;
  polyscope.camera.updateProjectionMatrix();

  psBaseMesh = polyscope.registerSurfaceMesh(
    "Base Mesh",
    geo.vertexCoordinates(),
    mesh.polygons()
  );

  psWalkerMesh = polyscope.registerSurfaceMesh(
    "Walker Mesh",
    geo.vertexCoordinates(),
    mesh.polygons()
  );

  let fn = [];
  let coords = geo.vertexCoordinates();
  for (let iV = 0; iV < coords.size(); iV++) {
    fn.push(coords.get(iV)[2]);
  }
  // let fn = Array.from({ length: psBaseMesh.nV }, () => Math.random() * 10 - 5);
  psBaseMesh.addVertexScalarQuantity("important function", fn);

  psTrajectory = polyscope.registerCurveNetwork("path", trajectory);

  // Translate walker up to walk along surface, and scale it down
  // fill position buffer
  const positions = psWalkerMesh.mesh.geometry.attributes.position.array;
  let V = psWalkerMesh.mesh.geometry.attributes.position.count;
  let minY = positions[1];
  for (let i = 0; i < V; i++) {
    minY = Math.min(minY, positions[3 * i + 1]);
  }
  let scale = 1 / 10;
  for (let i = 0; i < V; i++) {
    positions[3 * i + 0] = positions[3 * i + 0] * scale;
    positions[3 * i + 1] = (positions[3 * i + 1] - minY) * scale;
    positions[3 * i + 2] = positions[3 * i + 2] * scale;
  }
  psWalkerMesh.mesh.geometry.computeBoundingBox();
  psWalkerMesh.mesh.geometry.computeBoundingSphere();
  psWalkerMesh.mesh.geometry.attributes.position.needsUpdate = true;

  // update metadata
  polyscope.updateDisplayText();

  document.getElementById("spinner").style.display = "none";
};

polyscope.userCallback = () => {
  if (psWalkerMesh) {
    let stepResult = Module.takeStep(
      walkerDirection,
      walkerSurfacePoint,
      geo,
      polyscope.commandGuiFields["Speed"] / 100
    );

    let T = vec3ToTHREE(stepResult.T);
    let N = vec3ToTHREE(stepResult.N);
    let B = vec3ToTHREE(stepResult.B);

    walkerDirection = stepResult.dir;
    walkerSurfacePoint = stepResult.surfacePos;

    psWalkerMesh.setPosition(vec3ToTHREE(stepResult.pos));

    let mat = new THREE.Matrix4();
    // prettier-ignore
    mat.set(
          -T.x, N.x, -B.x, 0,
          -T.y, N.y, -B.y, 0,
          -T.z, N.z, -B.z, 0,
          0,    0,   0,    1
      );

    psWalkerMesh.setOrientationFromMatrix(mat);

    // update trajectory
    for (let iP = 1; iP < stepResult.trajectory.size(); iP++) {
      trajectory.shift(); // drop oldest element
      let pos = stepResult.trajectory.get(iP);
      trajectory.push([pos[0], pos[1], pos[2]]);
    }
    psTrajectory.updateVertexPositions(trajectory);
  }
};

let windowLoaded = false;
window.onload = () => {
  console.log("window loaded");
  windowLoaded = true;
};
// Initialize only after wasm is loaded and page has also loaded
Module.onRuntimeInitialized = (_) => {
  console.log("module loaded");
  if (windowLoaded) {
    console.log("Window loaded first");
    polyscope.init();
    polyscope.animate();
  } else {
    window.onload = () => {
      console.log("Module loaded first");
      polyscope.init();
      polyscope.animate();
    };
  }
};
