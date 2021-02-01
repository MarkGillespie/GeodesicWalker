import {
  ShaderMaterial,
  Vector3,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

function createMatCapMaterial(tex_r, tex_g, tex_b, tex_k) {
  let vertexShader = `
        attribute vec3 barycoord;

        varying vec2 Point;
        varying vec3 Barycoord;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            Point.x = vNormal.x * 0.5 + 0.5;
            Point.y = vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

  let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 color;
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;


        float getEdgeFactor(vec3 UVW, vec3 edgeReal, float width) {

            // The Nick Sharp Edge Function (tm). There are many like it, but this one is his.
            float slopeWidth = 1.;

            vec3 fw = fwidth(UVW);
            vec3 realUVW = max(UVW, 1. - edgeReal.yzx);
            vec3 baryWidth = slopeWidth * fw;

            vec3 end = width * fw;
            vec3 dist = smoothstep(end - baryWidth, end, realUVW);

            float e = 1.0 - min(min(dist.x, dist.y), dist.z);
            return e;
        }

        void main(void){


            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);

            vec4 mat_r = texture2D(Matcap_r, Point);
            vec4 mat_g = texture2D(Matcap_g, Point);
            vec4 mat_b = texture2D(Matcap_b, Point);
            vec4 mat_k = texture2D(Matcap_k, Point);

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b + 
                                (1. - color.r - color.g - color.b) * mat_k;

            vec4 edgeColorCombined = edgeColor.r * mat_r + edgeColor.g * mat_g + edgeColor.b * mat_b + 
                                (1. - edgeColor.r - edgeColor.g - edgeColor.b) * mat_k;

            gl_FragColor = (1.-alpha) * colorCombined + alpha * edgeColorCombined;
        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_r: { value: tex_r },
      Matcap_g: { value: tex_g },
      Matcap_b: { value: tex_b },
      Matcap_k: { value: tex_k },
      color: { value: new Vector3(1, 0, 1) },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  return Material;
}

export { createMatCapMaterial };
