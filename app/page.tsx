'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type LocaleCode = string;

type LocalizedValues = Partial<Record<LocaleCode, string[]>>;

type ImageService = {
  id: string;
  type: 'ImageService3' | 'ImageService2';
  profile?: string;
};

type ImageSource = {
  id: string;
  width: number;
  height: number;
  format: string;
  isIiif: boolean;
  service?: ImageService[];
};

type CanvasImageInput = {
  id: string;
  label: LocalizedValues;
  imageUrl: string;
  detected?: ImageSource;
  loading: boolean;
  error?: string;
};

type CanvasInput = {
  id: string;
  canvasNo: number;
  label: LocalizedValues;
  images: CanvasImageInput[];
  manualSize: boolean;
  manualWidth?: number;
  manualHeight?: number;
};

type ThumbnailMode = 'registered' | 'custom';

type ThumbnailChoice = {
  mode: ThumbnailMode;
  selectedImageId?: string;
  customUrl?: string;
};

type Manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json';
  id: string;
  type: 'Manifest';
  label: LocalizedValues;
  items: ManifestCanvas[];
  thumbnail?: Thumbnail[];
};

type ManifestCanvas = {
  id: string;
  type: 'Canvas';
  label: LocalizedValues;
  width: number;
  height: number;
  items: AnnotationPage[];
};

type AnnotationPage = {
  id: string;
  type: 'AnnotationPage';
  items: Annotation[];
};

type Annotation = {
  id: string;
  type: 'Annotation';
  motivation: 'painting';
  body: AnnotationBody;
  target: string;
};

type AnnotationBody = {
  id: string;
  type: 'Image';
  format: string;
  width: number;
  height: number;
  service?: ImageService[];
};

type Thumbnail = {
  id: string;
  type: 'Image';
  format?: string;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyLocalizedValues(): LocalizedValues {
  return {};
}

function createCanvasImage(): CanvasImageInput {
  return {
    id: uid('canvas-image'),
    label: createEmptyLocalizedValues(),
    imageUrl: '',
    loading: false,
  };
}

function createCanvas(canvasNo: number): CanvasInput {
  return {
    id: uid('canvas'),
    canvasNo,
    label: createEmptyLocalizedValues(),
    images: [createCanvasImage()],
    manualSize: false,
  };
}

function normalizeBaseUri(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getCanvasComputedSize(canvas: CanvasInput) {
  const detectedImages = canvas.images.map((image) => image.detected).filter((v): v is ImageSource => Boolean(v));
  if (detectedImages.length === 0) return null;
  return {
    width: Math.max(...detectedImages.map((img) => img.width)),
    height: Math.max(...detectedImages.map((img) => img.height)),
  };
}

function joinUrl(base: string, path: string) {
  return `${normalizeBaseUri(base)}${path.startsWith('/') ? '' : '/'}${path}`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function inferFormat(url: string) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  if (lower.endsWith('.jp2')) return 'image/jp2';
  return 'image/jpeg';
}

function sanitizeLocalizedValues(input: LocalizedValues): LocalizedValues {
  const out: LocalizedValues = {};
  for (const locale of Object.keys(input) as LocaleCode[]) {
    const values = (input[locale] ?? []).map((v) => v.trim()).filter(Boolean);
    if (values.length > 0) out[locale] = values;
  }
  return out;
}

async function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('画像サイズを取得できませんでした。CORS または URL を確認してください。'));
    img.src = url;
  });
}

