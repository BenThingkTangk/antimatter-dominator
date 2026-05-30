// WarRoomScene — the WebXR War Room. Five floating glass panels arranged in a
// semicircle inside a dark starfield. Designed for @react-three/xr v5 (VR/AR
// session) with desktop OrbitControls fallback. Geometry is kept light for a
// Quest 3 target: low-poly planes, instanced text, no heavy post-processing.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Text, RoundedBox, OrbitControls } from "@react-three/drei";
import { Interactive } from "@react-three/xr";
import * as THREE from "three";
import {
  PROSPECTS,
  VERTICAL_COLORS,
  STAGE_ORDER,
  PIPELINE_TOTAL,
  FORECAST_TOTAL,
} from "@/data/warroom-seed";

const CYAN = "#00d4ff";
const VIOLET = "#7c3aed";

// Position the 5 panels in a semicircle facing the viewer at origin.
const RADIUS = 4.2;
const PANEL_ANGLES = [130, 105, 90, 75, 50].map((d) => (d * Math.PI) / 180);

function panelPosition(angle: number, y = 1.4): [number, number, number] {
  return [Math.cos(angle) * RADIUS, y, -Math.sin(angle) * RADIUS];
}

/** Glass backing plane for a panel. */
function PanelFrame({
  width,
  height,
  color = CYAN,
}: {
  width: number;
  height: number;
  color?: string;
}) {
  return (
    <group>
      <RoundedBox args={[width, height, 0.06]} radius={0.08} smoothness={3}>
        <meshStandardMaterial
          color="#0a0d14"
          transparent
          opacity={0.82}
          emissive={color}
          emissiveIntensity={0.06}
          roughness={0.4}
          metalness={0.2}
        />
      </RoundedBox>
      {/* glowing border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, 0.06)]} />
        <lineBasicMaterial color={color} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

function PanelTitle({ children, color = CYAN, y }: { children: string; color?: string; y: number }) {
  return (
    <Text
      position={[0, y, 0.06]}
      fontSize={0.16}
      color={color}
      anchorX="center"
      anchorY="middle"
      maxWidth={2.4}
      outlineWidth={0.004}
      outlineColor="#000"
    >
      {children}
    </Text>
  );
}

/** Floating wrapper that gives every panel a gentle bob + faces center. */
function FloatingPanel({
  angle,
  children,
}: {
  angle: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const pos = panelPosition(angle);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.6 + phase) * 0.05;
    }
  });
  return (
    <group ref={ref} position={pos} rotation={[0, angle - Math.PI / 2, 0]}>
      {children}
    </group>
  );
}

// --- Panel 1: Pipeline (left-far) ---
function PipelinePanel({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <FloatingPanel angle={PANEL_ANGLES[0]}>
      <PanelFrame width={2.6} height={3.0} color={CYAN} />
      <PanelTitle y={1.32}>PIPELINE · 10 DEALS</PanelTitle>
      {PROSPECTS.map((p, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -0.62 : 0.62;
        const y = 0.95 - row * 0.42;
        const color = VERTICAL_COLORS[p.vertical];
        return (
          <Interactive key={p.id} onSelect={() => onSelect(p.id)}>
            <group position={[x, y, 0.06]}>
              <RoundedBox args={[1.12, 0.36, 0.03]} radius={0.03}>
                <meshStandardMaterial color="#11151f" emissive={color} emissiveIntensity={0.1} />
              </RoundedBox>
              <Text position={[-0.5, 0.08, 0.03]} fontSize={0.072} color="#f6f8ff" anchorX="left" maxWidth={1}>
                {p.company}
              </Text>
              <Text position={[-0.5, -0.04, 0.03]} fontSize={0.058} color={CYAN} anchorX="left">
                {`$${Math.round(p.dealValue / 1000)}K`}
              </Text>
              <Text position={[0.5, -0.04, 0.03]} fontSize={0.05} color={color} anchorX="right">
                {p.stage}
              </Text>
              {/* AI score bar */}
              <mesh position={[-0.5 + (p.intentScore / 100) * 0.5, -0.12, 0.03]}>
                <boxGeometry args={[(p.intentScore / 100) * 1.0, 0.02, 0.01]} />
                <meshBasicMaterial color={CYAN} />
              </mesh>
            </group>
          </Interactive>
        );
      })}
    </FloatingPanel>
  );
}

// --- Panel 2: Calls (left) ---
const EMOTIONS = ["Excited", "Hesitant", "Interested", "Objecting"];
const EMO_COLOR = ["#34d399", "#f5c842", "#00d4ff", "#fb7185"];

