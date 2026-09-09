'use client';



import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import { useParams, useRouter } from 'next/navigation';

import { apiFetch, apiUpload, ApiError } from '@/lib/api-client';

import {

  geolocationErrorMessage,

  isInsecureGeolocationContext,

  requestCurrentPosition,

} from '@/lib/field-tracking';

import {

  clearTrackStorage,

  trailPointsPayload,

  trailSnapshotCount,

} from '@/lib/field-track-queue';

import {

  VISIT_OUTCOME_LABELS,

  VISIT_STATUS_LABELS,

  fromDatetimeLocalValue,

  labelOf,

  toDatetimeLocalValue,

} from '@/lib/ops-labels';



type VisitOutcome = 'DONE' | 'NO_CONTACT' | 'REFUSED' | 'FOLLOW_UP';



type EvidenceItem = {

  id: string;

  mimeType: string;

  sizeBytes: number;

  caption: string | null;

  originalName: string | null;

  createdAt: string;

};



type VisitPayload = {

  visit: {

    id: string;

    status: string;

    street?: string | null;

    number?: string | null;

    complement?: string | null;

    district?: string | null;

    city?: string | null;

    state?: string | null;

    zipCode?: string | null;

    notes?: string | null;

    outcome?: VisitOutcome | null;

    executionNotes?: string | null;

    checkedInAt?: string | null;

    checkedOutAt?: string | null;

    checkedInLat?: number | null;

    checkedInLng?: number | null;

    checkedInAccuracy?: number | null;

    customer?: { id: string; name: string; tradeName?: string | null } | null;

    serviceOrder?: { id: string; number: number; title: string } | null;

    routeStop?: {

      id: string;

      sequence: number;

      status: string;

      routeId?: string;

      route?: { id: string; recordTrip?: boolean; status?: string } | null;

    } | null;

    evidence?: EvidenceItem[];

  };

};



const OUTCOME_OPTIONS: { value: VisitOutcome; label: string }[] = [

  { value: 'DONE', label: 'Realizada' },

  { value: 'NO_CONTACT', label: 'Cliente ausente' },

  { value: 'REFUSED', label: 'Sem interesse' },

  { value: 'FOLLOW_UP', label: 'Precisa retorno' },

];



function formatAddress(v: VisitPayload['visit']): string {

  const line1 = [v.street, v.number].filter(Boolean).join(', ');

  const line2 = [v.district, [v.city, v.state].filter(Boolean).join('/')].filter(Boolean).join(' · ');

  const zip = v.zipCode ? `CEP ${v.zipCode}` : '';

  return [line1, line2, zip, v.complement].filter(Boolean).join('\n') || 'Endereço não informado';

}



function formatCheckedIn(iso: string | null | undefined): string {

  if (!iso) return '';

  return new Date(iso).toLocaleString('pt-BR', {

    day: '2-digit',

    month: '2-digit',

    hour: '2-digit',

    minute: '2-digit',

  });

}



function evidenceFileUrl(visitId: string, evidenceId: string): string {

  return `/api/v1/visits/${visitId}/evidence/${evidenceId}/file`;

}



