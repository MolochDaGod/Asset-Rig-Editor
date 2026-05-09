#!/usr/bin/env node
/*
 * Build a clean, editor-friendly asset library from the raw Toon_RTS FBX files.
 *
 * Output structure:
 *
 *   public/assets/
 *     index.json                          ← global manifest (all races + counts)
 *     <race>/
 *       manifest.json                     ← per-race manifest
 *       colors.json                       ← editable colour-variant palette
 *       textures/                         ← per-race PNGs (editable!)
 *         body.png                          (the main race texture, ex-TGA)
 *         <variant>.png                     (Color/Colors sub-folder variants)
 *       character/
 *         infantry.gltf  +  infantry.bin  +  *.png   ← editable
 *         cavalry.gltf   +  cavalry.bin   +  *.png
 *         siege.gltf     +  siege.bin     +  *.png
 *       equipment/
 *         <item>.gltf  +  <item>.bin  +  *.png        ← per-weapon, editable
 *       animations/
 *         <class>_<action>[_variant].gltf + .bin      ← anim-only, ~no textures
 *
 * Why .gltf instead of .glb?
 *   - .gltf is a JSON file → the user can open it and tweak material colors.
 *   - Textures live as plain .png files alongside → drop in a new image to
 *     change what the model looks like, no rebuild required.
 *   - Geometry/animation data is in a sibling .bin → small, easy to diff.
 *
 * The runtime can load these directly via three.js GLTFLoader.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const execFileP = promisify(execFile);
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FBX2GLTF = require.resolve('fbx2gltf/bin/Linux/FBX2glTF');
const SRC_ROOT = path.join(__dirname, '..', 'public', 'models', 'toon_rts', 'Toon_RTS');
const DST_ROOT = path.join(__dirname, '..', 'public', 'assets');

const RACE_FROM_DIR = {
  Barbarians: 'barbarian', Dwarves: 'dwarf', Elves: 'elf',
  Orcs: 'orc', Undead: 'undead', WesternKingdoms: 'human',
};
const RACE_LABEL = {
  barbarian: 'Frost Clans', dwarf: 'Mountain Holds', elf: 'Sylvan Ascendancy',
  orc: 'Iron Horde', undead: 'Forsaken Court', human: 'Northern Kingdoms',
};
const RACE_HEIGHT_M = {
  barbarian: 1.98, dwarf: 1.52, elf: 1.95, orc: 2.13, undead: 1.83, human: 1.83,
};
const RACE_ACCENT = {
  barbarian: '#ff8a72', dwarf: '#ffb86b', elf: '#9beea8',
  orc: '#a3e063', undead: '#c89cff', human: '#7aa8ff',
};

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else list.push(p);
  }
  return list;
}

function classify(absPath) {
  const rel = path.relative(SRC_ROOT, absPath).split(path.sep).join('/');
  const parts = rel.split('/');
  const race = RACE_FROM_DIR[parts[0]] || 'unknown';
  const baseName = path.basename(absPath, path.extname(absPath));
  if (parts.includes('animation')) {
    const cls = parts[2] || 'unknown';
    return { kind: 'animation', race, cls, baseName };
  }
  if (parts.includes('Equipment') ||
      /^(BRB|DWF|ELF|ORC|UD|WK)_(weapon|Shield|Xtra|Mount|bag)/i.test(baseName)) {
    return { kind: 'equipment', race, baseName };
  }
  const lower = baseName.toLowerCase();
  if (lower.includes('cavalry')) return { kind: 'cavalry', race, baseName };
  if (lower.includes('catapult') || lower.includes('boltthrower') || lower.includes('siege')) {
    return { kind: 'siege', race, baseName };
  }
  if (lower.includes('characters') || lower.includes('character')) {
    return { kind: 'character', race, baseName };
  }
  return { kind: 'misc', race, baseName };
}

function dstFor(c) {
  const slug = c.baseName.replace(/[^A-Za-z0-9_]/g, '_');
  const raceDir = path.join(DST_ROOT, c.race);
  switch (c.kind) {
    case 'character':  return { dir: path.join(raceDir, 'character'),  name: 'infantry' };
    case 'cavalry':    return { dir: path.join(raceDir, 'character'),  name: 'cavalry'  };
    case 'siege':      return { dir: path.join(raceDir, 'character'),  name: `siege_${slug.toLowerCase()}` };
    case 'equipment':  return { dir: path.join(raceDir, 'equipment'),  name: slug };
    case 'animation':  return { dir: path.join(raceDir, 'animations'), name: `${c.cls.toLowerCase()}_${slug.toLowerCase().replace(/^(brb|dwf|elf|orc|ud|wk)_/i, '')}` };
    default:           return { dir: path.join(raceDir, 'misc'),       name: slug };
  }
}

// Best-guess: pick the most likely race body texture filename to use as the
// default for any model whose original FBX texture reference can't be found.
function defaultBodyTextureFor(race) {
  const map = {
    barbarian: 'BRB_StandardUnits_texture.png',
    dwarf:     'DWF_Standard_Units.png',
    elf:       'ELF_HighElves_Texture.png',
    orc:       'ORC_StandardUnits.png',
    undead:    'UD_Standard_Units.png',
    human:     'WK_Standard_Units.png',
  };
  return map[race] || null;
}

async function convertOne(srcAbs) {
  const c = classify(srcAbs);
  if (c.race === 'unknown') return { skipped: 'unknown-race', srcAbs };
  const { dir, name } = dstFor(c);
  fs.mkdirSync(dir, { recursive: true });
  const outBase = path.join(dir, name);
  const outGltf = path.join(dir, `${name}.gltf`);
  const outBin  = path.join(dir, `${name}.bin`);
  // Skip when up-to-date
  try {
    const sStat = fs.statSync(srcAbs);
    const dStat = fs.statSync(outGltf);
    if (dStat.mtimeMs >= sStat.mtimeMs) return { skipped: 'up-to-date', c, outGltf };
  } catch {}
  const args = [
    '-i', srcAbs,
    '-o', outBase,
    '--khr-materials-unlit',     // Toon_RTS art is flat / hand-painted
    // (no --binary → produces <base>_out/<base>.gltf + buffer.bin + textures)
  ];
  await execFileP(FBX2GLTF, args, { maxBuffer: 64 * 1024 * 1024 });

  // FBX2glTF emits a `<base>_out/` directory containing `<base>.gltf` +
  // `buffer.bin` + any embedded textures. Flatten it: move .gltf up as
  // <name>.gltf, .bin as <name>.bin, and rewrite the JSON references.
  const outDir = `${outBase}_out`;
  if (!fs.existsSync(outDir)) {
    throw new Error(`expected ${outDir} after conversion`);
  }
  const gltfSrc = path.join(outDir, `${name}.gltf`);
  if (!fs.existsSync(gltfSrc)) {
    throw new Error(`expected ${gltfSrc}`);
  }
  const json = JSON.parse(fs.readFileSync(gltfSrc, 'utf8'));

  // Rewrite buffer URI: buffer.bin → <name>.bin (and copy the file)
  for (const buf of json.buffers || []) {
    if (buf.uri && /^buffer\.bin$/.test(buf.uri)) {
      const srcBin = path.join(outDir, buf.uri);
      if (fs.existsSync(srcBin)) {
        fs.copyFileSync(srcBin, outBin);
      }
      buf.uri = `${name}.bin`;
    }
  }

  // Rewrite image URIs:
  //   - if the image file exists in outDir, copy it next to the .gltf
  //   - otherwise repoint to the race-shared `../../textures/<bodyTex>` so
  //     the model still renders with a sensible default texture.
  const bodyTex = defaultBodyTextureFor(c.race);
  for (const img of json.images || []) {
    if (!img.uri) continue;
    const baseFile = path.basename(img.uri);
    const srcImg = path.join(outDir, baseFile);
    if (fs.existsSync(srcImg)) {
      const dstImg = path.join(dir, baseFile);
      fs.copyFileSync(srcImg, dstImg);
      img.uri = baseFile;
    } else if (bodyTex) {
      // Repoint at the per-race shared texture pool (relative path from
      // <race>/<kind>/ to <race>/textures/).
      img.uri = `../textures/${bodyTex}`;
    }
  }

  fs.writeFileSync(outGltf, JSON.stringify(json, null, 2));
  // Clean up the _out directory.
  fs.rmSync(outDir, { recursive: true, force: true });

  return { c, outGltf };
}

// ─── Convert TGA textures from each race's Materials/ folder to PNG ────
async function convertTextures() {
  const races = Object.values(RACE_FROM_DIR);
  for (const raceDir of Object.keys(RACE_FROM_DIR)) {
    const race = RACE_FROM_DIR[raceDir];
    const matDir = path.join(SRC_ROOT, raceDir, 'models', 'Materials');
    if (!fs.existsSync(matDir)) continue;
    const outDir = path.join(DST_ROOT, race, 'textures');
    fs.mkdirSync(outDir, { recursive: true });
    const files = walk(matDir);
    for (const src of files) {
      const ext = path.extname(src).toLowerCase();
      if (ext !== '.tga' && ext !== '.png' && ext !== '.jpg') continue;
      const stem = path.basename(src, ext);
      const out = path.join(outDir, `${stem}.png`);
      try {
        const sStat = fs.statSync(src);
        const dStat = fs.statSync(out);
        if (dStat.mtimeMs >= sStat.mtimeMs) continue;
      } catch {}
      try {
        await execFileP('magick', [src, out]);
      } catch (e) {
        console.warn(`  texture-convert failed for ${path.basename(src)}: ${e.message.split('\n')[0]}`);
      }
    }
  }
}

// ─── Build per-race manifest & colors.json ──────────────────────────────
function buildManifests() {
  const races = Object.values(RACE_FROM_DIR);
  const global = { generated: new Date().toISOString(), races: {} };
  for (const race of races) {
    const raceDir = path.join(DST_ROOT, race);
    if (!fs.existsSync(raceDir)) continue;
    const charDir = path.join(raceDir, 'character');
    const equipDir = path.join(raceDir, 'equipment');
    const animDir = path.join(raceDir, 'animations');
    const texDir  = path.join(raceDir, 'textures');

    const list = (d) => fs.existsSync(d)
      ? fs.readdirSync(d).filter(f => f.endsWith('.gltf')).map(f => f.replace(/\.gltf$/, ''))
      : [];
    const listImg = (d) => fs.existsSync(d)
      ? fs.readdirSync(d).filter(f => /\.(png|jpe?g)$/i.test(f))
      : [];

    const manifest = {
      race,
      label: RACE_LABEL[race],
      heightMeters: RACE_HEIGHT_M[race],
      accentColor: RACE_ACCENT[race],
      baseUrl: `/assets/${race}/`,
      character: {
        infantry: list(charDir).includes('infantry') ? `character/infantry.gltf` : null,
        cavalry:  list(charDir).includes('cavalry')  ? `character/cavalry.gltf`  : null,
        siege:    list(charDir).filter(n => n.startsWith('siege_')).map(n => `character/${n}.gltf`),
      },
      equipment: list(equipDir).map(n => ({
        id: n,
        url: `equipment/${n}.gltf`,
      })),
      animations: list(animDir).map(n => {
        const m = n.match(/^([a-z_]+?)_(\d{2})_([a-z]+)(?:_([a-z0-9]+))?$/i);
        return {
          id: n,
          url: `animations/${n}.gltf`,
          class: m?.[1] ?? null,
          action: m?.[3] ?? null,
          variant: m?.[4] ?? null,
        };
      }),
      textures: listImg(texDir).map(f => `textures/${f}`),
    };
    fs.writeFileSync(path.join(raceDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2));

    // Editable colors.json — defaults the user can modify
    const colorsPath = path.join(raceDir, 'colors.json');
    if (!fs.existsSync(colorsPath)) {
      const defaults = {
        race,
        notes: 'Edit `variants` to change in-game color tints. Each variant is a hex multiplier applied to body.png at runtime.',
        variants: [
          { id: 'original',  label: 'Original',     hex: '#ffffff' },
          { id: 'royal',     label: 'Royal Blue',   hex: '#7aa8ff' },
          { id: 'crimson',   label: 'Crimson',      hex: '#ff4d6d' },
          { id: 'forest',    label: 'Forest Green', hex: '#5fbf72' },
          { id: 'shadow',    label: 'Black Knight', hex: '#5a5a66' },
          { id: 'gold',      label: 'Gold Trim',    hex: '#ffd166' },
        ],
      };
      fs.writeFileSync(colorsPath, JSON.stringify(defaults, null, 2));
    }

    global.races[race] = {
      manifest: `/assets/${race}/manifest.json`,
      colors:   `/assets/${race}/colors.json`,
      counts: {
        equipment:  manifest.equipment.length,
        animations: manifest.animations.length,
        textures:   manifest.textures.length,
        characters: ['infantry','cavalry'].filter(k => manifest.character[k]).length
                    + manifest.character.siege.length,
      },
    };
  }
  fs.writeFileSync(path.join(DST_ROOT, 'index.json'),
    JSON.stringify(global, null, 2));
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(DST_ROOT, { recursive: true });
  const all = walk(SRC_ROOT).filter(f => /\.fbx$/i.test(f)).sort();
  console.log(`Converting ${all.length} FBX → glTF (separate files)…`);
  let ok = 0, skipped = 0, fail = 0;
  const fails = [];
  for (const src of all) {
    const rel = path.relative(SRC_ROOT, src);
    try {
      const r = await convertOne(src);
      if (r.skipped) { skipped++; process.stdout.write('·'); }
      else { ok++; process.stdout.write('.'); }
    } catch (e) {
      fail++; fails.push([rel, (e.message || '').split('\n')[0]]);
      process.stdout.write('x');
    }
  }
  console.log(`\nFBX → glTF:  OK ${ok}  Skipped ${skipped}  Failed ${fail}`);
  if (fails.length) {
    console.log('Failures:');
    fails.slice(0, 10).forEach(([f, m]) => console.log(' ', f, '→', m));
  }

  console.log('\nConverting source TGA textures → PNG…');
  await convertTextures();

  console.log('\nBuilding manifests…');
  buildManifests();

  console.log('\n✓ Done. Output: public/assets/');
}

main().catch((e) => { console.error(e); process.exit(1); });
