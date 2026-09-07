'use client';

import { useEffect, useState } from 'react';
import { BOOSTER_ORDER, discountFor, type BoosterName, type BoosterTier, type RuntimeConfig } from '@/lib/tracker/rules';
import { refreshRuntimeConfig, saveRuntimeConfig, resetRuntimeConfig, type SyncState } from '@/lib/tracker';
import type { ConfigDraft } from '@/lib/tracker/runtimeConfig';
import { cn } from '@/lib/cn';

const TIER_LABEL: Record<BoosterTier, string> = {
  high: '고관여 — 명시적인 비교·이탈 행동',
  mid: '중간 — 망설임과 맥락',
  ambient: '앰비언트 — 일반 탐색에서도 흔히 발생',
  reserved: '미사용',
};
const TIERS: BoosterTier[] = ['high', 'mid', 'ambient', 'reserved'];

interface Draft {
  boosters: Record<string, { enabled: boolean; weight: number }>;
  s1: { enabled: boolean; cart_min_count: number; tab_hidden_seconds: number; intent_score_min: number };
  s2: { enabled: boolean; intent_score_min: number };
  discount: RuntimeConfig['discount'];
}

function toDraft(cfg: RuntimeConfig): Draft {
  const boosters: Draft['boosters'] = {};
  for (const b of BOOSTER_ORDER) {
    boosters[b] = { enabled: cfg.boosters[b].enabled, weight: cfg.boosters[b].weight };
  }
  return {
    boosters,
    s1: { ...cfg.scenarios.S1 },
    s2: { enabled: cfg.scenarios.S2.enabled, intent_score_min: cfg.scenarios.S2.intent_score_min },
    discount: { ...cfg.discount },
  };
}

function toPayload(d: Draft): ConfigDraft {
  const boosters: ConfigDraft['boosters'] = {};
  for (const b of BOOSTER_ORDER) boosters[b] = { enabled: d.boosters[b].enabled, weight: d.boosters[b].weight };
  return { boosters, scenarios: { S1: d.s1, S2: d.s2 }, discount: d.discount };
}

