const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileLooksAllowed(file: File): boolean {
  if (ALLOWED_MIME.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
}

export function validateOdometerPhoto(file: File): string | null {
  if (file.size > MAX_BYTES) return 'Foto excede 5 MB.';
  if (!fileLooksAllowed(file)) return 'Formato inválido. Use JPEG, PNG ou WebP.';
  return null;
}
