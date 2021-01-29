#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/meshio.h"
#include "geometrycentral/surface/trace_geodesic.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

#include "geometrycentral/surface/direction_fields.h"

#include "polyscope/curve_network.h"
#include "polyscope/polyscope.h"
#include "polyscope/surface_mesh.h"

#include <fstream>
#include <string>

#include "args/args.hxx"
#include "imgui.h"

#include "Walker.h"

using namespace geometrycentral;
using namespace geometrycentral::surface;

// == Geometry-central data
std::unique_ptr<ManifoldSurfaceMesh> mesh;
std::unique_ptr<VertexPositionGeometry> geometry;

double smallScale = 0.05;
size_t startingFace = 0;

SurfacePoint pos;
Vector2 direction{1, 0};

std::vector<Vector3> path;
std::vector<std::array<size_t, 2>> pathEdges;

// Polyscope visualization handle, to quickly add data to the surface
polyscope::SurfaceMesh *psMesh, *psSmallMesh;
polyscope::CurveNetwork *psPath;

std::string frameDir;

// A user-defined callback, for creating control panels (etc)
// Use ImGUI commands to build whatever you want here, see
// https://github.com/ocornut/imgui/blob/master/imgui.h
static size_t frameID = 0;
void myCallback() {

  std::vector<Vector3> stepTrajectory = step(direction, pos, *geometry);
  for (Vector3 p : stepTrajectory) {
    pathEdges.push_back(std::array<size_t, 2>{path.size() - 1, path.size()});
    path.push_back(p);
  }

  Vector3 srcPos = pos.interpolate(geometry->inputVertexPositions);
  Vector3 t = getExtrinsicDirection(direction, pos, *geometry);
  Vector3 n = geometry->faceNormals[pos.face];

  glm::mat4 frame = getFrame(t, n, srcPos);
  psSmallMesh->objectTransform = frame;

  polyscope::registerCurveNetwork("Path", path, pathEdges);
  if (!frameDir.empty()) {
    std::string idString = std::to_string(frameID);
    size_t padLen = 15;
    if (idString.length() <= padLen) {
      std::string paddedID =
          std::string(padLen - idString.length(), '0').append(idString);
      polyscope::screenshot(frameDir + "/frame" + paddedID + ".png", false);
      frameID++;
    } else {
      std::cerr << "Error: id string length > padding length (" << padLen << ")"
                << std::endl;
      std::cerr << "\t No longer saving screenshots" << std::endl;
    }
  }

  if (ImGui::Button("Print Camera JSON")) {
    std::cerr << polyscope::view::getCameraJson() << std::endl;
  }
}

int main(int argc, char **argv) {

  // Configure the argument parser
  args::ArgumentParser parser("geometry-central & Polyscope example project");
  args::Positional<std::string> inputFilename(parser, "mesh", "A mesh file.");
  args::Positional<std::string> walkerFilename(
      parser, "walking mesh",
      "The mesh to animate. If none is included, the first mesh walks along "
      "itself.");
  args::ValueFlag<std::string> outputPath(parser, "outputPath",
                                          "Render frames of walk to this path",
                                          {"outputPath"});
  args::ValueFlag<int> startFace(parser, "startFace",
                                 "Face to start walking from", {"startFace"});
  args::ValueFlag<std::string> cameraPosFile(
      parser, "cameraPos",
      "File containing json describing polyscope camera pos", {"cameraPos"});
  // Parse args
  try {
    parser.ParseCLI(argc, argv);
  } catch (args::Help &h) {
    std::cout << parser;
    return 0;
  } catch (args::ParseError &e) {
    std::cerr << e.what() << std::endl;
    std::cerr << parser;
    return 1;
  }

  // Make sure a mesh name was given
  if (!inputFilename) {
    std::cerr << "Please specify a mesh file as argument" << std::endl;
    return EXIT_FAILURE;
  }
  if (startFace) {
    startingFace = args::get(startFace);
  }

  frameDir = (outputPath) ? args::get(outputPath) : "";

  // Initialize polyscope
  polyscope::init();

  // Set the callback function
  polyscope::state::userCallback = myCallback;

  // Load mesh
  std::tie(mesh, geometry) = readManifoldSurfaceMesh(args::get(inputFilename));

  // Register the mesh with polyscope
  psMesh = polyscope::registerSurfaceMesh(
      polyscope::guessNiceNameFromPath(args::get(inputFilename)),
      geometry->inputVertexPositions, mesh->getFaceVertexList(),
      polyscopePermutations(*mesh));
  psMesh->setTransparency(0.75);

  if (walkerFilename) {
    std::unique_ptr<ManifoldSurfaceMesh> smallMesh;
    std::unique_ptr<VertexPositionGeometry> smallGeo;
    std::tie(smallMesh, smallGeo) =
        readManifoldSurfaceMesh(args::get(walkerFilename));

    VertexData<Vector3> smallPositions(*smallMesh);
    double minY = 0;
    for (Vertex v : smallMesh->vertices()) {
      smallPositions[v] = smallScale * smallGeo->inputVertexPositions[v];
      minY = fmin(minY, smallPositions[v].y);
    }
    for (Vertex v : smallMesh->vertices())
      smallPositions[v].y -= minY;
    psSmallMesh = polyscope::registerSurfaceMesh(
        polyscope::guessNiceNameFromPath(args::get(walkerFilename)) + "_small",
        smallPositions, smallMesh->getFaceVertexList(),
        polyscopePermutations(*smallMesh));
  } else {
    VertexData<Vector3> smallPositions(*mesh);
    double minY = 0;
    for (Vertex v : mesh->vertices()) {
      smallPositions[v] = smallScale * geometry->inputVertexPositions[v];
      minY = fmin(minY, smallPositions[v].y);
    }
    for (Vertex v : mesh->vertices())
      smallPositions[v].y -= minY;
    psSmallMesh = polyscope::registerSurfaceMesh(
        polyscope::guessNiceNameFromPath(args::get(inputFilename)) + "_small",
        smallPositions, mesh->getFaceVertexList(),
        polyscopePermutations(*mesh));
  }

  geometry->requireFaceNormals();
  geometry->requireFaceTangentBasis();
  Face start = mesh->face(startingFace);
  pos = SurfacePoint(start, Vector3{1. / 3., 1. / 3., 1. / 3.});
  Vector3 srcPos = pos.interpolate(geometry->inputVertexPositions);
  Vector3 t = getExtrinsicDirection(direction, pos, *geometry);
  Vector3 n = geometry->faceNormals[start];
  path.push_back(srcPos);

  glm::mat4 frame = getFrame(t, n, srcPos);
  psSmallMesh->objectTransform = frame;

  if (cameraPosFile) {
    try {
      // https://stackoverflow.com/questions/2912520/read-file-contents-into-a-string-in-c
      std::ifstream ifs(args::get(cameraPosFile));
      std::string cameraJson((std::istreambuf_iterator<char>(ifs)),
                             (std::istreambuf_iterator<char>()));
      polyscope::view::setCameraFromJson(cameraJson, false);
    } catch (const std::exception &e) {
      std::cerr << "Error: could not load camera data from " << cameraPosFile
                << std::endl;
      std::cerr << e.what() << std::endl;
    }
  }

  // Give control to the polyscope gui
  polyscope::show();

  return EXIT_SUCCESS;
}