export function SignalTuner({
  cfg,
  activeBoosters,
  score,
  syncState,
}: {
  cfg: RuntimeConfig;
  activeBoosters: BoosterName[];
  score: number;
  syncState: SyncState;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(cfg));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 서버 값이 바뀌면 draft 를 다시 씌운다. 단, 편집 중이면 덮지 않는다.
  useEffect(() => {
    if (!dirty) setDraft(toDraft(cfg));
  }, [cfg, dirty]);

  const patch = (fn: (d: Draft) => Draft) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
    setError(null);
  };

  async function save() {
    setBusy(true);
    const res = await saveRuntimeConfig(toPayload(draft), cfg.version);
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      setError(null);
      return;
    }
    if (res.status === 409) setError(`다른 탭에서 먼저 저장했습니다 (서버 v${res.current}). 되돌리기 후 다시 시도하세요.`);
    else if (res.status === 422) setError(`알 수 없는 신호: ${res.unknown?.join(', ')}`);
    else setError(res.error);
  }

  async function reset() {
    setBusy(true);
    await resetRuntimeConfig();
    setBusy(false);
    setDirty(false);
    setError(null);
  }

  // 살아 있는 경고들
  const enabledSum = BOOSTER_ORDER.reduce((s, b) => s + (draft.boosters[b].enabled ? draft.boosters[b].weight : 0), 0);
  const roundedSum = Math.round(enabledSum * 100) / 100;
  const activeBase = cfg.scenarios.S2.base_boosters.filter((b) => draft.boosters[b]?.enabled);
  const maxSingle = Math.max(...BOOSTER_ORDER.map((b) => (draft.boosters[b].enabled ? draft.boosters[b].weight : 0)));

  const warnings: string[] = [];
  if (activeBase.length === 0) warnings.push('S2 기본조건 신호가 모두 OFF — S2 는 절대 발화하지 않습니다');
  if (roundedSum < draft.s1.intent_score_min) warnings.push(`활성 가중치 합 ${roundedSum.toFixed(2)} 이 S1 임계치보다 낮아 S1 발화 불가`);
  if (roundedSum < draft.s2.intent_score_min) warnings.push(`활성 가중치 합 ${roundedSum.toFixed(2)} 이 S2 임계치보다 낮아 S2 발화 불가`);
  if (maxSingle >= Math.min(draft.s1.intent_score_min, draft.s2.intent_score_min)) {
    warnings.push('단일 신호 하나만으로 발화 가능한 상태입니다');
  }

  const currentTier = discountFor(score, draft.discount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[10px]">
        <SyncBadge state={syncState} version={cfg.version} workerSeen={cfg.workerSeen} />
        {dirty && <span className="text-amber-400">저장하지 않은 변경</span>}
      </div>

      {!cfg.writeEnabled && (
        <p className="rounded bg-slate-900 px-2 py-1.5 text-[10px] text-slate-500">
          읽기 전용 모드입니다 (CONFIG_WRITE_ENABLED=false)
        </p>
      )}

      <Group title="시나리오">
        <ToggleRow
          label="S1 쿠폰 모달"
          checked={draft.s1.enabled}
          onChange={(v) => patch((d) => ({ ...d, s1: { ...d.s1, enabled: v } }))}
        />
        <NumRow label="장바구니 최소" value={draft.s1.cart_min_count} step={1} min={1} max={10}
          onChange={(v) => patch((d) => ({ ...d, s1: { ...d.s1, cart_min_count: v } }))} />
        <NumRow label="탭 숨김(초)" value={draft.s1.tab_hidden_seconds} step={1} min={3} max={300}
          onChange={(v) => patch((d) => ({ ...d, s1: { ...d.s1, tab_hidden_seconds: v } }))} />
        <NumRow label="intent 최소" value={draft.s1.intent_score_min} step={0.01} min={0.01} max={2.05}
          onChange={(v) => patch((d) => ({ ...d, s1: { ...d.s1, intent_score_min: v } }))} />

        <div className="mt-2 border-t border-slate-800 pt-2">
          <ToggleRow
            label="S2 가격비교 배너"
            checked={draft.s2.enabled}
            onChange={(v) => patch((d) => ({ ...d, s2: { ...d.s2, enabled: v } }))}
          />
          <NumRow label="intent 최소" value={draft.s2.intent_score_min} step={0.01} min={0.01} max={2.05}
            onChange={(v) => patch((d) => ({ ...d, s2: { ...d.s2, intent_score_min: v } }))} />
        </div>
      </Group>

      <Group title={`할인 구간 — 현재 세션 ${currentTier}%`}>
        <NumRow label="기본 (%)" value={draft.discount.tier1_percent} step={1} min={0} max={90}
          onChange={(v) => patch((d) => ({ ...d, discount: { ...d.discount, tier1_percent: v } }))} />
        <NumRow label="2단계 시작" value={draft.discount.tier2_min_score} step={0.01} min={0.01} max={2.05}
          onChange={(v) => patch((d) => ({ ...d, discount: { ...d.discount, tier2_min_score: v } }))} />
        <NumRow label="2단계 (%)" value={draft.discount.tier2_percent} step={1} min={0} max={90}
          onChange={(v) => patch((d) => ({ ...d, discount: { ...d.discount, tier2_percent: v } }))} />
        <NumRow label="3단계 시작" value={draft.discount.tier3_min_score} step={0.01} min={0.01} max={2.05}
          onChange={(v) => patch((d) => ({ ...d, discount: { ...d.discount, tier3_min_score: v } }))} />
        <NumRow label="3단계 (%)" value={draft.discount.tier3_percent} step={1} min={0} max={90}
          onChange={(v) => patch((d) => ({ ...d, discount: { ...d.discount, tier3_percent: v } }))} />
      </Group>

      {TIERS.map((tier) => {
        const names = BOOSTER_ORDER.filter((b) => cfg.boosters[b]?.tier === tier);
        if (names.length === 0) return null;
        return (
          <Group key={tier} title={TIER_LABEL[tier]}>
            {names.map((b) => {
              const meta = cfg.boosters[b];
              const isActive = activeBoosters.includes(b);
              return (
                <div key={b} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    disabled={meta.reserved}
                    checked={draft.boosters[b].enabled}
                    onChange={(e) => {
                      const v = e.target.checked;
                      patch((d) => ({ ...d, boosters: { ...d.boosters, [b]: { ...d.boosters[b], enabled: v } } }));
                    }}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500 disabled:opacity-40"
                  />
                  {/* 현재 세션에서 활성인 신호 표시 — 설정 폼이 아니라 튜닝 콘솔이 되는 지점 */}
                  <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isActive ? 'bg-sky-400' : 'bg-transparent')}
                    title={isActive ? '이 세션에서 발동됨' : undefined}
                  />
                  <span className={cn('flex-1 truncate text-[11px]', meta.reserved ? 'text-slate-600' : 'text-slate-300')}>
                    {meta.label}
                  </span>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    disabled={meta.reserved}
                    value={draft.boosters[b].weight}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value) * 100) / 100;
                      patch((d) => ({ ...d, boosters: { ...d.boosters, [b]: { ...d.boosters[b], weight: v } } }));
                    }}
                    className="w-14 shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-right font-mono text-[10px] tabular-nums text-slate-200 outline-none focus:border-brand-500 disabled:opacity-40"
                  />
                </div>
              );
            })}
          </Group>
        );
      })}

      <div className="space-y-1 border-t border-slate-800 pt-3">
        <p className="flex justify-between font-mono text-[10px] text-slate-500">
          <span>활성 가중치 합</span>
          <span className="tabular-nums text-slate-300">{roundedSum.toFixed(2)}</span>
        </p>
        {warnings.map((w) => (
          <p key={w} className="rounded bg-amber-500/10 px-2 py-1 text-[10px] leading-relaxed text-amber-400">
            {w}
          </p>
        ))}
        {cfg.rejected.length > 0 &&
          cfg.rejected.map((r) => (
            <p key={r.path} className="rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
              워커가 거부함: {r.path} ({r.reason})
            </p>
          ))}
        {error && <p className="rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <PanelButton onClick={save} disabled={busy || !dirty || !cfg.writeEnabled} primary>
          저장
        </PanelButton>
        <PanelButton onClick={() => { setDraft(toDraft(cfg)); setDirty(false); setError(null); }} disabled={busy || !dirty}>
          되돌리기
        </PanelButton>
        <PanelButton onClick={reset} disabled={busy || !cfg.writeEnabled}>
          기본값 복원
        </PanelButton>
      </div>
    </div>
  );
}

