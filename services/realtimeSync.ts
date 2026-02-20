import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const realtimeLogger = logger.create('RealtimeSync');

const CLIENT_ID_STORAGE_KEY = 'gdp_realtime_client_id';

export type SyncEventScope = 'records' | 'employees' | 'admin';

interface SyncEventRow {
  id: number;
  scope: SyncEventScope;
  action: string;
  actor_email: string | null;
  origin_client_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PublishSyncEventInput {
  scope: SyncEventScope;
  action: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
}

interface SubscribeToSyncEventsOptions {
  scope?: SyncEventScope;
  channelKey: string;
  ignoreOwnEvents?: boolean;
  onEvent: (event: SyncEventRow) => void;
}

interface SubscribeToProfileChangesOptions {
  channelKey: string;
  email?: string;
  onChange: () => void;
}

let cachedClientId: string | null = null;

const normalizeEmail = (email: string | undefined | null): string | null => {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized || null;
};

const createClientId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildChannelName = (prefix: string, key: string): string => {
  return `${prefix}-${key}-${Math.random().toString(16).slice(2, 10)}`;
};

export const getRealtimeClientId = (): string => {
  if (cachedClientId) return cachedClientId;

  if (typeof window === 'undefined') {
    cachedClientId = createClientId();
    return cachedClientId;
  }

  try {
    const stored = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (stored) {
      cachedClientId = stored;
      return stored;
    }

    const nextId = createClientId();
    window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId);
    cachedClientId = nextId;
    return nextId;
  } catch {
    cachedClientId = createClientId();
    return cachedClientId;
  }
};

export const publishSyncEvent = async ({
  scope,
  action,
  actorEmail,
  metadata,
}: PublishSyncEventInput): Promise<void> => {
  const { error } = await supabase
    .from('sync_events')
    .insert({
      scope,
      action,
      actor_email: normalizeEmail(actorEmail),
      origin_client_id: getRealtimeClientId(),
      metadata: metadata || {},
    });

  if (error) {
    throw error;
  }
};

export const subscribeToSyncEvents = ({
  scope,
  channelKey,
  ignoreOwnEvents = true,
  onEvent,
}: SubscribeToSyncEventsOptions): (() => void) => {
  const filter = scope ? `scope=eq.${scope}` : undefined;
  const channelName = buildChannelName('gdp-sync-events', channelKey);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sync_events',
        ...(filter ? { filter } : {}),
      },
      (payload) => {
        const event = payload.new as SyncEventRow | undefined;
        if (!event) return;

        if (ignoreOwnEvents && event.origin_client_id === getRealtimeClientId()) {
          return;
        }

        onEvent(event);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeLogger.debug(`Canal conectado: ${channelName}`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};

export const subscribeToProfileChanges = ({
  channelKey,
  email,
  onChange,
}: SubscribeToProfileChangesOptions): (() => void) => {
  const channelName = buildChannelName('gdp-profiles', channelKey);
  const normalizedEmail = normalizeEmail(email);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
      },
      (payload) => {
        const row = ((payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) || {}) as {
          email?: string;
        };

        if (normalizedEmail && normalizeEmail(row.email) !== normalizedEmail) {
          return;
        }

        onChange();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeLogger.debug(`Canal conectado: ${channelName}`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};