async function detectIiifImage(imageUrl: string): Promise<ImageSource> {
  const trimmed = imageUrl.trim();
  if (!isValidHttpUrl(trimmed)) {
    throw new Error('画像 URL は http(s) 形式で入力してください。');
  }

  const normalized = trimmed.replace(/\/$/, '');
  const infoCandidates = normalized.endsWith('/info.json')
    ? [normalized]
    : [`${normalized}/info.json`, normalized.replace(/\/full\/[^\/]+\/[^\/]+\/[^\/]+\.[a-z0-9]+$/i, '/info.json')];

  for (const infoUrl of [...new Set(infoCandidates)]) {
    try {
      const res = await fetch(infoUrl, { mode: 'cors' });
      if (!res.ok) continue;
      const json = await res.json();
      if (!json?.width || !json?.height) continue;

      const context = Array.isArray(json['@context']) ? json['@context'].join(' ') : String(json['@context'] ?? '');
      const type = String(json.type ?? '');
      const isV3 = context.includes('/image/3/') || type === 'ImageService3';
      const isV2 = context.includes('/image/2/') || context.includes('/image/2/context.json');
      const serviceId = String(json.id ?? json['@id'] ?? infoUrl.replace(/\/info\.json$/, ''));

      return {
        id: trimmed,
        width: Number(json.width),
        height: Number(json.height),
        format: inferFormat(trimmed),
        isIiif: true,
        service: [
          {
            id: serviceId,
            type: isV3 ? 'ImageService3' : 'ImageService2',
            profile: "level1",
          },
        ],
      };
    } catch {
      // try next candidate
    }
  }

  const dimensions = await loadImageDimensions(trimmed);
  return {
    id: trimmed,
    width: dimensions.width,
    height: dimensions.height,
    format: inferFormat(trimmed),
    isIiif: false,
  };
}

function buildManifest(baseUri: string, manifestLabel: LocalizedValues, canvases: CanvasInput, thumbnailChoice: ThumbnailChoice): never {
  throw new Error('unreachable');
}

function generateManifest(baseUri: string, manifestLabel: LocalizedValues, canvases: CanvasInput[], thumbnailChoice: ThumbnailChoice): Manifest {
  const normalizedBase = normalizeBaseUri(baseUri);
  if (!normalizedBase) throw new Error('ベースURIを入力してください。');
  if (!canvases.length) throw new Error('キャンバスを 1 件以上登録してください。');

  const manifest: Manifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: joinUrl(normalizedBase, 'manifest.json'),
    type: 'Manifest',
    label: sanitizeLocalizedValues(manifestLabel),
    items: canvases.map((canvas) => {
      const detectedImages = canvas.images
        .map((image) => image.detected)
        .filter((v): v is ImageSource => Boolean(v));

      if (detectedImages.length === 0) {
        throw new Error(`Canvas ${canvas.canvasNo} に有効な画像がありません。`);
      }

      const computedSize = getCanvasComputedSize(canvas);
      if (!computedSize) {
        throw new Error(`Canvas ${canvas.canvasNo} に有効な画像サイズがありません。`);
      }

      const width = canvas.manualSize
        ? canvas.manualWidth ?? computedSize.width
        : computedSize.width;
      const height = canvas.manualSize
        ? canvas.manualHeight ?? computedSize.height
        : computedSize.height;

      if (canvas.manualSize && (!width || !height)) {
        throw new Error(`Canvas ${canvas.canvasNo} の手動サイズを正しく入力してください。`);
      }

      const canvasId = joinUrl(normalizedBase, `canvas/p${canvas.canvasNo}`);
      const pageId = joinUrl(normalizedBase, `page/p${canvas.canvasNo}/1`);

      return {
        id: canvasId,
        type: 'Canvas',
        label: sanitizeLocalizedValues(canvas.label),
        width,
        height,
        items: [
          {
            id: pageId,
            type: 'AnnotationPage',
            items: detectedImages.map((img, index) => ({
              id: joinUrl(normalizedBase, `annotation/p${String(canvas.canvasNo).padStart(4, '0')}-image-${index + 1}`),
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: img.id,
                type: 'Image',
                format: img.format,
                width: img.width,
                height: img.height,
                ...(img.isIiif && img.service ? { service: img.service } : {}),
              },
              target: canvasId,
            })),
          },
        ],
      } satisfies ManifestCanvas;
    }),
  };

  const thumbnail = resolveThumbnail(thumbnailChoice, canvases);
  if (thumbnail) manifest.thumbnail = [thumbnail];

  return manifest;
}

