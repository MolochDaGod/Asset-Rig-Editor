#!/usr/bin/env node
/**
 * build-animation-library.cjs
 *
 * Converts ALL animation FBX files from the Unity game export and merges
 * them into a single GLB animation library at:
 *   artifacts/character-customizer/public/anims/mixamo-clips.glb
 *
 * Sources (auto-detected on disk):
 *   1. Player Animation/ (43 clips: combat, magic, sword+shield, etc.)
 *   2. Toon_RTS race animations (cavalry, siege, worker per race)
 *   3. Character Juggernaut animations (boss attacks)
 *   4. Raw Mocap (interacting/parkour)
 *
 * Cross-platform: uses fbx2gltf Windows/Linux binary from the npm package.
 *
 * Usage:  node scripts/src/build-animation-library.cjs
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const convert = require('fbx2gltf');

const OUT_PATH = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/anims/mixamo-clips.glb',
);
const STAGE_ROOT = path.join(os.tmpdir(), 'grudge_anim_stage');

// ── Animation source directories ────────────────────────────────────
// Each entry: { tag, dir } where `tag` becomes the clip name prefix.
const UNITY_ROOT = [
  'D:/Games/Models/grudgeracecharacters/Il2CppDumper-master/Il2CppDumper-master/GRUDGE-NFT-Island-main/GRUDGE-NFT-Island-main/FRESH GRUDGE/Assets',
].find((p) => fs.existsSync(p));

const PACKS = [];

if (UNITY_ROOT) {
  // Player Animation — 43 combat/social/magic clips
  const playerAnim = path.join(UNITY_ROOT, 'uMMORPG/Prefabs/Entities/Players/Player Animation');
  if (fs.existsSync(playerAnim)) PACKS.push({ tag: 'player', dir: playerAnim });

  // Character Juggernaut — boss animations
  const jugg = path.join(UNITY_ROOT, 'Character Juggernaut/animation');
  if (fs.existsSync(jugg)) PACKS.push({ tag: 'boss', dir: jugg });

  // Raw Mocap — interacting/parkour
  const mocap = path.join(UNITY_ROOT, 'uMMORPG/Unity Essentials - Raw Mocap Data/Animations/Interacting');
  if (fs.existsSync(mocap)) PACKS.push({ tag: 'mocap', dir: mocap });

  // Toon_RTS race-specific animations
  const toonRTS = path.join(UNITY_ROOT, 'Toon_RTS');
  if (fs.existsSync(toonRTS)) {
    for (const race of ['Barbarians', 'Dwarves', 'Elves', 'Orcs', 'Undead', 'WesternKingdoms']) {
      const animDir = path.join(toonRTS, race, 'animation');
      if (fs.existsSync(animDir)) {
        PACKS.push({ tag: 'toon/' + race.toLowerCase(), dir: animDir, recursive: true });
      }
    }
  }

  // Warrior Pack (brute warrior)
  const warrior = path.join(UNITY_ROOT, 'ExplosiveLLC/Warrior Pack Bundle 1 FREE/Brute Warrior Mecanim Animation Pack/Characters');
  if (fs.existsSync(warrior)) PACKS.push({ tag: 'warrior', dir: warrior });
}

// Also check for the /tmp/animpacks from the old pipeline (Linux or WSL)
const LEGACY_PACKS = [
  { tag: 'melee',  dir: '/tmp/barbpack' },
  { tag: 'bow',    dir: '/tmp/animpacks/barbbow_1777606070765' },
  { tag: 'farm',   dir: '/tmp/animpacks/barbFarming_Pack_1777606241297' },
  { tag: 'sns',    dir: '/tmp/animpacks/barbSword_and_Shield_Pack_1777606312834' },
  { tag: 'hurt',   dir: '/tmp/animpacks/barbMale_Injured_Pack_1777606315596' },
  { tag: 'pistol', dir: '/tmp/animpacks/barbPistol_Handgun_Locomotion_Pack_1777606610172' },
  { tag: 'magic',  dir: '/tmp/animpacks/barbPro_Magic_Pack_1777606620687' },
  { tag: 'rifle',  dir: '/tmp/animpacks/barbRifle_8-Way_Locomotion_Pack_1777606624293' },
];
for (const p of LEGACY_PACKS) {
  if (fs.existsSync(p.dir)) PACKS.push(p);
}

// ── Helpers ─────────────────────────────────────────────────────────

function safeName(s) {
  return s.replace(/\.fbx$/i, '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_().@-]/g, '');
}

/** Collect FBX files from a directory (optionally recursive). */
function collectFbx(dir, recursive) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...collectFbx(full, true));
    } else if (entry.isFile() && /\.fbx$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results.sort();
}

/** Skip known non-animation FBXs (character meshes, environments). */
function isAnimationFbx(fbxPath) {
  const name = path.basename(fbxPath).toLowerCase();
  // Skip character mesh files
  if (/characters_customizable/i.test(name)) return false;
  if (/^barbarian\./i.test(name)) return false;
  // Skip environment/prop meshes in Toon_RTS model folders
  if (fbxPath.includes('models') && !fbxPath.includes('animation')) return false;
  return true;
}

