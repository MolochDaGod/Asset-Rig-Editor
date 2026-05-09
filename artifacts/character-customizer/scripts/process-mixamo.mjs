#!/usr/bin/env node
/*
 * Mixamo animation processor.
 *
 *   Drop raw .fbx files (downloaded from mixamo.com — pick "FBX Binary" with
 *   "Skin: Without Skin") into:
 *
 *     artifacts/character-customizer/mixamo-source/
 *       walk_forward.fbx
 *       sword_slash.fbx
 *       ...
 *
 *   Then run:
 *
 *     pnpm --filter @workspace/character-customizer mixamo
 *
 *   This converts each .fbx → .glb (animation-only, ~30 KB each) into:
 *
 *     public/animations/mixamo/<name>.glb
 *     public/animations/mixamo/manifest.json   ← the runtime reads this
 *
 *   The runtime renames Mixamo's `mixamorig:*` bone tracks to the
 *   `Bip001 *` names used by Toon_RTS skeletons (see
 *   src/utils/mixamoCompat.ts) and strips any tracks that don't bind, so
 *   no per-file editing is required — just download + drop + build.
 *
 *   File naming: the .fbx basename becomes the entry id and (titlecased)
 *   becomes the display name. e.g. `sword_slash.fbx` → id `sword_slash`,
 *   label "Sword Slash". Use the optional `_<category>` suffix to set
 *   the animation category, e.g. `sword_slash_attack.fbx` →
 *   category `attack`. Categories: idle, move, attack, death, other.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const execFileP = promisify(execFile);
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FBX2GLTF = require.resolve('fbx2gltf/bin/Linux/FBX2glTF');
const SRC_DIR  = path.join(__dirname, '..', 'mixamo-source');
const OUT_DIR  = path.join(__dirname, '..', 'public', 'animations', 'mixamo');

const CATEGORY_TOKENS = ['idle', 'move', 'walk', 'run', 'attack', 'death', 'other'];

function classifyName(baseName) {
  const id = baseName.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const tokens = id.split('_').filter(Boolean);
  let category = 'other';
  for (const tok of tokens) {
    if (CATEGORY_TOKENS.includes(tok)) {
      category = tok === 'walk' || tok === 'run' ? 'move' : tok;
      break;
    }
  }
  const label = tokens
    .filter((t) => !CATEGORY_TOKENS.includes(t))
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .join(' ') || id;
  return { id, label, category };
}

async function convertOne(srcAbs) {
  const baseName = path.basename(srcAbs, path.extname(srcAbs));
  const outAbs   = path.join(OUT_DIR, `${baseName}.glb`);

  // FBX2glTF emits <out>_out/<out>.glb when given -b, or <out>.glb when
  // given -o <name> -b directly. We use the latter for tidiness.
  const args = [
    '--binary',
    '--khr-materials-unlit',
    '--input',  srcAbs,
    '--output', outAbs.replace(/\.glb$/, ''),
  ];
  await execFileP(FBX2GLTF, args, { maxBuffer: 64 * 1024 * 1024 });

  // FBX2glTF writes `<out>_out/<base>.glb` even with --output set; also
  // moves it where requested. Defensive cleanup.
  const sidecarDir = `${outAbs.replace(/\.glb$/, '')}_out`;
  if (fs.existsSync(sidecarDir)) {
    const inside = path.join(sidecarDir, `${baseName}.glb`);
    if (fs.existsSync(inside)) fs.renameSync(inside, outAbs);
    fs.rmSync(sidecarDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(outAbs)) throw new Error(`expected output not produced: ${outAbs}`);
  return { baseName, outAbs };
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR, { recursive: true });
    console.log(`Created ${path.relative(process.cwd(), SRC_DIR)}/ — drop Mixamo .fbx files there.`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fbx = fs.readdirSync(SRC_DIR).filter((f) => /\.fbx$/i.test(f)).sort();

  if (!fbx.length) {
    console.log('No .fbx files in mixamo-source/. Nothing to do.');
    fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ animations: [] }, null, 2));
    return;
  }

  console.log(`Converting ${fbx.length} Mixamo FBX → GLB…`);
  const entries = [];
  for (const file of fbx) {
    const srcAbs = path.join(SRC_DIR, file);
    try {
      const { baseName } = await convertOne(srcAbs);
      const meta = classifyName(baseName);
      entries.push({
        id: meta.id,
        name: meta.label,
        category: meta.category,
        gltfPath: `/animations/mixamo/${baseName}.glb`,
      });
      console.log(`  ✓ ${file}  →  ${baseName}.glb  (${meta.category})`);
    } catch (e) {
      console.warn(`  ✗ ${file}: ${e.message?.split('\n')[0] ?? e}`);
    }
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ animations: entries }, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), manifestPath)} (${entries.length} entries)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
