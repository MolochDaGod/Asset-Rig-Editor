# Overview
This project is a pnpm workspace monorepo using TypeScript, designed to develop a WoW-style 3D character customizer for a real-time strategy (RTS) game. The customizer allows users to personalize characters from 6 playable races, featuring detailed 3D models, animations, and various customization options. The project aims to provide a robust and scalable platform for character asset management and in-game integration.

# User Preferences
I prefer iterative development with a focus on clear, concise communication. Please ask before making major architectural changes or introducing new dependencies. For code changes, prioritize maintainability and performance.

# System Architecture
The project is structured as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend utilizes Express 5 with PostgreSQL and Drizzle ORM for data management, and Zod for validation. API codegen is handled by Orval from an OpenAPI spec, and esbuild is used for CJS bundling.

The frontend is a React + Vite web application built with React Three Fiber, leveraging `@react-three/drei` and `Three.js` for 3D rendering. State management is handled by Zustand.

**Key Features:**
- **Character Customizer**: A 3D character customizer supporting 6 playable races with infantry and cavalry variants.
- **Asset Pipeline**: Uses glTF and PNG for multipack preview. **PURGED (2026-07):** Mixamo is NOT retargeted onto Bip001/grudge6 kits. Mixamo library binds only to mixamorig skeletons. Bip001 production packs + grudge6 admin live on **grudge-pipeline.vercel.app**. See `artifacts/character-customizer/docs/GRUDGE6_PURGE.md`.
- **Scaling & Positional Contract**: Characters are scaled based on lore-target `heightMeters` and anchored to X/Z center and Y=0 for consistent world placement.
- **UI/UX**: Features a WoW-style layout with a full-screen 3D viewport, floating left panel, and a bottom race bar.
- **Rendering**: Employs `@react-three/postprocessing` with Bloom, SMAA, and ToneMapping for enhanced visual effects, complemented by dramatic 3-point lighting, atmospheric fog, floating particles, and a glow ring.
- **Customization Panels**: Includes panels for "Gear" (equipment, color variants, mesh toggles), "Looks" (color variants), "Anim" (animation clip selection), and "Export" (JSON config dump).

**Technical Implementations:**
- `vite.config.ts` ensures `resolve.dedupe: ["three"]` and `optimizeDeps.include: ["postprocessing"]` for correct Three.js and postprocessing library handling.
- `CharacterModel.tsx` loads multipack glTF + atlas variants + equipment visibility. **Bip001 races: embedded clips only — no Mixamo retarget.** mixamorig-only: may bind `mixamo-clips.glb` 1:1. **Never** skeleton-swap Mixamo armature onto Bip001 mesh. Fleet grudge6 mesh/skeleton/texture admin = grudge-pipeline.
- **Bind-pose `localOffsets` are required.** `SkeletonUtils.retargetClip` matches per-bone WORLD rotations as `target_world_R := source_world_R · localOffset[bone]`. Without `localOffsets`, the Bip001 limbs come out rotated ~90° (or more) from their bind axes — legs point sideways and the character appears to float above the ground. `mixamoRetarget.ts → computeBindPoseOffsets` snapshots the target bind, poses both skeletons, and computes `localOffset = source_world_R⁻¹ · target_world_R` per mapped bone. Verified offline: reconstruction error at the source-bind frame is 0.00° for all 18 mapped bones; Pelvis/Spine offsets are exactly 90° around Z (the X↔Y swap).

# External Dependencies
- **Monorepo Tool**: pnpm workspaces
- **Package Manager**: pnpm
- **API Framework**: Express 5
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API Codegen**: Orval
- **Build Tool**: esbuild
- **3D Graphics**: React Three Fiber, @react-three/drei, Three.js, @react-three/postprocessing
- **State Management**: Zustand
- **3D Asset Loaders**: FBXLoader, GLTFLoader, TGALoader, THREE.TextureLoader
- **External 3D Rigger**: Mixamo (for character rigging)

