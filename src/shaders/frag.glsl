varying vec2 vUv;
varying vec3 vPosition;
uniform float time;
uniform float progress;
uniform float repeat;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform vec2 resolution;

void main() {
    vec2 newuv = vPosition.xy;

    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
