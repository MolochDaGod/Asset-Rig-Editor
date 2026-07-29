import { useCharacterStore } from '../store/customizer';
import { useAssetIdentityStore } from '../store/assetIdentityStore';
import { TOON_RACES } from '../data/assets';
import { HUMAN_HEIGHT_M } from '../data/worldScale';

export default function ExportPanel() {
  const {
    selectedRace,
    selectedWeapon,
    selectedColorVariant,
    visibleMeshParts,
    characterType,
    characterPosX,
    characterPosY,
    characterPosZ,
    characterRotY,
  } = useCharacterStore();
  const kit = useAssetIdentityStore((s) => s.kit);

  const race = TOON_RACES.find((r) => r.id === selectedRace);
  const weapon = race?.equipment.find((e) => e.id === selectedWeapon);
  const colorVariant = race?.colorVariants.find((v) => v.id === selectedColorVariant);

  const hiddenParts = Object.entries(visibleMeshParts)
    .filter(([, v]) => v === false)
    .map(([k]) => k);

  const visibleParts = Object.entries(visibleMeshParts)
    .filter(([, v]) => v !== false)
    .map(([k]) => k);

  const config = {
    schema: 'grudge.asset-rig-editor.export.v2',
    si: {
      unit: 'metre',
      humanHeightM: HUMAN_HEIGHT_M,
    },
    race: race?.name ?? selectedRace,
    raceId: selectedRace,
    characterType,
    colorVariant: colorVariant?.label ?? 'Default',
    colorHex: colorVariant?.hex ?? race?.color,
    equippedWeapon: weapon?.name ?? 'None',
    visibleMeshParts: visibleParts,
    hiddenMeshParts: hiddenParts,
    transform: {
      position: { x: characterPosX, y: characterPosY, z: characterPosZ },
      rotationY: characterRotY,
    },
    identity: kit
      ? {
          kitUuid: kit.grudgeUuid,
          assetKey: kit.assetKey,
          heightM: kit.heightM,
          timesHuman: kit.timesHuman,
          fitScale: kit.fitScale,
          unitDiagnosis: kit.unitDiagnosis,
          groundOffset: kit.groundOffset,
          attachPoints: kit.attachPointsFound,
          meshCount: kit.meshCount,
          visibleMeshCount: kit.visibleMeshCount,
          meshes: kit.meshes.map((m) => ({
            grudgeUuid: m.grudgeUuid,
            assetKey: m.assetKey,
            meshName: m.meshName,
            slot: m.slot,
            category: m.category,
            visible: m.visible,
            attachPoint: m.attachPoint,
            location: m.location,
            sizeM: m.sizeM,
          })),
        }
      : null,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${race?.id ?? 'character'}_${characterType}_identity.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="section-header">Export Configuration</div>

      <div className="panel-bg rounded-lg p-3 space-y-2.5">
        <div className="text-xs text-muted-foreground font-medium mb-2">
          Current Build (SI + grudge UUID)
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Race</span>
          <span className="text-primary font-medium">{race?.name}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Type</span>
          <span className="text-xs font-medium">{characterType}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Color</span>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border border-border"
              style={{ background: colorVariant?.hex ?? race?.color }}
            />
            <span className="text-xs">{colorVariant?.label ?? 'Default'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Weapon</span>
          <span className="text-xs font-medium">{weapon?.name ?? '—'}</span>
        </div>

        {kit && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Height (SI)</span>
              <span className="text-xs font-mono">
                {kit.heightM.toFixed(3)} m · {kit.timesHuman.toFixed(2)}× human
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kit UUID</span>
              <span className="text-[9px] font-mono truncate max-w-[9rem]" title={kit.grudgeUuid}>
                {kit.grudgeUuid}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meshes</span>
              <span className="text-xs">
                {kit.visibleMeshCount}/{kit.meshCount}
              </span>
            </div>
          </>
        )}

        {hiddenParts.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground block mb-1">Hidden Parts</span>
            <div className="flex flex-wrap gap-1">
              {hiddenParts.slice(0, 12).map((p) => (
                <span
                  key={p}
                  className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="panel-bg rounded-lg p-3">
        <div className="text-xs text-muted-foreground font-medium mb-2">JSON Preview</div>
        <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto leading-relaxed max-h-40">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopy}
          className="py-2 px-3 rounded-md text-xs border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all"
        >
          Copy JSON
        </button>
        <button
          onClick={handleDownload}
          className="py-2 px-3 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 transition-all font-medium"
        >
          Download
        </button>
      </div>
    </div>
  );
}
