const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const MIME_JPEG = 'image/jpeg';

export async function compressFieldPhoto(file: File): Promise<File> {
  const n = file.name.toLowerCase();
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    n.endsWith('.heic') ||
    n.endsWith('.heif')
  ) {
    throw new Error('Formato inválido. Use JPEG, PNG ou WebP.');
  }
  const bitmap = await decodeToBitmap(file);
  try {
    let { width, height } = bitmap;
    if (width < 1 || height < 1) {
      throw new Error('Foto inválida.');
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a foto.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_BYTES) {
        return new File([blob], jpegName(file.name), { type: MIME_JPEG });
      }
    }
    throw new Error('Foto excede 5 MB.');
  } finally {
    bitmap.close?.();
  }
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'foto';
  return `${base}.jpg`;
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a foto.');
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato inválido. Use JPEG, PNG ou WebP.'));
    img.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Não foi possível processar a foto.'));
        else resolve(blob);
      },
      MIME_JPEG,
      quality,
    );
  });
}
