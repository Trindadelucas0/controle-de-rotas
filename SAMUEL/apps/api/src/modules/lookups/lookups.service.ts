import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { httpError } from '../../common/errors/http-error';

const UA = 'Rotas/1.0 (operacoes-externas; contato-dev@local)';
const FETCH_MS = 8000;
const TTL_CNPJ_CEP = 60 * 60 * 24;
const TTL_ADDRESS = 60 * 10;

export type CnpjLookupResult = {
  document: string;
  name: string;
  tradeName: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export type CepLookupResult = {
  zipCode: string;
  street: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type AddressSuggestion = {
  label: string;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number;
  longitude: number;
};

type BrasilCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  ddd_telefone_1?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
};

type BrasilCepV2 = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  location?: {
    coordinates?: { latitude?: string | number; longitude?: string | number };
  };
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
  };
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function emptyToNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

@Injectable()
export class LookupsService {
  constructor(private readonly redis: RedisService) {}

  async lookupCnpj(raw: string): Promise<{ company: CnpjLookupResult }> {
    const cnpj = digitsOnly(raw);
    if (cnpj.length !== 14) {
      throw httpError(
        HttpStatus.BAD_REQUEST,
        'CNPJ_INVALID',
        'Informe um CNPJ com 14 dígitos.',
      );
    }

    const cacheKey = `lookup:cnpj:${cnpj}`;
    const cached = await this.redis.getJson<CnpjLookupResult>(cacheKey);
    if (cached) return { company: cached };

    const data = await this.fetchJson<BrasilCnpj>(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      'CNPJ',
    );

    const company: CnpjLookupResult = {
      document: cnpj,
      name: emptyToNull(data.razao_social) || 'Empresa',
      tradeName: emptyToNull(data.nome_fantasia),
      phone: emptyToNull(data.ddd_telefone_1),
      email: emptyToNull(data.email)?.toLowerCase() ?? null,
      street: emptyToNull(data.logradouro),
      number: emptyToNull(data.numero),
      complement: emptyToNull(data.complemento),
      district: emptyToNull(data.bairro),
      city: emptyToNull(data.municipio),
      state: emptyToNull(data.uf)?.toUpperCase() ?? null,
      zipCode: emptyToNull(digitsOnly(data.cep || '')) || null,
    };

    await this.redis.setJson(cacheKey, company, TTL_CNPJ_CEP);
    return { company };
  }

  async lookupCep(raw: string): Promise<{ address: CepLookupResult }> {
    const cep = digitsOnly(raw);
    if (cep.length !== 8) {
      throw httpError(HttpStatus.BAD_REQUEST, 'CEP_INVALID', 'Informe um CEP com 8 dígitos.');
    }

    const cacheKey = `lookup:cep:${cep}`;
    const cached = await this.redis.getJson<CepLookupResult>(cacheKey);
    if (cached) return { address: cached };

    const data = await this.fetchJson<BrasilCepV2>(
      `https://brasilapi.com.br/api/cep/v2/${cep}`,
      'CEP',
    );

    const latRaw = data.location?.coordinates?.latitude;
    const lngRaw = data.location?.coordinates?.longitude;
    const latitude =
      latRaw != null && String(latRaw).trim() !== '' ? Number(latRaw) : null;
    const longitude =
      lngRaw != null && String(lngRaw).trim() !== '' ? Number(lngRaw) : null;

    const address: CepLookupResult = {
      zipCode: cep,
      street: emptyToNull(data.street),
      district: emptyToNull(data.neighborhood),
      city: emptyToNull(data.city),
      state: emptyToNull(data.state)?.toUpperCase() ?? null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    };

    await this.redis.setJson(cacheKey, address, TTL_CNPJ_CEP);
    return { address };
  }

  async searchAddress(q: string): Promise<{ suggestions: AddressSuggestion[] }> {
    const query = q.trim();
    if (query.length < 3) {
      throw httpError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_QUERY_SHORT',
        'Digite ao menos 3 caracteres para buscar endereço.',
      );
    }

    const cacheKey = `lookup:address:${query.toLowerCase()}`;
    const cached = await this.redis.getJson<AddressSuggestion[]>(cacheKey);
    if (cached) return { suggestions: cached };

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'br');

    let items: NominatimItem[] = [];
    try {
      const res = await this.fetchWithTimeout(url.toString());
      if (res.status === 429) {
        throw httpError(
          HttpStatus.TOO_MANY_REQUESTS,
          'LOOKUP_RATE_LIMIT',
          'Muitas buscas de endereço. Aguarde e tente de novo.',
        );
      }
      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }
      items = (await res.json()) as NominatimItem[];
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw httpError(
        HttpStatus.BAD_GATEWAY,
        'ADDRESS_LOOKUP_FAILED',
        'Falha ao consultar sugestões de endereço.',
      );
    }

    const suggestions: AddressSuggestion[] = items.map((item) => {
      const a = item.address || {};
      const stateRaw = emptyToNull(a.state);
      const state =
        stateRaw && stateRaw.length === 2 ? stateRaw.toUpperCase() : null;
      return {
        label: item.display_name,
        street: emptyToNull(a.road || a.pedestrian),
        number: emptyToNull(a.house_number),
        district: emptyToNull(a.suburb || a.neighbourhood),
        city: emptyToNull(a.city || a.town || a.village || a.municipality),
        state,
        zipCode: emptyToNull(digitsOnly(a.postcode || '')) || null,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      };
    });

    await this.redis.setJson(cacheKey, suggestions, TTL_ADDRESS);
    return { suggestions };
  }

  private async fetchJson<T>(url: string, kind: 'CNPJ' | 'CEP'): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchWithTimeout(url);
    } catch {
      throw httpError(
        HttpStatus.BAD_GATEWAY,
        `${kind}_LOOKUP_FAILED`,
        `Falha ao consultar ${kind} na BrasilAPI.`,
      );
    }

    if (res.status === 404) {
      throw httpError(
        HttpStatus.NOT_FOUND,
        `${kind}_NOT_FOUND`,
        kind === 'CNPJ' ? 'CNPJ não encontrado.' : 'CEP não encontrado.',
      );
    }
    if (res.status === 429) {
      throw httpError(
        HttpStatus.TOO_MANY_REQUESTS,
        'LOOKUP_RATE_LIMIT',
        'Muitas consultas. Aguarde e tente de novo.',
      );
    }
    if (!res.ok) {
      throw httpError(
        HttpStatus.BAD_GATEWAY,
        `${kind}_LOOKUP_FAILED`,
        `Falha ao consultar ${kind} na BrasilAPI.`,
      );
    }

    return (await res.json()) as T;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_MS);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
