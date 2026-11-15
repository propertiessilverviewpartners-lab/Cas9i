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

  public hasBetGoneLive(bet: PlacedBet): boolean {
    for (const sel of bet.selections) {
      const hasFinishedRound = this.h2hRecords.some(
        r => r.matchId === sel.matchId && r.playedAt >= bet.timestamp
      );
      if (hasFinishedRound) return true;

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
      const matchingRecords = this.h2hRecords
        .filter(r => r.matchId === sel.matchId && r.playedAt >= bet.timestamp)
        .sort((a, b) => a.playedAt - b.playedAt);

      const roundResult = matchingRecords[0];
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
