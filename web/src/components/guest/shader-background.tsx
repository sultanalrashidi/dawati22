"use client";

import { useEffect, useRef } from "react";

const VERTEX_SRC = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Ported from the "Immersive Espresso" reference mockup's raw-WebGL silk-flow
// shader — multi-octave noise layered into a slowly drifting silk texture,
// with a soft vignette. Colors are uniforms (not hardcoded) so this can be
// reused for any theme's palette.
const FRAGMENT_SRC = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_deep;
uniform vec3 u_mid;
uniform vec3 u_highlight;

vec3 hash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash(i + vec3(0.0,0.0,0.0)), f - vec3(0.0,0.0,0.0)),
                       dot(hash(i + vec3(1.0,0.0,0.0)), f - vec3(1.0,0.0,0.0)), u.x),
                   mix(dot(hash(i + vec3(0.0,1.0,0.0)), f - vec3(0.0,1.0,0.0)),
                       dot(hash(i + vec3(1.0,1.0,0.0)), f - vec3(1.0,1.0,0.0)), u.x), u.y),
               mix(mix(dot(hash(i + vec3(0.0,0.0,1.0)), f - vec3(0.0,0.0,1.0)),
                       dot(hash(i + vec3(1.0,0.0,1.0)), f - vec3(1.0,0.0,1.0)), u.x),
                   mix(dot(hash(i + vec3(0.0,1.0,1.0)), f - vec3(0.0,1.0,1.0)),
                       dot(hash(i + vec3(1.0,1.0,1.0)), f - vec3(1.0,1.0,1.0)), u.x), u.y), u.z);
}

void main() {
    vec2 uv = v_texCoord;
    vec2 p = (uv * 2.0 - 1.0);
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.15;

    float n1 = noise(vec3(p * 1.5, t));
    float n2 = noise(vec3(p * 3.0 + n1, t * 1.2));
    float n3 = noise(vec3(p * 6.0, t * 0.8));

    float silk = n1 * 0.5 + n2 * 0.25 + n3 * 0.125;
    silk = smoothstep(-0.2, 0.8, silk);

    vec3 finalColor = mix(u_deep, u_mid, silk);

    float streaks = pow(max(0.0, noise(vec3(p.x * 2.0, p.y * 0.5, t * 2.0))), 8.0);
    finalColor = mix(finalColor, u_highlight, streaks * 0.4);

    float vignette = 1.0 - length(uv - 0.5) * 1.2;
    finalColor *= smoothstep(0.0, 0.6, vignette);

    gl_FragColor = vec4(finalColor, 1.0);
}`;

function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("ShaderBackground compile error:", gl.getShaderInfoLog(shader));
  }
  return shader;
}

/** Animated silk-noise canvas background, ported from a raw-WebGL reference mockup (no three.js dependency). */
export function ShaderBackground({ deep, mid, highlight }: { deep: string; mid: string; highlight: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") ?? (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("ShaderBackground link error:", gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uDeep = gl.getUniformLocation(prog, "u_deep");
    const uMid = gl.getUniformLocation(prog, "u_mid");
    const uHighlight = gl.getUniformLocation(prog, "u_highlight");
    gl.uniform3fv(uDeep, hexToVec3(deep));
    gl.uniform3fv(uMid, hexToVec3(mid));
    gl.uniform3fv(uHighlight, hexToVec3(highlight));

    function syncSize() {
      const w = canvas!.clientWidth || 1;
      const h = canvas!.clientHeight || 1;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);
    syncSize();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    function draw(timeMs: number) {
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, timeMs * 0.001);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }
    draw(0);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [deep, mid, highlight]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
