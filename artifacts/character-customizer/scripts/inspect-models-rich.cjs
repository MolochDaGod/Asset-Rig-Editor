#!/usr/bin/env node
/*
 * Rich FBX inspector for the Toon_RTS asset library.
 *
 * For every named mesh part in every FBX it computes:
 *   - real bounding-box dimensions (in cm — FBX native unit)
 *   - vertex / polygon counts
 *   - the primary skinning bone (which limb the mesh follows)
 *   - an MMO-style classification (slot, sub_slot, item_kind, hand)
 *   - a Meshy-3D-ready text prompt for generating a same-fitting replacement
 */
const fs = require('fs');
const path = require('path');
const { parseBinary, parseText, FBXReader } = require('fbx-parser');

const ROOT = path.join(__dirname, '..', 'public', 'models', 'toon_rts', 'Toon_RTS');
const OUT_PARTS = path.join(__dirname, '..', '..', '..', 'attached_assets', 'mmo_parts.csv');
const OUT_PROMPTS = path.join(__dirname, '..', '..', '..', 'attached_assets', 'meshy_prompts.csv');

// ─── Lore tables, used in Meshy prompts to keep style on-brand. ─────────────
const RACE_LORE = {
  Barbarian: { adj: 'savage frost-clan barbarian', material: 'fur, hide, bone, rough iron', palette: 'rust red, bone white, dark steel', vibe: 'crude tribal, blood-soaked' },
  Dwarf:     { adj: 'mountain-dwarven', material: 'forged steel, riveted plate, gold filigree, hammered bronze', palette: 'gold, brushed silver, dark iron', vibe: 'stout, ornate, runic engraving' },
  Elf:       { adj: 'high-elven wood-keeper', material: 'enchanted living wood, mithril leaf, woven silk, polished bronze', palette: 'sage green, silver, deep teal', vibe: 'graceful, art-nouveau curves, sylvan' },
  Orc:       { adj: 'orcish horde-warrior', material: 'crude iron, jagged bone, hide straps, blackened steel', palette: 'rust, blood red, dark green leather', vibe: 'brutal, jagged, oversized' },
  Undead:    { adj: 'risen undead deathknight', material: 'bone, tarnished silver, necrotic plate, frayed shroud', palette: 'bone white, sickly violet, tarnished steel', vibe: 'gothic, sinister, cracked and weathered' },
  Human:     { adj: 'western-kingdoms knight', material: 'polished plate steel, royal cloth, gold trim, leather straps', palette: 'royal blue, gold, white tabard', vibe: 'heroic, clean heraldic, paladin' },
};

const SLOT_PROMPT = {
  Head:        { kind: 'helmet/head piece', size: 'sized to fit a humanoid head, ~20cm tall', placement: 'rests on the skull, fits over hair' },
  Body:        { kind: 'chest armor (cuirass / tunic / robe top)', size: 'sized for a humanoid torso, ~50cm tall × 45cm wide', placement: 'covers shoulders down to waist' },
  Shoulders:   { kind: 'pauldron / shoulder pad pair', size: 'paired, each ~25cm wide', placement: 'sits on top of the shoulders' },
  Arms:        { kind: 'arm guards / bracers / sleeves', size: 'tubular, ~40cm long', placement: 'wrist to elbow on both arms' },
  Legs:        { kind: 'greaves / leg armor / leggings', size: 'paired, ~60cm long each', placement: 'hip to ankle' },
  Sword:       { kind: 'one-handed sword', size: 'blade ~70cm, total ~90cm long', placement: 'right hand grip, blade pointing up' },
  Axe:         { kind: 'one-handed war axe', size: 'haft ~60cm, head ~25cm wide', placement: 'right hand grip' },
  Hammer:      { kind: 'two-handed war hammer', size: 'haft ~110cm, head ~30cm wide', placement: 'right hand grip' },
  Mace:        { kind: 'flanged mace', size: '~70cm long, head ~20cm', placement: 'right hand grip' },
  Spear:       { kind: 'long spear', size: '~210cm shaft, leaf-shaped tip ~35cm', placement: 'right hand grip, vertical' },
  Lance:       { kind: 'cavalry lance', size: '~280cm long with conical guard', placement: 'couched under right arm' },
  Dagger:      { kind: 'dagger / short blade', size: '~30cm total, blade ~18cm', placement: 'right hand reverse-grip' },
  Staff:       { kind: 'magic staff with crystal/orb finial', size: '~180cm long', placement: 'right hand, vertical' },
  Bow:         { kind: 'recurve bow', size: '~140cm tall when strung', placement: 'left hand grip' },
  Pick:        { kind: 'mining pick / pickaxe', size: '~80cm haft, ~25cm head', placement: 'right hand grip' },
  Shield:      { kind: 'kite/round shield', size: '~70cm tall × 50cm wide', placement: 'left forearm strap' },
  'Belt Bag':  { kind: 'belt-pouch / satchel', size: '~15cm cube', placement: 'hangs from waist belt' },
  Quiver:      { kind: 'arrow quiver', size: '~45cm tall cylinder', placement: 'strapped to back, over shoulder' },
  Lumber:      { kind: 'log of carry-wood', size: '~80cm long bundle', placement: 'shouldered or back-strap' },
  Saddle:      { kind: 'riding saddle', size: 'fits across mount\'s back', placement: 'on top of mount creature' },
  Creature:    { kind: 'mount creature (full body)', size: '~250cm long quadruped', placement: 'ground anchor' },
  Engine:      { kind: 'siege engine (full assembly)', size: '~400cm long wheeled war machine', placement: 'ground anchor' },
};