# Animations

The Mixamo-rigged barbarian (`public/models/barbarian-mixamo.glb`) is the only race currently using the new pipeline. The other 5 races (human/elf/dwarf/orc/undead) still ride the legacy Bip001 skeleton.

**Clip library** (`public/anims/mixamo-clips.glb`, ~9.0 MB, 305 clips):
- Built by `scripts/src/convert-mixamo-packs.cjs` from 8 Mixamo packs:
  - `melee` — Pro Melee Axe Pack (`/tmp/barbpack`)
  - `bow`, `farm`, `sns`, `hurt` — bow / farming / sword & shield / injured (`/tmp/animpacks/*`)
  - `pistol` — Pistol & Handgun Locomotion Pack (`/tmp/animpacks/barbPistol_*`)
  - `magic` — Pro Magic Pack (`/tmp/animpacks/barbPro_Magic_Pack_*`)
  - `rifle` — Rifle 8-Way Locomotion Pack (`/tmp/animpacks/barbRifle_*`)
- Clip naming convention: `<pack>/<filename>` (e.g. `farm/Watering`).
- Re-run with `node scripts/src/convert-mixamo-packs.cjs` after dropping new packs into `/tmp/animpacks` (or editing the PACKS array at the top of the script).

**Animation Controller UI** (`src/components/AnimationTester.tsx`):
- Two views toggled in the bottom-right HUD:
  1. **Controller (state)** — clips grouped by semantic state (`ControllerState` enum in `src/data/rigAnimationLibrary.ts`) into 8 buckets: Idle/Locomotion, Combat, Ranged, Pistol, Rifle, Magic, Injured, Tasks. Picking a state plays the first clip in that state.
  2. **Browse (raw)** — clips grouped by source pack tag for direct exploration.
- The classifier `categorizeForController()` in `rigAnimationLibrary.ts` is the single source of truth for clip→state mapping; extend it when new packs are added.

**Cross-race rigging (planned, not yet executed):**
T-pose OBJ exports for all 5 remaining races already exist in `public/tpose-for-mixamo/{human,elf,dwarf,orc,undead}.obj`. The agreed path is:
1. Upload each OBJ to Mixamo, place markers, download a Mixamo-skinned T-pose FBX per race.
2. Re-run the existing barbarian conversion pipeline (FBX → GLB with merged textures) to produce `public/models/{race}-mixamo.glb`.
3. Add a `useMixamoRig` flag in race configs and let `CharacterModel.tsx` route to the Mixamo branch when present.
This is preferred over a programmatic re-skin because the existing race OBJs lack UVs (the decimate script only emits `v` and `f` lines), so a procedural skinning approach would also need a UV solution and is judged too risky relative to 5 manual uploads.

# Operational notes

**Tailwind v4 source-scope (CRITICAL — past OOM root cause).** `src/index.css`
declares an explicit `@source "./**/*.{ts,tsx,html}"` and `@source not "../public/**"`
right after `@import "tailwindcss"`. Without this, Tailwind v4's automatic
content detection scans the entire artifact tree, including the ~250 MB of
GLB/PNG/TGA assets in `public/`, and the OOM killer takes the dev server
within seconds of `vite ready` (`Exit status 137`). With the scope locked
to source files, the dev server steady-states around ~2.5 GiB.

Other knobs (kept as defense in depth):

- `NODE_OPTIONS=--max-old-space-size=2048` in `services.env` bounds the V8 heap.
- `DISABLE_CARTOGRAPHER=1` in `services.env` skips the Replit cartographer
  plugin (which scans the entire workspace) — gated in `vite.config.ts`.
- `vite.config.ts` ships `optimizeDeps.holdUntilCrawlEnd: false` and
  `server.preTransformRequests: false`.

The previously enormous unused Unity source pack at `public/models/toon_rts/`
(~275 MB of `.FBX`/`.tga`) has been moved to `.local/unused_assets/toon_rts/`.
None of `src/` references it.
