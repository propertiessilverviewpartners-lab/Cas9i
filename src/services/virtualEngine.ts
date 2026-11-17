import { VirtualMatch, LeaderboardEntry, LiveBetTickerItem, PlacedBet, Club, League, TipsterBetcode, H2HRecord, BetSelection, FXAsset, FXPosition, RegisteredUser, DtmMatchRule } from '../types';

export const PRESET_FIXTURES_INFO = {
  featuredTitle: 'CDA Navalcarnero vs Real Betis',
  pairTitle: 'Betis + Iceland vs Greece',
  allCount: 6,
};

const OFFLINE_SNAPSHOT_KEY = 'cas9i_offline_snapshot_v1';
const PENDING_USER_OPS_KEY = 'cas9i_pending_user_ops_v1';
const OFFLINE_DAILY_TARGET = 100;
const OFFLINE_ZOOM_TARGET = 50;
const OFFLINE_MAX_LIVE_WAVE = 10;

interface OfflineSnapshot {
  savedAt: number;
  matches: VirtualMatch[];
  h2hRecords: H2HRecord[];
  fxAssets: FXAsset[];
  clubs: Club[];
  leagues: League[];
  tipsterBetcodes: TipsterBetcode[];
  leaderboard: LeaderboardEntry[];
  liveTicker: LiveBetTickerItem[];
}

interface PendingUserOps {
  balanceDeltas: Record<string, number>;
  betsSync: Record<string, { placedBets: PlacedBet[]; fxPositions: FXPosition[]; totalBetsPlaced: number; totalWon: number }>;
}

const OFFLINE_SEED_LEAGUES: League[] = [
  { id: 'lg-1', name: 'Spain - Copa del Rey', country: 'Spain', icon: '🏆', isCustom: false, createdAt: 1700000000000 },
  { id: 'lg-2', name: 'Euro Qualification', country: 'Europe', icon: '⚽', isCustom: false, createdAt: 1700000000000 },
  { id: 'lg-3', name: 'England - Premier Virtual', country: 'England', icon: '👑', isCustom: false, createdAt: 1700000000000 },
  { id: 'lg-4', name: 'Germany - Bundesliga Virtual', country: 'Germany', icon: '🔥', isCustom: false, createdAt: 1700000000000 },
  { id: 'lg-5', name: 'Italy - Serie A Virtual', country: 'Italy', icon: '🛡️', isCustom: false, createdAt: 1700000000000 },
];

const OFFLINE_SEED_CLUBS: Club[] = [
  { id: 'club-1', name: 'Real Betis', shortName: 'BET', league: 'Spain - Copa del Rey', country: 'Spain', crest: '🟢', attack: 84, defense: 80 },
  { id: 'club-2', name: 'CDA Navalcarnero', shortName: 'NAV', league: 'Spain - Copa del Rey', country: 'Spain', crest: '🔴', attack: 73, defense: 71 },
  { id: 'club-3', name: 'Atletico Madrid', shortName: 'ATM', league: 'Spain - Copa del Rey', country: 'Spain', crest: '🔴', attack: 88, defense: 86 },
  { id: 'club-4', name: 'Real Sociedad', shortName: 'RSO', league: 'Spain - Copa del Rey', country: 'Spain', crest: '🔵', attack: 83, defense: 81 },
  { id: 'club-5', name: 'Iceland', shortName: 'ISL', league: 'Euro Qualification', country: 'Europe', crest: '❄️', attack: 75, defense: 74 },
  { id: 'club-6', name: 'Greece', shortName: 'GRE', league: 'Euro Qualification', country: 'Europe', crest: '🏛️', attack: 79, defense: 80 },
  { id: 'club-7', name: 'Portugal', shortName: 'POR', league: 'Euro Qualification', country: 'Europe', crest: '🦅', attack: 89, defense: 84 },
  { id: 'club-8', name: 'Croatia', shortName: 'CRO', league: 'Euro Qualification', country: 'Europe', crest: '⚡', attack: 85, defense: 83 },
  { id: 'club-9', name: 'Arsenal V', shortName: 'ARS', league: 'England - Premier Virtual', country: 'England', crest: '🔴', attack: 88, defense: 85 },
  { id: 'club-10', name: 'Liverpool V', shortName: 'LIV', league: 'England - Premier Virtual', country: 'England', crest: '🔥', attack: 89, defense: 84 },
  { id: 'club-11', name: 'Man City V', shortName: 'MCI', league: 'England - Premier Virtual', country: 'England', crest: '🔵', attack: 91, defense: 86 },
  { id: 'club-12', name: 'Chelsea V', shortName: 'CHE', league: 'England - Premier Virtual', country: 'England', crest: '🦁', attack: 84, defense: 82 },
  { id: 'club-13', name: 'Bayern V', shortName: 'BAY', league: 'Germany - Bundesliga Virtual', country: 'Germany', crest: '🔴', attack: 90, defense: 85 },
  { id: 'club-14', name: 'Dortmund V', shortName: 'BVB', league: 'Germany - Bundesliga Virtual', country: 'Germany', crest: '🟡', attack: 86, defense: 80 },
  { id: 'club-15', name: 'Leipzig V', shortName: 'RBL', league: 'Germany - Bundesliga Virtual', country: 'Germany', crest: '⚡', attack: 84, defense: 81 },
  { id: 'club-16', name: 'Leverkusen V', shortName: 'LEV', league: 'Germany - Bundesliga Virtual', country: 'Germany', crest: '🛡️', attack: 87, defense: 83 },
  { id: 'club-17', name: 'Inter V', shortName: 'INT', league: 'Italy - Serie A Virtual', country: 'Italy', crest: '🔵', attack: 88, defense: 86 },
  { id: 'club-18', name: 'AC Milan V', shortName: 'MIL', league: 'Italy - Serie A Virtual', country: 'Italy', crest: '🔴', attack: 85, defense: 83 },
  { id: 'club-19', name: 'Juventus V', shortName: 'JUV', league: 'Italy - Serie A Virtual', country: 'Italy', crest: '⭐', attack: 84, defense: 85 },
  { id: 'club-20', name: 'Napoli V', shortName: 'NAP', league: 'Italy - Serie A Virtual', country: 'Italy', crest: '💎', attack: 86, defense: 82 },
];

class VirtualEngineService {
  private matches: VirtualMatch[] = [];
  private tipsterBetcodes: TipsterBetcode[] = [];
  private h2hRecords: H2HRecord[] = [];
  private fxAssets: FXAsset[] = [];
  private clubs: Club[] = [];
  private leagues: League[] = [];
  private leaderboard: LeaderboardEntry[] = [];
  private liveTicker: LiveBetTickerItem[] = [];

