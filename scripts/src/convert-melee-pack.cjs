/* One-off offline converter:
 *
 *   /tmp/melee_pack/*.fbx  →  artifacts/character-customizer/public/anims/mixamo-melee.glb
 *
 * The first FBX file in alpha order provides the source SkinnedMesh +
 * skeleton for the entire merged GLB. Every subsequent FBX contributes
 * its first AnimationClip (renamed to the file's basename so it can be
 * looked up by the runtime hook). Result: ONE glb that ships the
 * Mixamo source skin + 47 named clips, all bound to the same
 * mixamorig:* skeleton. The runtime then uses
 * `SkeletonUtils.retargetClip` to retarget any clip onto the active
 * race rig.
 */
const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');

// Source dir contains:
//   • character_orc_worge_tpose_mixamo.fbx — the T-pose CHARACTER
//     (skin + skeleton). This becomes the SOURCE SkinnedMesh that
//     `SkeletonUtils.retargetClip` retargets every animation FROM.
//   • <action>.fbx × N — Mixamo animation-only files. Each contributes
//     its single AnimationClip into the merged GLB.
const SRC_DIR = '/tmp/melee_pack2';
const TPOSE_FBX = 'character_orc_worge_tpose_mixamo.fbx';
const STAGE = '/tmp/melee_glb_stage2';
const OUT = path.resolve(__dirname, '../../artifacts/character-customizer/public/anims/mixamo-melee.glb');

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('Source dir missing:', SRC_DIR);
    process.exit(1);
  }
  const allFbx = fs.readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('.fbx'))
    .sort();
  if (!allFbx.includes(TPOSE_FBX)) {
    console.error('T-pose source FBX missing:', TPOSE_FBX);
    process.exit(1);
  }
  // Animation files = every FBX except the T-pose character.
  const animFbx = allFbx.filter((f) => f !== TPOSE_FBX);
  console.log('T-pose:', TPOSE_FBX, '— anim FBX files:', animFbx.length);

  fs.mkdirSync(STAGE, { recursive: true });
  async function stage(name) {
    const inPath = path.join(SRC_DIR, name);
    const outName = name.replace(/\.fbx$/i, '.glb').replace(/\s+/g, '_');
    const outPath = path.join(STAGE, outName);
    if (!fs.existsSync(outPath)) {
      try {
        await convert(inPath, outPath, ['--khr-materials-unlit']);
        process.stdout.write('.');
      } catch (e) {
        console.error('\nFAIL', name, e?.message || e);
      }
    } else {
      process.stdout.write('-');
    }
    return outPath;
  }

  const tposeGlb = await stage(TPOSE_FBX);
  const glbs = [];
  for (const f of animFbx) {
    const out = await stage(f);
    glbs.push({ name: f.replace(/\.fbx$/i, ''), path: out });
  }
  console.log('\nstaged:', glbs.length, 'anim glbs');

  const { NodeIO } = await import('@gltf-transform/core');
  const io = new NodeIO();

  // Base = T-pose character. It carries the source SkinnedMesh +
  // skeleton needed by SkeletonUtils.retargetClip at runtime.
  const merged = await io.read(tposeGlb);
  for (const a of merged.getRoot().listAnimations()) a.dispose();

  const mergedNodes = new Map();
  for (const n of merged.getRoot().listNodes()) {
    if (n.getName()) mergedNodes.set(n.getName(), n);
  }

  let copied = 0;
  let skipped = 0;
  for (const { name, path: gp } of glbs) {
    const src = await io.read(gp);
    const srcAnims = src.getRoot().listAnimations();
    if (!srcAnims.length) { skipped++; continue; }
    const srcAnim = srcAnims[0];

    const dst = merged.createAnimation(name);
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
    }
    copied++;
  }
  console.log(`merged anims: copied=${copied} skipped=${skipped}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await io.write(OUT, merged);
  const stat = fs.statSync(OUT);
  console.log('wrote', OUT, 'size=', (stat.size/1e6).toFixed(2), 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
