const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE_COUNT = 5;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function assertEvidenceCount(current: number) {
  if (current >= MAX_EVIDENCE_COUNT) {
    return {
      ok: false as const,
      code: 'VISIT_EVIDENCE_LIMIT',
      message: `Máximo de ${MAX_EVIDENCE_COUNT} fotos por visita.`,
    };
  }
  return { ok: true as const };
}

export function validateEvidenceUpload(file: Express.Multer.File | undefined) {
  if (!file || !file.buffer?.length) {
    return {
      ok: false as const,
      code: 'VISIT_EVIDENCE_REQUIRED',
      message: 'Arquivo de foto é obrigatório.',
    };
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return {
      ok: false as const,
      code: 'VISIT_EVIDENCE_TOO_LARGE',
      message: 'Foto excede 5 MB.',
    };
  }
  const detected = detectImageMime(file.buffer);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    return {
      ok: false as const,
      code: 'VISIT_EVIDENCE_INVALID_TYPE',
      message: 'Formato inválido. Use JPEG, PNG ou WebP.',
    };
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return {
      ok: false as const,
      code: 'VISIT_EVIDENCE_INVALID_TYPE',
      message: 'Formato inválido. Use JPEG, PNG ou WebP.',
    };
  }
  return {
    ok: true as const,
    mimeType: detected,
    ext: mimeToExt(detected),
  };
}

function detectImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}

export { MAX_EVIDENCE_COUNT };
