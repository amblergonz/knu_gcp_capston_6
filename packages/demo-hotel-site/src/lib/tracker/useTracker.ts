'use client';

import { useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, subscribe } from './store';
import type { TrackerSnapshot } from './types';

export function useTrackerSnapshot(): TrackerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