// ─── Slot classification (richer than the prior pass). ──────────────────────
const SLOT_LABEL = { body: 'Body', head: 'Head', arms: 'Arms', legs: 'Legs', shoulderpads: 'Shoulders', shoulder: 'Shoulders' };
const WEAPON_LABEL = { sword: 'Sword', axe: 'Axe', hammer: 'Hammer', spear: 'Spear', staff: 'Staff', bow: 'Bow', dagger: 'Dagger', mace: 'Mace', lance: 'Lance', pick: 'Pick' };
const ACCESSORY_LABEL = { bag: 'Belt Bag', quiver: 'Quiver', wood: 'Lumber' };

const HAND_BY_SLOT = {
  Sword: 'right', Axe: 'right', Hammer: 'right', Mace: 'right', Spear: 'right',
  Lance: 'right', Dagger: 'right', Staff: 'right', Pick: 'right',
  Bow: 'left', Shield: 'left',
};

// Sub-slot heuristic: "muscle vs cloth vs plate" can't be inferred from name
// alone, but the LETTER variant convention in Toon_RTS is consistent enough
// that we can label the EARLIEST variants as the "lighter" and LATER as
// "heavier" tier (artist-author convention across the library).
function tierFromVariant(variant) {
  if (!variant) return '';
  const v = variant.toUpperCase();
  if (['A', 'B'].includes(v)) return 'light/cloth tier';
  if (['C', 'D', 'E'].includes(v)) return 'medium/leather tier';
  if (['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'].includes(v)) return 'heavy/plate tier';
  return '';
}

function classify(name) {
  const stripped = name.replace(/^(BRB|DWF|ELF|ORC|UD|WK|Orc)_/i, '');
  const sLower = stripped.toLowerCase();

  if (/seat/i.test(sLower)) return { slot: 'Saddle', sub: '', variant: '' };
  if (/^horse$|^wolf$|^ram$|^mount_/i.test(sLower)) {
    const animal = sLower.replace(/^mount_/, '').replace(/_.*/, '');
    return { slot: 'Creature', sub: animal, variant: '' };
  }
  if (/catapult|boltthrower|^bolt$|_stone$|_rock$/i.test(sLower)) {
    if (/_stone$|_rock$|^bolt$/i.test(sLower)) return { slot: 'Projectile', sub: '', variant: '' };
    return { slot: 'Engine', sub: '', variant: '' };
  }
  let m = stripped.match(/^Units_([A-Za-z]+)_?([A-Za-z0-9]*)$/i)
       || stripped.match(/^(body|head|arms|legs|shoulderpads|shoulder)_?([A-Za-z0-9]*)$/i);
  if (m) {
    const slot = m[1].toLowerCase();
    return { slot: SLOT_LABEL[slot] || slot, sub: '', variant: m[2] || '' };
  }
  m = stripped.match(/^Shield_?([A-Za-z0-9]*)$/i);
  if (m) return { slot: 'Shield', sub: 'shield', variant: m[1] || '' };

  m = stripped.match(/^[Ww]eapon_([A-Za-z]+)_?([A-Za-z0-9]*)$/);
  if (m) return { slot: WEAPON_LABEL[m[1].toLowerCase()] || m[1], sub: m[1].toLowerCase(), variant: m[2] || '' };

  m = stripped.match(/^Xtra_([A-Za-z0-9]+)$/i);
  if (m) {
    const thing = m[1].toLowerCase();
    return { slot: ACCESSORY_LABEL[thing] || thing, sub: thing, variant: '' };
  }
  return { slot: 'Other', sub: '', variant: '' };
}

// ─── FBX parsing. ───────────────────────────────────────────────────────────
function loadFbx(filePath) {
  const buf = fs.readFileSync(filePath);
  try { return new FBXReader(parseBinary(buf)); }
  catch { return new FBXReader(parseText(buf.toString('utf8'))); }
}

