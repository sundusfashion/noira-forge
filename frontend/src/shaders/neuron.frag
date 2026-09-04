// neuron.frag - Core fragment shader for neural cortex
uniform float uTime;
uniform float uActivation;
uniform vec3 uTypeColor;
varying float vActivation;
varying vec3 vColor;
varying float vTime;

void main() {
  // Neural pulse based on activation
  float pulse = sin(uTime * 3.0 + vActivation * 3.14159) * 0.15 + 0.85;
  
  // Base color from type
  vec3 color = vColor;
  
  // Mode-based glow
  if (vActivation > 0.7) {
    color += vec3(0.0, 0.2, 0.6) * pulse;
  }
  
  if (vActivation > 0.9) {
    color = vec3(1.0, 0.4, 0.2);
  }
  
  // Radial gradient
  float dist = length(gl_FragCoord.xy - vec2(0.5 * 800.0, 0.5 * 600.0));
  float radius = 0.5 * 800.0;
  float alpha = smoothstep(radius, 0.0, dist) * vActivation * pulse;
  
  gl_FragColor = vec4(color, alpha);
}