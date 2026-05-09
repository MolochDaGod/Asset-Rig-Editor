#!/usr/bin/env node
/*
 * Convert and MERGE every Mixamo pack drop in `attached_assets/*.zip`
 * (or pre-extracted under `/tmp/animpacks/<name>/`) into ONE GLB:
 *   artifacts/character-customizer/public/anims/mixamo-clips.glb
 *
 * Each pack contains a `barbarian.fbx` (the rigged mesh in T-pose) plus
 * N animation-only FBXs sharing the same `mixamorig:*` skeleton. The
 * first pack's `barbarian.fbx` provides the source SkinnedMesh +
 * skeleton for the merged GLB; every other FBX contributes its first
 * AnimationClip. Clip names are derived from the FBX filename, prefixed
 * with the pack tag (`melee/standing_idle_01`, `bow/standing_block`, …)
 * so identical filenames across packs (e.g. `standing block.fbx`)
 * don't collide.
 *
 * The runtime then loads this GLB with `useGLTF`, takes only the
 * AnimationClips off it, and binds them by name to the race's
 * mixamorig-rigged SkinnedMesh — no retargeting math involved.
 *
 * Usage:
 *   node scripts/src/convert-mixamo-packs.cjs
 *
 * Re-staged FBX→GLB conversions are cached under /tmp/mixamo_glb_stage/
 * so re-runs only re-merge instead of re-converting.
 */
const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');

const PACK_ROOT = '/tmp/animpacks';
const OUT_PATH = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/anims/mixamo-clips.glb',
);
const STAGE_ROOT = '/tmp/mixamo_glb_stage';

// Which directory inside each extracted pack carries the source rigged
// FBX. Mixamo packs put it at the root and name it `barbarian.fbx`
// (the project's chosen Mixamo character). Skipping it from animation
// merging — it is the SOURCE skin, not a clip.
const SOURCE_FBX_NAME = 'barbarian.fbx';

// Order matters only for picking the "primary" source skin. The first
// pack's `barbarian.fbx` is what we use; every other pack's
// `barbarian.fbx` is identical so we ignore it.
const PACKS = [
  // Original 47-clip melee pack (already extracted to /tmp/barbpack
  // earlier; we look for it there and fall back to the new pack
  // location if absent).
  { tag: 'melee',  dir: '/tmp/barbpack' },
  { tag: 'bow',    dir: PACK_ROOT + '/barbbow_1777606070765' },
  { tag: 'farm',   dir: PACK_ROOT + '/barbFarming_Pack_1777606241297' },
  { tag: 'sns',    dir: PACK_ROOT + '/barbSword_and_Shield_Pack_1777606312834' },
  { tag: 'hurt',   dir: PACK_ROOT + '/barbMale_Injured_Pack_1777606315596' },
  // Three additional packs uploaded after the first conversion:
  { tag: 'pistol', dir: PACK_ROOT + '/barbPistol_Handgun_Locomotion_Pack_1777606610172' },
  { tag: 'magic',  dir: PACK_ROOT + '/barbPro_Magic_Pack_1777606620687' },
  { tag: 'rifle',  dir: PACK_ROOT + '/barbRifle_8-Way_Locomotion_Pack_1777606624293' },
];

function safeName(s) {
  return s.replace(/\.fbx$/i, '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_()-]/g, '');
}

async function stageFbx(absFbxPath, stageDir) {
  fs.mkdirSync(stageDir, { recursive: true });
  const baseName = safeName(path.basename(absFbxPath)) + '.glb';
  const outPath = path.join(stageDir, baseName);
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

async function main() {
  const { NodeIO } = await import('@gltf-transform/core');
  const io = new NodeIO();

  // Pick first existing pack as the source-skin provider.
  const sourcePack = PACKS.find((p) => fs.existsSync(path.join(p.dir, SOURCE_FBX_NAME)));
  if (!sourcePack) {
    console.error('No pack with', SOURCE_FBX_NAME, 'found.');
    process.exit(1);
  }
  console.log('Source skin from pack:', sourcePack.tag);

  console.log('\nStaging FBX→GLB (. = converted, - = cached, x = failed)…');

  const sourceGlb = await stageFbx(
    path.join(sourcePack.dir, SOURCE_FBX_NAME),
    path.join(STAGE_ROOT, '_source'),
  );
  if (!sourceGlb) {
    console.error('\nFailed to convert source skin.');
    process.exit(1);
  }

  const animList = []; // { name, glbPath }
  for (const p of PACKS) {
    if (!fs.existsSync(p.dir)) {
      console.warn('\nPack dir missing:', p.dir, '— skipping.');
      continue;
    }
    const stageDir = path.join(STAGE_ROOT, p.tag);
    const fbxs = fs.readdirSync(p.dir)
      .filter((f) => f.toLowerCase().endsWith('.fbx') && f !== SOURCE_FBX_NAME)
      .sort();
    process.stdout.write('\n  ' + p.tag + ' (' + fbxs.length + '): ');
    for (const f of fbxs) {
      const glb = await stageFbx(path.join(p.dir, f), stageDir);
      if (!glb) continue;
      animList.push({ name: p.tag + '/' + safeName(f), glbPath: glb });
    }
  }
  console.log('\nstaged', animList.length, 'anim glbs');

  // ─── Merge ──────────────────────────────────────────────────────
  console.log('Merging into', OUT_PATH);
  const merged = await io.read(sourceGlb);
  // Drop the source FBX's own bundled animations (Mixamo includes a
  // T-pose "animation" we don't want).
  for (const a of merged.getRoot().listAnimations()) a.dispose();

  const mergedNodes = new Map();
  for (const n of merged.getRoot().listNodes()) {
    if (n.getName()) mergedNodes.set(n.getName(), n);
  }

  let copied = 0;
  let skipped = 0;
  for (const { name, glbPath } of animList) {
    let src;
    try {
      src = await io.read(glbPath);
    } catch (e) {
      skipped++; continue;
    }
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
      if (!mNode) continue; // bone not in source skeleton (e.g. extra finger joint)

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
    if (channelsCopied > 0) copied++;
    else skipped++;
  }
  console.log('Animations: copied=', copied, 'skipped=', skipped);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  await io.write(OUT_PATH, merged);
  const stat = fs.statSync(OUT_PATH);
  console.log('Wrote', OUT_PATH, '—', (stat.size / 1024 / 1024).toFixed(2), 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
