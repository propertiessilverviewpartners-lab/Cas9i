import { VirtualMatch, LeaderboardEntry, LiveBetTickerItem, PlacedBet, Club, League, TipsterBetcode, H2HRecord, BetSelection, FXAsset } from '../types';

export const PRESET_FIXTURES_INFO = {
  featuredTitle: 'CDA Navalcarnero vs Real Betis',
  pairTitle: 'Betis + Iceland vs Greece',
  allCount: 6,
};

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

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private adminToken: string | null = null;
  private fallbackPollId: ReturnType<typeof setInterval> | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
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
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.adminToken = window.localStorage.getItem('cas9i_admin_token');
      void this.fetchInitialState();
      this.connectWebSocket();
      this.startFallbackPoller();

      window.addEventListener('focus', () => {
        void this.fetchInitialState();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
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

  public async login(email: string, password: string): Promise<{ ok: boolean; isAdmin?: boolean; error?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Authentication failed.' };
    }
    if (data.isAdmin && data.adminToken) {
      this.setAdminToken(data.adminToken);
    } else {
      this.setAdminToken(null);
    }
    return { ok: true, isAdmin: Boolean(data.isAdmin) };
  }

  private async fetchInitialState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.applyFullState(data);
    } catch {
      // ignore transient network errors on startup; WebSocket/poller will retry
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
          if (typeof msg.version === 'number' && msg.version > this.stateVersion) {
            this.stateVersion = msg.version;
          }
          const incomingSliceVer = typeof msg.sliceVersion === 'number' ? msg.sliceVersion : undefined;
          switch (msg.type) {
            case 'init':
              this.applyFullState({
                version: msg.version,
                versions: msg.versions,
                ...(msg.data || {}),
              });
              break;
            case 'state:matches':
              this.applySlice<VirtualMatch>('matches', msg.data, incomingSliceVer ?? msg.versions?.matches, val => {
                this.matches = val;
                this.matchSubscribers.forEach(cb => cb(this.matches));
              });
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

  public evaluateBetSettlement(bet: PlacedBet): 'OPEN' | 'WON' | 'LOST' {
    if (bet.status !== 'OPEN') {
      return bet.status === 'WON' ? 'WON' : 'LOST';
    }

    let allResolved = true;
    for (const sel of bet.selections) {
      const matchingRecords = this.h2hRecords
        .filter(r => r.matchId === sel.matchId && r.playedAt >= bet.timestamp)
        .sort((a, b) => a.playedAt - b.playedAt);

      const roundResult = matchingRecords[0];
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

  public calculateCashout(bet: PlacedBet): number {
    if (bet.status !== 'OPEN') return 0;
    const settled = this.evaluateBetSettlement(bet);
    if (settled === 'LOST') return 0;
    if (settled === 'WON') return bet.potentialPayout;

    let probabilityWeight = 1.0;

    for (const sel of bet.selections) {
      const match = this.matches.find(m => m.id === sel.matchId);
      if (!match) continue;

      const totalGoals = match.homeScore + match.awayScore;
      const firstHalfGoals = (match.firstHalfHomeScore || 0) + (match.firstHalfAwayScore || 0);
      const homeWon = match.homeScore > match.awayScore;
      const awayWon = match.awayScore > match.homeScore;
      const draw = match.homeScore === match.awayScore;

      if (match.status === 'LIVE') {
        if (sel.marketType === '1st Goal' && match.firstGoalTeam) {
          const wonFirstGoal =
            (sel.selection === 'Home' && match.firstGoalTeam === 'home') ||
            (sel.selection === 'Away' && match.firstGoalTeam === 'away');
          probabilityWeight *= wonFirstGoal ? 1.35 : 0.1;
        } else if (sel.marketName === '1st Half O/U 15') {
          if (sel.selection === 'Over 15') {
            probabilityWeight *= firstHalfGoals > 15 ? 1.35 : match.minute > 30 ? 0.1 : 0.9;
          } else {
            probabilityWeight *= firstHalfGoals >= 15 ? 0.1 : 1.05;
          }
        } else if (sel.marketType === 'Over/Under') {
          const parts = sel.selection.split(' ');
          const side = parts[0];
          const line = Number(parts[1]);
          if (!Number.isNaN(line)) {
            if (side === 'Over') {
              probabilityWeight *= totalGoals > line ? 1.35 : 0.9;
            } else {
              probabilityWeight *= totalGoals >= line ? 0.1 : 1.05;
            }
          }
        } else if (sel.selection.startsWith('Home')) {
          if (homeWon) probabilityWeight *= 1.25;
          else if (awayWon) probabilityWeight *= 0.35;
          else probabilityWeight *= 0.85;
        } else if (sel.selection.startsWith('Away')) {
          if (awayWon) probabilityWeight *= 1.30;
          else if (homeWon) probabilityWeight *= 0.30;
          else probabilityWeight *= 0.80;
        } else if (sel.selection === 'Draw' || sel.selection.startsWith('X')) {
          if (draw) probabilityWeight *= (match.minute > 45 ? 1.4 : 1.05);
          else probabilityWeight *= 0.45;
        }
      }
    }

    const calculated = bet.stake * (1 + (bet.totalOdds - 1) * probabilityWeight * 0.7);
    return Math.max(1, Math.min(Math.round(calculated * 100) / 100, bet.potentialPayout * 0.95));
  }
}

export const virtualEngine = new VirtualEngineService();