function bboxFromVerts(arr) {
  if (!arr || arr.length < 3) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  return { sx: maxX - minX, sy: maxY - minY, sz: maxZ - minZ, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, cz: (minZ + maxZ) / 2 };
}

function cleanName(prop) {
  if (prop == null) return '';
  const s = String(prop).split('\x00')[0];
  const idx = s.indexOf('::');
  return idx >= 0 ? s.slice(idx + 2) : s;
}

function buildIndex(reader) {
  const objects = reader.node('Objects');
  const idToObj = new Map();
  if (!objects) return { idToObj, parentsOf: new Map(), childrenOf: new Map() };

  // Enumerate every known object kind by name.
  const KINDS = ['Model', 'Geometry', 'Material', 'Texture', 'Deformer', 'AnimationStack', 'AnimationLayer', 'AnimationCurve', 'AnimationCurveNode', 'NodeAttribute', 'Pose', 'Video'];
  for (const kind of KINDS) {
    for (const child of objects.nodes(kind) || []) {
      const id = child.prop(0);
      if (id == null) continue;
      idToObj.set(String(id), {
        kind,
        name: cleanName(child.prop(1)),
        subtype: String(child.prop(2) || ''),
        node: child,
      });
    }
  }

  const parentsOf = new Map();   // childId -> [parentId]
  const childrenOf = new Map();  // parentId -> [childId]
  const conns = reader.node('Connections');
  if (conns) {
    for (const c of conns.nodes('C')) {
      const type = String(c.prop(0));
      if (type !== 'OO') continue;
      const childId = String(c.prop(1));
      const parentId = String(c.prop(2));
      if (!parentsOf.has(childId)) parentsOf.set(childId, []);
      parentsOf.get(childId).push(parentId);
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId).push(childId);
    }
  }
  return { idToObj, parentsOf, childrenOf };
}

// For a given Model(Mesh) id, find its connected Geometry id.
function geometryOfModel(modelId, childrenOf, idToObj) {
  for (const cid of childrenOf.get(modelId) || []) {
    const o = idToObj.get(cid);
    if (o && o.kind === 'Geometry') return cid;
  }
  // Sometimes Geometry connects upward to Model — check parents too
  return null;
}

// Find primary skinning bone for a Geometry: Geometry -> Deformer(Skin)
// children -> Deformer(Cluster) children -> LimbNode parent connection.
// We pick the cluster with the highest summed weight.
function primaryBoneForGeometry(geoId, childrenOf, parentsOf, idToObj) {
  const skins = (childrenOf.get(geoId) || []).filter((id) => {
    const o = idToObj.get(id); return o && o.kind === 'Deformer' && o.subtype === 'Skin';
  });
  let best = null;
  for (const skinId of skins) {
    const clusters = (childrenOf.get(skinId) || []).filter((id) => {
      const o = idToObj.get(id); return o && o.kind === 'Deformer' && o.subtype === 'Cluster';
    });
    for (const cid of clusters) {
      const cnode = idToObj.get(cid).node;
      const w = cnode.node('Weights');
      const arr = w && w.prop(0);
      const sum = arr ? arr.reduce((s, x) => s + Math.abs(x), 0) : 0;
      // cluster connects upward (as child) to a LimbNode model
      const limbIds = (childrenOf.get(cid) || []).filter((id) => {
        const o = idToObj.get(id); return o && o.kind === 'Model' && (o.subtype === 'LimbNode' || o.subtype === 'Limb');
      });
      const limb = limbIds[0] && idToObj.get(limbIds[0]);
      if (limb && (!best || sum > best.sum)) best = { sum, bone: limb.name };
    }
  }
  return best ? best.bone : '';
}

function inspectFile(filePath) {
  const reader = loadFbx(filePath);
  const { idToObj, parentsOf, childrenOf } = buildIndex(reader);
  const records = [];

  for (const [id, obj] of idToObj) {
    if (obj.kind !== 'Model' || obj.subtype !== 'Mesh') continue;
    const geoId = geometryOfModel(id, childrenOf, idToObj);
    let bbox = null, vCount = 0, pCount = 0;
    if (geoId) {
      const gnode = idToObj.get(geoId).node;
      const verts = gnode.node('Vertices');
      const idxN = gnode.node('PolygonVertexIndex');
      const arr = verts && verts.prop(0);
      bbox = bboxFromVerts(arr);
      vCount = arr ? Math.floor(arr.length / 3) : 0;
      pCount = idxN ? idxN.prop(0).length : 0;
    }
    const bone = geoId ? primaryBoneForGeometry(geoId, childrenOf, parentsOf, idToObj) : '';
    records.push({ name: obj.name, bbox, vCount, pCount, bone });
  }
  return records;
}

