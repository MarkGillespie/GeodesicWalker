let mesh = undefined;
let geo = undefined;
let walkerSurfacePoint = undefined;
let walkerDirection = [1, 0];

let psBaseMesh = undefined;
let psWalkerMesh = undefined;

function vec3ToTHREE(v) {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

polyscope.onMeshLoad = (text) => {
  mesh = Module.readMesh(text, "obj");
  geo = Module.readGeo(mesh, text, "obj");
  walkerSurfacePoint = Module.getStartingPoint(geo);

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
  psWalkerMesh.setColor([180, 60, 225]);

  // Translate walker up to walk along surface, and scale it down
  // fill position and color buffers
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
    psWalkerMesh.mesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
    let stepResult = Module.takeStep(
      walkerDirection,
      walkerSurfacePoint,
      geo,
      polyscope.commandGuiFields["Speed"] / 100
    );
    let m = new THREE.Matrix4();
    let T = vec3ToTHREE(stepResult.T);
    let N = vec3ToTHREE(stepResult.N);
    let B = vec3ToTHREE(stepResult.B);

    // prettier-ignore
    m.set(
      -T.x, N.x, -B.x, 0,
      -T.y, N.y, -B.y, 0,
      -T.z, N.z, -B.z, 0,
      0,    0,   0,    1
    );
    walkerDirection = stepResult.dir;
    walkerSurfacePoint = stepResult.surfacePos;

    let pos = vec3ToTHREE(stepResult.pos);
    let oldPos = psWalkerMesh.mesh.position;
    psWalkerMesh.mesh.translateX(pos.x - oldPos.x, 1);
    psWalkerMesh.mesh.translateY(pos.y - oldPos.y, 1);
    psWalkerMesh.mesh.translateZ(pos.z - oldPos.z, 1);
    psWalkerMesh.mesh.setRotationFromMatrix(m);
  }
};

// Initialize only after wasm is loaded
Module.onRuntimeInitialized = (_) => {
  polyscope.init();
  polyscope.animate();
};