function CallsPanel() {
  const [playing, setPlaying] = useState(true);
  const barsRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!barsRef.current || !playing) return;
    barsRef.current.children.forEach((c, i) => {
      const m = c as THREE.Mesh;
      const h = 0.05 + Math.abs(Math.sin(clock.elapsedTime * 3 + i * 0.5)) * 0.4;
      m.scale.y = h / 0.05;
      m.position.y = 0.2 + h / 2;
    });
  });
  return (
    <FloatingPanel angle={PANEL_ANGLES[1]}>
      <PanelFrame width={2.4} height={2.6} color={VIOLET} />
      <PanelTitle y={1.12} color={VIOLET}>AI CALL · LIVE</PanelTitle>
      {/* waveform */}
      <group ref={barsRef} position={[-0.9, 0, 0.06]}>
        {Array.from({ length: 24 }).map((_, i) => (
          <mesh key={i} position={[i * 0.075, 0.2, 0]}>
            <boxGeometry args={[0.03, 0.05, 0.02]} />
            <meshBasicMaterial color={CYAN} />
          </mesh>
        ))}
      </group>
      {/* emotion tags */}
      {EMOTIONS.map((e, i) => (
        <group key={e} position={[-0.7 + (i % 2) * 0.95, -0.45 - Math.floor(i / 2) * 0.35, 0.06]}>
          <RoundedBox args={[0.8, 0.26, 0.02]} radius={0.04}>
            <meshStandardMaterial color="#11151f" emissive={EMO_COLOR[i]} emissiveIntensity={0.18} />
          </RoundedBox>
          <Text fontSize={0.072} color={EMO_COLOR[i]} position={[0, 0, 0.02]} anchorX="center">
            {e}
          </Text>
        </group>
      ))}
      <Interactive onSelect={() => setPlaying((p) => !p)}>
        <group position={[0, -1.05, 0.06]}>
          <RoundedBox args={[1.0, 0.3, 0.03]} radius={0.05}>
            <meshStandardMaterial color={playing ? VIOLET : "#11151f"} emissive={VIOLET} emissiveIntensity={0.3} />
          </RoundedBox>
          <Text fontSize={0.08} color="#f6f8ff" position={[0, 0, 0.03]} anchorX="center">
            {playing ? "❚❚ PAUSE" : "▶ PLAY"}
          </Text>
        </group>
      </Interactive>
    </FloatingPanel>
  );
}

// --- Panel 3: Campaigns (center) ---
const SEQ = ["Day 1 Email", "Day 2 LinkedIn", "Day 3 Call", "Day 5 SMS"];

function Particles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, velocities } = useMemo(() => {
    const n = 240;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0.1;
      const a = Math.random() * Math.PI * 2;
      const s = 0.4 + Math.random() * 1.2;
      vel[i * 3] = Math.cos(a) * s;
      vel[i * 3 + 1] = Math.sin(a) * s;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    return { positions: pos, velocities: vel };
  }, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    if (active) {
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += velocities[i] * delta;
        arr[i + 1] += velocities[i + 1] * delta;
        arr[i + 2] += velocities[i + 2] * delta;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
      (ref.current.material as THREE.PointsMaterial).opacity = Math.max(
        0,
        (ref.current.material as THREE.PointsMaterial).opacity - delta * 0.5,
      );
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={CYAN} size={0.04} transparent opacity={active ? 1 : 0} />
    </points>
  );
}

function CampaignsPanel() {
  const [burst, setBurst] = useState(0);
  return (
    <FloatingPanel angle={PANEL_ANGLES[2]}>
      <PanelFrame width={2.6} height={2.6} color={CYAN} />
      <PanelTitle y={1.12}>OUTBOUND CAMPAIGN</PanelTitle>
      {SEQ.map((s, i) => (
        <group key={s} position={[0, 0.65 - i * 0.42, 0.06]}>
          <RoundedBox args={[1.9, 0.32, 0.02]} radius={0.04}>
            <meshStandardMaterial color="#11151f" emissive={CYAN} emissiveIntensity={0.08} />
          </RoundedBox>
          <Text fontSize={0.08} color="#f6f8ff" position={[0, 0, 0.02]} anchorX="center">
            {s}
          </Text>
        </group>
      ))}
      {burst > 0 && <Particles key={burst} active />}
      <Interactive onSelect={() => setBurst((b) => b + 1)}>
        <group position={[0, -0.95, 0.06]}>
          <RoundedBox args={[1.6, 0.34, 0.03]} radius={0.05}>
            <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.4} />
          </RoundedBox>
          <Text fontSize={0.09} color="#04121a" position={[0, 0, 0.03]} anchorX="center">
            LAUNCH CAMPAIGN
          </Text>
        </group>
      </Interactive>
    </FloatingPanel>
  );
}

