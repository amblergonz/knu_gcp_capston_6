'use client';

import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CouponModal } from './CouponModal';
import { PriceMatchBanner } from './PriceMatchBanner';
import { COUPON_EVENT } from '@/components/checkout/PriceBreakdown';
import { setDecisionSink, track } from '@/lib/tracker';
import { pushLog } from '@/lib/tracker/store';
import type { DecisionPayload } from '@/lib/tracker/types';

/**
 * 개입 노출/클릭/닫기 전용 이벤트 타입이 ingestion enum 에 없다.
 * 새 타입을 보내면 배치 전체가 400 이므로, 워커의 어떤 룰에도 영향이 없는
 * click 에 action 을 실어 보낸다. (worker.js:225-277 에 click 분기가 없음을 확인)
 */
function emitInterventionEvent(action: string, d: DecisionPayload, extra: Record<string, unknown> = {}) {
  track('click', {
    action,
    intervention_id: d.intervention_id,
    scenario_id: d.scenario_id,
    component: d.component,
    ab_group: d.ab_group,
    copy_source: d.copy_source,
    intent_score: d.intent_score,
    ...extra,
  });
}

export function InterventionHost() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<DecisionPayload | null>(null);
  const [queue, setQueue] = useState<DecisionPayload[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setDecisionSink((d) => {
      // A/B 계약: control 은 프론트가 억제한다. 백엔드는 control 에도 개입을 만들어 준다.
      if (d.ab_group === 'control') {
        emitInterventionEvent('intervention_suppressed_control', d);
        pushLog('info', 'control 그룹', '개입 미표시 (A/B 계약)');
        return;
      }
      setCurrent((cur) => {
        if (cur) {
          setQueue((q) => [...q, d]);
          return cur;
        }
        return d;
      });
    });
    return () => setDecisionSink(null);
  }, []);

  useEffect(() => {
    if (!current) return;
    emitInterventionEvent('intervention_impression', current);
    // 서버가 준 TTL 이 지나면 스스로 닫는다.
    const t = setTimeout(() => setCurrent(null), Math.max(5000, current.ttl_seconds * 1000));
    return () => clearTimeout(t);
  }, [current]);

  const next = useCallback(() => {
    setQueue((q) => {
      const [head, ...rest] = q;
      setCurrent(head ?? null);
      return rest;
    });
  }, []);

  const dismiss = useCallback(
    (reason: string) => {
      if (current) emitInterventionEvent('intervention_dismiss', current, { reason });
      setCurrent(null);
      next();
    },
    [current, next],
  );

  const cta = useCallback(() => {
    if (!current) return;
    emitInterventionEvent('intervention_cta', current);

    if (current.component === 'coupon_modal') {
      const percent = current.context.discount_percent ?? 10;
      // 쿠폰란이 이미 떠 있으면 즉시 적용되고, 아니면 이동 후 마운트 시점에 적용된다.
      const apply = () =>
        window.dispatchEvent(new CustomEvent(COUPON_EVENT, { detail: { code: 'HOVER10', percent } }));
      apply();
      router.push('/checkout');
      setTimeout(apply, 600);
    } else {
      router.push('/search?sort=price_asc');
    }

    setCurrent(null);
    next();
  }, [current, next, router]);

  if (!mounted || !current) return null;

  const node =
    current.component === 'coupon_modal' ? (
      <CouponModal decision={current} onDismiss={dismiss} onCta={cta} />
    ) : (
      <PriceMatchBanner decision={current} onDismiss={dismiss} onCta={cta} />
    );

  return createPortal(<InterventionErrorBoundary>{node}</InterventionErrorBoundary>, document.body);
}

/** 위젯이 터져도 예약 사이트는 멀쩡해야 한다. */
class InterventionErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    pushLog('error', '위젯 렌더 실패', error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
