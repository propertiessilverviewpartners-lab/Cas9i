export type SportCategory = 'soccer' | 'live' | 'tipster' | 'virtuals' | 'zoom';

export type MarketType =
  | '1X2'
  | '5 Min Goal'
  | '1st Half'
  | '2nd Half'
  | 'Correct Score'
  | '1st Goal'
  | 'Odd/Even'
  | 'Over/Under';

export interface CorrectScoreOption {
  score: string;
  odds: number;
}

export interface OverUnderLineOption {
  line: number;
  over: number;
  under: number;
}

export interface OddsValue {
  // 1X2: Home & over 15 goals | Draw | Away & over 15 goals
  home: number;
  draw: number;
  away: number;
  // 1st Goal: Home | Away
  firstGoalHome: number;
  firstGoalAway: number;
  // 5 minutes goal: Yes | No | Over 5 goal
  fiveMinYes: number;
  fiveMinNo: number;
  fiveMinOver5: number;
  // 1st half: Home & over 10 | X & over 10 | Away & over 10 + Over 15 / Under 15
  ht1Over10: number;
  htXOver10: number;
  ht2Over10: number;
  htOver15: number;
  htUnder15: number;
  // 2nd half: Home & over 15 | X & over 15 | Away & over 15
  sh1Over15: number;
  shXOver15: number;
  sh2Over15: number;
  // Odd or Even total match goals
  oddGoals: number;
  evenGoals: number;
  // Over and Under 15..30 (odds 2.00 to 18.75)
  overUnderLines: OverUnderLineOption[];
  // Correct score: high goals bracket
  correctScores: CorrectScoreOption[];
}

export type OddsDirection = Record<string, 'up' | 'down' | 'same'>;

export interface MatchEvent {
  minute: number;
  text: string;
  type: 'goal' | 'card' | 'attack' | 'whistle';
  team?: 'home' | 'away';
}

export interface VirtualMatch {
  id: string;
  league: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  firstHalfHomeScore?: number;
  firstHalfAwayScore?: number;
  firstGoalTeam?: 'home' | 'away';
  hadFiveMinGoal?: boolean;
  roundNumber?: number;
  minute: number;
  durationMinutes?: number;
  durationSeconds?: number;
  elapsedSeconds?: number;
  isZoom?: boolean;
  status: 'LIVE' | 'UPCOMING' | 'FINISHED';
  scheduledTime: string;
  startsInSeconds: number;
  kickoffAt?: number;
  dayBucket?: 'TODAY' | 'NEXT_DAY';
  matchDate?: string;
  isSystemDaily?: boolean;
  odds: OddsValue;
  oddsDirection: OddsDirection;
  isFeatured?: boolean;
  stats: {
    possessionHome: number;
    possessionAway: number;
    dangerousAttacksHome: number;
    dangerousAttacksAway: number;
    shotsOnTargetHome: number;
    shotsOnTargetAway: number;
    cornersHome: number;
    cornersAway: number;
  };
  events: MatchEvent[];
}

export interface H2HRecord {
  id: string;
  matchId: string;
  roundNumber: number;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  firstHalfHomeScore: number;
  firstHalfAwayScore: number;
  firstGoalTeam?: 'home' | 'away';
  hadFiveMinGoal?: boolean;
  isZoom: boolean;
  playedAt: number;
}

export interface BetSelection {
  matchId: string;
  matchTitle: string;
  marketType: MarketType;
  marketName: string;
  selection: string;
  odds: number;
  initialOdds: number;
  isZoom?: boolean;
}

export interface TipsterBetcode {
  id: string;
  code: string;
  title: string;
  confidence: number;
  totalOdds: number;
  selections: BetSelection[];
}

export interface PlacedBet {
  id: string;
  timestamp: number;
  type: 'single' | 'accumulator';
  selections: BetSelection[];
  stake: number;
  originalStake?: number;
  liveHalfApplied?: boolean;
  totalOdds: number;
  potentialPayout: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'CASHED_OUT';
  cashoutAmount: number;
}

export interface CasinoGame {
  id: string;
  title: string;
  category: 'crash' | 'slots' | 'table' | 'instant' | 'wheel';
  badge?: string;
  multiplierMax: string;
  rtp: string;
  popularity: number;
  bgGradient: string;
  accentColor: string;
  iconType: string;
  description: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  totalProfit: number;
  winRate: number;
  recentWin: {
    game: string;
    amount: number;
    multiplier: number;
    timeAgo: string;
  };
  isUser?: boolean;
}

export interface LiveBetTickerItem {
  id: string;
  username: string;
  avatar: string;
  gameOrMatch: string;
  betAmount: number;
  multiplier: number;
  payout: number;
  timestamp: number;
  isWin: boolean;
}

export interface League {
  id: string;
  name: string;
  country: string;
  icon: string;
  isCustom?: boolean;
  createdAt: number;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string;
  league: string;
  crest: string;
  attack: number;
  defense: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  balance: number;
  currency: string;
  avatar: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
  totalBetsPlaced: number;
  totalWon: number;
}

export type FXCategory = 'forex' | 'bonds' | 'shares';

export type FXDuration = '10m' | '15m' | '20m' | '1h';

export type FXDirection = 'RISE' | 'FALL';

export interface FXPricePoint {
  time: number;
  price: number;
}

export interface FXAsset {
  id: string;
  symbol: string;
  name: string;
  category: FXCategory;
  sector: string;
  region: string;
  description: string;
  price: number;
  openPrice: number;
  high24h: number;
  low24h: number;
  decimals: number;
  unitPrefix?: string;
  unitSuffix?: string;
  spread: string;
  yieldOrDividend?: string;
  volatilityLabel: 'Low' | 'Medium' | 'High';
  trendDirection: 'RISING' | 'FALLING' | 'FLAT';
  trendStrength: number;
  changePercent: number;
  oddsByDuration: Record<FXDuration, { rise: number; fall: number }>;
  history: FXPricePoint[];
}

export interface FXPosition {
  id: string;
  assetId: string;
  symbol: string;
  assetName: string;
  category: FXCategory;
  direction: FXDirection;
  duration: FXDuration;
  durationMinutes: number;
  entryPrice: number;
  settlementPrice?: number;
  stake: number;
  odds: number;
  potentialPayout: number;
  createdAt: number;
  expiresAt: number;
  status: 'OPEN' | 'WON' | 'LOST';
}
