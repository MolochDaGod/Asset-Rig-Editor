/**
 * Apply SI position/scale best practices + stamp grudge identity on meshes.
 */
import * as THREE from 'three';
import {
  HUMAN_HEIGHT_M,
  computeFitScale,
  diagnoseUnitScale,
  SIZE_BANDS_M,
  type AssetCategory,
  type ScaleReport,
} from '../data/worldScale';
import {
  attachPointFromName,
  assetKeyFor,
  grudgeUuidFromKey,
  kitAssetKey,
  meshSlotFromName,
  racePrefix,
  type GrudgeAssetIdentity,
  type KitScaleIdentity,
  classifyMeshCategory,
} from '../data/assetIdentity';
import type { GrudgeRaceId } from '../data/grudgeRaces';
import { ATTACH_POINTS } from '../data/unitCatalog';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _wp = new THREE.Vector3();

export interface DeployOptions {
  category: AssetCategory;
  /** Lore / target height for characters (m). */
  targetHeightM?: number;
  /** Extra user multiplier (store slider). */
  userMul?: number;
  raceId?: string;
  characterType?: string;
  /** If false, only stamp identity — do not mutate transforms. */
  applyTransform?: boolean;
  /** Ground feet to y=0 and center XZ. */
  groundFeet?: boolean;
}

export interface DeployResult {
  scaleReport: ScaleReport;
  groundOffset: { x: number; y: number; z: number };
  appliedScale: number;
  kit: KitScaleIdentity;
}

function pathOf(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.name) parts.unshift(o.name);
    o = o.parent;
  }
  return parts.join('/');
}

function collectAttachPoints(root: THREE.Object3D): string[] {
  const want = new Set(Object.values(ATTACH_POINTS) as string[]);
  const found: string[] = [];
  root.traverse((o) => {
    if (o.name && want.has(o.name) && !found.includes(o.name)) found.push(o.name);
  });
  return found;
}

function collectBonesSample(root: THREE.Object3D, limit = 24): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name && names.length < limit) {
      names.push(o.name);
    }
  });
  return names;
}

/**
 * Stamp userData.grudge on every Mesh/SkinnedMesh and return catalog.
 */
export function stampAssetIdentity(
  root: THREE.Object3D,
  opts: {
    raceId: string;
    characterType: string;
  },
): GrudgeAssetIdentity[] {
  const { raceId, characterType } = opts;
  const meshes: GrudgeAssetIdentity[] = [];

  root.updateMatrixWorld(true);

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (!mesh.name) return;

    const category = classifyMeshCategory(mesh.name);
    const key = assetKeyFor(raceId, characterType, mesh.name);
    const uuid = grudgeUuidFromKey(key);

    _box.setFromObject(mesh);
    _box.getSize(_size);
    mesh.getWorldPosition(_wp);

    const identity: GrudgeAssetIdentity = {
      grudgeUuid: uuid,
      assetKey: key,
      meshName: mesh.name,
      raceId: (raceId as GrudgeRaceId) || 'unknown',
      racePrefix: racePrefix(raceId),
      characterType: characterType as GrudgeAssetIdentity['characterType'],
      category,
      slot: meshSlotFromName(mesh.name),
      attachPoint: attachPointFromName(mesh.name),
      location: {
        path: pathOf(mesh),
        parent: mesh.parent?.name ?? null,
        attachPoint: attachPointFromName(mesh.name),
        world: { x: _wp.x, y: _wp.y, z: _wp.z },
        local: {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        },
      },
      visible: mesh.visible,
      isSkinned: !!(mesh as THREE.SkinnedMesh).isSkinnedMesh,
      sizeM: { x: _size.x, y: _size.y, z: _size.z },
    };

    mesh.userData.grudge = identity;
    meshes.push(identity);
  });

  return meshes;
}

/**
 * Build full kit identity report (after CharacterModel has applied fit scale).
 */