// --- Panel 4: Buyer Intel scatter (right) ---
function IntelPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const maxSize = Math.max(...PROSPECTS.map((p) => p.companySize));
  return (
    <FloatingPanel angle={PANEL_ANGLES[3]}>
      <PanelFrame width={2.6} height={2.6} color={VIOLET} />
      <PanelTitle y={1.12} color={VIOLET}>BUYER INTEL · 3D</PanelTitle>
      {/* mini axis cage */}
      <lineSegments position={[0, -0.1, 0.1]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.8, 1.4, 1.0)]} />
        <lineBasicMaterial color={VIOLET} transparent opacity={0.3} />
      </lineSegments>
      {PROSPECTS.map((p) => {
        const x = (p.companySize / maxSize - 0.5) * 1.6;
        const y = (p.intentScore / 100 - 0.5) * 1.2 - 0.1;
        const z = ((p.sentimentScore + 100) / 200 - 0.5) * 0.9 + 0.1;
        const color = VERTICAL_COLORS[p.vertical];
        const r = 0.04 + (p.dealValue / 310000) * 0.06;
        return (
          <Interactive key={p.id} onSelect={() => onSelect(p.id)}>
            <mesh position={[x, y, z]}>
              <sphereGeometry args={[r, 12, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          </Interactive>
        );
      })}
    </FloatingPanel>
  );
}

// --- Panel 5: Revenue (right-far, read-only) ---
function RevenuePanel() {
  const arcRef = useRef<THREE.Mesh>(null);
  const attain = FORECAST_TOTAL / PIPELINE_TOTAL;
  useFrame(({ clock }) => {
    if (arcRef.current) {
      const mat = arcRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 + Math.sin(clock.elapsedTime * 1.5) * 0.2;
    }
  });
  const verts = Object.entries(
    PROSPECTS.reduce<Record<string, number>>((a, p) => {
      a[p.vertical] = (a[p.vertical] || 0) + p.dealValue;
      return a;
    }, {}),
  );
  const maxV = Math.max(...verts.map((v) => v[1]));
  return (
    <FloatingPanel angle={PANEL_ANGLES[4]}>
      <PanelFrame width={2.6} height={2.8} color={CYAN} />
      <PanelTitle y={1.22}>REVENUE</PanelTitle>
      {/* arc gauge */}
      <mesh ref={arcRef} position={[0, 0.55, 0.07]}>
        <ringGeometry args={[0.42, 0.52, 48, 1, Math.PI, Math.PI * attain]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.55, 0.06]}>
        <ringGeometry args={[0.42, 0.52, 48, 1, Math.PI, Math.PI]} />
        <meshBasicMaterial color="#1a2030" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 0.55, 0.08]} fontSize={0.14} color="#f6f8ff" anchorX="center">
        {`${Math.round(attain * 100)}%`}
      </Text>
      <Text position={[0, 0.18, 0.07]} fontSize={0.06} color="rgba(255,255,255,0.6)" anchorX="center">
        {`$${Math.round(PIPELINE_TOTAL / 1000)}K pipeline`}
      </Text>
      {/* ROI bars */}
      {verts.slice(0, 6).map(([v, val], i) => (
        <group key={v} position={[-0.9, -0.15 - i * 0.16, 0.07]}>
          <mesh position={[(val / maxV) * 0.8, 0, 0]}>
            <boxGeometry args={[(val / maxV) * 1.6, 0.08, 0.02]} />
            <meshStandardMaterial color={VERTICAL_COLORS[v as keyof typeof VERTICAL_COLORS]} emissive={CYAN} emissiveIntensity={0.1} />
          </mesh>
        </group>
      ))}
    </FloatingPanel>
  );
}

export function WarRoomScene({
  onSelectProspect,
}: {
  onSelectProspect?: (id: string) => void;
}) {
  const select = onSelectProspect ?? (() => {});
  return (
    <>
      <color attach="background" args={["#04060c"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 4, 2]} intensity={30} color={CYAN} />
      <pointLight position={[-4, 2, -2]} intensity={20} color={VIOLET} />
      <Stars radius={60} depth={40} count={3500} factor={4} saturation={0} fade speed={1} />

      <PipelinePanel onSelect={select} />
      <CallsPanel />
      <CampaignsPanel />
      <IntelPanel onSelect={select} />
      <RevenuePanel />
    </>
  );
}

/** Desktop-only orbit controls — not rendered inside an active XR session. */
export function DesktopControls() {
  return <OrbitControls enablePan={false} minDistance={2} maxDistance={12} target={[0, 1.2, 0]} />;
}

export { STAGE_ORDER };
