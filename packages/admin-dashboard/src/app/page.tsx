'use client';

import { useEffect, useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const API = 'http://localhost:4002';

const C = {
  bg: '#0f1117',
  card: '#1a1d27',
  border: '#2d3148',
  primary: '#818cf8',
  green: '#4ade80',
  yellow: '#fbbf24',
  red: '#f87171',
  text: '#e2e8f0',
  muted: '#94a3b8',
  dim: '#64748b',
  s2: '#34d399',
};

interface LiveEvent { ts: number; event: string; session_id?: string; }
interface ScenarioRow { scenario_id: string; fired: number; control: number; treatment: number; }
interface Firings {
  scenarios: ScenarioRow[];
  total_fired: number;
  ab_split: { control: number; treatment: number };
  copy_source: { gemini: number; fallback: number };
  booster_counts: Record<string, number>;
  avg_intent_score: number;
}
interface Coverage { counts: Record<string, number>; total_events: number; sessions: number; }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dim }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 20 }}>
      {children}
    </div>
  );
}

const SIGNAL_COLORS = [
  '#818cf8', '#6ee7b7', '#fbbf24', '#f87171', '#60a5fa',
  '#c084fc', '#34d399', '#fb923c', '#a78bfa', '#4ade80',
  '#38bdf8', '#f472b6', '#facc15', '#2dd4bf', '#e879f9', '#94a3b8',
];

