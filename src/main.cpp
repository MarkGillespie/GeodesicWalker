#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/meshio.h"
#include "geometrycentral/surface/trace_geodesic.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

#include "geometrycentral/surface/direction_fields.h"

#include "polyscope/curve_network.h"
#include "polyscope/polyscope.h"
#include "polyscope/surface_mesh.h"

#include "args/args.hxx"
#include "imgui.h"

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

glm::mat4 getFrame(Vector3 t, Vector3 n, Vector3 p) {
  t = -t.normalize();
  n = n.normalize();
  Vector3 b = cross(n, t);

  glm::mat4 f(1.f);
  f[0][0] = b.x;
  f[0][1] = b.y;
  f[0][2] = b.z;
  f[1][0] = n.x;
  f[1][1] = n.y;
  f[1][2] = n.z;
  f[2][0] = t.x;
  f[2][1] = t.y;
  f[2][2] = t.z;

  f[3][0] = p.x;
  f[3][1] = p.y;
  f[3][2] = p.z;

  return f;
}

Vector3 getDirection() {
  std::array<Vector3, 2> tb = geometry->faceTangentBasis[pos.face];
  return direction.x * tb[0] + direction.y * tb[1];
}

void step() {
  double stepSize = 0.01;
  direction = direction.normalize();
  TraceOptions options = defaultTraceOptions;
  options.includePath = true;
  TraceGeodesicResult result =
      traceGeodesic(*geometry, pos, direction * stepSize, options);
  pos = result.endPoint;
  direction = result.endingDir;
  for (size_t iP = 0; iP < result.pathPoints.size(); ++iP) {
    pathEdges.push_back(std::array<size_t, 2>{path.size() - 1, path.size()});
    path.push_back(
        result.pathPoints[iP].interpolate(geometry->inputVertexPositions));
  }
}

// A user-defined callback, for creating control panels (etc)
// Use ImGUI commands to build whatever you want here, see
// https://github.com/ocornut/imgui/blob/master/imgui.h
void myCallback() {
  step();
  Vector3 srcPos = pos.interpolate(geometry->inputVertexPositions);
  Vector3 t = getDirection();
  Vector3 n = geometry->faceNormals[pos.face];

  glm::mat4 frame = getFrame(t, n, srcPos);
  psSmallMesh->objectTransform = frame;

  polyscope::registerCurveNetwork("Path", path, pathEdges);
}

int main(int argc, char **argv) {

  // Configure the argument parser
  args::ArgumentParser parser("geometry-central & Polyscope example project");
  args::Positional<std::string> inputFilename(parser, "mesh", "A mesh file.");

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
      smallPositions, mesh->getFaceVertexList(), polyscopePermutations(*mesh));

  geometry->requireFaceNormals();
  geometry->requireFaceTangentBasis();
  Face start = mesh->face(startingFace);
  pos = SurfacePoint(start, Vector3{1. / 3., 1. / 3., 1. / 3.});
  Vector3 srcPos = pos.interpolate(geometry->inputVertexPositions);
  Vector3 t = getDirection();
  Vector3 n = geometry->faceNormals[start];
  path.push_back(srcPos);

  glm::mat4 frame = getFrame(t, n, srcPos);
  psSmallMesh->objectTransform = frame;

  // Give control to the polyscope gui
  polyscope::show();

  return EXIT_SUCCESS;
}
