import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Search, Upload, X } from 'lucide-react';
import { getIsHost, listAssetRecords, type AssetRecord } from '../../services/fileApi';

interface CanvasImagePickerProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelectAsset: (asset: AssetRecord) => void;
  onUploadFile: (file: File) => void;
}

function isImageAsset(asset: AssetRecord): boolean {
  return asset.type === 'image' || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(asset.path);
}

export function CanvasImagePicker({ x, y, onClose, onSelectAsset, onUploadFile }: CanvasImagePickerProps) {
  const { t } = useTranslation();
  const isHost = getIsHost();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isHost) return;

    let isCancelled = false;
    listAssetRecords()
      .then((records) => {
        if (!isCancelled) setAssets(records.filter(isImageAsset));
      })
      .catch((err) => {
        if (!isCancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isHost]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return assets;
    return assets.filter((asset) =>
      asset.name.toLowerCase().includes(normalizedQuery)
      || asset.path.toLowerCase().includes(normalizedQuery)
      || asset.ext.toLowerCase().includes(normalizedQuery)
    );
  }, [assets, query]);

  const left = Math.max(12, Math.min(x, window.innerWidth - 380));
  const top = Math.max(12, Math.min(y, window.innerHeight - 460));

  const handleUploadChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUploadFile(file);
    event.target.value = '';
  }, [onUploadFile]);

  return (
    <>
      <div
        className="fixed inset-0 z-[99998]"
        onMouseDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[99999] flex max-h-[440px] w-[368px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111827]/90 shadow-[0_24px_70px_rgba(0,0,0,0.72)] backdrop-blur-3xl"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-400/10 text-sky-100">
              <Image size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white/90">{t('assetPicker.title')}</div>
              <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {t('assetPicker.subtitle')}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
              title={t('common.close')}
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-bold text-white/75 transition-colors hover:border-sky-300/30 hover:bg-sky-400/10 hover:text-sky-100"
            >
              <Upload size={14} />
              {t('assetPicker.newFile')}
            </button>
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('assetPicker.searchPlaceholder')}
                className="h-9 w-full rounded-lg border border-white/10 bg-black/20 pl-8 pr-2 text-xs text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-white/25 focus:bg-black/30"
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          {!isHost ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/45">
              {t('assetPicker.hostOnlyHint')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          ) : isLoading ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs text-white/35">
              {t('assetPicker.loadingAssets')}
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs text-white/35">
              {t('assetPicker.noImages')}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visibleAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset)}
                  className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-left transition-colors hover:border-sky-300/35 hover:bg-sky-400/10"
                  title={asset.path}
                >
                  <div className="aspect-square overflow-hidden bg-black/25">
                    <img
                      src={asset.url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="truncate px-2 py-1.5 text-[10px] font-bold text-white/65">
                    {asset.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
