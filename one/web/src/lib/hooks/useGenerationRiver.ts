import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { changedRiverTasks, isRiverTaskActive, mergeRiverTasks, readGenerationRiver, recordRiverActivity, type RiverTask } from '@/services/api/generation-river';

const historyKey = (owner: string) => ['generation-river', 'history', owner] as const;
const activityKey = (owner: string) => ['generation-river', 'activity', owner] as const;
const emptyTasks: RiverTask[] = [];

export function useGenerationRiverFeedback() {
  const client = useQueryClient();
  return useCallback((owner: string, task: RiverTask) => {
    if (!owner) return;
    client.setQueryData<RiverTask[]>(activityKey(owner), (previous = []) => recordRiverActivity(previous, [task], Date.now()));
    if (task.requestId) void client.invalidateQueries({ queryKey: historyKey(owner) });
  }, [client]);
}

export function useReadGenerationAttempt() {
  const client = useQueryClient();
  return useCallback((owner: string, id: string) => {
    if (!owner) return undefined;
    return client.getQueryData<RiverTask[]>(activityKey(owner))?.find(task =>
      task.id === id && !task.requestId && (task.status === 'failed' || task.status === 'canceled'))?.homeDraft;
  }, [client]);
}

export function useGenerationRiver(owner: string) {
  const client = useQueryClient();
  const [streamOnline, setStreamOnline] = useState(false);
  const previousHistory = useRef<{ owner: string; tasks: RiverTask[] } | null>(null);
  const local = useQuery<RiverTask[]>({ queryKey: activityKey(owner), queryFn: () => [], enabled: false, gcTime: 30 * 60_000 });
  const history = useQuery({
    queryKey: historyKey(owner),
    queryFn: ({ signal }) => readGenerationRiver(owner, signal, client.getQueryData<RiverTask[]>(historyKey(owner))),
    enabled: Boolean(owner),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data?.some(task => task.requestId && (
      isRiverTaskActive(task) || task.status === 'checking'
    )) ? 8_000 : streamOnline ? false : 15_000,
  });

  useEffect(() => {
    const current = history.data;
    if (!owner || !current) {
      previousHistory.current = null;
      return;
    }
    const previous = previousHistory.current;
    previousHistory.current = { owner, tasks: current };
    if (previous?.owner !== owner) return;

    const changes = changedRiverTasks(previous.tasks, current);
    if (!changes.length) return;
    client.setQueryData<RiverTask[]>(activityKey(owner), (activity = []) => recordRiverActivity(activity, changes, Date.now()));
  }, [client, history.data, owner]);

  useEffect(() => {
    if (!owner || typeof EventSource === 'undefined') return;
    const events = new EventSource('/api/generations/events');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void client.invalidateQueries({ queryKey: historyKey(owner) });
      }, 150);
    };
    events.addEventListener('open', () => { setStreamOnline(true); refresh(); });
    events.addEventListener('error', () => setStreamOnline(false));
    for (const event of ['connected', 'generation.queued', 'generation.processing', 'generation.succeeded', 'generation.failed', 'generation.canceled', 'generation.cancelled', 'generation.reconciliation_required']) {
      events.addEventListener(event, refresh);
    }
    return () => {
      clearTimeout(timer);
      events.close();
    };
  }, [owner, client]);

  const activity = local.data || emptyTasks;
  return { ...history, tasks: mergeRiverTasks(history.data || emptyTasks, activity), activity };
}
