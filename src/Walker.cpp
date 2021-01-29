#include "Walker.h"

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

Vector3 getExtrinsicDirection(Vector2 direction, const SurfacePoint &pos,
                              VertexPositionGeometry &geo) {
  geo.requireFaceTangentBasis();
  std::array<Vector3, 2> tb = geo.faceTangentBasis[pos.face];
  return direction.x * tb[0] + direction.y * tb[1];
}

std::vector<Vector3> step(Vector2 &direction, SurfacePoint &pos,
                          VertexPositionGeometry &geo, double stepSize) {
  direction = direction.normalize();
  TraceOptions options = defaultTraceOptions;
  options.includePath = true;
  TraceGeodesicResult result =
      traceGeodesic(geo, pos, direction * stepSize, options);
  pos = result.endPoint;
  direction = result.endingDir;

  std::vector<Vector3> trajectory;
  for (size_t iP = 0; iP < result.pathPoints.size(); ++iP) {
    trajectory.push_back(
        result.pathPoints[iP].interpolate(geo.inputVertexPositions));
  }

  return trajectory;
}
