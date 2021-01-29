#include "geometrycentral/numerical/linear_solvers.h"
#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/meshio.h"
#include "geometrycentral/surface/simple_polygon_mesh.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <Eigen/Dense>
#include <Eigen/SparseCore>

using namespace emscripten;
using namespace geometrycentral;
using namespace geometrycentral::surface;

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

CornerData<Vector2> scpImpl(ManifoldSurfaceMesh &mesh,
                            VertexPositionGeometry &geo) {
  geo.requireCotanLaplacian();
  geo.requireVertexLumpedMassMatrix();
  SparseMatrix<std::complex<double>> L =
      geo.cotanLaplacian.cast<std::complex<double>>();
  SparseMatrix<std::complex<double>> M =
      geo.vertexLumpedMassMatrix.cast<std::complex<double>>();

  VertexData<size_t> vIdx = mesh.getVertexIndices();

  // build the area term
  std::complex<double> i(0, 1);
  std::vector<Eigen::Triplet<std::complex<double>>> T;
  for (BoundaryLoop b : mesh.boundaryLoops()) {
    for (Halfedge he : b.adjacentHalfedges()) {
      size_t j = vIdx[he.twin().vertex()];
      size_t k = vIdx[he.vertex()];

      T.emplace_back(Eigen::Triplet<std::complex<double>>(j, k, i * 0.25));
      T.emplace_back(Eigen::Triplet<std::complex<double>>(k, j, i * -0.25));
    }
  }
  SparseMatrix<std::complex<double>> A(mesh.nVertices(), mesh.nVertices());
  A.setFromTriplets(T.begin(), T.end());

  SparseMatrix<std::complex<double>> EC = 0.5 * L - A;

  Vector<std::complex<double>> ones =
      Vector<std::complex<double>>::Ones(mesh.nVertices());

  Vector<std::complex<double>> pos =
      smallestKEigenvectorsPositiveDefinite(EC, M, 2)[1];

  double meanPos = std::norm(pos.lpNorm<2>()) / (double)mesh.nVertices();

  CornerData<Vector2> positions(mesh);
  for (Vertex v : mesh.vertices()) {
    Vector2 vPos = Vector2{std::real(pos[vIdx[v]]), std::imag(pos[vIdx[v]])};
    for (Corner c : v.adjacentCorners()) {
      positions[c] = vPos / meanPos;
    }
  }

  return positions;
}

SimplePolygonMesh scp(std::string str, std::string type = "") {
  std::cout << "Reading file" << std::endl;
  std::stringstream in;
  in << str;

  std::cout << "Building halfedge mesh" << std::endl;
  std::unique_ptr<ManifoldSurfaceMesh> mesh;
  std::unique_ptr<VertexPositionGeometry> geo;
  std::tie(mesh, geo) = readManifoldSurfaceMesh(in, type);

  std::vector<Vector3> vertexPositions;
  for (Vertex v : mesh->vertices()) {
    vertexPositions.push_back(geo->inputVertexPositions[v]);
  }

  std::cout << "Computing parameterization" << std::endl;
  CornerData<Vector2> param = scpImpl(*mesh, *geo);
  std::vector<std::vector<Vector2>> paramVec;
  for (Face f : mesh->faces()) {
    std::vector<Vector2> faceCoords;
    for (Corner c : f.adjacentCorners()) {
      faceCoords.push_back(param[c]);
    }
    paramVec.push_back(faceCoords);
  }

  std::cout << "Returning mesh" << std::endl;
  return SimplePolygonMesh(mesh->getFaceVertexList(), vertexPositions,
                           paramVec);
}

SimplePolygonMesh readMesh(std::string str, std::string type = "") {
  std::stringstream in;
  in << str;
  return SimplePolygonMesh(in, type);
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
  register_vector<Vector2>("VectorVector2");
  register_vector<std::vector<Vector2>>("VectorVectorVector2");

  class_<SimplePolygonMesh>("SimplePolygonMesh")
      .constructor()
      .function("polygons", optional_override([](SimplePolygonMesh &self) {
                  return self.polygons;
                }))
      .function("vertexCoordinates",
                optional_override([](const SimplePolygonMesh &self) {
                  return self.vertexCoordinates;
                }))
      .function("textureCoordinates",
                optional_override([](const SimplePolygonMesh &self) {
                  return self.paramCoordinates;
                }))
      // .function("vertexCoordinatesDataView",
      //           optional_override([](const SimplePolygonMesh& self) {
      //               return val(typed_memory_view(
      //                   self.vertexCoordinates.size() * 3,
      //                   (double*)self.vertexCoordinates.data()));
      //           }))
      // .function("textureCoordinatesDataView",
      //           optional_override([](const SimplePolygonMesh& self) {
      //               size_t nCorners = 0;
      //               for (const std::vector<size_t>& face : self.polygons) {
      //                   nCorners += face.size();
      //               }
      //               return val(typed_memory_view(
      //                   nCorners * 2,
      //                   (double*)self.paramCoordinates.data()));
      //           }))
      ;

  function("readMesh", &readMesh);
  function("scp", &scp);
}
