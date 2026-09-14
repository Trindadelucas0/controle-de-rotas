import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateOdometerPhoto } from './odometer-photo';

describe('validateOdometerPhoto', () => {
  it('aceita JPEG pequeno', () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'odo.jpg', { type: 'image/jpeg' });
    assert.equal(validateOdometerPhoto(file), null);
  });

  it('aceita extensão jpeg sem MIME', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'painel.JPEG', { type: '' });
    assert.equal(validateOdometerPhoto(file), null);
  });

  it('recusa HEIC', () => {
    const file = new File([new Uint8Array([1])], 'foto.heic', { type: 'image/heic' });
    assert.equal(validateOdometerPhoto(file), 'Formato inválido. Use JPEG, PNG ou WebP.');
  });

  it('recusa arquivo maior que 5 MB', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'odo.jpg', { type: 'image/jpeg' });
    assert.equal(validateOdometerPhoto(file), 'Foto excede 5 MB.');
  });
});
