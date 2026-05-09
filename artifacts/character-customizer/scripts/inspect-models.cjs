#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseBinary, parseText, FBXReader } = require('fbx-parser');

const ROOT = path.join(__dirname, '..', 'public', 'models', 'toon_rts', 'Toon_RTS');
const OUT_CSV = path.join(__dirname, '..', '..', '..', 'attached_assets', 'model_manifest.csv');
const OUT_SUMMARY = path.join(__dirname, '..', '..', '..', 'attached_assets', 'model_summary.csv');

function loadFbx(filePath) {
  const buf = fs.readFileSync(filePath);
  try { return new FBXReader(parseBinary(buf)); }
  catch { return new FBXReader(parseText(buf.toString('utf8'))); }
}

function cleanName(prop) {
  if (prop == null) return '';
  const s = String(prop).split('\x00')[0];
  const idx = s.indexOf('::');
  return idx >= 0 ? s.slice(idx + 2) : s;
}

function inspect(filePath) {
  const reader = loadFbx(filePath);
  const objects = reader.node('Objects');
  const out = { meshes: [], bones: [], nullNodes: [], materials: [], textures: [], anims: [], deformers: 0 };
  if (!objects) return out;

  for (const geo of objects.nodes('Geometry')) {
    const verts = geo.node('Vertices');
    const idx = geo.node('PolygonVertexIndex');
    const vArr = verts && verts.prop(0);
    const iArr = idx && idx.prop(0);
    out.meshes.push({
      name: cleanName(geo.prop(1)),
      verts: vArr ? Math.floor(vArr.length / 3) : 0,
      polyIdx: iArr ? iArr.length : 0,
    });
  }
  out.meshNodes = [];
  for (const m of objects.nodes('Model')) {
    const name = cleanName(m.prop(1));
    const subtype = String(m.prop(2) || '');
    if (subtype === 'LimbNode' || subtype === 'Limb') out.bones.push(name);
    else if (subtype === 'Null') out.nullNodes.push(name);
    else if (subtype === 'Mesh') out.meshNodes.push(name);
  }
  for (const mat of objects.nodes('Material')) out.materials.push(cleanName(mat.prop(1)));
  for (const tex of objects.nodes('Texture')) out.textures.push(cleanName(tex.prop(1)));
  for (const a of objects.nodes('AnimationStack')) out.anims.push(cleanName(a.prop(1)));
  out.deformers = objects.nodes('Deformer').length;
  return out;
}

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (/\.fbx$/i.test(e.name)) list.push(p);
  }
  return list;
}