async function stageFbx(absFbxPath, stageDir) {
  fs.mkdirSync(stageDir, { recursive: true });
  const baseName = safeName(path.basename(absFbxPath));
  const outPath = path.join(stageDir, baseName + '.glb');
  if (fs.existsSync(outPath)) {
    process.stdout.write('-');
    return outPath;
  }
  try {
    await convert(absFbxPath, outPath, ['--khr-materials-unlit', '--binary']);
    process.stdout.write('.');
    return outPath;
  } catch (e) {
    process.stdout.write('x');
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  if (!PACKS.length) {
    console.error('No animation source directories found. Expected Unity game export at:');
    console.error('  D:\\Games\\Models\\grudgeracecharacters\\Il2CppDumper-master\\...');
    process.exit(1);
  }

  console.log(`Found ${PACKS.length} animation packs:`);
  for (const p of PACKS) console.log(`  ${p.tag}: ${p.dir}`);

  // We need a "source skin" GLB — find any FBX that has a skinned mesh
  // (the player animation files include the mixamorig skeleton)
  const firstPlayerFbx = PACKS.find((p) => p.tag === 'player');
  let sourceFbxPath = null;
  if (firstPlayerFbx) {
    const fbxs = collectFbx(firstPlayerFbx.dir, false);
    const idleFbx = fbxs.find((f) => /idle/i.test(path.basename(f))) || fbxs[0];
    sourceFbxPath = idleFbx;
  }

  if (!sourceFbxPath) {
    // Fallback: use any FBX from any pack
    for (const p of PACKS) {
      const fbxs = collectFbx(p.dir, !!p.recursive);
      if (fbxs.length) { sourceFbxPath = fbxs[0]; break; }
    }
  }

  if (!sourceFbxPath) {
    console.error('No FBX files found in any pack.');
    process.exit(1);
  }

  console.log(`\nSource skin FBX: ${path.basename(sourceFbxPath)}`);
  console.log('Staging FBX→GLB (. = converted, - = cached, x = failed)…\n');

  const sourceGlb = await stageFbx(sourceFbxPath, path.join(STAGE_ROOT, '_source'));
  if (!sourceGlb) {
    console.error('\nFailed to convert source skin FBX.');
    process.exit(1);
  }

  const animList = []; // { name, glbPath }
  for (const p of PACKS) {
    const fbxs = collectFbx(p.dir, !!p.recursive).filter(isAnimationFbx);
    if (!fbxs.length) continue;
    const stageDir = path.join(STAGE_ROOT, p.tag.replace(/\//g, '_'));
    process.stdout.write(`  ${p.tag} (${fbxs.length}): `);
    for (const f of fbxs) {
      const glb = await stageFbx(f, stageDir);
      if (!glb) continue;
      const clipName = p.tag + '/' + safeName(path.basename(f));
      animList.push({ name: clipName, glbPath: glb });
    }
    process.stdout.write('\n');
  }
  console.log(`\nStaged ${animList.length} animation GLBs`);

  // ── Merge with gltf-transform ─────────────────────────────────────
  const { NodeIO } = await import('@gltf-transform/core');
  const io = new NodeIO();

  console.log('Merging into', OUT_PATH);
  const merged = await io.read(sourceGlb);

  // Drop source FBX's own bundled animation (usually a T-pose)
  for (const a of merged.getRoot().listAnimations()) a.dispose();

  const mergedNodes = new Map();
  for (const n of merged.getRoot().listNodes()) {
    if (n.getName()) mergedNodes.set(n.getName(), n);
  }

  let copied = 0, skipped = 0;
  for (const { name, glbPath } of animList) {
    let src;
    try { src = await io.read(glbPath); }
    catch { skipped++; continue; }
    const srcAnims = src.getRoot().listAnimations();
    if (!srcAnims.length) { skipped++; continue; }
    const srcAnim = srcAnims[0];

    const dst = merged.createAnimation(name);
    let channelsCopied = 0;
    for (const ch of srcAnim.listChannels()) {
      const targetNode = ch.getTargetNode();
      if (!targetNode) continue;
      const tName = targetNode.getName();
      const mNode = mergedNodes.get(tName);
      if (!mNode) continue;

      const sampler = ch.getSampler();
      if (!sampler) continue;
      const inAcc = sampler.getInput();
      const outAcc = sampler.getOutput();
      if (!inAcc || !outAcc) continue;

      const newIn = merged.createAccessor()
        .setType(inAcc.getType())
        .setArray(new Float32Array(inAcc.getArray()));
      const newOut = merged.createAccessor()
        .setType(outAcc.getType())
        .setArray(new Float32Array(outAcc.getArray()));

      const newSampler = merged.createAnimationSampler()
        .setInput(newIn)
        .setOutput(newOut)
        .setInterpolation(sampler.getInterpolation());

      const newCh = merged.createAnimationChannel()
        .setTargetNode(mNode)
        .setTargetPath(ch.getTargetPath())
        .setSampler(newSampler);

      dst.addSampler(newSampler);
      dst.addChannel(newCh);
      channelsCopied++;
    }
    if (channelsCopied > 0) { copied++; }
    else { skipped++; }
  }
  console.log(`Animations: copied=${copied} skipped=${skipped}`);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  await io.write(OUT_PATH, merged);
  const stat = fs.statSync(OUT_PATH);
  console.log(`Wrote ${OUT_PATH} — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nDone! ${copied} clips in the animation library.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
