/**
 * Persistent admin strip: purges Mixamo-on-Bip001 confusion and points to pipeline.
 */
import { ADMIN_BANNER } from '../data/grudge6Policy';

export default function Grudge6AdminBanner() {
  return (
    <div
      role="status"
      className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 max-w-3xl w-[min(92vw,720px)]"
      style={{ top: 72 }}
    >
      <div
        className="rounded-lg border px-3 py-2 text-left shadow-lg"
        style={{
          background: 'rgba(8, 12, 24, 0.92)',
          borderColor: 'rgba(230, 168, 23, 0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#E6A817' }}
            >
              {ADMIN_BANNER.title}
            </div>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'rgba(220,210,180,0.85)' }}>
              {ADMIN_BANNER.body}
            </p>
          </div>
          <a
            href={ADMIN_BANNER.pipelineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold no-underline"
            style={{
              background: 'linear-gradient(120deg, #E6A817, #c48a10)',
              color: '#120c04',
            }}
          >
            {ADMIN_BANNER.pipelineCta} ↗
          </a>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'rgba(160,150,120,0.75)' }}>
          Bip001 packs: sword_shield · longbow · magic · 2h_melee — never mixamorig tracks on
          WK_/BRB_/ELF_/DWF_/ORC_/UD_ kits. Atlas: sRGB · flipY=false · equip = mesh visibility.
        </p>
      </div>
    </div>
  );
}
