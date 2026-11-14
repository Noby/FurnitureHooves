import { Bounds, Grid, Html, Line, OrbitControls, useBounds } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { BootMesh } from '../../core/generateBoot';
import type { BootParams } from '../../core/params';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { growProfile, legProfile, profilePoints } from '../../core/profile';
import { bootDimensions } from '../../core/stats';
import { useI18n } from '../../i18n';

export interface SceneProps {
  mesh: BootMesh;
  params: BootParams;
  showGhost: boolean;
  section: boolean;
  showDims: boolean;
  fitKey: string;
  dark: boolean;
}

const MODEL_COLOR = '#E4773A';
const CUT_COLOR = '#B84D1A';
const GHOST_COLOR = '#94A3B8';

/** Keeps only y ≥ 0 → the cut face looks at the default (front-left) camera. */
const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function useBootGeometry(mesh: BootMesh) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function BootModel({ mesh, section }: { mesh: BootMesh; section: boolean }) {
  const geometry = useBootGeometry(mesh);
  const planes = section ? [SECTION_PLANE] : [];
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          key={`f${section}`}
          color={MODEL_COLOR}
          roughness={0.55}
          metalness={0}
          flatShading
          clippingPlanes={planes}
        />
      </mesh>
      {section && (
        // back faces seen through the cut read as a solid "cap"
        <mesh geometry={geometry}>
          <meshBasicMaterial color={CUT_COLOR} side={THREE.BackSide} clippingPlanes={planes} />
        </mesh>
      )}
    </group>
  );
}

function GhostLeg({ params, section }: { params: BootParams; section: boolean }) {
  const height = params.sleeveHeight + Math.max(25, params.sleeveHeight);
  const { geometry, edges } = useMemo(() => {
    // frustum: leg size at its bottom, widening upwards by the taper angle
    const leg = legProfile(params);
    const grow = height * Math.tan((params.legTaper * Math.PI) / 180);
    const bottom = profilePoints(leg).map(([x, y]) => new THREE.Vector3(x, y, 0));
    const top = profilePoints(growProfile(leg, grow)).map(
      ([x, y]) => new THREE.Vector3(x, y, height),
    );
    const g = new ConvexGeometry([...bottom, ...top]);
    const e = new THREE.EdgesGeometry(g, 25);
    return { geometry: g, edges: e };
  }, [params, height]);
  useEffect(
    () => () => {
      geometry.dispose();
      edges.dispose();
    },
    [geometry, edges],
  );
  const line = useMemo(() => {
    const l = new THREE.LineSegments(
      edges,
      new THREE.LineDashedMaterial({ color: GHOST_COLOR, dashSize: 2, gapSize: 1.5 }),
    );
    l.computeLineDistances();
    return l;
  }, [edges]);
  useEffect(() => {
    const material = line.material as THREE.LineDashedMaterial;
    material.clippingPlanes = section ? [SECTION_PLANE] : [];
    material.needsUpdate = true;
  }, [line, section]);
  useEffect(() => () => (line.material as THREE.Material).dispose(), [line]);

  return (
    <group position={[0, 0, params.lift + 0.02]}>
      <mesh geometry={geometry} renderOrder={2}>
        <meshStandardMaterial
          key={`g${section}`}
          color={GHOST_COLOR}
          transparent
          opacity={0.2}
          depthWrite={false}
          clippingPlanes={section ? [SECTION_PLANE] : []}
        />
      </mesh>
      <primitive object={line} />
    </group>
  );
}

function DimLabel({
  position,
  text,
  color,
}: {
  position: [number, number, number];
  text: string;
  color: string;
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <span
        className="whitespace-nowrap rounded border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium"
        style={{ color, borderColor: 'var(--border)' }}
      >
        {text}
      </span>
    </Html>
  );
}

function Dimensions({ params, dark }: { params: BootParams; dark: boolean }) {
  const { fmt, t } = useI18n();
  const d = bootDimensions(params);
  const ox = d.outer.x / 2;
  const oy = d.outer.y / 2;
  const h = d.totalHeight;
  const off = Math.max(6, d.outer.x * 0.12);
  const ink = dark ? '#E5E7EB' : '#1F2937';
  const liftColor = dark ? '#FDBA8C' : '#9A3412';
  const y0 = -oy - off;
  const x1 = ox + off;
  const sizeText = d.round ? `Ø ${fmt(d.outer.x)}` : `${fmt(d.outer.x)} × ${fmt(d.outer.y)}`;
  return (
    <group>
      {/* outer width along X, in front of the model */}
      <Line
        points={[
          [-ox, y0, 0],
          [ox, y0, 0],
        ]}
        color={ink}
        lineWidth={1.2}
      />
      <Line
        points={[
          [-ox, -oy, 0],
          [-ox, y0 - 2, 0],
        ]}
        color={ink}
        lineWidth={0.8}
      />
      <Line
        points={[
          [ox, -oy, 0],
          [ox, y0 - 2, 0],
        ]}
        color={ink}
        lineWidth={0.8}
      />
      <DimLabel position={[0, y0, 0]} text={`${sizeText} mm`} color={ink} />
      {/* total height, right side */}
      <Line
        points={[
          [x1, -oy, 0],
          [x1, -oy, h],
        ]}
        color={ink}
        lineWidth={1.2}
      />
      <Line
        points={[
          [ox, -oy, h],
          [x1 + 2, -oy, h],
        ]}
        color={ink}
        lineWidth={0.8}
      />
      <Line
        points={[
          [ox, -oy, 0],
          [x1 + 2, -oy, 0],
        ]}
        color={ink}
        lineWidth={0.8}
      />
      <DimLabel
        position={[x1, -oy, h / 2 + d.lift / 2]}
        text={`${t('dim.height')} ${fmt(h)}`}
        color={ink}
      />
      {/* lift */}
      <Line
        points={[
          [x1 + off * 0.6, -oy, 0],
          [x1 + off * 0.6, -oy, d.lift],
        ]}
        color={liftColor}
        lineWidth={2}
      />
      <Line
        points={[
          [ox, -oy, d.lift],
          [x1 + off * 0.6 + 2, -oy, d.lift],
        ]}
        color={liftColor}
        lineWidth={0.8}
        dashed
        dashSize={1.5}
        gapSize={1}
      />
      <DimLabel
        position={[x1 + off * 0.6, -oy, d.lift / 2]}
        text={`${t('dim.lift')} ${fmt(d.lift)}`}
        color={liftColor}
      />
    </group>
  );
}

function Refit({ fitKey }: { fitKey: string }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, fitKey]);
  return null;
}

export function Scene({ mesh, params, showGhost, section, showDims, fitKey, dark }: SceneProps) {
  return (
    <>
      <hemisphereLight args={['#ffffff', dark ? '#1b2330' : '#d9dee5', 1.1]} />
      <directionalLight position={[-60, -90, 140]} intensity={1.6} />
      <directionalLight position={[90, 60, 60]} intensity={0.5} />
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.05]}
        infiniteGrid
        cellSize={10}
        sectionSize={50}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor={dark ? '#26303b' : '#dfe4ea'}
        sectionColor={dark ? '#35414e' : '#c9d1da'}
        fadeDistance={Math.max(400, mesh.bbox.max[0] * 12)}
        fadeStrength={1.5}
      />
      <Bounds fit clip observe margin={1.6} maxDuration={0.6}>
        <BootModel mesh={mesh} section={section} />
        <Refit fitKey={fitKey} />
      </Bounds>
      {showGhost && <GhostLeg params={params} section={section} />}
      {showDims && <Dimensions params={params} dark={dark} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
    </>
  );
}
