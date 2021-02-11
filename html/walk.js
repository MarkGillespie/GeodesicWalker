import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";

// import { Geoptic } from "./geoptic.js/src/geoptic.js";
import { Geoptic } from "./geoptic.js/build/geoptic.module.min.js";

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

// create geoptic manager
let geoptic = new Geoptic("geoptic.js");

// Set up UI panel
let io = geoptic.commandGui.addFolder("IO");
geoptic.commandGuiFields["Load Mesh"] = function () {
  geoptic.loadMesh(walkMesh);
};
io.add(geoptic.commandGuiFields, "Load Mesh");

geoptic.commandGuiFields["Load New Walker Mesh"] = function () {
  geoptic.loadMesh((text) => {
    let geo = Module.readMesh(text, "obj");
    geoptic.deregisterSurfaceMesh("Walker Mesh");

    psWalkerMesh = geoptic.registerSurfaceMesh(
      "Walker Mesh",
      geo.vertexCoordinates(),
      geo.polygons()
    );

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

    geo.delete();
  });
};
io.add(geoptic.commandGuiFields, "Load New Walker Mesh");

geoptic.commandGuiFields["Load New Base Mesh"] = function () {
  geoptic.loadMesh((text) => {
    geo.delete();
    geo = Module.readMesh(text, "obj");
    geoptic.deregisterSurfaceMesh("Base Mesh");

    psBaseMesh = geoptic.registerSurfaceMesh(
      "Base Mesh",
      geo.vertexCoordinates(),
      geo.polygons()
    );
    walkerSurfacePoint = Module.getStartingPoint(geo);
  });
};
io.add(geoptic.commandGuiFields, "Load New Base Mesh");
io.close();
geoptic.commandGuiFields["Speed"] = 1;
geoptic.commandGui
  .add(geoptic.commandGuiFields, "Speed")
  .min(0)
  .max(10)
  .step(0.1);

function walkMesh(text) {
  if (geo) geo.delete();
  // remove any previously loaded mesh from scene
  geoptic.clearAllStructures();

  geoptic.message("reading mesh ...");
  // give browser time to print the message
  setTimeout(() => {
    geo = Module.readMesh(text, "obj");
    walkerSurfacePoint = Module.getStartingPoint(geo);

    let stepResult = Module.takeStep(
      walkerDirection,
      walkerSurfacePoint,
      geo,
      1
    );
    let startingPos = stepResult.pos;
    trajectory = Array(trajectoryLength).fill(startingPos);

    // remove any previously loaded mesh from scene
    geoptic.clearAllStructures();

    geoptic.message("registering meshes with geoptic ...");
    setTimeout(() => {
      psBaseMesh = geoptic.registerSurfaceMesh(
        "Base Mesh",
        geo.vertexCoordinates(),
        geo.polygons()
      );

      psWalkerMesh = geoptic.registerSurfaceMesh(
        "Walker Mesh",
        geo.vertexCoordinates(),
        geo.polygons()
      );

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

      geoptic.message("registering trajectory ...");
      setTimeout(() => {
        psTrajectory = geoptic.registerCurveNetwork("path", trajectory);

        // update metadata
        geoptic.message("Done");

        // turn off spinner
        document.getElementById("spinner").style.display = "none";
      }, 0);
    }, 0);
  }, 0);
}

geoptic.userCallback = () => {
  if (psWalkerMesh) {
    let stepResult = Module.takeStep(
      walkerDirection,
      walkerSurfacePoint,
      geo,
      geoptic.commandGuiFields["Speed"] / 100
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
    if (psTrajectory) {
      psTrajectory.updateVertexPositions(trajectory);
    }
  }
};

geoptic.message("waiting for webassembly to load");
Module.onRuntimeInitialized = (_) => {
  // Once the wasm has loaded, we can start our app
  geoptic.message("webassembly loaded");

  // Initialize geoptic
  geoptic.init();

  // Load the meshes and set up our state
  walkMesh(bunny);

  // Start animating with geoptic
  // This will call geoptic.userCallback() every frame
  geoptic.animate();
};