  private matchSubscribers: Array<(matches: VirtualMatch[]) => void> = [];
  private tipsterSubscribers: Array<(betcodes: TipsterBetcode[]) => void> = [];
  private h2hSubscribers: Array<(records: H2HRecord[]) => void> = [];
  private fxSubscribers: Array<(assets: FXAsset[]) => void> = [];
  private clubSubscribers: Array<(clubs: Club[]) => void> = [];
  private leagueSubscribers: Array<(leagues: League[]) => void> = [];
  private leaderboardSubscribers: Array<(leaderboard: LeaderboardEntry[]) => void> = [];
  private tickerSubscribers: Array<(ticker: LiveBetTickerItem[]) => void> = [];
  private goalAlertSubscribers: Array<(alert: { match: VirtualMatch; text: string }) => void> = [];
  private usersChangedSubscribers: Array<() => void> = [];
  private userUpdatedSubscribers: Array<(user: RegisteredUser) => void> = [];
  private userDeletedSubscribers: Array<(userId: string) => void> = [];
  private userBetsResetSubscribers: Array<(userId: string) => void> = [];
  private reconnectSyncSubscribers: Array<() => void> = [];

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private adminToken: string | null = null;
  private fallbackPollId: ReturnType<typeof setInterval> | null = null;
  private offlineSimId: ReturnType<typeof setInterval> | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private lastServerContactAt = 0;
  private lastSnapshotSaveAt = 0;
  private offlineSimDirty = false;
  private stateVersion = 0;
  private sliceVersions = {
    clubs: 0,
    leagues: 0,
    matches: 0,
    tipster: 0,
    h2h: 0,
    fx: 0,
    leaderboard: 0,
    ticker: 0,
    users: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.adminToken = window.localStorage.getItem('cas9i_admin_token');
      this.hydrateFromOfflineSnapshot();
      this.startOfflineSimLoop();
      void this.fetchInitialState();
      this.connectWebSocket();
      this.startFallbackPoller();

      window.addEventListener('online', () => {
        void this.flushPendingUserOps();
        void this.fetchInitialState();
        this.connectWebSocket();
        this.reconnectSyncSubscribers.forEach(cb => cb());
      });
      window.addEventListener('focus', () => {
        void this.flushPendingUserOps();
        void this.fetchInitialState();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.flushPendingUserOps();
          void this.fetchInitialState();
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connectWebSocket();
          }
        }
      });
    }
  }

  private getAdminHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.adminToken) {
      headers['x-admin-token'] = this.adminToken;
    }
    return headers;
  }

  public setAdminToken(token: string | null) {
    this.adminToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem('cas9i_admin_token', token);
      } else {
        window.localStorage.removeItem('cas9i_admin_token');
      }
    }
  }

  public async verifyAdminSession(): Promise<'valid' | 'invalid' | 'error'> {
    if (!this.adminToken) return 'invalid';
    try {
      const res = await fetch('/api/auth/verify', {
        headers: this.getAdminHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return 'error';
      const data = await res.json();
      return data.valid ? 'valid' : 'invalid';
    } catch {
      return 'error';
    }
  }

  public async login(email: string, password: string): Promise<{
    ok: boolean;
    isAdmin?: boolean;
    adminBalance?: number;
    user?: RegisteredUser;
    placedBets?: PlacedBet[];
    fxPositions?: FXPosition[];
    needsVerification?: boolean;
    error?: string;
  }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        needsVerification: Boolean(data.needsVerification),
        error: data.error || 'Authentication failed.'
      };
    }
    if (data.isAdmin && data.adminToken) {
      this.setAdminToken(data.adminToken);
    } else {
      this.setAdminToken(null);
    }
    return {
      ok: true,
      isAdmin: Boolean(data.isAdmin),
      adminBalance: typeof data.adminBalance === 'number' ? data.adminBalance : undefined,
      user: data.user as RegisteredUser | undefined,
      placedBets: Array.isArray(data.placedBets) ? (data.placedBets as PlacedBet[]) : undefined,
      fxPositions: Array.isArray(data.fxPositions) ? (data.fxPositions as FXPosition[]) : undefined,
    };
  }

  public async loginWithGoogleAdmin(idToken: string): Promise<{
    ok: boolean;
    isAdmin?: boolean;
    adminBalance?: number;
    email?: string;
    error?: string;
  }> {
    const res = await fetch('/api/auth/google-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Google Admin authentication failed.' };
    }
    if (data.adminToken) {
      this.setAdminToken(data.adminToken);
    }
    return {
      ok: true,
      isAdmin: true,
      adminBalance: typeof data.adminBalance === 'number' ? data.adminBalance : 100000,
      email: typeof data.email === 'string' ? data.email : undefined,
    };
  }

  public async syncGoogleUserSession(idToken: string, user: RegisteredUser): Promise<{
    ok: boolean;
    user?: RegisteredUser;
    placedBets?: PlacedBet[];
    fxPositions?: FXPosition[];
    error?: string;
  }> {
    const res = await fetch('/api/auth/google-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, user }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Unable to sync Google session.' };
    }
    return {
      ok: true,
      user: data.user as RegisteredUser,
      placedBets: Array.isArray(data.placedBets) ? (data.placedBets as PlacedBet[]) : [],
      fxPositions: Array.isArray(data.fxPositions) ? (data.fxPositions as FXPosition[]) : [],
    };
  }

  public async registerUser(params: {
    username: string;
    fullName: string;
    email: string;
    password: string;
    avatar: string;
  }): Promise<{ ok: boolean; pendingUserId?: string; verificationCode?: string; email?: string; error?: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Registration failed.' };
    }
    return {
      ok: true,
      pendingUserId: data.pendingUserId,
      verificationCode: data.verificationCode,
      email: data.email
    };
  }

  public async verifyRegistration(email: string, code: string): Promise<{
    ok: boolean;
    user?: RegisteredUser;
    placedBets?: PlacedBet[];
    fxPositions?: FXPosition[];
    error?: string;
  }> {
    const res = await fetch('/api/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Verification failed.' };
    }
    return {
      ok: true,
      user: data.user as RegisteredUser,
      placedBets: Array.isArray(data.placedBets) ? (data.placedBets as PlacedBet[]) : [],
      fxPositions: Array.isArray(data.fxPositions) ? (data.fxPositions as FXPosition[]) : [],
    };
  }

  public async fetchUserSession(userId: string): Promise<
    | { status: 'ok'; user: RegisteredUser; placedBets: PlacedBet[]; fxPositions: FXPosition[] }
    | { status: 'not_found' }
    | { status: 'offline' }
  > {
    try {
      const res = await fetch(`/api/auth/session/${encodeURIComponent(userId)}`, { cache: 'no-store' });
      if (res.status === 404) return { status: 'not_found' };
      if (!res.ok) return { status: 'offline' };
      const data = await res.json();
      if (!data.ok || !data.user) return { status: 'offline' };
      return {
        status: 'ok',
        user: data.user as RegisteredUser,
        placedBets: Array.isArray(data.placedBets) ? (data.placedBets as PlacedBet[]) : [],
        fxPositions: Array.isArray(data.fxPositions) ? (data.fxPositions as FXPosition[]) : [],
      };
    } catch {
      return { status: 'offline' };
    }
  }

  public async updateOwnProfile(
    userId: string,
    updates: Partial<Pick<RegisteredUser, 'username' | 'fullName' | 'avatar' | 'phone' | 'country' | 'city' | 'address' | 'dateOfBirth'>>
  ): Promise<RegisteredUser> {
    const res = await fetch(`/api/auth/session/${encodeURIComponent(userId)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.user) {
      throw new Error(data.error || 'Unable to update profile.');
    }
    return data.user as RegisteredUser;
  }

  private readPendingUserOps(): PendingUserOps {
    if (typeof window === 'undefined') return { balanceDeltas: {}, betsSync: {} };
    try {
      const raw = window.localStorage.getItem(PENDING_USER_OPS_KEY);
      if (!raw) return { balanceDeltas: {}, betsSync: {} };
      const parsed = JSON.parse(raw) as Partial<PendingUserOps>;
      return {
        balanceDeltas: parsed.balanceDeltas && typeof parsed.balanceDeltas === 'object' ? parsed.balanceDeltas : {},
        betsSync: parsed.betsSync && typeof parsed.betsSync === 'object' ? parsed.betsSync : {},
      };
    } catch {
      return { balanceDeltas: {}, betsSync: {} };
    }
  }

  private writePendingUserOps(ops: PendingUserOps) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PENDING_USER_OPS_KEY, JSON.stringify(ops));
    } catch {
      // ignore storage quota errors
    }
  }

  private queuePendingBetsSync(
    userId: string,
    payload: { placedBets: PlacedBet[]; fxPositions: FXPosition[]; totalBetsPlaced: number; totalWon: number }
  ) {
    const ops = this.readPendingUserOps();
    ops.betsSync[userId] = payload;
    this.writePendingUserOps(ops);
  }

  private queuePendingBalanceDelta(userId: string, delta: number) {
    const ops = this.readPendingUserOps();
    ops.balanceDeltas[userId] = Math.round(((ops.balanceDeltas[userId] || 0) + delta) * 100) / 100;
    this.writePendingUserOps(ops);
  }

  public async flushPendingUserOps() {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    const ops = this.readPendingUserOps();
    let changed = false;

    for (const [userId, delta] of Object.entries(ops.balanceDeltas)) {
      if (!Number.isFinite(delta) || delta === 0) {
        delete ops.balanceDeltas[userId];
        changed = true;
        continue;
      }
      try {
        const res = userId === 'admin-cas9i'
          ? (this.adminToken
              ? await fetch('/api/auth/admin/balance', {
                  method: 'POST',
                  headers: this.getAdminHeaders(),
                  body: JSON.stringify({ delta }),
                })
              : null)
          : await fetch(`/api/auth/session/${encodeURIComponent(userId)}/balance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ delta }),
            });
        if (res && res.ok) {
          delete ops.balanceDeltas[userId];
          changed = true;
        }
      } catch {
        // still offline; keep queued
      }
    }

    for (const [userId, payload] of Object.entries(ops.betsSync)) {
      try {
        const res = await fetch(`/api/auth/session/${encodeURIComponent(userId)}/bets`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          delete ops.betsSync[userId];
          changed = true;
        }
      } catch {
        // still offline; keep queued
      }
    }

    if (changed) {
      this.writePendingUserOps(ops);
    }
  }

  public onReconnectSync(callback: () => void): () => void {
    this.reconnectSyncSubscribers.push(callback);
    return () => {
      this.reconnectSyncSubscribers = this.reconnectSyncSubscribers.filter(cb => cb !== callback);
    };
  }

  public syncUserBets(
    userId: string,
    payload: { placedBets: PlacedBet[]; fxPositions: FXPosition[]; totalBetsPlaced: number; totalWon: number }
  ) {
    if (!userId || userId === 'guest' || userId === 'admin-cas9i') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queuePendingBetsSync(userId, payload);
      return;
    }
    void fetch(`/api/auth/session/${encodeURIComponent(userId)}/bets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) this.queuePendingBetsSync(userId, payload);
      })
      .catch(() => {
        this.queuePendingBetsSync(userId, payload);
      });
  }

  public syncAdminBalanceDelta(delta: number) {
    if (!this.adminToken || !Number.isFinite(delta) || delta === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queuePendingBalanceDelta('admin-cas9i', delta);
      return;
    }
    void fetch('/api/auth/admin/balance', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ delta })
    })
      .then(res => {
        if (!res.ok) this.queuePendingBalanceDelta('admin-cas9i', delta);
      })
      .catch(() => {
        this.queuePendingBalanceDelta('admin-cas9i', delta);
      });
  }

  public syncUserBalanceDelta(userId: string, delta: number) {
    if (!userId || userId === 'guest' || !Number.isFinite(delta) || delta === 0) return;
    if (userId === 'admin-cas9i') {
      this.syncAdminBalanceDelta(delta);
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queuePendingBalanceDelta(userId, delta);
      return;
    }
    void fetch(`/api/auth/session/${encodeURIComponent(userId)}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    })
      .then(res => {
        if (!res.ok) this.queuePendingBalanceDelta(userId, delta);
      })
      .catch(() => {
        this.queuePendingBalanceDelta(userId, delta);
      });
  }

  private saveOfflineSnapshot(force = false) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (!force && now - this.lastSnapshotSaveAt < 2000) return;
    this.lastSnapshotSaveAt = now;
    try {
      const snapshot: OfflineSnapshot = {
        savedAt: now,
        matches: this.matches.slice(0, 260),
        h2hRecords: this.h2hRecords.slice(-600),
        fxAssets: this.fxAssets,
        clubs: this.clubs,
        leagues: this.leagues,
        tipsterBetcodes: this.tipsterBetcodes,
        leaderboard: this.leaderboard,
        liveTicker: this.liveTicker.slice(0, 30),
      };
      window.localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }

  private hydrateFromOfflineSnapshot() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
      if (!raw) {
        if (!navigator.onLine) {
          this.seedOfflineFallbackFixtures();
        }
        return;
      }
      const snap = JSON.parse(raw) as Partial<OfflineSnapshot>;
      if (Array.isArray(snap.clubs) && snap.clubs.length > 0) this.clubs = snap.clubs;
      if (Array.isArray(snap.leagues) && snap.leagues.length > 0) this.leagues = snap.leagues;
      if (Array.isArray(snap.h2hRecords)) this.h2hRecords = snap.h2hRecords;
      if (Array.isArray(snap.fxAssets)) this.fxAssets = snap.fxAssets;
      if (Array.isArray(snap.tipsterBetcodes)) this.tipsterBetcodes = snap.tipsterBetcodes;
      if (Array.isArray(snap.leaderboard)) this.leaderboard = snap.leaderboard;
      if (Array.isArray(snap.liveTicker)) this.liveTicker = snap.liveTicker;
      if (Array.isArray(snap.matches) && snap.matches.length > 0) {
        this.matches = snap.matches;
        // Catch up offline matches immediately using wall-clock elapsed time
        this.advanceMatchesOffline(Date.now(), false);
      } else if (!navigator.onLine) {
        this.seedOfflineFallbackFixtures();
      }
    } catch {
      if (!navigator.onLine) {
        this.seedOfflineFallbackFixtures();
      }
    }
  }

  private buildOfflineOdds(homeAtt: number, homeDef: number, awayAtt: number, awayDef: number) {
    const hPow = (homeAtt + homeDef) / 2 + 2;
    const aPow = (awayAtt + awayDef) / 2;
    const diff = (hPow - aPow) / 100;
    const home = Number(Math.max(1.35, Math.min(4.8, 2.25 - diff * 1.4)).toFixed(2));
    const away = Number(Math.max(1.4, Math.min(5.2, 2.55 + diff * 1.5)).toFixed(2));
    const draw = Number(Math.max(2.9, Math.min(4.6, 3.45 + Math.abs(diff) * 0.6)).toFixed(2));
    const overUnderLines = Array.from({ length: 16 }, (_, idx) => {
      const line = 15 + idx;
      const t = idx / 15;
      return {
        line,
        over: Number((2.0 + t * 14.5).toFixed(2)),
        under: Number((18.75 - t * 16.4).toFixed(2)),
      };
    });
    return {
      home,
      draw,
      away,
      firstGoalHome: Number(Math.max(1.55, home * 0.85).toFixed(2)),
      firstGoalAway: Number(Math.max(1.65, away * 0.88).toFixed(2)),
      fiveMinYes: 2.15,
      fiveMinNo: 1.68,
      fiveMinOver5: 3.4,
      ht1Over10: Number(Math.max(1.85, home * 1.12).toFixed(2)),
      htXOver10: 4.1,
      ht2Over10: Number(Math.max(1.95, away * 1.15).toFixed(2)),
      htOver15: 2.45,
      htUnder15: 1.55,
      sh1Over15: Number(Math.max(1.8, home * 1.05).toFixed(2)),
      shXOver15: 3.9,
      sh2Over15: Number(Math.max(1.9, away * 1.08).toFixed(2)),
      oddGoals: 1.92,
      evenGoals: 1.92,
      overUnderLines,
      correctScores: [
        { score: '12:9', odds: 14.5 },
        { score: '14:11', odds: 15.2 },
        { score: '15:10', odds: 16.0 },
        { score: '11:13', odds: 17.5 },
        { score: '16:12', odds: 19.0 },
        { score: '13:13', odds: 21.0 },
      ],
    };
  }

  private getPairRecentH2H(homeTeam: string, awayTeam: string): H2HRecord[] {
    const h = homeTeam.trim().toLowerCase();
    const a = awayTeam.trim().toLowerCase();
    return this.h2hRecords
      .filter(
        r =>
          (r.homeTeam.trim().toLowerCase() === h && r.awayTeam.trim().toLowerCase() === a) ||
          (r.homeTeam.trim().toLowerCase() === a && r.awayTeam.trim().toLowerCase() === h)
      )
      .sort((x, y) => y.playedAt - x.playedAt)
      .slice(0, 25);
  }

  private seedOfflineFallbackFixtures() {
    if (this.clubs.length < 2) this.clubs = [...OFFLINE_SEED_CLUBS];
    if (this.leagues.length === 0) this.leagues = [...OFFLINE_SEED_LEAGUES];
    const now = Date.now();
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const tomorrowKey = new Date(now + 86400000).toISOString().slice(0, 10);

    const pairs: Array<{ home: Club; away: Club }> = [];
    for (let i = 0; i < this.clubs.length; i += 1) {
      for (let j = i + 1; j < this.clubs.length; j += 1) {
        if (this.clubs[i].league === this.clubs[j].league) {
          pairs.push({ home: this.clubs[i], away: this.clubs[j] });
        }
      }
    }
    while (pairs.length < OFFLINE_DAILY_TARGET) {
      for (let i = 0; i < this.clubs.length && pairs.length < OFFLINE_DAILY_TARGET; i += 1) {
        const home = this.clubs[i];
        const away = this.clubs[(i + 1 + Math.floor(pairs.length / this.clubs.length)) % this.clubs.length];
        if (home.id !== away.id) pairs.push({ home, away });
      }
    }

    const generated: VirtualMatch[] = [];
    const buildBucket = (bucket: 'TODAY' | 'NEXT_DAY', dateStr: string, count: number) => {
      for (let idx = 0; idx < count; idx += 1) {
        const pair = pairs[idx % pairs.length];
        const waveIdx = Math.floor(idx / OFFLINE_MAX_LIVE_WAVE);
        const slot = idx % OFFLINE_MAX_LIVE_WAVE;
        const kickoffAt =
          bucket === 'TODAY'
            ? now + (4 + waveIdx * 72 + slot) * 60000
            : now + (24 * 60 + waveIdx * 72 + slot * 2) * 60000;
        const dt = new Date(kickoffAt);
        const hhmm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        generated.push({
          id: `offline-${dateStr}-${bucket.toLowerCase()}-${idx + 1}`,
          league: pair.home.league,
          country: pair.home.country,
          homeTeam: pair.home.name,
          awayTeam: pair.away.name,
          homeScore: 0,
          awayScore: 0,
          firstHalfHomeScore: 0,
          firstHalfAwayScore: 0,
          roundNumber: 1,
          minute: 0,
          durationMinutes: 60,
          status: 'UPCOMING',
          scheduledTime: bucket === 'TODAY' ? `Today ${hhmm}` : `Tomorrow ${hhmm}`,
          startsInSeconds: Math.max(10, Math.ceil((kickoffAt - now) / 1000)),
          kickoffAt,
          dayBucket: bucket,
          matchDate: dateStr,
          isSystemDaily: true,
          isFeatured: bucket === 'TODAY' && idx === 0,
          odds: this.buildOfflineOdds(pair.home.attack, pair.home.defense, pair.away.attack, pair.away.defense),
          oddsDirection: {},
          stats: {
            possessionHome: 52,
            possessionAway: 48,
            dangerousAttacksHome: 0,
            dangerousAttacksAway: 0,
            shotsOnTargetHome: 0,
            shotsOnTargetAway: 0,
            cornersHome: 0,
            cornersAway: 0,
          },
          events: [{ minute: 0, text: `Daily fixed match scheduled (60' standard): ${pair.home.name} vs ${pair.away.name}`, type: 'whistle' }],
          recentH2H: this.getPairRecentH2H(pair.home.name, pair.away.name),
        });
      }
    };

    buildBucket('TODAY', dayKey, OFFLINE_DAILY_TARGET);
    buildBucket('NEXT_DAY', tomorrowKey, OFFLINE_DAILY_TARGET);

    for (let idx = 0; idx < OFFLINE_ZOOM_TARGET; idx += 1) {
      const pair = pairs[(idx * 3) % pairs.length];
      const waveIdx = Math.floor(idx / 5);
      const slot = idx % 5;
      const kickoffAt = now + (45 + waveIdx * 120 + slot * 3) * 1000;
      generated.push({
        id: `offline-zoom-${dayKey}-${idx + 1}`,
        league: pair.home.league,
        country: pair.home.country,
        homeTeam: pair.home.name,
        awayTeam: pair.away.name,
        homeScore: 0,
        awayScore: 0,
        firstHalfHomeScore: 0,
        firstHalfAwayScore: 0,
        roundNumber: 1,
        minute: 0,
        durationMinutes: 2,
        durationSeconds: 90,
        elapsedSeconds: 0,
        isZoom: true,
        status: 'UPCOMING',
        scheduledTime: `Starts in ${Math.max(5, Math.ceil((kickoffAt - now) / 1000))}s`,
        startsInSeconds: Math.max(5, Math.ceil((kickoffAt - now) / 1000)),
        kickoffAt,
        dayBucket: 'TODAY',
        matchDate: dayKey,
        isSystemDaily: true,
        isFeatured: false,
        odds: this.buildOfflineOdds(pair.home.attack, pair.home.defense, pair.away.attack, pair.away.defense),
        oddsDirection: {},
        stats: {
          possessionHome: 51,
          possessionAway: 49,
          dangerousAttacksHome: 0,
          dangerousAttacksAway: 0,
          shotsOnTargetHome: 0,
          shotsOnTargetAway: 0,
          cornersHome: 0,
          cornersAway: 0,
        },
        events: [{ minute: 0, text: `Zoom 90s match scheduled: ${pair.home.name} vs ${pair.away.name}`, type: 'whistle' }],
        recentH2H: this.getPairRecentH2H(pair.home.name, pair.away.name),
      });
    }

    this.matches = generated;
    if (this.fxAssets.length === 0) {
      const defaultOdds = {
        '10m': { rise: 1.88, fall: 1.92 },
        '15m': { rise: 1.9, fall: 1.9 },
        '20m': { rise: 1.95, fall: 1.86 },
        '1h': { rise: 2.05, fall: 1.82 },
      };
      this.fxAssets = [
        {
          id: 'fx-eurusd',
          symbol: 'EUR/USD',
          name: 'Euro / US Dollar',
          category: 'forex',
          sector: 'Major Currency',
          region: 'Europe / US',
          description: 'Major EUR/USD virtual spot FX rate.',
          price: 1.0842,
          openPrice: 1.0842,
          high24h: 1.0885,
          low24h: 1.0801,
          decimals: 4,
          spread: '0.2 pips',
          volatilityLabel: 'Medium',
          trendDirection: 'FLAT',
          trendStrength: 50,
          changePercent: 0,
          oddsByDuration: defaultOdds,
          history: [{ time: now, price: 1.0842 }],
        },
        {
          id: 'fx-us10y',
          symbol: 'US10Y',
          name: 'US 10Y Treasury Yield',
          category: 'bonds',
          sector: 'Government Bonds',
          region: 'United States',
          description: '10-Year US Sovereign benchmark yield.',
          price: 4.245,
          openPrice: 4.245,
          high24h: 4.29,
          low24h: 4.21,
          decimals: 3,
          unitSuffix: '%',
          spread: '0.5 bps',
          yieldOrDividend: '4.25%',
          volatilityLabel: 'Low',
          trendDirection: 'FLAT',
          trendStrength: 48,
          changePercent: 0,
          oddsByDuration: defaultOdds,
          history: [{ time: now, price: 4.245 }],
        },
        {
          id: 'fx-nvda',
          symbol: 'NVDA',
          name: 'NVIDIA Virtual Equity',
          category: 'shares',
          sector: 'Semiconductors',
          region: 'United States',
          description: 'Global GPU & compute hardware index share.',
          price: 142.85,
          openPrice: 142.85,
          high24h: 145.1,
          low24h: 140.4,
          decimals: 2,
          unitPrefix: '$',
          spread: '$0.04',
          volatilityLabel: 'High',
          trendDirection: 'FLAT',
          trendStrength: 52,
          changePercent: 0,
          oddsByDuration: defaultOdds,
          history: [{ time: now, price: 142.85 }],
        },
      ];
    }
    this.saveOfflineSnapshot(true);
  }

  private mergeOfflineH2HRecords(incoming: H2HRecord[]): H2HRecord[] {
    const map = new Map<string, H2HRecord>();
    for (const r of this.h2hRecords) {
      const k = r.roundNumber ? `${r.matchId}:r${r.roundNumber}` : r.id;
      map.set(k, r);
    }
    for (const r of incoming) {
      const k = r.roundNumber ? `${r.matchId}:r${r.roundNumber}` : r.id;
      map.set(k, r);
    }
    const all = Array.from(map.values()).sort((a, b) => a.playedAt - b.playedAt);
    const nonZoom = all.filter(r => !r.isZoom).slice(-1500);
    const zoom = all.filter(r => Boolean(r.isZoom)).slice(-900);
    return [...nonZoom, ...zoom].sort((a, b) => a.playedAt - b.playedAt);
  }

  private advanceMatchesOffline(now: number, notify = true) {
    if (this.matches.length === 0) return;

    let anyChanged = false;
    const newlyRecorded: H2HRecord[] = [];
    const liveDailyNow = this.matches.filter(m => !m.isZoom && m.dayBucket !== 'NEXT_DAY' && m.status === 'LIVE').length;
    let activeDailyLive = liveDailyNow;

    const nextMatches = this.matches.map(raw => {
      let m: VirtualMatch = {
        ...raw,
        odds: {
          ...raw.odds,
          correctScores: [...(raw.odds.correctScores || [])],
          overUnderLines: [...(raw.odds.overUnderLines || [])],
        },
        stats: { ...raw.stats },
        events: [...raw.events],
        recentH2H: Array.isArray(raw.recentH2H) ? [...raw.recentH2H] : [],
        oddsDirection: {},
      };

      const isZoom = Boolean(m.isZoom);
      const durationMin = m.durationMinutes || 60;
      const zoomDurationSec = m.durationSeconds || 90;
      const matchDurationMs = isZoom ? zoomDurationSec * 1000 : durationMin * 60000;
      const resetDelayMs = isZoom ? 20000 : 20 * 60000;
      const cycleMs = matchDurationMs + resetDelayMs;
      const maxRounds = isZoom ? 3 : 8;

      if (m.kickoffAt && now - m.kickoffAt > maxRounds * cycleMs) {
        const skip = Math.floor((now - m.kickoffAt) / cycleMs) - maxRounds;
        if (skip > 0) {
          m.kickoffAt += skip * cycleMs;
          m.roundNumber = (m.roundNumber || 1) + skip;
          anyChanged = true;
        }
      }

      let roundsProcessed = 0;
      while (roundsProcessed < maxRounds + 1) {
        const kickoffMs = m.kickoffAt;
        if (!kickoffMs) break;

        if (now < kickoffMs) {
          const secsLeft = Math.max(1, Math.ceil((kickoffMs - now) / 1000));
          if (secsLeft !== m.startsInSeconds) {
            m.startsInSeconds = secsLeft;
            if (isZoom) {
              m.scheduledTime = secsLeft < 60 ? `Starts in ${secsLeft}s` : `Starts in ${Math.round(secsLeft / 60)}m`;
            }
            anyChanged = true;
          }
          break;
        }

        const elapsedMs = now - kickoffMs;
        const canStartLive =
          isZoom ||
          m.dayBucket === 'NEXT_DAY' ||
          elapsedMs >= matchDurationMs ||
          activeDailyLive < OFFLINE_MAX_LIVE_WAVE;

        if (m.status === 'UPCOMING') {
          if (!canStartLive) {
            m.startsInSeconds = 10;
            break;
          }
          m.status = 'LIVE';
          m.minute = 1;
          m.elapsedSeconds = isZoom ? 1 : undefined;
          m.startsInSeconds = 0;
          m.scheduledTime = 'Live Now';
          m.events = [
            {
              minute: 1,
              text: isZoom ? 'Kickoff! 90s Zoom simulation is LIVE.' : "Kickoff! 60' standard match is now LIVE.",
              type: 'whistle',
            },
            ...m.events.slice(0, 9),
          ];
          if (!isZoom && m.dayBucket !== 'NEXT_DAY') activeDailyLive += 1;
          anyChanged = true;
        }

        const applyOfflineGoal = (stepClock: number, isHome: boolean) => {
          if (isHome) m.homeScore += 1;
          else m.awayScore += 1;
          if (!m.firstGoalTeam) m.firstGoalTeam = isHome ? 'home' : 'away';
          const fiveThreshold = isZoom ? 8 : 5;
          const halfThreshold = isZoom ? 45 : 30;
          if (stepClock <= fiveThreshold) m.hadFiveMinGoal = true;
          if (stepClock <= halfThreshold) {
            if (isHome) m.firstHalfHomeScore = (m.firstHalfHomeScore || 0) + 1;
            else m.firstHalfAwayScore = (m.firstHalfAwayScore || 0) + 1;
          }
          const teamName = isHome ? m.homeTeam : m.awayTeam;
          m.events = [
            {
              minute: stepClock,
              text: `GOAL! ${teamName} (${m.homeScore} - ${m.awayScore})`,
              type: 'goal',
              team: isHome ? 'home' : 'away',
            },
            ...m.events.slice(0, 14),
          ];
        };

        if (isZoom) {
          const targetSec = Math.min(zoomDurationSec, Math.max(1, Math.floor(elapsedMs / 1000) + 1));
          const curSec = Math.max(0, m.elapsedSeconds || 0);
          const steps = Math.max(0, Math.floor((Math.min(elapsedMs >= matchDurationMs ? zoomDurationSec : targetSec, zoomDurationSec) - curSec) / 1.5));
          for (let s = 1; s <= steps; s += 1) {
            const stepSec = Math.min(zoomDurationSec, Math.round(curSec + s * 1.5));
            m.elapsedSeconds = stepSec;
            m.minute = Math.min(60, Math.max(1, Math.ceil((stepSec / zoomDurationSec) * 60)));
            if (Math.random() < 0.24) {
              applyOfflineGoal(stepSec, Math.random() < (m.stats.possessionHome || 50) / 100);
            }
          }
          if (targetSec !== m.elapsedSeconds) {
            m.elapsedSeconds = targetSec;
            m.minute = Math.min(60, Math.max(1, Math.ceil((targetSec / zoomDurationSec) * 60)));
            anyChanged = true;
          }
        } else {
          const targetMin = Math.min(durationMin, Math.max(1, Math.floor(elapsedMs / 60000) + 1));
          const curMin = Math.max(0, m.minute || 0);
          const endMin = elapsedMs >= matchDurationMs ? durationMin : targetMin;
          if (endMin > curMin) {
            for (let min = curMin + 1; min <= endMin; min += 1) {
              m.minute = min;
              if (Math.random() < 0.352) {
                applyOfflineGoal(min, Math.random() < (m.stats.possessionHome || 50) / 100);
              }
            }
            anyChanged = true;
          }
        }

        if (elapsedMs >= matchDurationMs) {
          const roundNo = m.roundNumber || 1;
          const conclusionAt = kickoffMs + matchDurationMs;
          const record: H2HRecord = {
            id: `h2h-${m.id}-r${roundNo}`,
            matchId: m.id,
            roundNumber: roundNo,
            league: m.league,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            firstHalfHomeScore: m.firstHalfHomeScore || 0,
            firstHalfAwayScore: m.firstHalfAwayScore || 0,
            firstGoalTeam: m.firstGoalTeam,
            hadFiveMinGoal: m.hadFiveMinGoal,
            isZoom,
            playedAt: conclusionAt,
          };
          newlyRecorded.push(record);

          const prevRecent = Array.isArray(m.recentH2H) ? m.recentH2H : [];
          const nextRecent = [record, ...prevRecent.filter(r => !(r.matchId === record.matchId && r.roundNumber === record.roundNumber))].slice(0, 25);
          const nextRound = roundNo + 1;
          const nextKickoff = conclusionAt + resetDelayMs;
          const nextStartSec = Math.max(5, Math.ceil((nextKickoff - now) / 1000));
          const dtNext = new Date(nextKickoff);
          const hhmmNext = `${String(dtNext.getHours()).padStart(2, '0')}:${String(dtNext.getMinutes()).padStart(2, '0')}`;

          m = {
            ...m,
            homeScore: 0,
            awayScore: 0,
            firstHalfHomeScore: 0,
            firstHalfAwayScore: 0,
            firstGoalTeam: undefined,
            hadFiveMinGoal: false,
            roundNumber: nextRound,
            minute: 0,
            elapsedSeconds: isZoom ? 0 : undefined,
            status: 'UPCOMING',
            kickoffAt: nextKickoff,
            startsInSeconds: nextStartSec,
            scheduledTime: isZoom
              ? `Starts in ${nextStartSec}s`
              : `${m.dayBucket === 'NEXT_DAY' ? 'Tomorrow' : 'Today'} ${hhmmNext}`,
            events: [
              {
                minute: 0,
                text: isZoom
                  ? `Zoom 90s Round #${nextRound} ready: ${m.homeTeam} vs ${m.awayTeam}`
                  : `Virtual 60' Round #${nextRound} ready: ${m.homeTeam} vs ${m.awayTeam}`,
                type: 'whistle',
              },
            ],
            recentH2H: nextRecent,
          };
          anyChanged = true;
          roundsProcessed += 1;
        } else {
          break;
        }
      }

      return m;
    });

    // Advance FX market ticks gently when offline
    if (this.fxAssets.length > 0 && notify) {
      this.fxAssets = this.fxAssets.map(asset => {
        const deltaPct = (Math.random() - 0.495) * 0.0022;
        const decimals = typeof asset.decimals === 'number' ? asset.decimals : asset.price > 100 ? 2 : 4;
        const nextPrice = Number(Math.max(0.01, asset.price * (1 + deltaPct)).toFixed(decimals));
        const trendDirection: 'RISING' | 'FALLING' | 'FLAT' =
          nextPrice > asset.price ? 'RISING' : nextPrice < asset.price ? 'FALLING' : 'FLAT';
        const changePercent = asset.openPrice > 0 ? Number((((nextPrice - asset.openPrice) / asset.openPrice) * 100).toFixed(2)) : 0;
        return {
          ...asset,
          price: nextPrice,
          high24h: Math.max(asset.high24h, nextPrice),
          low24h: Math.min(asset.low24h, nextPrice),
          changePercent,
          trendDirection,
          history: [...asset.history.slice(-29), { time: now, price: nextPrice }],
        };
      });
      this.fxSubscribers.forEach(cb => cb(this.fxAssets));
    }

    if (newlyRecorded.length > 0) {
      this.h2hRecords = this.mergeOfflineH2HRecords(newlyRecorded);
      if (notify) {
        this.h2hSubscribers.forEach(cb => cb(this.h2hRecords));
      }
    }

    if (anyChanged) {
      this.matches = nextMatches;
      this.offlineSimDirty = true;
      this.saveOfflineSnapshot(newlyRecorded.length > 0);
      if (notify) {
        this.matchSubscribers.forEach(cb => cb(this.matches));
      }
    }
  }

  private startOfflineSimLoop() {
    if (this.offlineSimId || typeof window === 'undefined') return;
    this.offlineSimId = setInterval(() => {
      const wsOpen = Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
      const isDisconnected = !navigator.onLine || (!wsOpen && Date.now() - this.lastServerContactAt >= 4500);
      if (!isDisconnected) return;
      if (this.matches.length === 0) {
        this.seedOfflineFallbackFixtures();
        this.matchSubscribers.forEach(cb => cb(this.matches));
        this.fxSubscribers.forEach(cb => cb(this.fxAssets));
        this.clubSubscribers.forEach(cb => cb(this.clubs));
        this.leagueSubscribers.forEach(cb => cb(this.leagues));
      }
      this.advanceMatchesOffline(Date.now(), true);
    }, 1500);
  }

  private resetSliceVersionsForReconnect() {
    if (!this.offlineSimDirty) return;
    this.offlineSimDirty = false;
    this.stateVersion = 0;
    this.sliceVersions = {
      clubs: 0,
      leagues: 0,
      matches: 0,
      tipster: 0,
      h2h: 0,
      fx: 0,
      leaderboard: 0,
      ticker: 0,
      users: this.sliceVersions.users,
    };
  }

  private async fetchInitialState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.lastServerContactAt = Date.now();
      this.resetSliceVersionsForReconnect();
      this.applyFullState(data);
      void this.flushPendingUserOps();
    } catch {
      if (this.matches.length === 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
        this.seedOfflineFallbackFixtures();
        this.matchSubscribers.forEach(cb => cb(this.matches));
      }
    }
  }

  private applySlice<T>(
    slice: keyof VirtualEngineService['sliceVersions'],
    incoming: T[] | undefined,
    incomingVersion: number | undefined,
    applyValue: (val: T[]) => void
  ) {
    if (!Array.isArray(incoming)) return;
    if (typeof incomingVersion === 'number') {
      if (incomingVersion < this.sliceVersions[slice]) {
        return;
      }
      if (this.sliceVersions[slice] !== 0 && incomingVersion === this.sliceVersions[slice]) {
        return;
      }
      this.sliceVersions[slice] = incomingVersion;
    }
    applyValue(incoming);
  }

  private applyFullState(data: {
    version?: number;
    versions?: Partial<VirtualEngineService['sliceVersions']>;
    matches?: VirtualMatch[];
    tipsterBetcodes?: TipsterBetcode[];
    h2hRecords?: H2HRecord[];
    fxAssets?: FXAsset[];
    clubs?: Club[];
    leagues?: League[];
    leaderboard?: LeaderboardEntry[];
    ticker?: LiveBetTickerItem[];
  }) {
    if (typeof data.version === 'number' && data.version > this.stateVersion) {
      this.stateVersion = data.version;
    }

    const v = data.versions;

    this.applySlice('matches', data.matches, v?.matches, val => {
      this.matches = val;
      this.matchSubscribers.forEach(cb => cb(this.matches));
    });
    this.applySlice('tipster', data.tipsterBetcodes, v?.tipster, val => {
      this.tipsterBetcodes = val;
      this.tipsterSubscribers.forEach(cb => cb(this.tipsterBetcodes));
    });
    this.applySlice('h2h', data.h2hRecords, v?.h2h, val => {
      this.h2hRecords = val;
      this.h2hSubscribers.forEach(cb => cb(this.h2hRecords));
    });
    this.applySlice('fx', data.fxAssets, v?.fx, val => {
      this.fxAssets = val;
      this.fxSubscribers.forEach(cb => cb(this.fxAssets));
    });
    this.applySlice('clubs', data.clubs, v?.clubs, val => {
      this.clubs = val;
      this.clubSubscribers.forEach(cb => cb(this.clubs));
    });
    this.applySlice('leagues', data.leagues, v?.leagues, val => {
      this.leagues = val;
      this.leagueSubscribers.forEach(cb => cb(this.leagues));
    });
    this.applySlice('leaderboard', data.leaderboard, v?.leaderboard, val => {
      this.leaderboard = val;
      this.leaderboardSubscribers.forEach(cb => cb(this.leaderboard));
    });
    this.applySlice('ticker', data.ticker, v?.ticker, val => {
      this.liveTicker = val;
      this.tickerSubscribers.forEach(cb => cb(this.liveTicker));
    });

    if (typeof v?.users === 'number' && v.users > this.sliceVersions.users) {
      this.sliceVersions.users = v.users;
      this.usersChangedSubscribers.forEach(cb => cb());
    }

    this.saveOfflineSnapshot(false);
  }

  private connectWebSocket() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.lastServerContactAt = Date.now();
        this.resetSliceVersionsForReconnect();
        void this.flushPendingUserOps();
        void this.fetchInitialState();
        if (this.heartbeatId) clearInterval(this.heartbeatId);
        this.heartbeatId = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 10000);
      };

      socket.onmessage = evt => {
        try {
          const msg = JSON.parse(evt.data);
          this.lastServerContactAt = Date.now();
          if (typeof msg.version === 'number' && msg.version > this.stateVersion) {
            this.stateVersion = msg.version;
          }
          const incomingSliceVer = typeof msg.sliceVersion === 'number' ? msg.sliceVersion : undefined;
          switch (msg.type) {
            case 'init':
              this.resetSliceVersionsForReconnect();
              this.applyFullState({
                version: msg.version,
                versions: msg.versions,
                ...(msg.data || {}),
              });
              break;
            case 'state:matches':
              this.resetSliceVersionsForReconnect();
              this.applySlice<VirtualMatch>('matches', msg.data, incomingSliceVer ?? msg.versions?.matches, val => {
                this.matches = val;
                this.matchSubscribers.forEach(cb => cb(this.matches));
              });
              this.saveOfflineSnapshot(false);
              break;
            case 'state:tipster':
              this.applySlice<TipsterBetcode>('tipster', msg.data, incomingSliceVer ?? msg.versions?.tipster, val => {
                this.tipsterBetcodes = val;
                this.tipsterSubscribers.forEach(cb => cb(this.tipsterBetcodes));
              });
              break;
            case 'state:h2h':
              this.applySlice<H2HRecord>('h2h', msg.data, incomingSliceVer ?? msg.versions?.h2h, val => {
                this.h2hRecords = val;
                this.h2hSubscribers.forEach(cb => cb(this.h2hRecords));
              });
              break;
            case 'state:fx':
              this.applySlice<FXAsset>('fx', msg.data, incomingSliceVer ?? msg.versions?.fx, val => {
                this.fxAssets = val;
                this.fxSubscribers.forEach(cb => cb(this.fxAssets));
              });
              break;
            case 'state:clubs':
              this.applySlice<Club>('clubs', msg.data, incomingSliceVer ?? msg.versions?.clubs, val => {
                this.clubs = val;
                this.clubSubscribers.forEach(cb => cb(this.clubs));
              });
              break;
            case 'state:leagues':
              this.applySlice<League>('leagues', msg.data, incomingSliceVer ?? msg.versions?.leagues, val => {
                this.leagues = val;
                this.leagueSubscribers.forEach(cb => cb(this.leagues));
              });
              break;
            case 'state:leaderboard':
              this.applySlice<LeaderboardEntry>('leaderboard', msg.data, incomingSliceVer ?? msg.versions?.leaderboard, val => {
                this.leaderboard = val;
                this.leaderboardSubscribers.forEach(cb => cb(this.leaderboard));
              });
              break;
            case 'state:ticker':
              this.applySlice<LiveBetTickerItem>('ticker', msg.data, incomingSliceVer ?? msg.versions?.ticker, val => {
                this.liveTicker = val;
                this.tickerSubscribers.forEach(cb => cb(this.liveTicker));
              });
              break;
            case 'event:goal':
              if (msg.data?.match && msg.data?.text) {
                this.goalAlertSubscribers.forEach(cb => cb(msg.data));
              }
              break;
            case 'event:users-changed':
              this.usersChangedSubscribers.forEach(cb => cb());
              break;
            case 'event:user-updated':
              if (msg.data?.id) {
                this.userUpdatedSubscribers.forEach(cb => cb(msg.data as RegisteredUser));
              }
              break;
            case 'event:user-deleted':
              if (msg.data?.userId) {
                this.userDeletedSubscribers.forEach(cb => cb(String(msg.data.userId)));
              }
              break;
            case 'event:user-bets-reset':
              if (msg.data?.userId) {
                this.userBetsResetSubscribers.forEach(cb => cb(String(msg.data.userId)));
              }
              break;
            default:
              break;
          }
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (this.heartbeatId) {
          clearInterval(this.heartbeatId);
          this.heartbeatId = null;
        }
        this.ws = null;
        const delay = Math.min(8000, 800 * Math.pow(1.5, this.reconnectAttempts));
        this.reconnectAttempts += 1;
        setTimeout(() => this.connectWebSocket(), delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Fallback poller keeps syncing if WebSocket fails
    }
  }

  private startFallbackPoller() {
    if (this.fallbackPollId) return;
    this.fallbackPollId = setInterval(async () => {
      try {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          await this.fetchInitialState();
          return;
        }
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const remote = data.versions as Partial<VirtualEngineService['sliceVersions']> | undefined;
        const hasDiff = remote
          ? (
              (typeof remote.clubs === 'number' && remote.clubs > this.sliceVersions.clubs) ||
              (typeof remote.leagues === 'number' && remote.leagues > this.sliceVersions.leagues) ||
              (typeof remote.matches === 'number' && remote.matches > this.sliceVersions.matches) ||
              (typeof remote.tipster === 'number' && remote.tipster > this.sliceVersions.tipster) ||
              (typeof remote.h2h === 'number' && remote.h2h > this.sliceVersions.h2h) ||
              (typeof remote.fx === 'number' && remote.fx > this.sliceVersions.fx) ||
              (typeof remote.leaderboard === 'number' && remote.leaderboard > this.sliceVersions.leaderboard) ||
              (typeof remote.ticker === 'number' && remote.ticker > this.sliceVersions.ticker)
            )
          : (typeof data.version === 'number' && data.version > this.stateVersion);

        if (remote && typeof remote.users === 'number' && remote.users > this.sliceVersions.users) {
          this.sliceVersions.users = remote.users;
          this.usersChangedSubscribers.forEach(cb => cb());
        }

        if (hasDiff) {
          await this.fetchInitialState();
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  }

  public getMatches(): VirtualMatch[] {
    return this.matches;
  }

  public getTipsterBetcodes(): TipsterBetcode[] {
    return this.tipsterBetcodes;
  }

  public getH2HRecords(): H2HRecord[] {
    return this.h2hRecords;
  }

  public getFxAssets(): FXAsset[] {
    return this.fxAssets;
  }

  public getClubs(): Club[] {
    return this.clubs;
  }

  public getLeagues(): League[] {
    return this.leagues;
  }

  public getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  public getLiveTicker(): LiveBetTickerItem[] {
    return this.liveTicker;
  }

  public subscribeClubs(callback: (clubs: Club[]) => void): () => void {
    this.clubSubscribers.push(callback);
    callback(this.clubs);
    return () => {
      this.clubSubscribers = this.clubSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeLeagues(callback: (leagues: League[]) => void): () => void {
    this.leagueSubscribers.push(callback);
    callback(this.leagues);
    return () => {
      this.leagueSubscribers = this.leagueSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeMatches(callback: (matches: VirtualMatch[]) => void): () => void {
    this.matchSubscribers.push(callback);
    callback(this.matches);
    return () => {
      this.matchSubscribers = this.matchSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeTipsterBetcodes(callback: (betcodes: TipsterBetcode[]) => void): () => void {
    this.tipsterSubscribers.push(callback);
    callback(this.tipsterBetcodes);
    return () => {
      this.tipsterSubscribers = this.tipsterSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeH2H(callback: (records: H2HRecord[]) => void): () => void {
    this.h2hSubscribers.push(callback);
    callback(this.h2hRecords);
    return () => {
      this.h2hSubscribers = this.h2hSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeFxAssets(callback: (assets: FXAsset[]) => void): () => void {
    this.fxSubscribers.push(callback);
    callback(this.fxAssets);
    return () => {
      this.fxSubscribers = this.fxSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeLeaderboard(callback: (leaderboard: LeaderboardEntry[]) => void): () => void {
    this.leaderboardSubscribers.push(callback);
    callback(this.leaderboard);
    return () => {
      this.leaderboardSubscribers = this.leaderboardSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeTicker(callback: (ticker: LiveBetTickerItem[]) => void): () => void {
    this.tickerSubscribers.push(callback);
    callback(this.liveTicker);
    return () => {
      this.tickerSubscribers = this.tickerSubscribers.filter(cb => cb !== callback);
    };
  }

  public onGoalAlert(callback: (alert: { match: VirtualMatch; text: string }) => void): () => void {
    this.goalAlertSubscribers.push(callback);
    return () => {
      this.goalAlertSubscribers = this.goalAlertSubscribers.filter(cb => cb !== callback);
    };
  }

  public onUsersChanged(callback: () => void): () => void {
    this.usersChangedSubscribers.push(callback);
    return () => {
      this.usersChangedSubscribers = this.usersChangedSubscribers.filter(cb => cb !== callback);
    };
  }

  public onUserUpdated(callback: (user: RegisteredUser) => void): () => void {
    this.userUpdatedSubscribers.push(callback);
    return () => {
      this.userUpdatedSubscribers = this.userUpdatedSubscribers.filter(cb => cb !== callback);
    };
  }

  public onUserDeleted(callback: (userId: string) => void): () => void {
    this.userDeletedSubscribers.push(callback);
    return () => {
      this.userDeletedSubscribers = this.userDeletedSubscribers.filter(cb => cb !== callback);
    };
  }

  public onUserBetsReset(callback: (userId: string) => void): () => void {
    this.userBetsResetSubscribers.push(callback);
    return () => {
      this.userBetsResetSubscribers = this.userBetsResetSubscribers.filter(cb => cb !== callback);
    };
  }

  public async fetchAdminUsers(): Promise<RegisteredUser[]> {
    const res = await fetch('/api/admin/users', {
      headers: this.getAdminHeaders(),
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load users.');
    }
    return (data.users || []) as RegisteredUser[];
  }

  public async pushCloudSyncToServer(payload: {
    users: RegisteredUser[];
    deletedUserIds: string[];
    clubs: Club[];
    deletedClubIds: string[];
    leagues: League[];
    matches: Array<{
      id: string;
      league: string;
      country: string;
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      minute: number;
      status: 'UPCOMING' | 'LIVE' | 'FINISHED';
      startsInSeconds: number;
      isFeatured?: boolean;
      homeOdds: number;
      drawOdds: number;
      awayOdds: number;
    }>;
    dtmRules?: DtmMatchRule[];
    h2hRecords?: H2HRecord[];
  }): Promise<RegisteredUser[] | null> {
    if (!this.adminToken) return null;
    const res = await fetch('/api/admin/cloud-sync', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    this.applyFullState({
      clubs: data.clubs,
      leagues: data.leagues,
      matches: data.matches,
      h2hRecords: data.h2hRecords,
      versions: data.versions,
    });
    return Array.isArray(data.users) ? (data.users as RegisteredUser[]) : null;
  }

  public async searchAdminSoccerMatches(query: string): Promise<{ verified: boolean; matches: VirtualMatch[]; error?: string }> {
    const res = await fetch(`/api/admin/matches/search?q=${encodeURIComponent(query.trim())}`, {
      headers: this.getAdminHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Unable to verify match.');
    }
    return {
      verified: Boolean(data.verified),
      matches: (data.matches || []) as VirtualMatch[],
      error: typeof data.error === 'string' ? data.error : undefined,
    };
  }

  public async fetchAdminDtmRules(): Promise<DtmMatchRule[]> {
    const res = await fetch('/api/admin/dtm', {
      headers: this.getAdminHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load configurations.');
    }
    return (data.dtmRules || []) as DtmMatchRule[];
  }

  public async saveAdminDtmRule(rule: DtmMatchRule): Promise<{ rule: DtmMatchRule; dtmRules: DtmMatchRule[] }> {
    const res = await fetch(`/api/admin/dtm/${encodeURIComponent(rule.id)}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(rule),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to save configuration.');
    }
    return {
      rule: data.rule as DtmMatchRule,
      dtmRules: (data.dtmRules || []) as DtmMatchRule[],
    };
  }

  public async toggleAdminDtmRule(ruleId: string, enabled: boolean): Promise<{ rule: DtmMatchRule; dtmRules: DtmMatchRule[] }> {
    const res = await fetch(`/api/admin/dtm/${encodeURIComponent(ruleId)}/toggle`, {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to update status.');
    }
    return {
      rule: data.rule as DtmMatchRule,
      dtmRules: (data.dtmRules || []) as DtmMatchRule[],
    };
  }

  public async deleteAdminDtmRule(ruleId: string): Promise<DtmMatchRule[]> {
    const res = await fetch(`/api/admin/dtm/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to remove configuration.');
    }
    return (data.dtmRules || []) as DtmMatchRule[];
  }

  public async lookupAdminUserById(userId: string): Promise<RegisteredUser> {
    const cleanId = userId.trim().replace(/^#/, '');
    const res = await fetch(`/api/admin/users/lookup?id=${encodeURIComponent(cleanId)}`, {
      headers: this.getAdminHeaders(),
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.user) {
      throw new Error(data.error || 'error');
    }
    return data.user as RegisteredUser;
  }

  public async updateAdminUser(userId: string, updates: Partial<RegisteredUser>): Promise<{ user: RegisteredUser; users: RegisteredUser[] }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to update user.');
    }
    return {
      user: data.user as RegisteredUser,
      users: (data.users || []) as RegisteredUser[],
    };
  }

  public async deleteAdminUser(userId: string): Promise<RegisteredUser[]> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to delete user.');
    }
    return (data.users || []) as RegisteredUser[];
  }

  public async depositToUser(userId: string, amount: number): Promise<{ user: RegisteredUser; users: RegisteredUser[]; depositedAmount: number }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/deposit`, {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'error');
    }
    return {
      user: data.user as RegisteredUser,
      users: (data.users || []) as RegisteredUser[],
      depositedAmount: Number(data.depositedAmount) || amount,
    };
  }

  public async resetAdminUserBets(userId: string): Promise<{ user: RegisteredUser; users: RegisteredUser[] }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-bets`, {
      method: 'POST',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to reset user check bets.');
    }
    return {
      user: data.user as RegisteredUser,
      users: (data.users || []) as RegisteredUser[],
    };
  }

  public async createClub(clubInput: Omit<Club, 'id'>): Promise<Club> {
    const res = await fetch('/api/admin/clubs', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(clubInput)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create club.');
    }
    this.applyFullState({ clubs: data.clubs, leagues: data.leagues, versions: data.versions });
    return data.club as Club;
  }

  public async createClubsBulk(params: {
    clubs: Array<{ name: string; shortName?: string; league?: string; country?: string; attack?: number; defense?: number }>;
    defaultLeague: string;
    defaultCountry: string;
  }): Promise<Club[]> {
    const res = await fetch('/api/admin/clubs/bulk', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save written clubs.');
    }
    this.applyFullState({ clubs: data.clubs, leagues: data.leagues, versions: data.versions });
    return data.createdClubs as Club[];
  }

  public async deleteClub(clubId: string): Promise<void> {
    const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete club.');
    }
    this.applyFullState({ clubs: data.clubs, versions: data.versions });
  }

  public async autoGenerateFiveClubs(): Promise<Club[]> {
    const res = await fetch('/api/admin/clubs/auto-generate', {
      method: 'POST',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to auto-generate 5 clubs.');
    }
    this.applyFullState({ clubs: data.clubs, versions: data.versions });
    return data.createdClubs as Club[];
  }

  public async deployThreeClubsPerLeague(): Promise<{ createdClubs: Club[]; leagueCount: number }> {
    const res = await fetch('/api/admin/clubs/deploy-per-league', {
      method: 'POST',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to auto-deploy clubs to leagues.');
    }
    this.applyFullState({ clubs: data.clubs, versions: data.versions });
    return {
      createdClubs: data.createdClubs as Club[],
      leagueCount: Number(data.leagueCount) || 0
    };
  }

  public async createLeague(leagueInput: { name: string; country: string; icon: string }): Promise<League> {
    const res = await fetch('/api/admin/leagues', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(leagueInput)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create custom league.');
    }
    this.applyFullState({ leagues: data.leagues, versions: data.versions });
    return data.league as League;
  }

  public async fixMatchBetweenClubs(params: {
    homeClub: Club;
    awayClub: Club;
    league: string;
    status: 'UPCOMING' | 'LIVE';
    startsInSeconds: number;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    isFeatured: boolean;
  }): Promise<VirtualMatch> {
    const res = await fetch('/api/admin/matches/fix', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({
        homeClubId: params.homeClub.id,
        awayClubId: params.awayClub.id,
        league: params.league,
        status: params.status,
        startsInSeconds: params.startsInSeconds,
        homeOdds: params.homeOdds,
        drawOdds: params.drawOdds,
        awayOdds: params.awayOdds,
        isFeatured: params.isFeatured
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fix match.');
    }
    this.applyFullState({ matches: data.matches, leagues: data.leagues, versions: data.versions });
    return data.match as VirtualMatch;
  }

  public async fixPresetBatch(type: 'featured' | 'copa_and_euro' | 'all'): Promise<void> {
    const res = await fetch('/api/admin/matches/preset', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to publish preset fixtures.');
    }
    this.applyFullState({ matches: data.matches, leagues: data.leagues, versions: data.versions });
  }

  public async kickoffMatchNow(matchId: string): Promise<void> {
    const res = await fetch(`/api/admin/matches/${encodeURIComponent(matchId)}/kickoff`, {
      method: 'POST',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      this.applyFullState({ matches: data.matches, versions: data.versions });
    }
  }

  public async triggerAdminGoal(matchId: string, team: 'home' | 'away'): Promise<void> {
    const res = await fetch(`/api/admin/matches/${encodeURIComponent(matchId)}/goal`, {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ team })
    });
    const data = await res.json();
    if (res.ok) {
      this.applyFullState({ matches: data.matches, versions: data.versions });
    }
  }

  public async removeMatch(matchId: string): Promise<void> {
    const res = await fetch(`/api/admin/matches/${encodeURIComponent(matchId)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      this.applyFullState({ matches: data.matches, versions: data.versions });
    }
  }

  public async resetAllMatches(): Promise<void> {
    const res = await fetch('/api/admin/matches/reset', {
      method: 'POST',
      headers: this.getAdminHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      this.applyFullState({ matches: data.matches, tipsterBetcodes: data.tipsterBetcodes, versions: data.versions });
    }
  }

  public recordUserWin(username: string, amount: number, multiplier: number, game: string) {
    void fetch('/api/ticker/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, amount, multiplier, game })
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          this.applyFullState({ ticker: data.ticker, leaderboard: data.leaderboard, versions: data.versions });
        }
      })
      .catch(() => {
        // ignore non-critical telemetry failure
      });
  }

  private evaluateSelectionAgainstResult(sel: BetSelection, res: {
    homeScore: number;
    awayScore: number;
    firstHalfHomeScore: number;
    firstHalfAwayScore: number;
    firstGoalTeam?: 'home' | 'away';
    hadFiveMinGoal?: boolean;
  }): boolean {
    const totalGoals = res.homeScore + res.awayScore;
    const firstHalfTotal = res.firstHalfHomeScore + res.firstHalfAwayScore;
    const shHome = Math.max(0, res.homeScore - res.firstHalfHomeScore);
    const shAway = Math.max(0, res.awayScore - res.firstHalfAwayScore);
    const shTotal = shHome + shAway;
    const homeWon = res.homeScore > res.awayScore;
    const awayWon = res.awayScore > res.homeScore;
    const draw = res.homeScore === res.awayScore;

    if (sel.marketType === '1X2') {
      if (sel.selection === 'Home & O15' || sel.selection === '1') return homeWon && totalGoals > 15;
      if (sel.selection === 'Away & O15' || sel.selection === '2') return awayWon && totalGoals > 15;
      if (sel.selection === 'Draw' || sel.selection === 'X') return draw;
    }
    if (sel.marketType === '1st Goal') {
      if (sel.selection === 'Home') return res.firstGoalTeam === 'home';
      if (sel.selection === 'Away') return res.firstGoalTeam === 'away';
    }
    if (sel.marketType === '5 Min Goal') {
      if (sel.selection === 'Yes') return Boolean(res.hadFiveMinGoal);
      if (sel.selection === 'No') return !res.hadFiveMinGoal;
      if (sel.selection === 'Over 5 Goals') return totalGoals > 5;
    }
    if (sel.marketName === '1st Half O/U 15') {
      if (sel.selection === 'Over 15') return firstHalfTotal > 15;
      if (sel.selection === 'Under 15') return firstHalfTotal < 15;
    }
    if (sel.marketType === '1st Half') {
      if (sel.selection === 'Home & O10') return res.firstHalfHomeScore > res.firstHalfAwayScore && firstHalfTotal > 10;
      if (sel.selection === 'X & O10') return res.firstHalfHomeScore === res.firstHalfAwayScore && firstHalfTotal > 10;
      if (sel.selection === 'Away & O10') return res.firstHalfAwayScore > res.firstHalfHomeScore && firstHalfTotal > 10;
    }
    if (sel.marketType === '2nd Half') {
      if (sel.selection === 'Home & O15') return shHome > shAway && shTotal > 15;
      if (sel.selection === 'X & O15') return shHome === shAway && shTotal > 15;
      if (sel.selection === 'Away & O15') return shAway > shHome && shTotal > 15;
    }
    if (sel.marketType === 'Odd/Even') {
      if (sel.selection === 'Odd') return totalGoals % 2 !== 0;
      if (sel.selection === 'Even') return totalGoals % 2 === 0;
    }
    if (sel.marketType === 'Over/Under') {
      const parts = sel.selection.split(' ');
      const side = parts[0];
      const line = Number(parts[1]);
      if (!Number.isNaN(line)) {
        if (side === 'Over') return totalGoals > line;
        if (side === 'Under') return totalGoals < line;
      }
    }
    if (sel.marketType === 'Correct Score') {
      return sel.selection === `${res.homeScore}:${res.awayScore}`;
    }
    return false;
  }

  private findSelectionH2HResult(sel: BetSelection, betTimestamp: number): H2HRecord | undefined {
    const matchObj = this.matches.find(m => m.id === sel.matchId);
    const embedded = Array.isArray(matchObj?.recentH2H) ? matchObj.recentH2H : [];
    const pool = embedded.length > 0 ? [...embedded, ...this.h2hRecords] : this.h2hRecords;

    if (typeof sel.roundNumber === 'number') {
      const byRound = pool.find(
        r => r.matchId === sel.matchId && r.roundNumber === sel.roundNumber
      );
      if (byRound) return byRound;
    }
    const matchingRecords = pool
      .filter(r => r.matchId === sel.matchId && r.playedAt >= betTimestamp - 15000)
      .sort((a, b) => a.playedAt - b.playedAt);
    return matchingRecords[0];
  }

  public evaluateBetSettlement(bet: PlacedBet): 'OPEN' | 'WON' | 'LOST' {
    if (bet.status !== 'OPEN') {
      return bet.status === 'WON' ? 'WON' : 'LOST';
    }

    let allResolved = true;
    for (const sel of bet.selections) {
      const roundResult = this.findSelectionH2HResult(sel, bet.timestamp);
      if (!roundResult) {
        const finishedMatch = this.matches.find(m => m.id === sel.matchId && m.status === 'FINISHED');
        if (!finishedMatch) {
          allResolved = false;
          continue;
        }
        const won = this.evaluateSelectionAgainstResult(sel, {
          homeScore: finishedMatch.homeScore,
          awayScore: finishedMatch.awayScore,
          firstHalfHomeScore: finishedMatch.firstHalfHomeScore || 0,
          firstHalfAwayScore: finishedMatch.firstHalfAwayScore || 0,
          firstGoalTeam: finishedMatch.firstGoalTeam,
          hadFiveMinGoal: finishedMatch.hadFiveMinGoal,
        });
        if (!won) return 'LOST';
        continue;
      }

      const won = this.evaluateSelectionAgainstResult(sel, roundResult);
      if (!won) return 'LOST';
    }

    return allResolved ? 'WON' : 'OPEN';
  }

  public hasBetGoneLive(bet: PlacedBet): boolean {
    for (const sel of bet.selections) {
      if (this.findSelectionH2HResult(sel, bet.timestamp)) {
        return true;
      }

      const match = this.matches.find(m => m.id === sel.matchId);
      if (match && (match.status === 'LIVE' || match.status === 'FINISHED')) {
        return true;
      }
    }
    return false;
  }

  private evaluateLiveSelectionProgress(sel: BetSelection, match: VirtualMatch): {
    progress: number;
    isDefinitiveLoss: boolean;
    isCurrentlyLosing: boolean;
  } {
    const totalGoals = match.homeScore + match.awayScore;
    const htHome = match.firstHalfHomeScore || 0;
    const htAway = match.firstHalfAwayScore || 0;
    const htTotal = htHome + htAway;
    const shHome = Math.max(0, match.homeScore - htHome);
    const shAway = Math.max(0, match.awayScore - htAway);
    const shTotal = shHome + shAway;
    const homeWon = match.homeScore > match.awayScore;
    const awayWon = match.awayScore > match.homeScore;
    const draw = match.homeScore === match.awayScore;
    const minute = match.minute || 0;

    if (sel.marketType === '1X2') {
      if (sel.selection === 'Home & O15' || sel.selection === '1') {
        if (homeWon && totalGoals > 15) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        if (homeWon) {
          const prog = totalGoals >= 12 ? 0.8 + Math.min(0.16, (totalGoals - 12) * 0.04) : Math.min(0.75, 0.25 + (totalGoals / 16) * 0.5);
          return { progress: prog, isDefinitiveLoss: false, isCurrentlyLosing: false };
        }
        return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: true };
      }
      if (sel.selection === 'Away & O15' || sel.selection === '2') {
        if (awayWon && totalGoals > 15) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        if (awayWon) {
          const prog = totalGoals >= 12 ? 0.8 + Math.min(0.16, (totalGoals - 12) * 0.04) : Math.min(0.75, 0.25 + (totalGoals / 16) * 0.5);
          return { progress: prog, isDefinitiveLoss: false, isCurrentlyLosing: false };
        }
        return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: true };
      }
      if (sel.selection === 'Draw' || sel.selection === 'X') {
        if (draw) {
          const prog = minute >= 48 ? Math.min(0.96, 0.8 + ((minute - 48) / 12) * 0.16) : Math.min(0.75, (minute / 48) * 0.75);
          return { progress: prog, isDefinitiveLoss: false, isCurrentlyLosing: false };
        }
        return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: true };
      }
    }

    if (sel.marketType === '1st Goal') {
      if (match.firstGoalTeam) {
        const wonFirstGoal =
          (sel.selection === 'Home' && match.firstGoalTeam === 'home') ||
          (sel.selection === 'Away' && match.firstGoalTeam === 'away');
        return wonFirstGoal
          ? { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false }
          : { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
      }
      return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: false };
    }

    if (sel.marketType === '5 Min Goal') {
      if (sel.selection === 'Yes') {
        if (match.hadFiveMinGoal) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        if (minute > 5) return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
        return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: false };
      }
      if (sel.selection === 'No') {
        if (match.hadFiveMinGoal) return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
        if (minute > 5) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        return { progress: Math.min(0.75, (minute / 6) * 0.75), isDefinitiveLoss: false, isCurrentlyLosing: false };
      }
      if (sel.selection === 'Over 5 Goals') {
        if (totalGoals > 5) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        return { progress: Math.min(0.75, (totalGoals / 6) * 0.8), isDefinitiveLoss: false, isCurrentlyLosing: totalGoals === 0 && minute >= 15 };
      }
    }

    if (sel.marketName === '1st Half O/U 15') {
      if (sel.selection === 'Over 15') {
        if (htTotal > 15) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        if (minute > 30) return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
        if (htTotal >= 13) return { progress: 0.8 + (htTotal - 13) * 0.06, isDefinitiveLoss: false, isCurrentlyLosing: false };
        return { progress: Math.min(0.75, (htTotal / 16) * 0.85), isDefinitiveLoss: false, isCurrentlyLosing: minute >= 20 && htTotal < 8 };
      } else {
        if (htTotal >= 15) return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
        if (minute > 30) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
        if (minute >= 24) return { progress: 0.8 + ((minute - 24) / 6) * 0.15, isDefinitiveLoss: false, isCurrentlyLosing: false };
        return { progress: Math.min(0.75, (minute / 30) * 0.8), isDefinitiveLoss: false, isCurrentlyLosing: false };
      }
    }

    if (sel.marketType === '1st Half') {
      const htHomeWon = htHome > htAway;
      const htAwayWon = htAway > htHome;
      const htDraw = htHome === htAway;
      const sideWon =
        (sel.selection === 'Home & O10' && htHomeWon) ||
        (sel.selection === 'Away & O10' && htAwayWon) ||
        (sel.selection === 'X & O10' && htDraw);

      if (minute > 30) {
        return sideWon && htTotal > 10
          ? { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false }
          : { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
      }
      if (sideWon && htTotal > 10) return { progress: 0.96, isDefinitiveLoss: false, isCurrentlyLosing: false };
      if (sideWon && htTotal >= 9) return { progress: 0.82, isDefinitiveLoss: false, isCurrentlyLosing: false };
      if (!sideWon) return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: true };
      return { progress: Math.min(0.75, (htTotal / 11) * 0.78), isDefinitiveLoss: false, isCurrentlyLosing: false };
    }

    if (sel.marketType === '2nd Half') {
      if (minute <= 30) return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: false };
      const shHomeWon = shHome > shAway;
      const shAwayWon = shAway > shHome;
      const shDraw = shHome === shAway;
      const sideWon =
        (sel.selection === 'Home & O15' && shHomeWon) ||
        (sel.selection === 'Away & O15' && shAwayWon) ||
        (sel.selection === 'X & O15' && shDraw);

      if (!sideWon) return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: true };
      if (shTotal > 15) return { progress: minute >= 50 ? 0.94 : 0.85, isDefinitiveLoss: false, isCurrentlyLosing: false };
      if (shTotal >= 12) return { progress: 0.8, isDefinitiveLoss: false, isCurrentlyLosing: false };
      return { progress: Math.min(0.75, (shTotal / 16) * 0.8), isDefinitiveLoss: false, isCurrentlyLosing: false };
    }

    if (sel.marketType === 'Odd/Even') {
      const isOdd = totalGoals % 2 !== 0;
      const matchesParity = (sel.selection === 'Odd' && isOdd) || (sel.selection === 'Even' && !isOdd);
      if (matchesParity && minute >= 48) {
        return { progress: 0.8 + ((minute - 48) / 12) * 0.12, isDefinitiveLoss: false, isCurrentlyLosing: false };
      }
      return { progress: matchesParity ? Math.min(0.7, (minute / 60) * 0.7) : 0, isDefinitiveLoss: false, isCurrentlyLosing: !matchesParity };
    }

    if (sel.marketType === 'Over/Under') {
      const parts = sel.selection.split(' ');
      const side = parts[0];
      const line = Number(parts[1]);
      if (!Number.isNaN(line)) {
        if (side === 'Over') {
          if (totalGoals > line) return { progress: 1, isDefinitiveLoss: false, isCurrentlyLosing: false };
          if (totalGoals >= line) return { progress: 0.84, isDefinitiveLoss: false, isCurrentlyLosing: false };
          return {
            progress: Math.min(0.78, (totalGoals / (line + 1)) * 0.9),
            isDefinitiveLoss: false,
            isCurrentlyLosing: minute >= 40 && totalGoals < line * 0.55,
          };
        } else {
          if (totalGoals >= line) return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
          if (minute >= 48) {
            return { progress: 0.8 + ((minute - 48) / 12) * 0.14, isDefinitiveLoss: false, isCurrentlyLosing: false };
          }
          return { progress: Math.min(0.75, (minute / 60) * 0.8), isDefinitiveLoss: false, isCurrentlyLosing: false };
        }
      }
    }

    if (sel.marketType === 'Correct Score') {
      const [tH, tA] = sel.selection.split(':').map(Number);
      if (!Number.isNaN(tH) && !Number.isNaN(tA)) {
        if (match.homeScore > tH || match.awayScore > tA) {
          return { progress: 0, isDefinitiveLoss: true, isCurrentlyLosing: true };
        }
        if (match.homeScore === tH && match.awayScore === tA && minute >= 50) {
          return { progress: 0.82 + ((minute - 50) / 10) * 0.12, isDefinitiveLoss: false, isCurrentlyLosing: false };
        }
      }
      return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: false };
    }

    return { progress: 0, isDefinitiveLoss: false, isCurrentlyLosing: false };
  }

  public calculateCashout(bet: PlacedBet): number {
    if (bet.status !== 'OPEN' || bet.selections.length === 0) return 0;

    let totalProgress = 0;
    let hasDefinitiveLoss = false;
    let hasLosingLiveLeg = false;
    let anyStartedOrFinished = false;

    for (const sel of bet.selections) {
      const roundResult = this.findSelectionH2HResult(sel, bet.timestamp);
      if (roundResult) {
        anyStartedOrFinished = true;
        const won = this.evaluateSelectionAgainstResult(sel, roundResult);
        if (!won) {
          hasDefinitiveLoss = true;
        } else {
          totalProgress += 1;
        }
        continue;
      }

      const match = this.matches.find(m => m.id === sel.matchId);
      if (!match) continue;

      if (match.status === 'FINISHED') {
        anyStartedOrFinished = true;
        const won = this.evaluateSelectionAgainstResult(sel, {
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          firstHalfHomeScore: match.firstHalfHomeScore || 0,
          firstHalfAwayScore: match.firstHalfAwayScore || 0,
          firstGoalTeam: match.firstGoalTeam,
          hadFiveMinGoal: match.hadFiveMinGoal,
        });
        if (!won) {
          hasDefinitiveLoss = true;
        } else {
          totalProgress += 1;
        }
        continue;
      }

      if (match.status === 'LIVE') {
        anyStartedOrFinished = true;
        const legState = this.evaluateLiveSelectionProgress(sel, match);
        if (legState.isDefinitiveLoss) hasDefinitiveLoss = true;
        if (legState.isCurrentlyLosing) hasLosingLiveLeg = true;
        totalProgress += legState.progress;
      }
    }

    // Cancel cash out offer if losing or not yet winning at least 80% of the ticket
    if (!anyStartedOrFinished || hasDefinitiveLoss || hasLosingLiveLeg) {
      return 0;
    }

    const overallWinProgress = totalProgress / bet.selections.length;
    if (overallWinProgress < 0.8) {
      return 0;
    }

    // Remaining 50% stake basis once bet goes live
    const origStake = bet.originalStake ?? (bet.liveHalfApplied ? bet.stake * 2 : bet.stake);
    const remainingStake = bet.liveHalfApplied ? bet.stake : Math.round(origStake * 0.5 * 100) / 100;
    const remainingMaxPayout = bet.potentialPayout * 0.5;

    // Scale offer between 72% (at 80% winning) and 94% (at 100% completely winning) of remaining 50% payout
    const clampedProgress = Math.min(1, Math.max(0.8, overallWinProgress));
    const payoutRatio = 0.72 + ((clampedProgress - 0.8) / 0.2) * (0.94 - 0.72);
    const rawOffer = remainingMaxPayout * payoutRatio;
    const minOffer = Math.min(remainingMaxPayout * 0.95, remainingStake * 1.05);
    const finalOffer = Math.max(minOffer, Math.min(rawOffer, remainingMaxPayout * 0.95));

    return Math.round(finalOffer * 100) / 100;
  }
}

export const virtualEngine = new VirtualEngineService();
