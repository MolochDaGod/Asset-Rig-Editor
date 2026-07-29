/**
 * SI world scale SSOT for Asset-Rig-Editor (mirrors grudge-world-scale skill).
 *
 * Rules:
 *  - 1 Three.js unit = 1 metre
 *  - HUMAN_HEIGHT_M = 1.8 is the adult human yardstick
 *  - Characters fit to lore height / 1.8 m; weapons/props never hero-fit
 *  - Unit decade (10× / 100×) is unclamped
 *  - Feet ground via Box3 min.y (never pelvis Y = 0)
 */

export const HUMAN_HEIGHT_M = 1.8;
export const SI_UNIT = 1; // metres

/** Height bands for hero characters after fit (m). */
export const HERO_HEIGHT_BAND = { min: 1.55, max: 2.05 } as const;

export type AssetCategory =
  | 'character'
  | 'cavalry'
  | 'siege'
  | 'weapon'
  | 'shield'
  | 'prop'
  | 'mount'
  | 'projectile'
  | 'building'
  | 'unknown';

/** Expected size bands (metres) for diagnosis — not hard clamps for non-heroes. */
export const SIZE_BANDS_M: Record<AssetCategory, { min: number; max: number; label: string }> = {
  character: { min: 1.55, max: 2.05, label: 'Hero / infantry' },
  cavalry: { min: 2.0, max: 3.2, label: 'Rider + mount' },
  siege: { min: 2.5, max: 6.0, label: 'Siege engine' },
  weapon: { min: 0.4, max: 2.2, label: 'Hand weapon' },
  shield: { min: 0.4, max: 1.4, label: 'Shield' },
  prop: { min: 0.15, max: 1.5, label: 'Prop / bag' },
  mount: { min: 1.2, max: 2.5, label: 'Mount only' },
  projectile: { min: 0.3, max: 1.0, label: 'Arrow / bolt' },
  building: { min: 2.5, max: 40, label: 'Building' },
  unknown: { min: 0.05, max: 50, label: 'Unknown' },
};

export type UnitDiagnosis = 'ok' | 'x100_cm_as_m' | 'x100_m_as_cm' | 'x10' | 'x0.1' | 'out_of_band';

export interface ScaleReport {
  category: AssetCategory;
  authoredHeightM: number;
  targetHeightM: number | null;
  fitScale: number;
  unitDiagnosis: UnitDiagnosis;
  timesHuman: number;
  bandOk: boolean;
  message: string;
}

/**
 * Detect classic unit decade errors from measured height vs expected.
 * Unit decade fix is unclamped — return the decade multiplier only.
 */
export function diagnoseUnitScale(
  measuredY: number,
  expectedY: number,
): { decade: number; diagnosis: UnitDiagnosis } {
  if (measuredY < 1e-6 || expectedY < 1e-6) {
    return { decade: 1, diagnosis: 'ok' };
  }
  const ratio = measuredY / expectedY;
  if (ratio > 40 && ratio < 250) return { decade: 0.01, diagnosis: 'x100_cm_as_m' };
  if (ratio > 4 && ratio < 25) return { decade: 0.1, diagnosis: 'x10' };
  if (ratio < 0.025 && ratio > 0.004) return { decade: 100, diagnosis: 'x100_m_as_cm' };
  if (ratio < 0.25 && ratio > 0.04) return { decade: 10, diagnosis: 'x0.1' };
  return { decade: 1, diagnosis: 'ok' };
}

/**
 * Character fit: targetHeight / authoredHeight after optional unit decade.
 * Weapons/projectiles must call with applyHeroFit=false.
 */
export function computeFitScale(
  authoredHeightM: number,
  category: AssetCategory,
  targetHeightM?: number,
): ScaleReport {
  const band = SIZE_BANDS_M[category];
  const expected =
    targetHeightM ??
    (category === 'character' ? HUMAN_HEIGHT_M : (band.min + band.max) / 2);

  const { decade, diagnosis } = diagnoseUnitScale(authoredHeightM, expected);
  const corrected = authoredHeightM * decade;

  // Only characters / cavalry / siege get hero-style height fit to a target.
  const applyHeroFit =
    category === 'character' || category === 'cavalry' || category === 'siege';

  let fitScale = decade;
  let target: number | null = null;
  if (applyHeroFit && targetHeightM && targetHeightM > 0 && corrected > 1e-6) {
    target = targetHeightM;
    fitScale = (targetHeightM / authoredHeightM); // includes decade implicitly if authored is raw
    // Prefer: fix decade first then residual fit — but for characters we use
    // single scale = target / raw_authored (existing CharacterModel path).
    fitScale = targetHeightM / Math.max(authoredHeightM, 1e-6);
  } else if (decade !== 1) {
    fitScale = decade;
  } else {
    fitScale = 1;
  }

  const finalH = authoredHeightM * fitScale;
  const timesHuman = finalH / HUMAN_HEIGHT_M;
  const bandOk = finalH >= band.min * 0.85 && finalH <= band.max * 1.2;

  let message = `${band.label}: ${finalH.toFixed(3)} m (${timesHuman.toFixed(2)}× human)`;
  if (diagnosis !== 'ok') message += ` · unit ${diagnosis}`;
  if (!bandOk) message += ' · OUT OF BAND';

  return {
    category,
    authoredHeightM,
    targetHeightM: target,
    fitScale,
    unitDiagnosis: diagnosis === 'ok' && !bandOk ? 'out_of_band' : diagnosis,
    timesHuman,
    bandOk,
    message,
  };
}

/** Classify mesh name → asset category (for scale policy). */
export function classifyMeshCategory(meshName: string): AssetCategory {
  const n = meshName.toLowerCase();
  if (/weapon_|_sword|_axe|_hammer|_spear|_staff|_dagger|_mace|_bow|_lance/.test(n)) {
    return 'weapon';
  }
  if (/shield/.test(n)) return 'shield';
  if (/quiver|_bag|_wood|xtra_/.test(n)) return 'prop';
  if (/horse|mount|wolf|boar|steed/.test(n)) return 'mount';
  if (/bolt|arrow|projectile/.test(n)) return 'projectile';
  if (/catapult|boltthrower|siege/.test(n)) return 'siege';
  if (/body|head|arms|legs|shoulder/.test(n)) return 'character';
  return 'unknown';
}
