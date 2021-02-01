#include "geometrycentral/numerical/linear_solvers.h"
#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/meshio.h"
#include "geometrycentral/surface/simple_polygon_mesh.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <Eigen/Dense>
#include <Eigen/SparseCore>

#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/simple_polygon_mesh.h"
#include "geometrycentral/surface/trace_geodesic.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

#include "Walker.h"

using namespace emscripten;
using namespace geometrycentral;
using namespace geometrycentral::surface;

struct StepResult {
  Vector3 T, N, B, pos;
  Vector2 dir;
  SurfacePoint surfacePos;
  std::vector<Vector3> trajectory;
};

// Stolen from Ricky Reusser https://observablehq.com/d/d0df0c04ce5c94FCC
template <typename T>
void copyToVector(const val &typedArray, std::vector<T> &vec) {
  unsigned int length = typedArray["length"].as<unsigned int>();
  val memory = val::module_property("buffer");
  vec.reserve(length);
  val memoryView = typedArray["constructor"].new_(
      memory, reinterpret_cast<uintptr_t>(vec.data()), length);
  memoryView.call<void>("set", typedArray);
}

SurfacePoint getStartingPoint(VertexPositionGeometry &geo) {
  Face start = geo.mesh.face(0);
  return SurfacePoint(start, Vector3{1. / 3., 1. / 3., 1. / 3.});
}

StepResult takeStep(Vector2 direction, SurfacePoint pos,
                    VertexPositionGeometry &geo, double stepSize) {
  StepResult result;

  result.trajectory = step(direction, pos, geo, stepSize);

  result.pos = pos.interpolate(geo.inputVertexPositions);
  result.T = getExtrinsicDirection(direction, pos, geo).normalize();
  geo.requireFaceNormals();
  result.N = geo.faceNormals[pos.face];
  result.B = cross(result.T, result.N);
  result.dir = direction;
  result.surfacePos = pos;

  return result;
}

// Mostly stolen from Ricky Reusser https://observablehq.com/d/d0df0c04ce5c94fc
EMSCRIPTEN_BINDINGS(my_module) {
  value_array<Vector3>("Vector3")
      .element(&Vector3::x)
      .element(&Vector3::y)
      .element(&Vector3::z);
  value_array<Vector2>("Vector2").element(&Vector2::x).element(&Vector2::y);

  register_vector<Vector3>("VectorVector3");
  register_vector<size_t>("VectorSizeT");
  register_vector<std::vector<size_t>>("VectorVectorSizeT");

  class_<ManifoldSurfaceMesh>("ManifoldSurfaceMesh")
      .function("polygons", optional_override([](ManifoldSurfaceMesh &self) {
                  return self.getFaceVertexList();
                }));
  class_<VertexPositionGeometry>("VertexPositionGeometry")
      .function("vertexCoordinates",
                optional_override([](const VertexPositionGeometry &self) {
                  std::vector<Vector3> vCoords;
                  for (Vertex v : self.mesh.vertices())
                    vCoords.push_back(self.inputVertexPositions[v]);
                  return vCoords;
                }));
  class_<SurfacePoint>("SurfacePoint");

  function("readMesh",
           optional_override([](std::string str, std::string type = "") {
             std::stringstream in;
             in << str;
             SimplePolygonMesh soup(in, type);
             std::unique_ptr<ManifoldSurfaceMesh> mesh(
                 new ManifoldSurfaceMesh(soup.polygons));
             return mesh;
           }));

  function("readGeo",
           optional_override([](ManifoldSurfaceMesh &mesh, std::string str,
                                std::string type = "") {
             std::stringstream in;
             in << str;
             SimplePolygonMesh soup(in, type);

             VertexData<Vector3> vertexPositions(mesh);
             for (size_t iV = 0; iV < mesh.nVertices(); ++iV) {
               vertexPositions[iV] = soup.vertexCoordinates[iV];
             }
             std::unique_ptr<VertexPositionGeometry> geo(
                 new VertexPositionGeometry(mesh, vertexPositions));
             return geo;
           }));

  value_object<StepResult>("StepResult")
      .field("T", &StepResult::T)
      .field("N", &StepResult::N)
      .field("B", &StepResult::B)
      .field("pos", &StepResult::pos)
      .field("dir", &StepResult::dir)
      .field("surfacePos", &StepResult::surfacePos)
      .field("trajectory", &StepResult::trajectory);

  function("getStartingPoint", &getStartingPoint);
  function("takeStep", &takeStep);
}