function resolveThumbnail(choice: ThumbnailChoice, canvases: CanvasInput[]): Thumbnail | undefined {
  if (choice.mode === 'custom' && choice.customUrl?.trim()) {
    return { id: choice.customUrl.trim(), type: 'Image', format: inferFormat(choice.customUrl.trim()) };
  }

  if (choice.mode === 'registered' && choice.selectedImageId) {
    for (const canvas of canvases) {
      for (const image of canvas.images) {
        if (image.id === choice.selectedImageId && image.detected) {
          return {
            id: image.detected.id,
            type: 'Image',
            format: image.detected.format,
          };
        }
      }
    }
  }

  return undefined;
}

function getBaseUriFromManifestId(id: string) {
  if (!id) return '';
  const normalized = id.trim();
  if (normalized.endsWith('/manifest.json')) {
    return normalized.slice(0, normalized.length - '/manifest.json'.length) + '/';
  }
  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex + 1) : normalized;
}

function manifestCanvasToInput(canvas: ManifestCanvas, index: number): CanvasInput {
  return {
    id: uid('canvas'),
    canvasNo: index + 1,
    label: canvas.label || {},
    images: canvas.items.flatMap((page) =>
      page.items.map((annotation) => ({
        id: uid('canvas-image'),
        label: createEmptyLocalizedValues(),
        imageUrl: annotation.body.id,
        detected: {
          id: annotation.body.id,
          width: annotation.body.width,
          height: annotation.body.height,
          format: annotation.body.format,
          isIiif: Boolean(annotation.body.service?.length),
          service: annotation.body.service,
        },
        loading: false,
      })),
    ),
    manualSize: false,
  };
}

function resolveImportedThumbnail(manifest: Manifest, canvases: CanvasInput[]): ThumbnailChoice {
  const thumbnailId = manifest.thumbnail?.[0]?.id;
  if (!thumbnailId) return { mode: 'registered' };

  for (const canvas of canvases) {
    for (const image of canvas.images) {
      if (image.detected?.id === thumbnailId) {
        return { mode: 'registered', selectedImageId: image.id };
      }
    }
  }

  return { mode: 'custom', customUrl: thumbnailId };
}

function parseManifestImport(input: unknown): {
  baseUri: string | null;
  manifestLabel: LocalizedValues;
  canvases: CanvasInput[];
  thumbnailChoice: ThumbnailChoice;
} {
  const parsed = input as any;
  let manifest: Manifest | null = null;

  if (parsed?.type === 'Manifest' && Array.isArray(parsed.items)) {
    manifest = parsed as Manifest;
  } else if (parsed?.manifest?.type === 'Manifest' && Array.isArray(parsed.manifest.items)) {
    manifest = parsed.manifest as Manifest;
  } else if (Array.isArray(parsed?.items)) {
    manifest = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: '',
      type: 'Manifest',
      label: parsed.label || {},
      items: parsed.items,
      thumbnail: parsed.thumbnail,
    };
  }

  if (!manifest) {
    throw new Error('Manifest JSON ではありません。');
  }

  const baseUri = manifest.id ? getBaseUriFromManifestId(manifest.id) : null;
  const canvases = manifest.items.map(manifestCanvasToInput);
  const thumbnailChoice = resolveImportedThumbnail(manifest, canvases);

  return {
    baseUri,
    manifestLabel: manifest.label || {},
    canvases,
    thumbnailChoice,
  };
}

