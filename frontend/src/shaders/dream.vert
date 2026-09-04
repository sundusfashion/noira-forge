// dream.vert - Vertex shader for dream state visualization
uniform float uTime;
uniform float uIntensity;
attribute vec3 position;
attribute vec3 normal;
varying vec3 vNormal;
varying float vIntensity;

void main() {
  vNormal = normal;
  vIntensity = uIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}