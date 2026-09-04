// neuron.vert - Core vertex shader for neural cortex
uniform float uTime;
uniform float[] uActivations;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute float size;
varying float vActivation;
varying vec3 vColor;
varying float vTime;

void main() {
  vActivation = activation;
  vColor = color;
  vTime = time;
  vec4 mvPosition = modelViewMatrix * vec4(position + normal * size, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * (300.0 / -mvPosition.z);
}