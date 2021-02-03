import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Polyscope } from "./polyscope.js";

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

// create polyscope manager
let polyscope = new Polyscope();

// Set up UI panel
let io = polyscope.commandGui.addFolder("IO");
polyscope.commandGuiFields["Load Mesh"] = function () {
  polyscope.loadMesh(walkMesh);
};
io.add(polyscope.commandGuiFields, "Load Mesh");
polyscope.commandGuiFields["Load New Walker Mesh"] = function () {
  polyscope.loadMesh((text) => {
    let geo = Module.readMesh(text, "obj");
    polyscope.deregisterSurfaceMesh("Walker Mesh");

    psWalkerMesh = polyscope.registerSurfaceMesh(
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
  });
};
io.add(polyscope.commandGuiFields, "Load New Walker Mesh");
polyscope.commandGuiFields["Load New Base Mesh"] = function () {
  polyscope.loadMesh((text) => {
    geo = Module.readMesh(text, "obj");
    polyscope.deregisterSurfaceMesh("Base Mesh");

    psBaseMesh = polyscope.registerSurfaceMesh(
      "Base Mesh",
      geo.vertexCoordinates(),
      geo.polygons()
    );
    walkerSurfacePoint = Module.getStartingPoint(geo);
  });
};
io.add(polyscope.commandGuiFields, "Load New Base Mesh");
io.close();
polyscope.commandGuiFields["Speed"] = 1;
polyscope.commandGui
  .add(polyscope.commandGuiFields, "Speed")
  .min(0)
  .max(10)
  .step(0.1);

function walkMesh(text) {
  // remove any previously loaded mesh from scene
  polyscope.clearAllStructures();

  polyscope.message("reading mesh ...");
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
    polyscope.clearAllStructures();

    polyscope.message("registering meshes with polyscope ...");
    setTimeout(() => {
      psBaseMesh = polyscope.registerSurfaceMesh(
        "Base Mesh",
        geo.vertexCoordinates(),
        geo.polygons()
      );

      psWalkerMesh = polyscope.registerSurfaceMesh(
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

      polyscope.message("constructing important function ...");
      setTimeout(() => {
        let y = [];
        let z = [];
        let coords = geo.vertexCoordinates();
        for (let iV = 0; iV < coords.size(); iV++) {
          y.push(coords.get(iV)[2]);
          z.push(coords.get(iV)[1]);
        }
        polyscope.message("registering important function ...");
        setTimeout(() => {
          psBaseMesh.addVertexScalarQuantity("function y", y);
          psBaseMesh.addVertexScalarQuantity("function z", z);

          polyscope.message("registering trajectory ...");
          setTimeout(() => {
            psTrajectory = polyscope.registerCurveNetwork("path", trajectory);

            // update metadata
            polyscope.message("Done");

            // turn off spinner
            document.getElementById("spinner").style.display = "none";
          }, 0);
        }, 0);
      }, 0);
    }, 0);
  }, 0);
}

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
    if (psTrajectory) {
      psTrajectory.updateVertexPositions(trajectory);
    }
  }
};

polyscope.message("waiting for webassembly to load");
Module.onRuntimeInitialized = (_) => {
  // Once the wasm has loaded, we can start our app
  polyscope.message("webassembly loaded");

  // Initialize polyscope
  polyscope.init();

  // Load the meshes and set up our state
  walkMesh(bunny);

  // Start animating with polyscope
  // This will call polyscope.userCallback() every frame
  polyscope.animate();
};