function classify(rel) {
  const lc = rel.toLowerCase();
  if (lc.includes('/animation/')) return 'animation';
  if (lc.includes('/equipment/')) return 'equipment';
  if (lc.includes('cavalry')) return 'cavalry-character';
  if (lc.includes('catapult') || lc.includes('boltthrower')) return 'siege';
  if (lc.includes('customizable')) return 'character';
  if (lc.includes('/extra_models/')) return 'extra';
  return 'other';
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

// Classify a mesh part name into Slot, Subtype, Variant, Description.
// Naming convention observed across all 6 races:
//   <RACE>_Units_<Slot>_<Variant>     -> body part (Body/Head/Arms/Legs/Shoulderpads)
//   <RACE>_<Slot>_<Variant>           -> equipment piece (Shield, weapon_*)
//   <RACE>_weapon_<Subtype>[_Variant] -> weapon (sword/axe/bow/staff/spear/...)
//   <RACE>_Xtra_<thing>               -> accessory (bag/quiver/wood)
//   <RACE>_Mount_<animal>             -> mount creature
//   <RACE>_Horse / Wolf / Ram         -> mount creature
//   <RACE>_Catapult / BoltThrower / Bolt / *_stone / *_rock -> siege piece
//   Bip001 / Bip001 *                 -> skeleton bone
function classifyPart(rawName, partType) {
  const name = String(rawName || '');
  const lower = name.toLowerCase();
  const stripped = name.replace(/^(BRB|DWF|ELF|ORC|UD|WK)_/i, '');
  const sLower = stripped.toLowerCase();

  if (partType === 'bone') {
    return { group: 'Skeleton', slot: 'Bone', subtype: '', variant: '', desc: `Skeleton bone (${name})` };
  }
  if (partType === 'null') {
    return { group: 'Rig', slot: 'Helper', subtype: '', variant: '', desc: `Null helper / rig node (${name})` };
  }
  if (partType === 'material' || partType === 'texture' || partType === 'anim_stack' || partType === 'geometry') {
    return { group: partType, slot: '', subtype: '', variant: '', desc: name };
  }

  // mount creatures
  if (/^horse$|^wolf$|^ram$|^mount_/i.test(sLower) || /horse_seat|wolf_seat|ram_seat/i.test(sLower)) {
    if (/seat/i.test(sLower)) return { group: 'Mount', slot: 'Saddle', subtype: '', variant: '', desc: `Saddle / rider seat for mount` };
    const animal = sLower.replace(/^mount_/, '').replace(/_.*/, '');
    return { group: 'Mount', slot: 'Creature', subtype: animal, variant: '', desc: `Mount creature: ${animal}` };
  }
  // siege
  if (/catapult|boltthrower|^bolt$|_stone$|_rock$/i.test(sLower)) {
    if (/_stone$|_rock$|^bolt$/i.test(sLower)) return { group: 'Siege', slot: 'Projectile', subtype: '', variant: '', desc: `Siege projectile (${name})` };
    return { group: 'Siege', slot: 'Engine', subtype: '', variant: '', desc: `Siege engine (${name})` };
  }
  // body parts:  Units_<Slot>_<Variant>  OR  bare <Slot>_<Variant> (Barbarian style)
  let m = stripped.match(/^Units_([A-Za-z]+)_?([A-Za-z0-9]*)$/i)
       || stripped.match(/^(body|head|arms|legs|shoulderpads|shoulder)_?([A-Za-z0-9]*)$/i);
  if (m) {
    const slot = m[1].toLowerCase();
    const variant = m[2] || '';
    const slotMap = {
      body: 'Body / Torso', head: 'Head', arms: 'Arms', legs: 'Legs',
      shoulderpads: 'Shoulders', shoulder: 'Shoulders',
    };
    const slotLabel = slotMap[slot] || slot;
    return { group: 'Body', slot: slotLabel, subtype: '', variant, desc: `${slotLabel} variant ${variant || '?'} (swappable body mesh)` };
  }
  // shield
  m = stripped.match(/^Shield_?([A-Za-z0-9]*)$/i);
  if (m) return { group: 'Equipment', slot: 'Shield', subtype: 'shield', variant: m[1] || '', desc: `Shield variant ${m[1] || '?'} (off-hand)` };

  // weapons: weapon_<subtype>[_variant]
  m = stripped.match(/^weapon_([A-Za-z]+)_?([A-Za-z0-9]*)$/i) || stripped.match(/^Weapon_([A-Za-z]+)_?([A-Za-z0-9]*)$/i);
  if (m) {
    const sub = m[1].toLowerCase();
    const variant = m[2] || '';
    const subMap = {
      sword: 'Sword', axe: 'Axe', hammer: 'Hammer', spear: 'Spear', staff: 'Staff (caster)',
      bow: 'Bow (ranged)', dagger: 'Dagger', mace: 'Mace', lance: 'Lance (cavalry)',
      pick: 'Pick (worker tool)',
    };
    const label = subMap[sub] || sub;
    return { group: 'Equipment', slot: 'Weapon', subtype: sub, variant, desc: `${label} variant ${variant || '-'} (right-hand weapon mesh)` };
  }
  // accessories: Xtra_<thing>
  m = stripped.match(/^Xtra_([A-Za-z0-9]+)$/i);
  if (m) {
    const thing = m[1].toLowerCase();
    const accMap = {
      bag: 'Belt bag / pouch', quiver: 'Arrow quiver (back)',
      wood: 'Wood/log carry prop',
    };
    return { group: 'Accessory', slot: 'Extra', subtype: thing, variant: '', desc: accMap[thing] || `Accessory: ${thing}` };
  }
  return { group: 'Other', slot: 'Unknown', subtype: '', variant: '', desc: `Unclassified mesh part: ${name}` };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

console.log(`Scanning ${ROOT}`);
const files = walk(ROOT).sort();
console.log(`Found ${files.length} FBX files`);

const detail = [['Race', 'FileCategory', 'File', 'PartType', 'PartName', 'Group', 'Slot', 'Subtype', 'Variant', 'Description', 'Vertices', 'PolyIndices']];
const summary = [['Race', 'Category', 'File', 'MeshParts', 'Geometries', 'TotalVerts', 'Bones', 'NullNodes', 'Materials', 'Textures', 'AnimStacks', 'Deformers']];

let ok = 0, fail = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const race = raceOf(rel);
  const cat = classify(rel);
  try {
    const info = inspect(file);
    const totalVerts = info.meshes.reduce((s, m) => s + m.verts, 0);
    summary.push([race, cat, rel, (info.meshNodes || []).length, info.meshes.length, totalVerts, info.bones.length, info.nullNodes.length, info.materials.length, info.textures.length, info.anims.length, info.deformers]);
    const push = (pt, n, v = '', p = '') => {
      const c = classifyPart(n, pt);
      detail.push([race, cat, rel, pt, n, c.group, c.slot, c.subtype, c.variant, c.desc, v, p]);
    };
    for (const n of info.meshNodes || []) push('mesh_part', n);
    for (const m of info.meshes) push('geometry', m.name || '(unnamed)', m.verts, m.polyIdx);
    for (const b of info.bones) push('bone', b);
    for (const n of info.nullNodes) push('null', n);
    for (const mat of info.materials) push('material', mat);
    for (const tex of info.textures) push('texture', tex);
    for (const a of info.anims) push('anim_stack', a);
    ok++;
  } catch (e) {
    summary.push([race, cat, rel, 'ERROR', e.message, '', '', '', '', '', '', '']);
    detail.push([race, cat, rel, 'ERROR', e.message, '', '', '', '', '', '', '']);
    fail++;
  }
}

fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
fs.writeFileSync(OUT_CSV, detail.map((r) => r.map(csvEscape).join(',')).join('\n'));
fs.writeFileSync(OUT_SUMMARY, summary.map((r) => r.map(csvEscape).join(',')).join('\n'));
console.log(`OK ${ok} / FAIL ${fail}`);
console.log(`Detail: ${OUT_CSV} (${detail.length - 1} rows)`);
console.log(`Summary: ${OUT_SUMMARY} (${summary.length - 1} rows)`);