export function FieldVisitPage() {

  const params = useParams<{ id: string }>();

  const router = useRouter();

  const visitId = params?.id;

  const fileInputRef = useRef<HTMLInputElement>(null);



  const [visit, setVisit] = useState<VisitPayload['visit'] | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [forbidden, setForbidden] = useState(false);

  const [checkingIn, setCheckingIn] = useState(false);

  const [checkInError, setCheckInError] = useState<string | null>(null);

  const [checkedIn, setCheckedIn] = useState(false);

  const [trailWarnAck, setTrailWarnAck] = useState(false);

  const [trailMsg, setTrailMsg] = useState<string | null>(null);



  const [outcome, setOutcome] = useState<VisitOutcome>('DONE');

  const [executionNotes, setExecutionNotes] = useState('');

  const [scheduleNext, setScheduleNext] = useState(false);

  const [nextVisitStart, setNextVisitStart] = useState('');

  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);

  const [finishing, setFinishing] = useState(false);

  const [finishError, setFinishError] = useState<string | null>(null);

  const [finished, setFinished] = useState(false);



  const load = useCallback(async () => {

    if (!visitId) return;

    setLoading(true);

    setError(null);

    setForbidden(false);

    try {

      const r = await apiFetch<VisitPayload>(`/api/v1/visits/${visitId}`);

      setVisit(r.visit);

      const hasCheckIn = Boolean(r.visit.checkedInAt);

      setCheckedIn(hasCheckIn);

      setFinished(Boolean(r.visit.checkedOutAt));

      if (r.visit.outcome) setOutcome(r.visit.outcome);

      if (r.visit.executionNotes) setExecutionNotes(r.visit.executionNotes);

    } catch (e) {

      if (e instanceof ApiError && e.status === 403) {

        setForbidden(true);

        setError(e.message);

      } else {

        setError(e instanceof ApiError ? e.message : 'Falha ao carregar a visita.');

      }

    } finally {

      setLoading(false);

    }

  }, [visitId]);



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    if (outcome === 'FOLLOW_UP') {

      setScheduleNext(true);

    }

  }, [outcome]);



  const alreadyIn = Boolean(visit?.checkedInAt);

  const canCheckIn = Boolean(

    visit && !alreadyIn && !finished && (visit.status === 'ASSIGNED' || visit.status === 'IN_ROUTE'),

  );

  const evidence = visit?.evidence ?? [];

  const address = useMemo(() => (visit ? formatAddress(visit) : ''), [visit]);

  const notesRequired = outcome !== 'DONE';

  const photoRequired = outcome === 'DONE';

  const nextRequired = outcome === 'FOLLOW_UP' || scheduleNext;



  async function handleCheckIn() {

    if (!visitId || checkingIn) return;

    setCheckInError(null);

    const routeId = visit?.routeStop?.route?.id ?? visit?.routeStop?.routeId;

    const recording = Boolean(visit?.routeStop?.route?.recordTrip);

    if (recording && routeId && trailSnapshotCount(routeId) < 2 && !trailWarnAck) {

      setTrailWarnAck(true);

      setCheckInError(

        'Poucos pontos GPS — a trilha pode ficar incompleta. Toque de novo em Cheguei para confirmar.',

      );

      return;

    }

    setCheckingIn(true);

    try {

      if (!navigator.geolocation) {

        setCheckInError('GPS indisponível neste dispositivo. O check-in precisa da sua localização.');

        return;

      }

      if (isInsecureGeolocationContext()) {

        setCheckInError(

          'GPS bloqueado em HTTP. No iPhone use HTTPS (túnel) ou teste em localhost no computador.',

        );

        return;

      }

      const pos = await requestCurrentPosition();

      const trailPoints = routeId ? trailPointsPayload(routeId) : [];

      const r = await apiFetch<

        VisitPayload & { accessPath?: { saved: boolean; reason?: string } }

      >(`/api/v1/visits/${visitId}/check-in`, {

        method: 'POST',

        body: JSON.stringify({

          latitude: pos.coords.latitude,

          longitude: pos.coords.longitude,

          accuracy: pos.coords.accuracy ?? 0,

          ...(trailPoints.length ? { trailPoints } : {}),

        }),

      });

      setVisit(r.visit);

      setCheckedIn(true);

      if (recording) {

        if (r.accessPath?.saved) {

          setTrailMsg('Trilha gravada');

          if (routeId) clearTrackStorage(routeId);

        } else {

          setTrailMsg('Trilha não gravada — será tentada ao finalizar a visita.');

        }

      }

    } catch (e) {

      if (e instanceof ApiError && e.code === 'VISIT_ALREADY_CHECKED_IN') {

        setCheckedIn(true);

        setCheckInError(null);

        void load();

        return;

      }

      if (e instanceof ApiError) {

        setCheckInError(e.message);

      } else if (e && typeof e === 'object' && 'code' in e) {

        setCheckInError(geolocationErrorMessage(e as GeolocationPositionError));

      } else if (e instanceof Error) {

        setCheckInError(e.message);

      } else {

        setCheckInError('Não foi possível obter o GPS para o check-in.');

      }

    } finally {

      setCheckingIn(false);

    }

  }



  async function handleUploadPhoto(file: File) {

    if (!visitId || uploading) return;

    setUploadError(null);

    setUploading(true);

    try {

      const pos = await requestCurrentPosition().catch(() => null);

      const form = new FormData();

      form.append('file', file);

      if (pos) {

        form.append('latitude', String(pos.coords.latitude));

        form.append('longitude', String(pos.coords.longitude));

        form.append('accuracy', String(pos.coords.accuracy ?? 0));

      }

      await apiUpload<{ evidence: EvidenceItem }>(`/api/v1/visits/${visitId}/evidence`, form);

      await load();

    } catch (e) {

      setUploadError(e instanceof ApiError ? e.message : 'Falha ao enviar foto.');

    } finally {

      setUploading(false);

    }

  }



  async function handleFinish() {

    if (!visitId || finishing || finished) return;

    setFinishError(null);



    if (notesRequired && !executionNotes.trim()) {

      setFinishError('Observações são obrigatórias para este resultado.');

      return;

    }

    if (photoRequired && evidence.length < 1) {

      setFinishError('Adicione pelo menos uma foto para visita realizada.');

      return;

    }

    if (nextRequired && !nextVisitStart.trim()) {

      setFinishError('Informe a data da próxima visita.');

      return;

    }



    setFinishing(true);

    try {

      if (!navigator.geolocation) {

        setFinishError('GPS indisponível. Finalizar exige localização.');

        return;

      }

      if (isInsecureGeolocationContext()) {

        setFinishError('GPS bloqueado em HTTP. Use HTTPS ou localhost no PC.');

        return;

      }

      const pos = await requestCurrentPosition();

      const nextIso = nextRequired ? fromDatetimeLocalValue(nextVisitStart) : undefined;

      if (nextRequired && !nextIso) {

        setFinishError('Data da próxima visita inválida.');

        return;

      }

      const routeId = visit?.routeStop?.route?.id ?? visit?.routeStop?.routeId;

      const trailPoints = routeId ? trailPointsPayload(routeId) : [];

      const recording = Boolean(visit?.routeStop?.route?.recordTrip);

      const out = await apiFetch<{

        visit: VisitPayload['visit'];

        accessPath?: { saved: boolean; reason?: string };

      }>(`/api/v1/visits/${visitId}/check-out`, {

        method: 'POST',

        body: JSON.stringify({

          latitude: pos.coords.latitude,

          longitude: pos.coords.longitude,

          accuracy: pos.coords.accuracy ?? 0,

          outcome,

          executionNotes: executionNotes.trim() || undefined,

          ...(trailPoints.length ? { trailPoints } : {}),

          ...(nextIso

            ? {

                nextVisit: {

                  scheduledStart: nextIso,

                },

              }

            : {}),

        }),

      });

      if (recording && out.accessPath?.saved && routeId) {

        clearTrackStorage(routeId);

      }

      setFinished(true);

      router.push('/field/navigate');

    } catch (e) {

      setFinishError(e instanceof ApiError ? e.message : 'Não foi possível finalizar a visita.');

    } finally {

      setFinishing(false);

    }

  }



  if (loading) {

    return (

      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-[#121212] px-6 text-center text-sm text-white/70">

        <p>Carregando visita…</p>

      </div>

    );

  }



  if (forbidden) {

    return (

      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[#121212] px-6 text-center">

        <p className="text-xl font-semibold text-white">Sem permissão</p>

        <p className="text-sm text-white/70" role="alert">

          {error ?? 'Você não pode ver esta visita.'}

        </p>

        <Link

          href="/field/navigate"

          className="ops-btn ops-btn-primary"

        >

          Voltar à navegação

        </Link>

      </div>

    );

  }



  if (error || !visit) {

    return (

      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[#121212] px-6 text-center">

        <p className="text-xl font-semibold text-white">Visita</p>

        <p className="text-sm text-white/70" role="alert">

          {error ?? 'Visita não encontrada.'}

        </p>

        <div className="flex flex-wrap justify-center gap-2">

          <button

            type="button"

            onClick={() => void load()}

            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white"

          >

            Tentar de novo

          </button>

          <button

            type="button"

            onClick={() => router.push('/field/navigate')}

            className="ops-btn ops-btn-primary"

          >

            Voltar à navegação

          </button>

        </div>

      </div>

    );

  }



  const customerName = visit.customer?.tradeName || visit.customer?.name || 'Cliente';



  return (

    <div className="flex h-full min-h-0 flex-col overflow-auto bg-[#121212] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white">

      <div className="mx-auto w-full max-w-md">

        <div className="flex items-center justify-between gap-2">

          <p className="ops-label mb-0">Visita</p>

          <Link

            href="/field/navigate"

            className="ops-link text-xs"

          >

            Voltar à navegação

          </Link>

        </div>



        <h1 className="mt-3 text-2xl font-semibold leading-tight">{customerName}</h1>

        {visit.serviceOrder ? (

          <p className="mt-1 text-sm text-white/60">

            OS #{visit.serviceOrder.number} · {visit.serviceOrder.title}

          </p>

        ) : null}



        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80">{address}</p>



        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">

          Status: {labelOf(VISIT_STATUS_LABELS, visit.status)}

        </p>



        {!checkedIn && !finished ? (

          <div className="mt-6">

            {checkInError ? (

              <p

                className={`mb-3 rounded-xl border px-3 py-2 text-sm ${

                  trailWarnAck

                    ? 'border-amber-400/40 bg-amber-950/70 text-amber-100'

                    : 'border-red-400/40 bg-red-950/70 text-red-100'

                }`}

                role="alert"

              >

                {checkInError}

              </p>

            ) : (

              <p className="mb-3 text-sm text-white/65">

                Toque em Cheguei para registrar a chegada verificada com GPS.

              </p>

            )}

            <button

              type="button"

              onClick={() => void handleCheckIn()}

              disabled={checkingIn || !canCheckIn}

              className="ops-btn ops-btn-primary w-full py-3 text-base"

            >

              {checkingIn ? 'Registrando…' : 'Cheguei — chegada verificada'}

            </button>

          </div>

        ) : null}



        {checkedIn && !finished ? (

          <div className="mt-6 space-y-5">

            <div

              className="rounded-[10px] border border-[var(--ok)]/35 bg-[var(--ok-bg)] px-4 py-4"

              role="status"

            >

              <p className="text-sm font-semibold text-brand-900">Chegada verificada</p>

              {trailMsg ? (

                <p className="mt-1 text-sm text-[var(--ok)]" role="status">

                  {trailMsg}

                </p>

              ) : null}

              <p className="mt-1 text-sm text-[var(--muted)]">

                {visit.checkedInAt

                  ? `Registrada às ${formatCheckedIn(visit.checkedInAt)}.`

                  : 'Check-in concluído.'}

              </p>

            </div>



            <fieldset className="space-y-2">

              <legend className="text-sm font-semibold text-white">Resultado da visita</legend>

              {OUTCOME_OPTIONS.map((opt) => (

                <label

                  key={opt.value}

                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"

                >

                  <input

                    type="radio"

                    name="outcome"

                    value={opt.value}

                    checked={outcome === opt.value}

                    onChange={() => setOutcome(opt.value)}

                    className="h-4 w-4 accent-amber-400"

                  />

                  {opt.label}

                </label>

              ))}

            </fieldset>



            <label className="block text-sm">

              <span className="mb-1 block font-semibold text-white">

                Observações{notesRequired ? ' *' : ''}

              </span>

              <textarea

                value={executionNotes}

                onChange={(e) => setExecutionNotes(e.target.value)}

                rows={4}

                maxLength={2000}

                placeholder="Detalhes do atendimento, objeções, próximos passos…"

                className="ops-input"

              />

            </label>



            <div>

              <div className="flex items-center justify-between gap-2">

                <p className="text-sm font-semibold text-white">

                  Fotos{photoRequired ? ' *' : ''} ({evidence.length}/5)

                </p>

                <button

                  type="button"

                  disabled={uploading || evidence.length >= 5}

                  onClick={() => fileInputRef.current?.click()}

                  className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"

                >

                  {uploading ? 'Enviando…' : 'Adicionar foto'}

                </button>

              </div>

              <input

                ref={fileInputRef}

                type="file"

                accept="image/jpeg,image/png,image/webp"

                capture="environment"

                className="sr-only"

                onChange={(e) => {

                  const file = e.target.files?.[0];

                  if (file) void handleUploadPhoto(file);

                  e.target.value = '';

                }}

              />

              {uploadError ? (

                <p className="mt-2 text-sm text-red-200" role="alert">

                  {uploadError}

                </p>

              ) : null}

              {evidence.length > 0 ? (

                <ul className="mt-3 grid grid-cols-3 gap-2">

                  {evidence.map((ev) => (

                    <li key={ev.id} className="overflow-hidden rounded-lg border border-white/20">

                      {/* eslint-disable-next-line @next/next/no-img-element */}

                      <img

                        src={evidenceFileUrl(visit.id, ev.id)}

                        alt={ev.caption || 'Foto da visita'}

                        className="aspect-square h-full w-full object-cover"

                      />

                    </li>

                  ))}

                </ul>

              ) : (

                <p className="mt-2 text-xs text-white/50">JPEG, PNG ou WebP — até 5 MB cada.</p>

              )}

            </div>



            {outcome !== 'FOLLOW_UP' ? (

              <label className="flex items-center gap-2 text-sm text-white/90">

                <input

                  type="checkbox"

                  checked={scheduleNext}

                  onChange={(e) => setScheduleNext(e.target.checked)}

                  className="h-4 w-4 accent-amber-400"

                />

                Remarcar próxima visita

              </label>

            ) : null}



            {nextRequired ? (

              <label className="block text-sm">

                <span className="mb-1 block font-semibold text-white">Próxima visita *</span>

                <input

                  type="datetime-local"

                  value={nextVisitStart}

                  onChange={(e) => setNextVisitStart(e.target.value)}

                  min={toDatetimeLocalValue(new Date())}

                  className="ops-input"

                />

                <p className="mt-1 text-xs text-white/50">

                  A nova visita entra na agenda — não entra na rota de hoje.

                </p>

              </label>

            ) : null}



            {finishError ? (

              <p

                className="rounded-xl border border-red-400/40 bg-red-950/70 px-3 py-2 text-sm text-red-100"

                role="alert"

              >

                {finishError}

              </p>

            ) : null}



            <button

              type="button"

              onClick={() => void handleFinish()}

              disabled={finishing}

              className="ops-btn ops-btn-primary w-full py-3 text-base"

            >

              {finishing ? 'Finalizando…' : 'Finalizar visita'}

            </button>

          </div>

        ) : null}



        {finished ? (

          <div className="mt-6 rounded-[10px] border border-[var(--ok)]/35 bg-[var(--ok-bg)] px-4 py-4" role="status">

            <p className="text-sm font-semibold text-brand-900">Visita finalizada</p>

            {visit.outcome ? (

              <p className="mt-1 text-sm text-[var(--muted)]">

                Resultado: {labelOf(VISIT_OUTCOME_LABELS, visit.outcome)}

              </p>

            ) : null}

          </div>

        ) : null}

      </div>

    </div>

  );

}


