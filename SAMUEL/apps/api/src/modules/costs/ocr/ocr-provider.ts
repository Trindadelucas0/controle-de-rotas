/** Gancho OCR: nenhum motor nesta entrega. */
export type OcrExtractResult = {
  value: string;
  confidence: number;
} | null;

export interface OcrProvider {
  extractFromImage(_buffer: Buffer): Promise<OcrExtractResult>;
}

export class NoopOcrProvider implements OcrProvider {
  async extractFromImage(_buffer: Buffer): Promise<OcrExtractResult> {
    return null;
  }
}

export const ocrProvider: OcrProvider = new NoopOcrProvider();
