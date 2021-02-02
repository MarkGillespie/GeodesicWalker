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

struct GeoMesh {
  std::unique_ptr<ManifoldSurfaceMesh> mesh;
  std::unique_ptr<VertexPositionGeometry> geo;
};

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

SurfacePoint getStartingPoint(GeoMesh &geo) {
  Face start = geo.mesh->face(0);
  return SurfacePoint(start, Vector3{1. / 3., 1. / 3., 1. / 3.});
}

StepResult takeStep(Vector2 direction, SurfacePoint pos, GeoMesh &geo,
                    double stepSize) {
  StepResult result;

  result.trajectory = step(direction, pos, *geo.geo, stepSize);

  result.pos = pos.interpolate(geo.geo->inputVertexPositions);
  result.T = getExtrinsicDirection(direction, pos, *geo.geo).normalize();
  geo.geo->requireFaceNormals();
  result.N = geo.geo->faceNormals[pos.face];
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

  class_<SurfacePoint>("SurfacePoint");

  class_<GeoMesh>("GCMesh")
      .function("polygons", optional_override([](GeoMesh &self) {
                  return self.mesh->getFaceVertexList();
                }))
      .function("vertexCoordinates", optional_override([](const GeoMesh &self) {
                  std::vector<Vector3> vCoords;
                  for (Vertex v : self.mesh->vertices())
                    vCoords.push_back(self.geo->inputVertexPositions[v]);
                  return vCoords;
                }));

  function(
      "readMesh", optional_override([](std::string str, std::string type = "") {
        std::stringstream in;
        in << str;

        GeoMesh gMesh;
        std::tie(gMesh.mesh, gMesh.geo) = readManifoldSurfaceMesh(in, type);
        return gMesh;
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