// ─── Meshy prompt builder. ─────────────────────────────────────────────────
function dimText(b) {
  if (!b) return '?';
  return `${b.sx.toFixed(0)}×${b.sy.toFixed(0)}×${b.sz.toFixed(0)} cm (W×H×D)`;
}

function buildMeshyPrompt({ race, slot, variant, bone, bbox }) {
  const lore = RACE_LORE[race] || RACE_LORE.Human;
  const sp = SLOT_PROMPT[slot];
  const tier = tierFromVariant(variant);
  const dim = bbox ? `${bbox.sx.toFixed(0)} cm wide × ${bbox.sy.toFixed(0)} cm tall × ${bbox.sz.toFixed(0)} cm deep` : 'character-scale';
  const placement = bone ? `attaches to the ${bone} bone (${sp ? sp.placement : 'standard rig slot'})` : (sp ? sp.placement : 'standard rig slot');
  const kind = sp ? sp.kind : `${slot.toLowerCase()} item`;
  return [
    `A low-poly stylized 3D model: ${lore.adj} ${kind}.`,
    tier ? `${tier} variant ${variant}.` : (variant ? `variant ${variant}.` : ''),
    `Materials/feel: ${lore.material}.`,
    `Color palette: ${lore.palette}.`,
    `Style: ${lore.vibe}, hand-painted toon shading, clean silhouette, suitable for an RTS unit at ~2m tall.`,
    `Approximate size: ${dim}.`,
    `Placement: ${placement}.`,
    `Single mesh, T-pose neutral, no skeleton, baked diffuse texture only.`,
  ].filter(Boolean).join(' ');
}

function negativePrompt() {
  return 'photoreal, hyperreal, realistic skin pores, no humans, no faces in armor, no text, no logos, no watermarks, no excess geometry, no PBR maps';
}

// ─── Walk + classify. ──────────────────────────────────────────────────────
function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (/\.fbx$/i.test(e.name)) list.push(p);
  }
  return list;
}

function raceOf(rel) {
  if (rel.startsWith('Barbarians')) return 'Barbarian';
  if (rel.startsWith('Dwarves')) return 'Dwarf';
  if (rel.startsWith('Elves')) return 'Elf';
  if (rel.startsWith('Orcs')) return 'Orc';
  if (rel.startsWith('Undead')) return 'Undead';
  if (rel.startsWith('WesternKingdoms')) return 'Human';
  return 'Unknown';
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

console.log(`Scanning ${ROOT}`);
const files = walk(ROOT).sort();
console.log(`Found ${files.length} FBX files`);

const partsHeader = [
  'Race', 'File', 'PartName', 'Slot', 'SubType', 'Variant', 'Tier',
  'Hand', 'PrimaryBone', 'WidthCm', 'HeightCm', 'DepthCm',
  'CenterY', 'Vertices', 'PolyIndices',
];
const promptHeader = [
  'Race', 'PartName', 'Slot', 'Variant', 'Tier', 'Hand', 'PrimaryBone',
  'SizeWxHxD_cm', 'MeshyPrompt', 'NegativePrompt',
];
const parts = [partsHeader];
const prompts = [promptHeader];

let ok = 0, fail = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const race = raceOf(rel);
  try {
    const recs = inspectFile(file);
    for (const r of recs) {
      const c = classify(r.name);
      const tier = tierFromVariant(c.variant);
      const hand = HAND_BY_SLOT[c.slot] || '';
      const b = r.bbox;
      parts.push([
        race, rel, r.name, c.slot, c.sub, c.variant, tier, hand, r.bone,
        b ? b.sx.toFixed(2) : '',
        b ? b.sy.toFixed(2) : '',
        b ? b.sz.toFixed(2) : '',
        b ? b.cy.toFixed(2) : '',
        r.vCount, r.pCount,
      ]);
      const prompt = buildMeshyPrompt({ race, slot: c.slot, variant: c.variant, bone: r.bone, bbox: b });
      prompts.push([race, r.name, c.slot, c.variant, tier, hand, r.bone, dimText(b), prompt, negativePrompt()]);
    }
    ok++;
  } catch (e) {
    parts.push([race, rel, 'ERROR', e.message, '', '', '', '', '', '', '', '', '', '', '']);
    fail++;
  }
}

fs.mkdirSync(path.dirname(OUT_PARTS), { recursive: true });
fs.writeFileSync(OUT_PARTS, parts.map((r) => r.map(csvEscape).join(',')).join('\n'));
fs.writeFileSync(OUT_PROMPTS, prompts.map((r) => r.map(csvEscape).join(',')).join('\n'));
console.log(`OK ${ok} / FAIL ${fail}`);
console.log(`Parts:   ${OUT_PARTS}  (${parts.length - 1} rows)`);
console.log(`Prompts: ${OUT_PROMPTS}  (${prompts.length - 1} rows)`);
