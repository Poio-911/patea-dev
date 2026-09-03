#version 460 core
#include <flutter/runtime_effect.glsl>

// Material de la carta según su tier.
//
// Cada tier es una superficie distinta, no el mismo fondo con otro borde:
//   0 bronce  - metal mate, sin reflejo
//   1 plata   - acero cepillado, líneas finas y reflejo frío
//   2 oro     - metal pulido, reflejo cálido que sigue la inclinación
//   3 élite   - lámina holográfica, arcoíris que se corre al inclinar
//
// El desplazamiento del reflejo depende de la inclinación real del dedo, así
// que no se puede precalcular: es lo que hace que se sienta una lámina física
// y no una textura pegada.

uniform vec2  uSize;
uniform float uTiltX;   // -1 a 1
uniform float uTiltY;   // -1 a 1
uniform float uTier;    // 0..3
uniform float uSeed;    // separa las cartas para que no brillen todas igual

out vec4 fragColor;

// Arcoíris suave sin bandas duras (aproximación de Inigo Quilez).
vec3 spectrum(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * t + d));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = FlutterFragCoord().xy / uSize;
  vec2 centered = uv - 0.5;

  // Eje del reflejo: diagonal desplazada por la inclinación.
  float axis = (centered.x + centered.y) * 0.5 + (uTiltX * 0.55 - uTiltY * 0.55);
  float tiltAmount = clamp(length(vec2(uTiltX, uTiltY)), 0.0, 1.0);

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (uTier < 0.5) {
    // ── Bronce: mate. Sólo un veteado muy tenue, sin reflejo.
    float grain = hash(floor(uv * vec2(140.0, 210.0))) * 0.045;
    color = vec3(0.82, 0.53, 0.26);
    alpha = grain;

  } else if (uTier < 1.5) {
    // ── Plata: acero cepillado. Líneas horizontales finas más un reflejo
    // frío y ancho que se corre con la inclinación.
    float brushed = sin(uv.y * 420.0 + hash(vec2(floor(uv.y * 420.0), 0.0)) * 6.0);
    brushed = brushed * 0.5 + 0.5;
    float sheen = exp(-pow(axis * 3.4, 2.0));
    color = mix(vec3(0.72, 0.77, 0.86), vec3(1.0), sheen);
    alpha = brushed * 0.035 + sheen * 0.16 * (0.35 + tiltAmount);

  } else if (uTier < 2.5) {
    // ── Oro: metal pulido. Reflejo angosto e intenso, cálido.
    float sheen = exp(-pow(axis * 5.0, 2.0));
    float secondary = exp(-pow((axis + 0.34) * 8.0, 2.0)) * 0.45;
    color = mix(vec3(0.98, 0.78, 0.28), vec3(1.0, 0.96, 0.80), sheen);
    alpha = (sheen + secondary) * 0.30 * (0.40 + tiltAmount);

  } else {
    // ── Élite: lámina holográfica. El arcoíris se desplaza con la
    // inclinación y lo cruza un patrón de interferencia fino, como el
    // reflejo real de un holograma.
    float band = axis * 2.6 + uSeed;
    float interference = sin((uv.x * 26.0 + uv.y * 18.0) + uTiltX * 7.0) * 0.055;
    vec3 holo = spectrum(band + interference);

    // En reposo casi no se ve —una lámina real de frente parece normal— y se
    // enciende al girarla. Antes el piso era 0.10 y lavaba los atributos.
    float bloom = exp(-pow(axis * 2.1, 2.0));
    color = holo;
    alpha = (0.045 + tiltAmount * 0.40) * (0.30 + bloom * 0.70);
  }

  // Se apaga hacia los bordes para que no marque el rectángulo.
  float vignette = smoothstep(0.72, 0.18, length(centered * vec2(1.0, 0.78)));
  alpha *= mix(0.55, 1.0, vignette);

  fragColor = vec4(color * alpha, alpha);
}
