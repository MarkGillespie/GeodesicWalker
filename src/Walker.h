#pragma once

#include "polyscope/polyscope.h"

#include "geometrycentral/surface/manifold_surface_mesh.h"
#include "geometrycentral/surface/trace_geodesic.h"
#include "geometrycentral/surface/vertex_position_geometry.h"

using namespace geometrycentral;
using namespace geometrycentral::surface;

glm::mat4 getFrame(Vector3 t, Vector3 n, Vector3 p);

Vector3 getExtrinsicDirection(Vector2 direction, const SurfacePoint &pos,
                              VertexPositionGeometry &geo);

std::vector<Vector3> step(Vector2 &direction, SurfacePoint &pos,
                          VertexPositionGeometry &geo, double stepSize = 0.01);