export default function Dashboard() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [firings, setFirings] = useState<Firings | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [now, setNow] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNow(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })); }, []);

  useEffect(() => {
    // 실제 Redis 스트림 집계라 시간이 지나면 값이 는다. 10초마다 다시 읽는다.
    const load = () => {
      fetch(`${API}/signals/coverage`).then(r => r.json()).then(setCoverage).catch(() => {});
      fetch(`${API}/scenarios/firings`).then(r => r.json()).then(setFirings).catch(() => {});
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API}/stream/live`);
    es.onopen = () => setIsLive(true);
    es.onerror = () => setIsLive(false);
    es.onmessage = (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      if (data.event === 'heartbeat') return;
      setLiveCount(c => c + 1);
      setLiveEvents(prev => [data, ...prev].slice(0, 40));
    };
    return () => es.close();
  }, []);

  const coverageData = Object.entries(coverage?.counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  const scenarios = firings?.scenarios ?? [];
  const firingsData = scenarios.map(s => ({ name: s.scenario_id, 표시: s.treatment, 억제: s.control }));

  const s1 = scenarios.find(s => s.scenario_id === 'S1');
  const s2 = scenarios.find(s => s.scenario_id === 'S2');
  const totalFired = firings?.total_fired ?? 0;
  const shown = firings?.ab_split.treatment ?? 0;
  const suppressed = firings?.ab_split.control ?? 0;
  const geminiRate = firings && (firings.copy_source.gemini + firings.copy_source.fallback) > 0
    ? Math.round((firings.copy_source.gemini / (firings.copy_source.gemini + firings.copy_source.fallback)) * 100)
    : null;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      {/* ── Header ── */}
      <header style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: isLive ? C.green : C.red, display: 'block', boxShadow: isLive ? `0 0 8px ${C.green}88` : 'none' }} />
          <span style={{ fontSize: 12, color: isLive ? C.green : C.red, fontWeight: 600 }}>{isLive ? 'LIVE' : 'OFFLINE'}</span>
          <span style={{ width: 1, height: 16, background: C.border, display: 'block' }} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px' }}>Hover Admin Dashboard</span>
        </div>
        <span style={{ fontSize: 13, color: C.dim }}>{now}</span>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="수신 이벤트" value={(coverage?.total_events ?? 0).toLocaleString()} sub={`세션 ${coverage?.sessions ?? 0}개 · 실시간 +${liveCount}`} color={C.primary} />
          <StatCard label="S1 발화" value={s1?.fired ?? 0} sub={`쿠폰 모달 · 표시 ${s1?.treatment ?? 0}건`} color={C.primary} />
          <StatCard label="S2 발화" value={s2?.fired ?? 0} sub={`가격비교 배너 · 표시 ${s2?.treatment ?? 0}건`} color={C.s2} />
          <StatCard label="평균 intent" value={firings ? firings.avg_intent_score.toFixed(2) : '-'} sub={`총 ${totalFired}건 발화`} color={C.yellow} />
        </div>

        {/* ── Middle row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>
          {/* Signal Coverage */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
            <SectionTitle>신호 커버리지 (16개)</SectionTitle>
            {coverageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={coverageData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: C.dim, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ background: '#252836', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {coverageData.map((_, i) => (
                      <Cell key={i} fill={SIGNAL_COLORS[i % SIGNAL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 13 }}>데이터 로딩 중...</div>
            )}
          </div>

          {/* Live Feed */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>실시간 이벤트 피드</SectionTitle>
            <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liveEvents.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 13, gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📡</span>
                  <span>이벤트 대기 중</span>
                  <span style={{ fontSize: 11, color: C.dim }}>Ingestion API로 이벤트를 전송하면 여기 표시됩니다</span>
                </div>
              ) : liveEvents.map((ev, i) => (
                <div key={i} className={i === 0 ? 'new-event' : ''} style={{ padding: '8px 10px', background: i === 0 ? `${C.primary}18` : 'transparent', borderRadius: 7, borderLeft: `2px solid ${i === 0 ? C.primary : C.border}`, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: i === 0 ? C.primary : C.muted, fontWeight: 600 }}>{ev.event}</span>
                    <span style={{ color: C.dim }}>{new Date(ev.ts).toLocaleTimeString('ko-KR')}</span>
                  </div>
                  {ev.session_id && (
                    <div style={{ color: C.dim, fontFamily: 'monospace' }}>
                      {ev.session_id.length > 22 ? ev.session_id.slice(0, 22) + '…' : ev.session_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Scenario Firings Chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
            <SectionTitle>시나리오 발화 현황</SectionTitle>
            {firingsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={firingsData} barGap={6} margin={{ top: 4, right: 8 }}>
                  <XAxis dataKey="name" tick={{ fill: C.text, fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.dim, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ background: '#252836', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                  />
                  <Bar dataKey="표시" fill={C.primary} radius={[4, 4, 0, 0]} barSize={48} />
                  <Bar dataKey="억제" fill={C.s2} radius={[4, 4, 0, 0]} barSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 13 }}>로딩 중...</div>
            )}
            <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
              {[{ label: '표시', color: C.primary }, { label: '억제', color: C.s2 }].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'block' }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* A/B Results */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
            <SectionTitle>A/B 그룹 분포</SectionTitle>

            {/* 전환 추적이 없으므로 CTR 을 계산하지 않는다.
                개입이 만들어진 뒤 실제로 표시된 비율만 보여준다. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Control', count: suppressed, desc: '생성 후 미표시', color: C.dim },
                { label: 'Treatment', count: shown, desc: '실제 표시', color: C.green },
              ].map(({ label, count, desc, color }) => (
                <div key={label} style={{ background: C.bg, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 8, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 4 }}>
                    {totalFired > 0 ? `${Math.round((count / totalFired) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>{count}건 · {desc}</div>
                </div>
              ))}
            </div>

            {geminiRate !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>문구 생성</div>
                  <div style={{ fontSize: 11, color: C.dim }}>
                    Gemini {firings?.copy_source.gemini ?? 0}건 · 폴백 {firings?.copy_source.fallback ?? 0}건
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: geminiRate > 50 ? C.green : C.yellow }}>{geminiRate}%</div>
              </div>
            )}

            {scenarios.map(sc => (
              <div key={sc.scenario_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {sc.scenario_id === 'S1' ? 'S1 — coupon_modal' : 'S2 — price_match_banner'}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>표시 {sc.treatment}건 · 억제 {sc.control}건</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: sc.scenario_id === 'S1' ? C.primary : C.s2 }}>
                    {sc.fired}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>발화</div>
                </div>
              </div>
            ))}

            {totalFired === 0 && (
              <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 12, color: C.dim }}>
                아직 발화한 개입이 없습니다
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
