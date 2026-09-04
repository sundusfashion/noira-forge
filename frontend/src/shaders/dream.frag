// dream.frag - Fragment shader for dream state - flowing organic patterns
uniform float uTime;
uniform float uIntensity;
varying vec3 vNormal;
varying float vIntensity;

// Flow noise function
float flowNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Turbulence
float turbulence(vec2 p) {
  float t = 0.0;
  float frequency = 1.0;
  amplitude = 1.0;
  for (int i = 0; i < 5; i++) {
    t += amplitude * flowNoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return abs(t);
}

void main() {
  // Organic flow patterns
  vec2 uv = gl_FragCoord.xy / vec2(800.0, 600.0);
  float flow = flowNoise(uv * 3.0 + uTime * 0.1);
  float turb = turbulence(uv * 2.0 + uTime * 0.05);
  
  // Dream color palette - melancholy purple to gold transitions
  vec3 dreamColor1 = vec3(0x6b, 0x2d, 0xff) / 255.0; // melancholy purple
  vec3 dreamColor2 = vec3(0xd4, 0xa8, 0x43) / 255.0; // synapse gold
  
  // Interpolate based on time and turbulence
  mix(dreamColor1, dreamColor2, flow * 0.5 + 0.5);
  
  // Radial blur effect
  float centerDist = length(uv - 0.5);
  float radialAlpha = 1.0 - smoothstep(0.3, 0.0, centerDist);
  
  // Dream pulse
  float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
  
  vec3 finalColor = mix(dreamColor1, dreamColor2, flow);
  float alpha = radialAlpha * vIntensity * pulse;
  
  gl_FragColor = vec4(finalColor, alpha);
}