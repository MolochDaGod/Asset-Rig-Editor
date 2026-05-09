#!/usr/bin/env node
/*
 * Split each all-in-one character / cavalry GLB into a modular layout that a
 * runtime can mix-and-match (the WoW M2 / Daz / VRoid pattern):
 *
 *   public/models/gltf/modular/{race}/_skeleton.glb     — rig + bind pose, no meshes
 *   public/models/gltf/modular/{race}/{partName}.glb    — one SkinnedMesh, full
 *                                                         joint references intact
 *   public/models/gltf/modular/{race-cavalry}/...       — same, for cavalry rigs
 *
 * Every part GLB carries the full bone hierarchy with the same joint NAMES as
 * the skeleton GLB, which means at runtime you can:
 *
 *   1. Load `_skeleton.glb` once per race.
 *   2. Load any number of part GLBs.
 *   3. For each part's SkinnedMesh, rebind `mesh.skeleton.bones` to the cached
 *      skeleton's bones (matched by name) — three.js does this for free with
 *      `SkeletonUtils.retarget` or by direct reassignment.
 *
 * Animations (in animations/{race}/*.glb) target bone names too, so they
 * retarget onto the shared skeleton with no extra work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, prune } from '@gltf-transform/functions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, '..', 'public', 'models', 'gltf');
const DST_ROOT = path.join(SRC_ROOT, 'modular');

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

function safeName(s) {
  return s.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Write a copy of `srcDoc` containing only the meshes whose names pass `keep`,
 * with everything else (materials/textures/skins/animations not referenced)
 * pruned automatically.
 */
async function writeSubset(srcDoc, keep, outPath) {
  const doc = cloneDocument(srcDoc);
  const root = doc.getRoot();

  // Detach mesh references from nodes and dispose meshes that don't pass.
  for (const m of [...root.listMeshes()]) {
    if (!keep(m.getName())) {
      // Detach nodes pointing at this mesh first
      for (const n of root.listNodes()) {
        if (n.getMesh() === m) n.setMesh(null);
      }
      m.dispose();
    }
  }

  // Drop animations entirely — they live in animations/{race}/*.glb
  for (const a of [...root.listAnimations()]) a.dispose();

  // prune() removes any orphan accessors / materials / textures / skins.
  // KEEP_LEAVES is the safer mode here: we want to preserve joint nodes
  // even when they have no mesh, because part GLBs need the skeleton intact.
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await io.write(outPath, doc);
  return fs.statSync(outPath).size;
}

const SOURCES = [
  { kind: 'infantry', dir: 'characters' },
  { kind: 'cavalry', dir: 'cavalry' },
];

const summary = { infantry: {}, cavalry: {} };

for (const { kind, dir } of SOURCES) {
  const srcDir = path.join(SRC_ROOT, dir);
  if (!fs.existsSync(srcDir)) continue;

  for (const file of fs.readdirSync(srcDir).sort()) {
    if (!file.endsWith('.glb')) continue;
    const race = path.basename(file, '.glb');
    const folder = kind === 'cavalry' ? `${race}-cavalry` : race;
    const srcAbs = path.join(srcDir, file);
    console.log(`\n→ ${kind}/${race}`);
    const srcDoc = await io.read(srcAbs);
    const meshes = srcDoc.getRoot().listMeshes().map((m) => m.getName()).filter(Boolean);

    // 1) skeleton-only
    const skelPath = path.join(DST_ROOT, folder, '_skeleton.glb');
    const skelSize = await writeSubset(srcDoc, () => false, skelPath);
    console.log(`  _skeleton.glb  ${(skelSize / 1024).toFixed(1)} KB`);

    // 2) one GLB per mesh
    const parts = [];
    for (const meshName of meshes) {
      const slug = safeName(meshName);
      const partPath = path.join(DST_ROOT, folder, `${slug}.glb`);
      try {
        const sz = await writeSubset(srcDoc, (n) => n === meshName, partPath);
        parts.push({ name: meshName, file: `${slug}.glb`, sizeKB: +(sz / 1024).toFixed(1) });
      } catch (e) {
        console.warn(`    FAIL ${meshName}:`, e.message);
      }
    }
    console.log(`  ${parts.length} part GLBs`);
    summary[kind][race] = {
      folder,
      skeleton: '_skeleton.glb',
      skeletonKB: +(skelSize / 1024).toFixed(1),
      parts,
    };
  }
}

const outManifest = path.join(DST_ROOT, 'modular_manifest.json');
fs.mkdirSync(DST_ROOT, { recursive: true });
fs.writeFileSync(outManifest, JSON.stringify(summary, null, 2));
const total = Object.values(summary).flatMap((g) => Object.values(g)).reduce((s, e) => s + e.parts.length + 1, 0);
console.log(`\nWrote ${total} GLBs total → ${DST_ROOT}`);
console.log(`Manifest: ${outManifest}`);
