/**
 * Browser-only A-Frame bootstrap for the WebXR War Room.
 *
 * Imports A-Frame + add-ons for their side effects (they register globals and
 * primitives on `window.AFRAME`) and registers the handful of custom components
 * the scene needs. Guarded so it is a no-op outside the browser and runs its
 * registration exactly once even under React StrictMode double-invocation.
 *
 * Kept out of the React render path so the heavy A-Frame bundle is only pulled
 * in when the immersive route is actually visited (dynamic import in the scene).
 */

import { compactNumber } from "@/lib/warroom-xr-data";

let registered = false;

// A-Frame's global object. It has no first-party TS types, so we treat it as
// `any` — the scene interacts with it purely through string-keyed component
// registration, which carries no useful static surface anyway.
type AframeGlobal = any;

export async function ensureAFrame(): Promise<AframeGlobal | null> {
  if (typeof window === "undefined") return null;
  // A-Frame attaches itself to window.AFRAME on import.
  await import("aframe");
  // Add-on packages register their components against the global AFRAME.
  await import("aframe-extras");
  await import("aframe-environment-component");

  const AFRAME = (window as { AFRAME?: AframeGlobal }).AFRAME;
  if (!AFRAME) return null;

  if (!registered) {
    registered = true;
    registerComponents(AFRAME);
  }
  return AFRAME;
}

