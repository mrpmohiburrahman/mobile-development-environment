/**
 * The Mixpanel sender, with every platform concern behind an adapter.
 *
 * ADR 0003: only the native app sends events. The studio on web renders the same
 * screens and must send nothing, in dev and on GitHub Pages. That rule lives
 * here, in the one module every call site goes through, so a screen added later
 * cannot bypass it by accident.
 *
 * Nothing in this file touches React, React Native, AsyncStorage or `fetch`.
 * `native.ts` supplies those as adapters; `test/analytics.test.ts` supplies
 * fakes. The decisions a test can watch happen — refusal order, identity races,
 * region routing, payload shape, failure isolation — all live here.
 *
 * What a result means:
 * - `accepted`: the ingestion host answered `status: 1`. That is an HTTP
 *   acceptance, not proof the event reached a report. Mixpanel drops some
 *   events silently after accepting them (a disallowed `distinct_id`, a wrong
 *   region host). Only the Events page in the project proves arrival.
 * - `rejected`: the host answered, and said no, or said something unreadable.
 * - `unsent`: the transport failed before an answer. No retry, no queue; the
 *   spec rules a durable offline queue out of scope.
 * - `refused`: this sender decided not to try. `web` is the ADR 0003 guard,
 *   `not-configured` is an absent token, `unknown-region` is a region that maps
 *   to no host. An unknown region must not fall back to the US host, because
 *   the US host answers `status: 1` for a token from another region and the
 *   events vanish.
 */

export type Region = 'us' | 'eu' | 'in';

export type EventName = 'App Opened' | 'Screen Viewed' | 'Habit Toggled' | 'Signed Out';

/** The only properties an event may carry. No names, habit text, state or tokens. */
export type EventProperties = {
  platform?: string;
  screen?: string;
  habit_id?: string;
  done?: boolean;
};

export type Config = { token: string; region: string };

export type TrackRequest = {
  url: string;
  contentType: 'application/x-www-form-urlencoded';
  body: string;
};

export type TrackResponse = { ok: boolean; body: string };

export type Adapters = {
  /** `Platform.OS` on native; `'web'` is refused before anything else runs. */
  platform: string;
  /** `null` means not configured. */
  config: Config | null;
  /** Milliseconds since the epoch. Real time, not the demo date. */
  now: () => number;
  /** A fresh UUIDv4 per call. */
  uuid: () => string;
  /** Small persistent key-value store that survives a relaunch. */
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  /** One HTTP POST. May throw; the sender catches. */
  send: (request: TrackRequest) => Promise<TrackResponse>;
};

export type Outcome =
  | { kind: 'accepted' }
  | { kind: 'rejected'; error: string }
  | { kind: 'unsent'; error: string }
  | { kind: 'refused'; reason: 'web' | 'not-configured' | 'unknown-region' };

export type Analytics = {
  /** Never rejects. The outcome is for diagnostics; callers may ignore it. */
  track: (event: EventName, properties?: EventProperties) => Promise<Outcome>;
};

const HOSTS: Record<Region, string> = {
  us: 'https://api.mixpanel.com',
  eu: 'https://api-eu.mixpanel.com',
  in: 'https://api-in.mixpanel.com',
};

export const INSTALL_ID_KEY = 'mixpanel.install_id';

/** The ingestion host for a region, or `null` when the region is not one we know. */
export function hostForRegion(region: string | undefined): string | null {
  if (region === undefined) return null;
  return Object.hasOwn(HOSTS, region) ? HOSTS[region as Region] : null;
}

/**
 * Read the build-time configuration. An absent or blank token is not configured.
 * The region defaults to `us` only when the variable is absent or blank; a
 * present unknown value is kept so the sender can refuse it by name.
 */
export function readConfig(env: Record<string, string | undefined>): Config | null {
  const token = env.EXPO_PUBLIC_MIXPANEL_TOKEN?.trim() ?? '';
  if (token === '') return null;
  const region = env.EXPO_PUBLIC_MIXPANEL_REGION?.trim().toLowerCase() || 'us';
  return { token, region };
}

/**
 * A UUIDv4 from a `[0, 1)` random source, for runtimes without
 * `crypto.randomUUID`. These ids label an anonymous install and deduplicate
 * events; they do not need to be unguessable.
 */
export function uuidFrom(random: () => number): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const bytes = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const s = bytes.map(hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Outcomes are diagnostics. A host or transport may echo the token; the outcome must not. */
function redact(text: string, token: string): string {
  return text.split(token).join('[token]');
}

export function createAnalytics(adapters: Adapters): Analytics {
  // One promise per sender, created on the first event that gets past the
  // guards. Concurrent first events await the same promise, so they share one
  // install id and storage is read once and written at most once.
  let identity: Promise<string> | null = null;

  const loadIdentity = async (): Promise<string> => {
    let minted: string | null = null;
    try {
      const stored = await adapters.storage.get(INSTALL_ID_KEY);
      if (stored) return stored;
      minted = adapters.uuid();
      await adapters.storage.set(INSTALL_ID_KEY, minted);
      return minted;
    } catch {
      // Storage is unavailable. Use one id for this launch rather than send
      // nothing; the next launch mints another, which is the honest cost.
      return minted ?? adapters.uuid();
    }
  };

  const send = async (event: EventName, properties: EventProperties): Promise<Outcome> => {
    if (adapters.platform === 'web') return { kind: 'refused', reason: 'web' };
    const config = adapters.config;
    if (config === null) return { kind: 'refused', reason: 'not-configured' };
    const host = hostForRegion(config.region);
    if (host === null) return { kind: 'refused', reason: 'unknown-region' };

    identity ??= loadIdentity();
    let installId: string;
    try {
      installId = await identity;
    } catch (error) {
      // Only `uuid()` throwing inside the storage fallback can get here. Do not
      // keep a rejected promise around, or every later event would fail with it.
      identity = null;
      return { kind: 'unsent', error: redact(message(error), config.token) };
    }

    const body = JSON.stringify([
      {
        event,
        properties: {
          token: config.token,
          $device_id: installId,
          distinct_id: `$device:${installId}`,
          $insert_id: adapters.uuid(),
          time: Math.floor(adapters.now() / 1000),
          ...properties,
        },
      },
    ]);

    let response: TrackResponse;
    try {
      response = await adapters.send({
        url: `${host}/track?verbose=1&ip=0`,
        contentType: 'application/x-www-form-urlencoded',
        body: `data=${encodeURIComponent(body)}`,
      });
    } catch (error) {
      return { kind: 'unsent', error: redact(message(error), config.token) };
    }

    if (!response.ok) return { kind: 'rejected', error: 'http error' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return { kind: 'rejected', error: 'malformed response' };
    }
    if (typeof parsed !== 'object' || parsed === null || !('status' in parsed)) {
      return { kind: 'rejected', error: 'malformed response' };
    }
    if (parsed.status === 1) return { kind: 'accepted' };
    const error = 'error' in parsed && typeof parsed.error === 'string' ? parsed.error : 'rejected';
    return { kind: 'rejected', error: redact(error, config.token) };
  };

  const track: Analytics['track'] = async (event, properties = {}) => {
    try {
      return await send(event, properties);
    } catch (error) {
      // Belt and braces for an adapter that throws outside the guarded awaits
      // (`now`, `uuid`). The contract is that this promise never rejects.
      return { kind: 'unsent', error: message(error) };
    }
  };

  return { track };
}
