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

function createMatCapMaterial(tex_r, tex_g, tex_b, tex_k) {
  let vertexShader = `
        varying vec2 Point;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            Point.x = vNormal.x * 0.5 + 0.5;
            Point.y = vNormal.y * 0.5 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

  let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 color;

        varying vec2 Point;

        void main(void){

            vec4 mat_r = texture2D(Matcap_r, Point);
            vec4 mat_g = texture2D(Matcap_g, Point);
            vec4 mat_b = texture2D(Matcap_b, Point);
            vec4 mat_k = texture2D(Matcap_k, Point);

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b + 
                                (1. - color.r - color.g - color.b) * mat_k;

            gl_FragColor = colorCombined;
        }
    `;

  let Material = new THREE.ShaderMaterial({
    uniforms: {
      Matcap_r: { value: tex_r },
      Matcap_g: { value: tex_g },
      Matcap_b: { value: tex_b },
      Matcap_k: { value: tex_k },
      color: { value: new THREE.Vector3(1, 0, 1) },
    },
    vertexShader,
    fragmentShader,
  });

  return Material;
}

class MeshStructure {
  constructor(mesh, geo, wireframe, name, polyscopeEnvironment) {
    this.mesh = mesh;
    this.geo = geo;
    this.wireframe = wireframe;
    this.name = name;
    this.ps = polyscopeEnvironment;
  }

  setColor(color) {
    this.ps.structureGuiFields[this.name + "#Color"] = color;
    this.ps.updateMeshColor(
      this,
      this.ps.structureGuiFields[this.name + "#Color"]
    );
  }
}

class Polyscope {
  constructor() {
    this.input = undefined;

    this.renderer = undefined;
    this.camera = undefined;
    this.controls = undefined;
    this.shiftClick = false;
    this.showWireframe = false;
    this.scene = undefined;
    this.matcapTextures = undefined;

    this.structures = {};

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
    console.log("hi");
    let inputContainer = document.createElement("div");
    this.input = document.createElement("input");
    inputContainer.appendChild(this.input);
    document.body.appendChild(inputContainer);
    this.input.id = "fileInput";
    this.input.style.display = "none";
    this.input.type = "file";
    console.log(this.input);
  }

  init() {
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
    this.matcapTextures.r = new THREE.TextureLoader().load("img/clay_r.jpg");
    this.matcapTextures.g = new THREE.TextureLoader().load("img/clay_g.jpg");
    this.matcapTextures.b = new THREE.TextureLoader().load("img/clay_b.jpg");
    this.matcapTextures.k = new THREE.TextureLoader().load("img/clay_k.jpg");
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
    this.commandGui.add(this.commandGuiFields, "Speed");
  }

  updateDisplayText() {
    let element = document.getElementById("meta");
    element.textContent = "";
  }

  toggleWireframe(checked, structure) {
    this.showWireframe = checked;
    if (this.showWireframe) {
      structure.mesh.add(structure.wireframe);
    } else {
      structure.mesh.remove(structure.wireframe);
    }
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
    // create THREE.js mesh (and geometry) objects
    let [threeMesh, threeGeometry, wireframe] = this.constructPolyscopeMesh(
      vertexCoordinates,
      faces,
      scale
    );

    let meshStructure = new MeshStructure(
      threeMesh,
      threeGeometry,
      wireframe,
      name,
      this
    );
    this.structures[name] = meshStructure;

    this.structureGuiFields[name + "#Color"] = [255, 180, 60];
    let meshGui = this.structureGuiMeshes.addFolder(name);
    meshGui
      .addColor(this.structureGuiFields, name + "#Color")
      .onChange((c) => {
        this.updateMeshColor(meshStructure, c);
      })
      .listen()
      .name("Color");
    this.structureGuiFields[name + "#Show Wireframe"] = false;
    meshGui
      .add(this.structureGuiFields, name + "#Show Wireframe")
      .onChange((checked) => {
        this.toggleWireframe(checked, meshStructure);
      })
      .listen()
      .name("Show Wireframe");
    meshGui.open();

    this.updateMeshColor(
      meshStructure,
      this.structureGuiFields[name + "#Color"]
    );

    this.scene.add(threeMesh);

    return meshStructure;
  }

  deregisterSurfaceMesh(name) {
    if (!(name in this.structures)) return;

    this.structureGuiMeshes.removeFolder(name);
    this.scene.remove(this.structures[name].mesh);
    delete this.structures[name];
  }

  clearAllStructures() {
    let names = Object.keys(this.structures);
    names.forEach((name) => {
      this.deregisterSurfaceMesh(name);
    });
  }

  constructPolyscopeMesh(coords, faces, scale = 1) {
    // create geometry object
    let threeGeometry = new THREE.BufferGeometry();

    // fill position and color buffers
    let V = coords.size();
    let positions = new Float32Array(V * 3);
    let normals = new Float32Array(V * 3);
    for (let i = 0; i < V; i++) {
      let position = coords.get(i);
      positions[3 * i + 0] = position[0] * scale;
      positions[3 * i + 1] = position[1] * scale;
      positions[3 * i + 2] = position[2] * scale;
    }

    // fill index buffer
    let F = faces.size();
    let indices = new Uint32Array(F * 3);
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
    threeGeometry.computeVertexNormals();
    threeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    // create wireframe
    let wireframe = new THREE.LineSegments();
    wireframe.geometry = new THREE.WireframeGeometry(threeGeometry);
    wireframe.material = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 0.75,
    });

    // create matcap material
    let matcapMaterial = createMatCapMaterial(
      this.matcapTextures.r,
      this.matcapTextures.g,
      this.matcapTextures.b,
      this.matcapTextures.k
    );

    // create mesh
    let threeMesh = new THREE.Mesh(threeGeometry, matcapMaterial);
    return [threeMesh, threeGeometry, wireframe];
  }

  updateMeshColor(meshStructure, color) {
    let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    meshStructure.mesh.material.uniforms.color.value = c;
  }

  initControls() {
    this.controls = new THREE.TrackballControls(
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
    this.controls.update();
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

window.onload = function () {
  polyscope.initInput();
  console.log("adding event listener");
  polyscope.input.addEventListener("change", function (e) {
    console.log("picked new file");

    // remove any previously loaded mesh from scene
    polyscope.clearAllStructures();

    // show spinner
    document.getElementById("spinner").style.display = "inline-block";

    let file = polyscope.input.files[0];
    let filename = file.name;

    if (filename.endsWith(".obj")) {
      console.log("reading obj file");
      let reader = new FileReader();
      reader.onload = function (e) {
        console.log("read input file");
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
};

if (!Detector.webgl) Detector.addGetWebGLMessage();
