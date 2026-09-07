const KRW = new Intl.NumberFormat('ko-KR');

export function won(value: number): string {
  return `₩${KRW.format(value)}`;
}

export function num(value: number): string {
  return KRW.format(value);
}

export function nights(checkin: string, checkout: string): number {
  const a = new Date(checkin).getTime();
  const b = new Date(checkout).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}.${d.getDate()}(${week})`;
}
