import {
  ShaderMaterial,
  Vector3,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

let common = `
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


        vec4 gammaCorrect( vec4 colorLinear )
        {
        const float screenGamma = 2.2;
        return vec4(pow(colorLinear.rgb, vec3(1./screenGamma)), colorLinear.a);
        }
`;

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

        ${common}

        void main(void){


            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec2 coord = Point * 0.95; // pull slightly inward, to reduce sampling artifacts near edges

            vec4 mat_r = gammaCorrect(texture2D(Matcap_r, coord));
            vec4 mat_g = gammaCorrect(texture2D(Matcap_g, coord));
            vec4 mat_b = gammaCorrect(texture2D(Matcap_b, coord));
            vec4 mat_k = gammaCorrect(texture2D(Matcap_k, coord));

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

function createVertexScalarFunctionMaterial(tex_r, tex_g, tex_b, tex_k) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute vec3 color;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec3 Color;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            Point.x = vNormal.x * 0.5 + 0.5;
            Point.y = vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;
            Color = color;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

  let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec3 Color;

        ${common}

        void main(void){


            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec2 coord = Point * 0.95; // pull slightly inward, to reduce sampling artifacts near edges

            vec4 mat_r = texture2D(Matcap_r, coord);
            vec4 mat_g = texture2D(Matcap_g, coord);
            vec4 mat_b = texture2D(Matcap_b, coord);
            vec4 mat_k = texture2D(Matcap_k, coord);

            vec4 colorCombined = Color.r * mat_r + Color.g * mat_g + Color.b * mat_b +
                                (1. - Color.r - Color.g - Color.b) * mat_k;

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

let groundPlaneVertexShader = `
  uniform mat4 textureMatrix;
  attribute vec2 texture_uv;

  varying vec4 vUv;
  varying vec2 TextureUV;

  void main() {

  	vUv = textureMatrix * vec4( position, 1.0 );

    TextureUV = texture_uv;

  	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

  }
`;

let groundPlaneFragmentShader = `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tex;
    uniform float alpha;

    varying vec2 TextureUV;
    varying vec4 vUv;

    float blendOverlay( float base, float blend ) {
        return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
    }

    vec3 blendOverlay( vec3 base, vec3 blend ) {
        return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
    }

    float onGrid(vec2 coord2D) {
        // Checker stripes
        float modDist = min(min(mod(coord2D.x, 1.0), mod(coord2D.y, 1.0)), min(mod(-coord2D.x, 1.0), mod(-coord2D.y, 1.0)));
        return 1.-smoothstep(0.005, .01, modDist);
    }

    void main() {

        vec4 mat = texture2D(tex, TextureUV);
        vec4 base = texture2DProj( tDiffuse, vUv );
        float t = onGrid(26.*TextureUV);
        gl_FragColor = (1.-t) * ((1.-alpha) * vec4( blendOverlay( base.rgb, color ), 1.0 ) + alpha * mat) + t*vec4(0,0,0,1);

    }
`;

export {
  createMatCapMaterial,
  createVertexScalarFunctionMaterial,
  groundPlaneVertexShader,
  groundPlaneFragmentShader,
};
