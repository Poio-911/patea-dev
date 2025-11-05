"use client";
import React, { useEffect, useRef } from 'react';

/**
 * shader-backdrop.tsx
 * WebGL2 fragment shader backdrop producing animated energy field.
 * Falls back gracefully if WebGL2 is not available (parent will handle fallback).
 */
const vertexShaderSrc = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSrc = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity; // 0..1
uniform vec3 u_accent; // h, s, l (h in degrees, s/l 0..1)

// Simple 2D noise - value noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i + vec2(0.0,0.0));
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x / 360.0;
  float s = hsl.y;
  float l = hsl.z;
  float r = l;
  float g = l;
  float b = l;
  if (s > 0.0001) {
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    float hk = h;
    float t[3];
    t[0] = hk + 1.0/3.0;
    t[1] = hk;
    t[2] = hk - 1.0/3.0;
    for (int i = 0; i < 3; i++) {
      float tc = t[i];
      if (tc < 0.0) tc += 1.0;
      if (tc > 1.0) tc -= 1.0;
      if (tc < 1.0/6.0) {
        if (i==0) r = p + (q - p) * 6.0 * tc;
        if (i==1) g = p + (q - p) * 6.0 * tc;
        if (i==2) b = p + (q - p) * 6.0 * tc;
      } else if (tc < 1.0/2.0) {
        if (i==0) r = q;
        if (i==1) g = q;
        if (i==2) b = q;
      } else if (tc < 2.0/3.0) {
        if (i==0) r = p + (q - p) * (2.0/3.0 - tc) * 6.0;
        if (i==1) g = p + (q - p) * (2.0/3.0 - tc) * 6.0;
        if (i==2) b = p + (q - p) * (2.0/3.0 - tc) * 6.0;
      } else {
        if (i==0) r = p;
        if (i==1) g = p;
        if (i==2) b = p;
      }
    }
  }
  return vec3(r,g,b);
}

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * u_resolution.xy / min(u_resolution.x, u_resolution.y);

  float t = u_time * 0.2;
  float q = fbm(p * 0.8 + t * 0.6);

  // energy ridges
  float ridge = smoothstep(0.4, 0.7, q + 0.2 * sin(u_time + p.x * 6.0));

  // color sweep using accent hue
  vec3 accent = hsl2rgb(u_accent);
  vec3 base = vec3(0.02, 0.03, 0.06);
  vec3 color = mix(base, accent, ridge * u_intensity);

  // subtle bloom via second noise layer
  float glow = fbm(p * 3.0 - t * 0.3) * 0.5 + 0.25;
  color += vec3(0.12, 0.18, 0.28) * glow * u_intensity * 0.6;

  // vignette
  float dist = distance(uv, vec2(0.5));
  color *= smoothstep(0.9, 0.3, dist);

  outColor = vec4(color, 1.0);
}
`;

export default function ShaderBackdrop(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: true }) as WebGL2RenderingContext | null;
    if (!gl) return;

    let prog: WebGLProgram | null = null;

    const resize = () => {
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, vertexShaderSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShaderSrc);
    if (!vs || !fs) return;

    prog = gl.createProgram();
    gl.attachShader(prog!, vs);
    gl.attachShader(prog!, fs);
    gl.linkProgram(prog!);
    if (!gl.getProgramParameter(prog!, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog!));
      return;
    }

  const posLoc = gl.getAttribLocation(prog!, 'a_position');
  const tUniform = gl.getUniformLocation(prog!, 'u_time');
  const resUniform = gl.getUniformLocation(prog!, 'u_resolution');
  const intensityUniform = gl.getUniformLocation(prog!, 'u_intensity');
  const accentUniform = gl.getUniformLocation(prog!, 'u_accent');

    // Quad buffer
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(prog!);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // uniform defaults
    if (intensityUniform) {
      const cs = getComputedStyle(document.documentElement);
      const intensityCss = cs.getPropertyValue('--game-intensity').trim();
      const intensityVal = intensityCss ? parseFloat(intensityCss) : 0.9;
      gl.uniform1f(intensityUniform, isFinite(intensityVal) ? intensityVal : 0.9);
    }
    // default accent: use the --accent variable from CSS by reading computed style
    const cs = getComputedStyle(document.documentElement);
    const accentCss = cs.getPropertyValue('--accent').trim();
    // parse: "h s% l%" -> convert to 0..1 for S/L
    let accent = [173, 1.0, 0.45];
    if (accentCss) {
      const parts = accentCss.split(/\s+/).map(p => p.replace('%', ''));
      if (parts.length >= 3) {
        accent = [parseFloat(parts[0]) || accent[0], (parseFloat(parts[1]) || 100) / 100, (parseFloat(parts[2]) || 45) / 100];
      }
    }
    gl.uniform3f(accentUniform, accent[0], accent[1], accent[2]);

    let start = performance.now();
    const render = () => {
      const now = performance.now();
      // respect CSS game speed token
      const speedCss = cs.getPropertyValue('--game-speed').trim();
      const speedVal = speedCss ? parseFloat(speedCss) : 1.0;
      const t = ((now - start) / 1000) * (isFinite(speedVal) ? speedVal : 1.0);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog!);
      gl.uniform1f(tUniform, t);
      gl.uniform2f(resUniform, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      if (prog) gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[-6] w-full h-full select-none pointer-events-none"
    />
  );
}