function registerComponents(AFRAME: any) {
  const THREE = AFRAME.THREE;

  // ── hover-glow: scale + emissive pop on cursor enter, restore on leave ──────
  if (!AFRAME.components["hover-glow"]) {
    AFRAME.registerComponent("hover-glow", {
      schema: {
        scale: { type: "number", default: 1.06 },
        color: { type: "color", default: "#00FFFF" },
      },
      init() {
        const el = this.el;
        const baseScale = el.object3D.scale.clone();
        this.onEnter = () => {
          el.object3D.scale.set(
            baseScale.x * this.data.scale,
            baseScale.y * this.data.scale,
            baseScale.z * this.data.scale,
          );
          el.emit("glow-on");
        };
        this.onLeave = () => {
          el.object3D.scale.copy(baseScale);
          el.emit("glow-off");
        };
        el.addEventListener("mouseenter", this.onEnter);
        el.addEventListener("mouseleave", this.onLeave);
      },
      remove() {
        this.el.removeEventListener("mouseenter", this.onEnter);
        this.el.removeEventListener("mouseleave", this.onLeave);
      },
    });
  }

  // ── count-up: animate a numeric text value from 0 → target on load ──────────
  if (!AFRAME.components["count-up"]) {
    AFRAME.registerComponent("count-up", {
      schema: {
        to: { type: "number", default: 0 },
        dur: { type: "number", default: 1600 },
        prefix: { type: "string", default: "" },
        suffix: { type: "string", default: "" },
        compact: { type: "boolean", default: false },
      },
      init() {
        this.start = performance.now();
        this.done = false;
      },
      tick() {
        if (this.done) return;
        const t = Math.min(1, (performance.now() - this.start) / this.data.dur);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const v = Math.round(this.data.to * eased);
        const shown = this.data.compact ? compactNumber(v) : v.toLocaleString();
        this.el.setAttribute("value", `${this.data.prefix}${shown}${this.data.suffix}`);
        if (t >= 1) this.done = true;
      },
    });
  }

  // ── pulse: gentle opacity/scale pulsing for badges & rings ──────────────────
  if (!AFRAME.components["pulse"]) {
    AFRAME.registerComponent("pulse", {
      schema: {
        speed: { type: "number", default: 1.5 },
        min: { type: "number", default: 0.7 },
        max: { type: "number", default: 1.0 },
      },
      tick(time: number) {
        const mesh = this.el.getObject3D("mesh");
        if (mesh && mesh.material) {
          // transparent is set once the first time we see the material; only
          // opacity needs to change per frame (reassigning flags can force a
          // shader recompile in some THREE paths).
          if (!mesh.material.transparent) mesh.material.transparent = true;
          const s = (Math.sin((time / 1000) * this.data.speed) + 1) / 2;
          mesh.material.opacity = this.data.min + s * (this.data.max - this.data.min);
        }
      },
    });
  }

  // ── particle-burst: emit a one-shot expanding burst of points on `burst` ────
  if (!AFRAME.components["particle-burst"]) {
    AFRAME.registerComponent("particle-burst", {
      schema: {
        count: { type: "number", default: 140 },
        color: { type: "color", default: "#00FFFF" },
      },
      init() {
        this.active = false;
        this.el.addEventListener("burst", () => this.fire());
      },
      fire() {
        // Remove any prior burst mesh.
        const old = this.el.getObject3D("burst");
        if (old) this.el.removeObject3D("burst");

        const n = this.data.count;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(n * 3);
        this.velocities = [];
        for (let i = 0; i < n; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = 0;
          const dir = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          ).normalize().multiplyScalar(0.6 + Math.random() * 1.4);
          this.velocities.push(dir);
        }
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color: new THREE.Color(this.data.color),
          size: 0.06,
          transparent: true,
          opacity: 1,
        });
        const pts = new THREE.Points(geo, mat);
        this.el.setObject3D("burst", pts);
        this.elapsed = 0;
        this.active = true;
      },
      tick(_t: number, dt: number) {
        if (!this.active) return;
        const pts = this.el.getObject3D("burst");
        if (!pts) return;
        const d = (dt || 16) / 1000;
        this.elapsed += d;
        const arr = pts.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.velocities.length; i++) {
          arr[i * 3] += this.velocities[i].x * d;
          arr[i * 3 + 1] += this.velocities[i].y * d;
          arr[i * 3 + 2] += this.velocities[i].z * d;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        pts.material.opacity = Math.max(0, 1 - this.elapsed / 1.6);
        if (this.elapsed >= 1.6) {
          this.active = false;
          this.el.removeObject3D("burst");
        }
      },
    });
  }

  // ── starfield: slow-rotating ambient particle field behind the room ─────────
  if (!AFRAME.components["starfield"]) {
    AFRAME.registerComponent("starfield", {
      schema: {
        count: { type: "number", default: 900 },
        radius: { type: "number", default: 30 },
        color: { type: "color", default: "#2bd6ff" },
      },
      init() {
        const n = this.data.count;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const r = this.data.radius * (0.4 + Math.random() * 0.6);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          positions[i * 3 + 1] = r * Math.cos(phi);
          positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color: new THREE.Color(this.data.color),
          size: 0.08,
          transparent: true,
          opacity: 0.55,
        });
        this.points = new THREE.Points(geo, mat);
        this.el.setObject3D("starfield", this.points);
      },
      tick(time: number) {
        if (this.points) {
          this.points.rotation.y = (time / 1000) * 0.02;
          this.points.rotation.x = Math.sin((time / 1000) * 0.01) * 0.05;
        }
      },
      remove() {
        this.el.removeObject3D("starfield");
      },
    });
  }

  // ── waveform: animated audio-style bars; plays on `replay` event ────────────
  if (!AFRAME.components["waveform"]) {
    AFRAME.registerComponent("waveform", {
      schema: {
        bars: { type: "number", default: 24 },
        color: { type: "color", default: "#00FFFF" },
        width: { type: "number", default: 1.4 },
      },
      init() {
        this.group = new THREE.Group();
        this.meshes = [];
        const n = this.data.bars;
        const bw = this.data.width / n;
        for (let i = 0; i < n; i++) {
          const g = new THREE.BoxGeometry(bw * 0.6, 0.05, 0.02);
          const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.data.color) });
          const mesh = new THREE.Mesh(g, m);
          mesh.position.x = -this.data.width / 2 + i * bw + bw / 2;
          this.group.add(mesh);
          this.meshes.push(mesh);
        }
        this.el.setObject3D("waveform", this.group);
        this.playing = false;
        this.el.addEventListener("replay", () => { this.playing = true; });
      },
      tick(time: number) {
        const amp = this.playing ? 1 : 0.15;
        for (let i = 0; i < this.meshes.length; i++) {
          const h = (0.1 + Math.abs(Math.sin((time / 200) + i * 0.5)) * 0.4) * amp + 0.05;
          this.meshes[i].scale.y = Math.max(0.1, h / 0.05);
        }
      },
      remove() {
        this.el.removeObject3D("waveform");
      },
    });
  }
}