export function buildKitIdentity(
  root: THREE.Object3D,
  opts: {
    raceId: string;
    characterType: string;
    heightM: number;
    fitScale: number;
    unitDiagnosis: string;
    groundOffset: { x: number; y: number; z: number };
    position: { x: number; y: number; z: number };
    rotationY: number;
  },
): KitScaleIdentity {
  const meshes = stampAssetIdentity(root, {
    raceId: opts.raceId,
    characterType: opts.characterType,
  });

  const kitKey = kitAssetKey(opts.raceId, opts.characterType);
  return {
    grudgeUuid: grudgeUuidFromKey(kitKey),
    assetKey: kitKey,
    raceId: opts.raceId,
    characterType: opts.characterType,
    heightM: opts.heightM,
    timesHuman: opts.heightM / HUMAN_HEIGHT_M,
    fitScale: opts.fitScale,
    unitDiagnosis: opts.unitDiagnosis,
    groundOffset: opts.groundOffset,
    position: opts.position,
    rotationY: opts.rotationY,
    meshCount: meshes.length,
    visibleMeshCount: meshes.filter((m) => m.visible).length,
    meshes,
    attachPointsFound: collectAttachPoints(root),
    bonesSample: collectBonesSample(root),
    generatedAt: new Date().toISOString(),
  };
}

function isHeroCategory(c: AssetCategory): boolean {
  return c === 'character' || c === 'cavalry' || c === 'siege';
}

/**
 * Deploy an unrigged / user-uploaded root: unit decade + optional hero fit + ground.
 * Weapons/props: decade only — never fit to 1.8 m.
 */
export function deployObjectSI(
  root: THREE.Object3D,
  opts: DeployOptions,
): DeployResult {
  const applyTransform = opts.applyTransform !== false;
  const groundFeet =
    opts.groundFeet ?? isHeroCategory(opts.category) || opts.category === 'unknown';

  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  _box.getSize(_size);
  const authoredH = Math.max(_size.y, 1e-6);

  let report: ScaleReport;
  let appliedScale: number;

  if (isHeroCategory(opts.category) || opts.category === 'unknown') {
    const target =
      opts.targetHeightM ??
      (opts.category === 'character' || opts.category === 'unknown'
        ? HUMAN_HEIGHT_M
        : undefined);
    report = computeFitScale(authoredH, opts.category === 'unknown' ? 'character' : opts.category, target);
    appliedScale = report.fitScale * (opts.userMul ?? 1);
  } else {
    // Non-heroes: unit decade vs category mid-band only
    const band = SIZE_BANDS_M[opts.category];
    const expected = (band.min + band.max) / 2;
    const { decade, diagnosis } = diagnoseUnitScale(authoredH, expected);
    appliedScale = decade * (opts.userMul ?? 1);
    const finalH = authoredH * appliedScale;
    report = {
      category: opts.category,
      authoredHeightM: authoredH,
      targetHeightM: null,
      fitScale: decade,
      unitDiagnosis: diagnosis,
      timesHuman: finalH / HUMAN_HEIGHT_M,
      bandOk: finalH >= band.min * 0.7 && finalH <= band.max * 1.4,
      message: `${band.label}: no hero-fit · ${finalH.toFixed(3)} m · ${diagnosis}`,
    };
  }

  if (applyTransform && Math.abs(appliedScale - 1) > 1e-6) {
    root.scale.multiplyScalar(appliedScale);
    root.updateMatrixWorld(true);
  }

  let groundOffset = { x: 0, y: 0, z: 0 };
  if (applyTransform && groundFeet) {
    root.updateMatrixWorld(true);
    _box.setFromObject(root);
    _box.getCenter(_center);
    groundOffset = {
      x: -_center.x,
      y: -_box.min.y,
      z: -_center.z,
    };
    root.position.x += groundOffset.x;
    root.position.y += groundOffset.y;
    root.position.z += groundOffset.z;
    root.updateMatrixWorld(true);
  }

  const raceId = opts.raceId ?? 'user';
  const characterType = opts.characterType ?? 'user';
  const finalBox = new THREE.Box3().setFromObject(root);
  const finalH = Math.max(finalBox.max.y - finalBox.min.y, 0);

  const kit = buildKitIdentity(root, {
    raceId,
    characterType,
    heightM: finalH,
    fitScale: appliedScale,
    unitDiagnosis: report.unitDiagnosis,
    groundOffset,
    position: {
      x: root.position.x,
      y: root.position.y,
      z: root.position.z,
    },
    rotationY: root.rotation.y,
  });

  return { scaleReport: report, groundOffset, appliedScale, kit };
}