function SyncBadge({ state, version, workerSeen }: { state: SyncState; version: number; workerSeen: boolean }) {
  if (!workerSeen) {
    return <span className="text-slate-500">워커 미연결 — 기본값 표시 중</span>;
  }
  const map: Record<SyncState, [string, string]> = {
    idle: ['text-slate-500', `v${version} · 동기화됨`],
    pending: ['text-amber-400', `v${version} · 워커 반영 대기 (최대 5초)`],
    synced: ['text-emerald-400', `v${version} · 동기화됨`],
    stale: ['text-rose-400', `v${version} · 워커가 아직 반영하지 않음`],
    error: ['text-rose-400', '저장 실패'],
  };
  const [tone, text] = map[state];
  return <span className={tone}>{text}</span>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{title}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function NumRow({
  label, value, step, min, max, onChange,
}: {
  label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-0.5 pl-5 text-[11px] text-slate-400">
      <span className="flex-1 truncate">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (!Number.isFinite(raw)) return;
          onChange(step < 1 ? Math.round(raw * 100) / 100 : Math.round(raw));
        }}
        className="w-14 shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-right font-mono text-[10px] tabular-nums text-slate-200 outline-none focus:border-brand-500"
      />
    </label>
  );
}

function PanelButton({
  onClick, disabled, primary, children,
}: {
  onClick: () => void; disabled?: boolean; primary?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40',
        primary
          ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