function PreviewPane({ manifest, currentCanvasIndex, onCanvasIndexChange }: { manifest?: Manifest; currentCanvasIndex: number; onCanvasIndexChange: (index: number) => void }) {
  const currentCanvas = manifest?.items[currentCanvasIndex];
  const annotations = currentCanvas?.items[0]?.items ?? [];

  const goToPrevious = () => {
    onCanvasIndexChange(Math.max(0, currentCanvasIndex - 1));
  };

  const goToNext = () => {
    onCanvasIndexChange(Math.min((manifest?.items.length ?? 1) - 1, currentCanvasIndex + 1));
  };

  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-600">プレビュー</div>
        {manifest?.items.length && manifest.items.length > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrevious}
              disabled={currentCanvasIndex === 0}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              ← 前
            </button>
            <span className="text-sm text-neutral-500">
              {currentCanvasIndex + 1} / {manifest.items.length}
            </span>
            <button
              type="button"
              onClick={goToNext}
              disabled={currentCanvasIndex === (manifest.items.length - 1)}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              次 →
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 overflow-hidden">
        {annotations.length > 0 ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {annotations.map((annotation, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={annotation.id}
                src={annotation.body.id}
                alt={`Layer ${index + 1}`}
                className="absolute max-h-[400px] max-w-full object-contain"
                style={{
                  zIndex: index,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-neutral-400">画像を登録するとここに表示されます</div>
        )}
      </div>
      {currentCanvas ? (
        <div className="mt-2 text-center text-xs text-neutral-500">
          Canvas {currentCanvas.label?.ja?.[0] || currentCanvas.label?.en?.[0] || currentCanvas.id.split('/').pop()}
        </div>
      ) : null}
    </div>
  );
}

function LocalizedInput({
  label,
  onChange,
  title,
}: {
  label: LocalizedValues;
  onChange: (next: LocalizedValues) => void;
  title: string;
}) {
  const [newLocale, setNewLocale] = useState('');

  const addLocale = () => {
    if (!newLocale.trim() || label[newLocale.trim()]) return;
    onChange({ ...label, [newLocale.trim()]: [''] });
    setNewLocale('');
  };

  const removeLocale = (locale: string) => {
    const next = { ...label };
    delete next[locale];
    onChange(next);
  };

  const updateValue = (locale: string, index: number, value: string) => {
    const values = [...(label[locale] ?? [''])];
    values[index] = value;
    onChange({ ...label, [locale]: values });
  };

  const addValue = (locale: string) => {
    onChange({ ...label, [locale]: [...(label[locale] ?? []), ''] });
  };

  const removeValue = (locale: string, index: number) => {
    const values = [...(label[locale] ?? [])];
    values.splice(index, 1);
    const next = { ...label };
    if (values.length) next[locale] = values;
    else delete next[locale];
    onChange(next);
  };

  const locales = Object.keys(label);

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex gap-2">
        <input
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value)}
          placeholder="言語コード (例: ja, en, fr)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addLocale}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          disabled={!newLocale.trim() || !!label[newLocale.trim()]}
        >
          言語を追加
        </button>
      </div>

      {locales.map((locale) => (
        <div key={locale} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase text-neutral-500">{locale}</div>
          </div>
          {(label[locale] ?? []).map((value, index) => (
            <div key={`${locale}-${index}`} className="flex gap-2">
              <input
                value={value}
                onChange={(e) => updateValue(locale, index, e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder={`${locale} label ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeValue(locale, index)}
                className="rounded-lg border border-red-300 px-3 text-sm text-red-600 hover:border-red-400 hover:text-red-700"
              >
                −
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addValue(locale)} className="rounded-lg border border-neutral-300 px-3 py-1 text-sm">
            値を追加
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const [baseUri, setBaseUri] = useState('https://example.org/iiif/book1/');
  const [manifestLabel, setManifestLabel] = useState<LocalizedValues>({ja: ['シンプルマニフェスト'] });
  const [canvases, setCanvases] = useState<CanvasInput[]>([createCanvas(1)]);
  const [thumbnailChoice, setThumbnailChoice] = useState<ThumbnailChoice>({ mode: 'registered' });
  const [manifestJson, setManifestJson] = useState('');
  const [error, setError] = useState<string>();
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string>();
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [currentCanvasIndex, setCurrentCanvasIndex] = useState(0);

  const registeredImages = useMemo(
    () => canvases.flatMap((canvas) => canvas.images.map((image) => ({ canvasNo: canvas.canvasNo, image }))).filter((entry) => entry.image.detected),
    [canvases],
  );

  useEffect(() => {
    try {
      const manifest = generateManifest(baseUri, manifestLabel, canvases, thumbnailChoice);
      setManifestJson(JSON.stringify(manifest, null, 2));
      setError(undefined);
    } catch (e) {
      setManifestJson('');
      setError(e instanceof Error ? e.message : 'manifest 生成に失敗しました。');
    }
  }, [baseUri, manifestLabel, canvases, thumbnailChoice]);

  const manifestPreview = useMemo(() => {
    if (!manifestJson) return undefined;
    try {
      return JSON.parse(manifestJson) as Manifest;
    } catch {
      return undefined;
    }
  }, [manifestJson]);

  const updateCanvas = (canvasId: string, updater: (canvas: CanvasInput) => CanvasInput) => {
    setCanvases((prev) => prev.map((canvas) => (canvas.id === canvasId ? updater(canvas) : canvas)));
  };

  const removeCanvas = (canvasId: string) => {
    const index = canvases.findIndex((c) => c.id === canvasId);
    setCanvases((prev) => {
      const filtered = prev.filter((canvas) => canvas.id !== canvasId);
      // Reassign canvasNo
      return filtered.map((canvas, idx) => ({ ...canvas, canvasNo: idx + 1 }));
    });
    // Adjust currentCanvasIndex if necessary
    if (index < currentCanvasIndex) {
      setCurrentCanvasIndex(currentCanvasIndex - 1);
    } else if (index === currentCanvasIndex && currentCanvasIndex >= canvases.length - 1) {
      setCurrentCanvasIndex(Math.max(0, canvases.length - 2));
    }
  };

  const addCanvas = () => {
    setCanvases((prev) => [...prev, createCanvas(prev.length + 1)]);
    setCurrentCanvasIndex((prev) => prev + 1);
  };

  const moveCanvasUp = (canvasId: string) => {
    setCanvases((prev) => {
      const index = prev.findIndex((c) => c.id === canvasId);
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((canvas, idx) => ({ ...canvas, canvasNo: idx + 1 }));
    });
  };

  const moveCanvasDown = (canvasId: string) => {
    setCanvases((prev) => {
      const index = prev.findIndex((c) => c.id === canvasId);
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((canvas, idx) => ({ ...canvas, canvasNo: idx + 1 }));
    });
  };

  const moveImageUp = (canvasId: string, imageId: string) => {
    updateCanvas(canvasId, (canvas) => {
      const images = [...canvas.images];
      const index = images.findIndex((img) => img.id === imageId);
      if (index <= 0) return canvas;
      [images[index - 1], images[index]] = [images[index], images[index - 1]];
      return { ...canvas, images };
    });
  };

  const moveImageDown = (canvasId: string, imageId: string) => {
    updateCanvas(canvasId, (canvas) => {
      const images = [...canvas.images];
      const index = images.findIndex((img) => img.id === imageId);
      if (index >= images.length - 1) return canvas;
      [images[index], images[index + 1]] = [images[index + 1], images[index]];
      return { ...canvas, images };
    });
  };

  const detectImage = async (canvasId: string, imageId: string) => {
    const canvas = canvases.find((v) => v.id === canvasId);
    const image = canvas?.images.find((v) => v.id === imageId);
    if (!image?.imageUrl.trim()) return;

    updateCanvas(canvasId, (current) => ({
      ...current,
      images: current.images.map((img) => (img.id === imageId ? { ...img, loading: true, error: undefined } : img)),
    }));

    try {
      const detected = await detectIiifImage(image.imageUrl);
      updateCanvas(canvasId, (current) => ({
        ...current,
        images: current.images.map((img) => (img.id === imageId ? { ...img, loading: false, detected, error: undefined } : img)),
      }));
    } catch (e) {
      updateCanvas(canvasId, (current) => ({
        ...current,
        images: current.images.map((img) => (
          img.id === imageId ? { ...img, loading: false, detected: undefined, error: e instanceof Error ? e.message : '取得失敗' } : img
        )),
      }));
    }
  };

  const downloadManifest = () => {
    if (!manifestJson) return;
    const blob = new Blob([manifestJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const copyManifest = async () => {
    if (!manifestJson) return;
    await navigator.clipboard.writeText(manifestJson);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const importManifestJson = async (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const result = parseManifestImport(parsed);
      setManifestLabel(result.manifestLabel);
      setCanvases(result.canvases);
      setThumbnailChoice(result.thumbnailChoice);
      if (result.baseUri) setBaseUri(result.baseUri);
      setCurrentCanvasIndex(0);
      setImportError(undefined);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 2000);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '読み込みに失敗しました。');
      setImportSuccess(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importManifestJson(text);
    event.target.value = '';
  };

  const handleImportText = async () => {
    await importManifestJson(importText);
  };

  return (
    <main className="h-screen bg-neutral-100 p-6 text-neutral-900 overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_520px] h-full">
        <div className="space-y-6 overflow-y-auto">
          <h1 className="text-2xl font-semibold">IIIF Manifest生成ページ</h1>
          <PreviewPane manifest={manifestPreview} currentCanvasIndex={currentCanvasIndex} onCanvasIndexChange={setCurrentCanvasIndex} />
          <div className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-medium">生成結果</div>
            {error ? <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {copySuccess ? <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">コピーしました</div> : null}
            {downloadSuccess ? <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">ダウンロードしました</div> : null}
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={copyManifest} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                Copy
              </button>
              <button type="button" onClick={downloadManifest} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                Download
              </button>
            </div>
            <textarea value={manifestJson} readOnly className="min-h-[420px] w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 font-mono text-sm" />
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto">
          <div className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-medium">Manifest インポート</div>
            <input type="file" accept="application/json" onChange={handleImportFile} className="mb-3 block w-full text-sm text-neutral-700" />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Manifest JSON を貼り付けてください"
              className="mb-3 h-28 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
            />
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={handleImportText} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                読み込む
              </button>
              <button type="button" onClick={() => setImportText('')} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                クリア
              </button>
            </div>
            {importError ? <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{importError}</div> : null}
            {importSuccess ? <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">読み込みました</div> : null}
            <label className="mb-2 block text-sm font-medium">ベースURI</label>
            <input
              value={baseUri}
              onChange={(e) => setBaseUri(e.target.value)}
              placeholder="https://example.org/iiif/book1/"
              className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <LocalizedInput title="Manifest Label" label={manifestLabel} onChange={setManifestLabel} />
          </div>

          {canvases.map((canvas, canvasIndex) => (
            <section key={canvas.id} className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm cursor-pointer" onClick={() => setCurrentCanvasIndex(canvasIndex)}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">キャンバス {canvas.canvasNo}</h2>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-neutral-500">ID: /canvas/p{canvas.canvasNo}</div>
                  {canvases.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => moveCanvasUp(canvas.id)}
                        disabled={canvasIndex === 0}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCanvasDown(canvas.id)}
                        disabled={canvasIndex === canvases.length - 1}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCanvas(canvas.id)}
                        className="rounded-lg border border-red-300 px-3 text-sm text-red-600 hover:border-red-400 hover:text-red-700"
                      >
                        −
                      </button>
                    </>
                  )}
                </div>
              </div>

              <LocalizedInput
                title="Canvas Label"
                label={canvas.label}
                onChange={(next) => updateCanvas(canvas.id, (current) => ({ ...current, label: next }))}
              />

              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <div className="mb-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={canvas.manualSize}
                      onChange={(e) => {
                        const computed = getCanvasComputedSize(canvas);
                        updateCanvas(canvas.id, (current) => ({
                          ...current,
                          manualSize: e.target.checked,
                          manualWidth: e.target.checked
                            ? current.manualWidth ?? computed?.width
                            : current.manualWidth,
                          manualHeight: e.target.checked
                            ? current.manualHeight ?? computed?.height
                            : current.manualHeight,
                        }));
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-600"
                    />
                    手動サイズを有効にする
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>幅</span>
                    <input
                      type="number"
                      value={canvas.manualWidth ?? getCanvasComputedSize(canvas)?.width ?? ''}
                      onChange={(e) =>
                        updateCanvas(canvas.id, (current) => ({
                          ...current,
                            manualWidth: e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      disabled={!canvas.manualSize}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>高さ</span>
                    <input
                      type="number"
                      value={canvas.manualHeight ?? getCanvasComputedSize(canvas)?.height ?? ''}
                      onChange={(e) =>
                        updateCanvas(canvas.id, (current) => ({
                          ...current,
                            manualHeight: e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      disabled={!canvas.manualSize}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100"
                    />
                  </label>
                </div>
                {!canvas.manualSize ? (
                  <div className="mt-3 text-xs text-neutral-500">
                    自動検出サイズ: {getCanvasComputedSize(canvas)?.width ?? '-'} × {getCanvasComputedSize(canvas)?.height ?? '-'}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {canvas.images.map((image, imageIndex) => (
                  <div key={image.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium">画像 {imageIndex + 1}</div>
                      {canvas.images.length > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveImageUp(canvas.id, image.id)}
                            disabled={imageIndex === 0}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImageDown(canvas.id, image.id)}
                            disabled={imageIndex === canvas.images.length - 1}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      value={image.imageUrl}
                      onChange={(e) =>
                        updateCanvas(canvas.id, (current) => ({
                          ...current,
                          images: current.images.map((img) => (img.id === image.id ? { ...img, imageUrl: e.target.value } : img)),
                        }))
                      }
                      onBlur={() => void detectImage(canvas.id, image.id)}
                      placeholder="画像 URL"
                      className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void detectImage(canvas.id, image.id)}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        {image.loading ? '判定中...' : 'IIIF 判定'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCanvas(canvas.id, (current) => ({
                            ...current,
                            images: current.images.filter((img) => img.id !== image.id),
                          }))
                        }
                        className="rounded-lg border border-red-300 px-3 text-sm text-red-600 hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                        disabled={canvas.images.length === 1}
                      >
                        −
                      </button>
                    </div>
                    {image.error ? <div className="text-sm text-red-600">{image.error}</div> : null}
                    {image.detected ? (
                      <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                        <div>判定: {image.detected.isIiif ? 'IIIF 対応' : '非 IIIF'}</div>
                        <div>size: {image.detected.width} × {image.detected.height}</div>
                        <div>page: /page/p{canvas.canvasNo}/1</div>
                        {image.detected.isIiif && image.detected.service?.[0] ? <div>service: {image.detected.service[0].id}</div> : null}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => updateCanvas(canvas.id, (current) => ({ ...current, images: [...current.images, createCanvasImage()] }))}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
                >
                  + 画像を追加
                </button>
              </div>
            </section>
          ))}

          <button type="button" onClick={addCanvas} className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-lg shadow-sm">
            + キャンバス追加
          </button>

          <section className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">サムネイル</h2>
            <div className="mb-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="thumbnail-mode"
                  checked={thumbnailChoice.mode === 'registered'}
                  onChange={() => setThumbnailChoice({ mode: 'registered', selectedImageId: registeredImages[0]?.image.id })}
                />
                登録済み画像から選ぶ
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="thumbnail-mode"
                  checked={thumbnailChoice.mode === 'custom'}
                  onChange={() => setThumbnailChoice({ mode: 'custom', customUrl: '' })}
                />
                別 URL を使う
              </label>
            </div>

            {thumbnailChoice.mode === 'registered' ? (
              <>
                <select
                  value={thumbnailChoice.selectedImageId ?? ''}
                  onChange={(e) => setThumbnailChoice({ mode: 'registered', selectedImageId: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">選択してください</option>
                  {registeredImages.map(({ canvasNo, image }, index) => (
                    <option key={image.id} value={image.id}>
                      Canvas {canvasNo} / 画像 {index + 1} / {image.detected?.id}
                    </option>
                  ))}
                </select>
                {thumbnailChoice.selectedImageId && (() => {
                  const selected = registeredImages.find(({ image }) => image.id === thumbnailChoice.selectedImageId)?.image;
                  return selected?.imageUrl ? (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selected.imageUrl} alt="thumbnail preview" className="h-20 w-full rounded object-contain" />
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                <input
                  value={thumbnailChoice.customUrl ?? ''}
                  onChange={(e) => setThumbnailChoice({ mode: 'custom', customUrl: e.target.value })}
                  placeholder="thumbnail URL"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                {thumbnailChoice.customUrl?.trim() && (
                  <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnailChoice.customUrl} alt="thumbnail preview" className="h-20 w-full rounded object-contain" onError={() => {}} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
