#!/usr/bin/env node
/**
 * Inspect every character glTF in `public/assets/<race>/character/*.gltf`
 * and emit a machine-readable inventory at `src/data/partInventory.json`.
 *
 * For every model we record:
 *  - meshNames    : every mesh in the file
 *  - boneNames    : every node-name on the skeleton (used for retargeting)
 *  - attachPoints : non-bone Transform nodes used as weapon/prop sockets
 *                   (R_hand_container, L_hand_container, Bone_wood, Bone_bag)
 *  - parts        : meshes classified by slot via filename convention
 *                   (head, body, arms, legs, shoulderpad, weapon, shield,
 *                    bow, staff, dagger, prop)
 *
 * Re-run any time the GLBs change:
 *     node scripts/inspect-models.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public', 'assets');
const OUT = join(ROOT, 'src', 'data', 'partInventory.json');

const RACES = ['human', 'elf', 'dwarf', 'orc', 'undead', 'barbarian'];
const KINDS = ['infantry', 'cavalry', 'siege'];

/** Classify a mesh-name into a logical part slot. */
function classify(name) {
  const n = name.toLowerCase();
  // Weapons (most specific first).
  if (/_bow($|_)/.test(n))                     return { slot: 'weapon', kind: 'bow' };
  if (/_staff/.test(n))                        return { slot: 'weapon', kind: 'staff' };
  if (/_dagger/.test(n))                       return { slot: 'weapon', kind: 'dagger' };
  if (/_spear/.test(n))                        return { slot: 'weapon', kind: 'spear' };
  if (/_sword/.test(n))                        return { slot: 'weapon', kind: 'sword' };
  if (/_axe/.test(n))                          return { slot: 'weapon', kind: 'axe' };
  if (/_hammer|_mace|_pick/.test(n))           return { slot: 'weapon', kind: 'blunt' };
  if (/_lance/.test(n))                        return { slot: 'weapon', kind: 'lance' };
  // Off-hand
  if (/_shield/.test(n))                       return { slot: 'shield', kind: 'shield' };
  // Body parts
  if (/_head_/.test(n))                        return { slot: 'head' };
  if (/_body_/.test(n) || /^[a-z]{2,4}_body/.test(n)) return { slot: 'body' };
  if (/_arms?_/.test(n))                       return { slot: 'arms' };
  if (/_legs?_/.test(n))                       return { slot: 'legs' };
  if (/_shoulderpads?/.test(n))                return { slot: 'shoulderpad' };
  // Worker / extra props
  if (/_xtra_wood|_wood$/.test(n))             return { slot: 'prop', kind: 'wood' };
  if (/_xtra_bag|_bag$/.test(n))               return { slot: 'prop', kind: 'bag' };
  if (/_xtra_quiver|_quiver$/.test(n))         return { slot: 'prop', kind: 'quiver' };
  // Mount / siege geometry
  if (/horse|wolf|ram/.test(n))                return { slot: 'mount' };
  if (/catapult|boltthrower|ballista/.test(n)) return { slot: 'siege_engine' };
  return { slot: 'unknown' };
}

/** Default attach point per weapon kind. */
const ATTACH_FOR_KIND = {
  sword:   'R_hand_container',
  axe:     'R_hand_container',
  blunt:   'R_hand_container',
  spear:   'R_hand_container',
  lance:   'R_hand_container',
  dagger:  'R_hand_container',
  staff:   'R_hand_container',
  bow:     'L_hand_container',
  shield:  'L_hand_container',
  wood:    'Bone_wood',
  bag:     'Bone_bag',
  quiver:  'Bip001 Spine',
};

function inspectGltf(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const nodes  = j.nodes  ?? [];
  const meshes = j.meshes ?? [];
  const skins  = j.skins  ?? [];

  const meshNames = meshes.map((m) => m.name).filter(Boolean);

  // Collect every node referenced by any skin's joint list = bone set.
  const boneIdx = new Set();
  for (const s of skins) for (const j of (s.joints ?? [])) boneIdx.add(j);
  const boneNames = [...boneIdx].map((i) => nodes[i]?.name).filter(Boolean);

  // "Attach points" = non-mesh, non-bone transforms that we use as sockets.
  // The Toon_RTS pack ships these as plain Transforms parented to a hand
  // bone (R_hand_container, L_hand_container) or to the spine (Bone_wood,
  // Bone_bag). They give artists control over weapon orientation.
  const meshNodeNames = new Set(
    nodes.filter((n) => n.mesh != null).map((n) => n.name),
  );
  const attachPoints = nodes
    .map((n) => n.name)
    .filter(Boolean)
    .filter((name) => !boneNames.includes(name) && !meshNodeNames.has(name))
    .filter((name) => /_container$|^Bone_/.test(name));

  // Parts: every mesh, classified by name.
  const parts = meshNames.map((name) => {
    const { slot, kind } = classify(name);
    const out = { name, slot };
    if (kind) {
      out.kind = kind;
      out.attachPoint = ATTACH_FOR_KIND[kind] ?? null;
    }
    return out;
  });

  return { meshCount: meshes.length, meshNames, boneNames, attachPoints, parts };
}

function inspectRace(race) {
  const out = {};
  for (const kind of KINDS) {
    // siege has a race-specific filename suffix; cavalry/infantry are fixed.
    const candidates =
      kind === 'siege'
        ? ['siege_wk_catapult.gltf', 'siege_orc_catapult.gltf', 'siege_elf_boltthrower.gltf']
        : [`${kind}.gltf`];
    for (const fname of candidates) {
      const p = join(ASSETS, race, 'character', fname);
      if (existsSync(p)) {
        out[kind] = inspectGltf(p);
        break;
      }
    }
  }
  return out;
}

function main() {
  const inventory = {
    generatedAt: new Date().toISOString(),
    races: {},
  };
  for (const race of RACES) {
    inventory.races[race] = inspectRace(race);
  }
  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(inventory, null, 2));

  // Quick console summary so the operator can eyeball it.
  for (const race of RACES) {
    const r = inventory.races[race];
    for (const k of Object.keys(r)) {
      const counts = {};
      for (const p of r[k].parts) counts[p.slot] = (counts[p.slot] ?? 0) + 1;
      const summary = Object.entries(counts).map(([s, n]) => `${s}=${n}`).join(' ');
      console.log(`${race.padEnd(10)} ${k.padEnd(8)} bones=${r[k].boneNames.length} attach=[${r[k].attachPoints.join(', ')}] ${summary}`);
    }
  }
  console.log(`\nWrote ${OUT}`);
}

main();
