import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  Club,
  League,
  VirtualMatch,
  LeaderboardEntry,
  LiveBetTickerItem,
  MatchEvent,
  TipsterBetcode,
  BetSelection,
  H2HRecord,
  FXAsset,
  FXDuration,
  FXPricePoint
} from './src/types/index.ts';

const PORT = 3000;
const ADMIN_EMAIL = 'admin@cas9i.com';
const ADMIN_PASS = 'AdminCas9i';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'cas9i-store.json');
const STORE_BACKUP_FILE = path.join(DATA_DIR, 'cas9i-store.bak.json');

const INITIAL_LEAGUES: League[] = [
  { id: 'league-copa', name: 'Spain - Copa del Rey', country: 'Spain', icon: '🏆', isCustom: false, createdAt: 1700000000000 },
  { id: 'league-euro-u21', name: 'Europe - European Championship U21 Qualification', country: 'Europe', icon: '🌍', isCustom: false, createdAt: 1700000000001 },
  { id: 'league-epl-v', name: 'England - Premier League Virtual', country: 'England', icon: '🦁', isCustom: false, createdAt: 1700000000002 },
  { id: 'league-laliga-v', name: 'Spain - La Liga Virtual', country: 'Spain', icon: '👑', isCustom: false, createdAt: 1700000000003 },
  { id: 'league-bundesliga-v', name: 'Germany - Bundesliga Virtual', country: 'Germany', icon: '⚡', isCustom: false, createdAt: 1700000000004 },
  { id: 'league-seriea-v', name: 'Italy - Serie A Virtual', country: 'Italy', icon: '🛡️', isCustom: false, createdAt: 1700000000005 },
  { id: 'league-concacaf', name: 'CONCACAF Nations League', country: 'Americas', icon: '⚽', isCustom: false, createdAt: 1700000000006 },
];

const MATCH_DURATION_MINUTES = 60;
const DAILY_MATCH_TARGET = 20;
const MAX_LIVE_DAILY_MATCHES = 5;
const ZOOM_DAILY_TARGET = 50;
const ZOOM_DURATION_SECONDS = 90;
const ZOOM_WAVE_SIZE = 5;

function getDayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function buildHighGoalOdds(
  homeAtk: number,
  homeDef: number,
  awayAtk: number,
  awayDef: number,
  overrideBase?: { home?: number; draw?: number; away?: number }
): VirtualMatch['odds'] {
  const homePower = (homeAtk + homeDef) / 2 + 2;
  const awayPower = (awayAtk + awayDef) / 2;
  const diff = homePower - awayPower;

  const pHome = Math.max(0.14, Math.min(0.68, 0.39 + diff * 0.015));
  const pAway = Math.max(0.14, Math.min(0.68, 0.36 - diff * 0.015));
  const pDraw = Math.max(0.14, Math.min(0.32, 1 - pHome - pAway));

  const home = overrideBase?.home
    ? Number(Math.max(1.05, overrideBase.home).toFixed(2))
    : Number(Math.max(1.45, Math.min(8.5, (0.94 / pHome) * 1.12)).toFixed(2));
  const draw = overrideBase?.draw
    ? Number(Math.max(1.2, overrideBase.draw).toFixed(2))
    : Number(Math.max(2.6, Math.min(9.5, 0.94 / pDraw)).toFixed(2));
  const away = overrideBase?.away
    ? Number(Math.max(1.05, overrideBase.away).toFixed(2))
    : Number(Math.max(1.45, Math.min(9.5, (0.94 / pAway) * 1.12)).toFixed(2));

  const clampOuOdds = (val: number) => Number(Math.max(2.0, Math.min(18.75, val)).toFixed(2));

  const pFirstHome = pHome / (pHome + pAway);
  const pFirstAway = 1 - pFirstHome;
  const firstGoalHome = Number(Math.max(1.35, Math.min(3.4, 0.94 / pFirstHome)).toFixed(2));
  const firstGoalAway = Number(Math.max(1.35, Math.min(3.4, 0.94 / pFirstAway)).toFixed(2));

  const tempoFactor = Math.max(-0.15, Math.min(0.2, (homeAtk + awayAtk - 155) * 0.005));

  const fiveMinYes = Number(Math.max(1.25, Math.min(1.85, 1.48 - tempoFactor * 0.5)).toFixed(2));
  const fiveMinNo = Number(Math.max(2.1, Math.min(3.8, 2.65 + tempoFactor * 0.8)).toFixed(2));
  const fiveMinOver5 = Number(Math.max(2.6, Math.min(6.2, 3.85 - tempoFactor * 1.4)).toFixed(2));

  const ht1Over10 = Number(Math.max(1.75, Math.min(5.9, home * 1.08)).toFixed(2));
  const htXOver10 = Number(Math.max(2.9, Math.min(7.5, draw * 1.12)).toFixed(2));
  const ht2Over10 = Number(Math.max(1.75, Math.min(6.4, away * 1.08)).toFixed(2));
  const htOver15 = Number(Math.max(2.25, Math.min(5.4, 3.45 - tempoFactor * 2.2)).toFixed(2));
  const htUnder15 = Number(Math.max(1.18, Math.min(1.72, 1.32 + tempoFactor * 0.45)).toFixed(2));

  const sh1Over15 = Number(Math.max(1.65, Math.min(5.5, home * 1.02)).toFixed(2));
  const shXOver15 = Number(Math.max(3.1, Math.min(8.2, draw * 1.18)).toFixed(2));
  const sh2Over15 = Number(Math.max(1.65, Math.min(6.0, away * 1.02)).toFixed(2));

  const oddBias = ((homeAtk + awayDef) % 5) * 0.01 - 0.02;
  const oddGoals = Number((1.9 + oddBias).toFixed(2));
  const evenGoals = Number((1.9 - oddBias).toFixed(2));

  const overBaseOffset = Math.max(0, Math.min(0.4, -tempoFactor * 1.6));
  const underBaseOffset = Math.max(0, Math.min(0.4, tempoFactor * 1.5));
  const overExp = Math.max(1.05, Math.min(1.42, 1.24 - tempoFactor * 0.5));
  const underExp = Math.max(1.05, Math.min(1.42, 1.24 + tempoFactor * 0.5));

  const overUnderLines = Array.from({ length: 16 }, (_, idx) => {
    const line = 15 + idx;
    const t = idx / 15;
    const over = clampOuOdds(2.0 + overBaseOffset + Math.pow(t, overExp) * (16.75 - overBaseOffset));
    const under = clampOuOdds(2.0 + underBaseOffset + Math.pow(1 - t, underExp) * (16.75 - underBaseOffset));
    return { line, over, under };
  });

  const favoredSide = diff > 3 ? 'home' : diff < -3 ? 'away' : 'even';
  const scoreTemplates =
    favoredSide === 'home'
      ? ['10:7', '11:8', '12:8', '13:9', '10:10', '14:10']
      : favoredSide === 'away'
      ? ['7:10', '8:11', '8:12', '9:13', '10:10', '10:14']
      : ['10:9', '9:10', '11:10', '10:10', '11:11', '12:11'];

  const correctScores = scoreTemplates.map((score, idx) => ({
    score,
    odds: Number((7.2 + idx * 1.85 + Math.abs(diff) * 0.08).toFixed(2)),
  }));

  return {
    home,
    draw,
    away,
    firstGoalHome,
    firstGoalAway,
    fiveMinYes,
    fiveMinNo,
    fiveMinOver5,
    ht1Over10,
    htXOver10,
    ht2Over10,
    htOver15,
    htUnder15,
    sh1Over15,
    shXOver15,
    sh2Over15,
    oddGoals,
    evenGoals,
    overUnderLines,
    correctScores,
  };
}

const PRESET_FIXTURES: VirtualMatch[] = [
  {
    id: 'match-featured-betis',
    league: 'Spain - Copa del Rey',
    country: 'Spain',
    homeTeam: 'CDA Navalcarnero',
    awayTeam: 'Real Betis',
    homeScore: 0,
    awayScore: 0,
    firstHalfHomeScore: 0,
    firstHalfAwayScore: 0,
    minute: 0,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'UPCOMING',
    scheduledTime: 'Starts in 24m',
    startsInSeconds: 1440,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    isFeatured: true,
    odds: buildHighGoalOdds(68, 66, 85, 82, { home: 5.80, draw: 4.90, away: 1.65 }),
    oddsDirection: {},
    stats: {
      possessionHome: 34,
      possessionAway: 66,
      dangerousAttacksHome: 4,
      dangerousAttacksAway: 14,
      shotsOnTargetHome: 1,
      shotsOnTargetAway: 5,
      cornersHome: 1,
      cornersAway: 4,
    },
    events: [
      { minute: 0, text: 'Admin fixed fixture (60m standard match).', type: 'whistle' }
    ]
  },
  {
    id: 'match-live-u21',
    league: 'Europe - European Championship U21 Qualification',
    country: 'Europe',
    homeTeam: 'Iceland U21',
    awayTeam: 'Greece U21',
    homeScore: 6,
    awayScore: 5,
    firstHalfHomeScore: 6,
    firstHalfAwayScore: 5,
    minute: 22,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'LIVE',
    scheduledTime: 'Live Now',
    startsInSeconds: 0,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    odds: buildHighGoalOdds(73, 74, 75, 76, { home: 2.35, draw: 3.90, away: 2.75 }),
    oddsDirection: {},
    stats: {
      possessionHome: 49,
      possessionAway: 51,
      dangerousAttacksHome: 21,
      dangerousAttacksAway: 22,
      shotsOnTargetHome: 8,
      shotsOnTargetAway: 7,
      cornersHome: 4,
      cornersAway: 3,
    },
    events: [
      { minute: 19, text: 'GOAL! Iceland U21 takes the lead in high-scoring clash!', type: 'goal', team: 'home' },
      { minute: 14, text: 'GOAL! Greece U21 strikes quickly from the edge of the box!', type: 'goal', team: 'away' }
    ]
  },
  {
    id: 'match-epl-virtual-1',
    league: 'England - Premier League Virtual',
    country: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Manchester City',
    homeScore: 7,
    awayScore: 8,
    firstHalfHomeScore: 7,
    firstHalfAwayScore: 8,
    minute: 28,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'LIVE',
    scheduledTime: 'Live Now',
    startsInSeconds: 0,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    odds: buildHighGoalOdds(89, 88, 92, 87, { home: 2.45, draw: 3.85, away: 2.30 }),
    oddsDirection: {},
    stats: {
      possessionHome: 50,
      possessionAway: 50,
      dangerousAttacksHome: 30,
      dangerousAttacksAway: 32,
      shotsOnTargetHome: 10,
      shotsOnTargetAway: 11,
      cornersHome: 5,
      cornersAway: 5,
    },
    events: [
      { minute: 26, text: 'GOAL! Manchester City fires into the top corner!', type: 'goal', team: 'away' },
      { minute: 21, text: 'GOAL! Arsenal answers immediately on the break!', type: 'goal', team: 'home' }
    ]
  },
  {
    id: 'match-laliga-virtual-1',
    league: 'Spain - La Liga Virtual',
    country: 'Spain',
    homeTeam: 'Real Madrid',
    awayTeam: 'FC Barcelona',
    homeScore: 10,
    awayScore: 8,
    firstHalfHomeScore: 8,
    firstHalfAwayScore: 7,
    minute: 38,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'LIVE',
    scheduledTime: 'Live Now',
    startsInSeconds: 0,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    odds: buildHighGoalOdds(93, 87, 91, 85, { home: 1.95, draw: 4.40, away: 2.95 }),
    oddsDirection: {},
    stats: {
      possessionHome: 54,
      possessionAway: 46,
      dangerousAttacksHome: 38,
      dangerousAttacksAway: 33,
      shotsOnTargetHome: 14,
      shotsOnTargetAway: 12,
      cornersHome: 6,
      cornersAway: 4,
    },
    events: [
      { minute: 35, text: 'GOAL! Real Madrid pulls ahead in 2nd half goal fest!', type: 'goal', team: 'home' }
    ]
  },
  {
    id: 'match-bundesliga-virtual',
    league: 'Germany - Bundesliga Virtual',
    country: 'Germany',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    homeScore: 4,
    awayScore: 3,
    firstHalfHomeScore: 4,
    firstHalfAwayScore: 3,
    minute: 14,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'LIVE',
    scheduledTime: 'Live Now',
    startsInSeconds: 0,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    odds: buildHighGoalOdds(92, 86, 86, 81, { home: 1.85, draw: 4.60, away: 3.15 }),
    oddsDirection: {},
    stats: {
      possessionHome: 59,
      possessionAway: 41,
      dangerousAttacksHome: 18,
      dangerousAttacksAway: 12,
      shotsOnTargetHome: 6,
      shotsOnTargetAway: 5,
      cornersHome: 4,
      cornersAway: 2,
    },
    events: [
      { minute: 12, text: 'GOAL! Bayern Munich converts sharp team play!', type: 'goal', team: 'home' }
    ]
  },
  {
    id: 'match-seriea-virtual',
    league: 'Italy - Serie A Virtual',
    country: 'Italy',
    homeTeam: 'Inter Milan',
    awayTeam: 'Juventus',
    homeScore: 9,
    awayScore: 9,
    firstHalfHomeScore: 7,
    firstHalfAwayScore: 7,
    minute: 41,
    durationMinutes: MATCH_DURATION_MINUTES,
    status: 'LIVE',
    scheduledTime: 'Live Now',
    startsInSeconds: 0,
    dayBucket: 'TODAY',
    matchDate: getDayKey(0),
    odds: buildHighGoalOdds(89, 87, 85, 86, { home: 2.25, draw: 3.45, away: 2.85 }),
    oddsDirection: {},
    stats: {
      possessionHome: 52,
      possessionAway: 48,
      dangerousAttacksHome: 34,
      dangerousAttacksAway: 31,
      shotsOnTargetHome: 12,
      shotsOnTargetAway: 12,
      cornersHome: 5,
      cornersAway: 4,
    },
    events: [
      { minute: 39, text: 'GOAL! Juventus levels the high-scoring battle!', type: 'goal', team: 'away' }
    ]
  }
];

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'lead-1',
    rank: 1,
    username: 'ApexBettor_99',
    avatar: '👑',
    totalProfit: 14820.50,
    winRate: 84.6,
    recentWin: { game: 'Flight', amount: 3450.00, multiplier: 34.5, timeAgo: '1m ago' }
  },
  {
    id: 'lead-2',
    rank: 2,
    username: 'LagosVIP_King',
    avatar: '💎',
    totalProfit: 11450.00,
    winRate: 78.2,
    recentWin: { game: 'Shoot', amount: 1820.00, multiplier: 8.0, timeAgo: '3m ago' }
  },
  {
    id: 'lead-3',
    rank: 3,
    username: 'CryptoSpinX',
    avatar: '⚡',
    totalProfit: 9890.20,
    winRate: 72.4,
    recentWin: { game: 'Plinko', amount: 2600.00, multiplier: 52.0, timeAgo: '5m ago' }
  },
  {
    id: 'lead-4',
    rank: 4,
    username: 'NaijaStrike777',
    avatar: '🔥',
    totalProfit: 8120.00,
    winRate: 69.8,
    recentWin: { game: '777 Strike', amount: 1440.00, multiplier: 12.0, timeAgo: '8m ago' }
  },
  {
    id: 'lead-5',
    rank: 5,
    username: 'BetisFanatic',
    avatar: '⚽',
    totalProfit: 6840.40,
    winRate: 75.0,
    recentWin: { game: 'Copa Virtual', amount: 980.00, multiplier: 2.45, timeAgo: '12m ago' }
  },
  {
    id: 'lead-user',
    rank: 12,
    username: 'You (Player)',
    avatar: '🎯',
    totalProfit: 1250.00,
    winRate: 66.7,
    recentWin: { game: 'Aviator', amount: 350.00, multiplier: 3.5, timeAgo: 'Just now' },
    isUser: true
  }
];

const INITIAL_TICKER: LiveBetTickerItem[] = [
  {
    id: 'tick-1',
    username: 'Zlatan_V',
    avatar: '🦁',
    gameOrMatch: 'Flight (Crash)',
    betAmount: 50,
    multiplier: 18.4,
    payout: 920,
    timestamp: Date.now() - 4000,
    isWin: true
  },
  {
    id: 'tick-2',
    username: 'BetKing_01',
    avatar: '🦅',
    gameOrMatch: 'Real Betis @ 1.10',
    betAmount: 200,
    multiplier: 1.10,
    payout: 220,
    timestamp: Date.now() - 11000,
    isWin: true
  },
  {
    id: 'tick-3',
    username: 'LuckyPlinko',
    avatar: '🎲',
    gameOrMatch: 'Plinko High Risk',
    betAmount: 25,
    multiplier: 29.0,
    payout: 725,
    timestamp: Date.now() - 19000,
    isWin: true
  },
  {
    id: 'tick-4',
    username: 'Madridista_9',
    avatar: '⭐',
    gameOrMatch: 'Real Madrid Virtual',
    betAmount: 100,
    multiplier: 1.65,
    payout: 165,
    timestamp: Date.now() - 25000,
    isWin: true
  }
];

interface FXSeedTemplate {
  id: string;
  symbol: string;
  name: string;
  category: FXAsset['category'];
  sector: string;
  region: string;
  description: string;
  basePrice: number;
  decimals: number;
  unitPrefix?: string;
  unitSuffix?: string;
  spread: string;
  yieldOrDividend?: string;
  volatilityLabel: FXAsset['volatilityLabel'];
  stepScale: number;
}

const FX_ASSET_CATALOG: FXSeedTemplate[] = [
  // Forex Pairs
  {
    id: 'fx-eurusd',
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    sector: 'Major Currency Pair',
    region: 'Eurozone · USA',
    description: 'Most liquid global FX pair driven by ECB and Federal Reserve rate expectations, Eurozone inflation data, and US Treasury yield differentials.',
    basePrice: 1.0842,
    decimals: 4,
    spread: '0.6 pips',
    yieldOrDividend: 'Rate Diff: -1.15%',
    volatilityLabel: 'Medium',
    stepScale: 0.00055,
  },
  {
    id: 'fx-gbpusd',
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    category: 'forex',
    sector: 'Major Currency Pair',
    region: 'UK · USA',
    description: 'High-beta major currency pair sensitive to Bank of England policy guidance, UK CPI releases, and London-New York session overlap flows.',
    basePrice: 1.2718,
    decimals: 4,
    spread: '0.8 pips',
    yieldOrDividend: 'Rate Diff: -0.25%',
    volatilityLabel: 'Medium',
    stepScale: 0.00075,
  },
  {
    id: 'fx-usdjpy',
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    category: 'forex',
    sector: 'Major Currency Pair',
    region: 'USA · Japan',
    description: 'Carry-trade benchmark tracking the spread between US 10Y yields and Bank of Japan yield curve control policy.',
    basePrice: 153.46,
    decimals: 2,
    spread: '0.7 pips',
    yieldOrDividend: 'Carry: +4.50%',
    volatilityLabel: 'High',
    stepScale: 0.095,
  },
  {
    id: 'fx-usdchf',
    symbol: 'USD/CHF',
    name: 'US Dollar / Swiss Franc',
    category: 'forex',
    sector: 'Safe-Haven FX',
    region: 'USA · Switzerland',
    description: 'Defensive European currency pair shaped by Swiss National Bank inflation targets and global risk-on / risk-off capital rotation.',
    basePrice: 0.8814,
    decimals: 4,
    spread: '0.9 pips',
    yieldOrDividend: 'Rate Diff: +3.50%',
    volatilityLabel: 'Low',
    stepScale: 0.00045,
  },
  {
    id: 'fx-audusd',
    symbol: 'AUD/USD',
    name: 'Australian Dollar / US Dollar',
    category: 'forex',
    sector: 'Commodity FX',
    region: 'Australia · USA',
    description: 'Commodity-linked major pair closely correlated with iron ore, copper prices, RBA cash rate guidance, and Asia-Pacific industrial demand.',
    basePrice: 0.6582,
    decimals: 4,
    spread: '0.9 pips',
    yieldOrDividend: 'Rate Diff: -0.40%',
    volatilityLabel: 'Medium',
    stepScale: 0.0005,
  },
  {
    id: 'fx-eurgbp',
    symbol: 'EUR/GBP',
    name: 'Euro / British Pound',
    category: 'forex',
    sector: 'Cross Currency Pair',
    region: 'Eurozone · UK',
    description: 'Low-noise European cross pair reflecting relative growth momentum and central bank divergence between the ECB and Bank of England.',
    basePrice: 0.8525,
    decimals: 4,
    spread: '0.8 pips',
    yieldOrDividend: 'Rate Diff: -1.40%',
    volatilityLabel: 'Low',
    stepScale: 0.00035,
  },
  {
    id: 'fx-eurjpy',
    symbol: 'EUR/JPY',
    name: 'Euro / Japanese Yen',
    category: 'forex',
    sector: 'Cross Currency Pair',
    region: 'Eurozone · Japan',
    description: 'Active momentum cross tracking European risk appetite and Japanese monetary policy normalization.',
    basePrice: 166.38,
    decimals: 2,
    spread: '1.1 pips',
    yieldOrDividend: 'Carry: +3.15%',
    volatilityLabel: 'High',
    stepScale: 0.11,
  },

  // Sovereign & Corporate Bonds
  {
    id: 'bond-us10y',
    symbol: 'US10Y',
    name: 'US 10-Year Treasury Note',
    category: 'bonds',
    sector: 'Sovereign Bond Yield',
    region: 'United States',
    description: 'Global risk-free benchmark debt instrument. Yield moves reflect inflation expectations, Federal Reserve dot-plot guidance, and Treasury auction demand.',
    basePrice: 4.385,
    decimals: 3,
    unitSuffix: '%',
    spread: '0.002%',
    yieldOrDividend: 'Coupon: 4.25%',
    volatilityLabel: 'Medium',
    stepScale: 0.006,
  },
  {
    id: 'bond-us30y',
    symbol: 'US30Y',
    name: 'US 30-Year Treasury Bond',
    category: 'bonds',
    sector: 'Long-Duration Sovereign',
    region: 'United States',
    description: 'Long-duration US government bond highly sensitive to fiscal deficit outlooks, long-run GDP growth, and institutional pension allocation.',
    basePrice: 4.592,
    decimals: 3,
    unitSuffix: '%',
    spread: '0.003%',
    yieldOrDividend: 'Coupon: 4.50%',
    volatilityLabel: 'Medium',
    stepScale: 0.007,
  },
  {
    id: 'bond-uk10y',
    symbol: 'UK10Y',
    name: 'UK 10-Year Gilt',
    category: 'bonds',
    sector: 'Sovereign Bond Yield',
    region: 'United Kingdom',
    description: 'HM Treasury benchmark gilt priced off UK wage growth, BoE Bank Rate expectations, and DMO gilt supply schedules.',
    basePrice: 4.418,
    decimals: 3,
    unitSuffix: '%',
    spread: '0.003%',
    yieldOrDividend: 'Coupon: 4.125%',
    volatilityLabel: 'Medium',
    stepScale: 0.0065,
  },
  {
    id: 'bond-de10y',
    symbol: 'DE10Y',
    name: 'German 10-Year Bund',
    category: 'bonds',
    sector: 'Eurozone Core Debt',
    region: 'Germany · EU',
    description: 'Core Eurozone sovereign benchmark pricing European credit spreads, ECB quantitative tightening, and industrial sentiment.',
    basePrice: 2.364,
    decimals: 3,
    unitSuffix: '%',
    spread: '0.002%',
    yieldOrDividend: 'Coupon: 2.30%',
    volatilityLabel: 'Low',
    stepScale: 0.0045,
  },
  {
    id: 'bond-igcorp',
    symbol: 'USIGB',
    name: 'US Investment Grade Bond Index',
    category: 'bonds',
    sector: 'Corporate Bond Index',
    region: 'United States',
    description: 'Diversified basket of AAA–BBB rated US corporate debt securities tracking credit spreads and corporate balance-sheet health.',
    basePrice: 108.45,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.04',
    yieldOrDividend: 'YTM: 5.32%',
    volatilityLabel: 'Low',
    stepScale: 0.06,
  },

  // Global Shares / Equities
  {
    id: 'share-aapl',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'shares',
    sector: 'Consumer Tech · NASDAQ',
    region: 'United States',
    description: 'Mega-cap consumer hardware and high-margin services ecosystem leader backed by recurring App Store, iCloud, and silicon innovation.',
    basePrice: 228.65,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.03',
    yieldOrDividend: 'Div: 0.44%',
    volatilityLabel: 'Medium',
    stepScale: 0.24,
  },
  {
    id: 'share-msft',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    category: 'shares',
    sector: 'Cloud & Enterprise · NASDAQ',
    region: 'United States',
    description: 'Global enterprise software and Azure cloud infrastructure powerhouse with strong recurring institutional SaaS cash flows.',
    basePrice: 419.80,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.05',
    yieldOrDividend: 'Div: 0.78%',
    volatilityLabel: 'Medium',
    stepScale: 0.42,
  },
  {
    id: 'share-nvda',
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    category: 'shares',
    sector: 'Semiconductors · NASDAQ',
    region: 'United States',
    description: 'Leading accelerated computing and data-center GPU designer with high institutional volume and strong earnings momentum.',
    basePrice: 146.30,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.03',
    yieldOrDividend: 'Div: 0.03%',
    volatilityLabel: 'High',
    stepScale: 0.34,
  },
  {
    id: 'share-tsla',
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    category: 'shares',
    sector: 'EV & Energy · NASDAQ',
    region: 'United States',
    description: 'High-volatility electric vehicle, grid-scale battery storage, and autonomous mobility manufacturer favored by active momentum traders.',
    basePrice: 318.40,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.06',
    yieldOrDividend: 'Beta: 2.08',
    volatilityLabel: 'High',
    stepScale: 0.65,
  },
  {
    id: 'share-amzn',
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    category: 'shares',
    sector: 'E-Commerce & AWS · NASDAQ',
    region: 'United States',
    description: 'Dominant global e-commerce fulfillment network and AWS cloud leader supported by expanding retail operating margins and digital ads.',
    basePrice: 209.75,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.04',
    yieldOrDividend: 'P/E: 38.4',
    volatilityLabel: 'Medium',
    stepScale: 0.28,
  },
  {
    id: 'share-googl',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    category: 'shares',
    sector: 'Digital Platforms · NASDAQ',
    region: 'United States',
    description: 'Search, YouTube, and Google Cloud parent generating resilient advertising revenue and deep balance-sheet liquidity.',
    basePrice: 179.55,
    decimals: 2,
    unitPrefix: '$',
    spread: '$0.03',
    yieldOrDividend: 'Div: 0.45%',
    volatilityLabel: 'Medium',
    stepScale: 0.22,
  },
];

function computeFxOddsByDuration(trendDirection: FXAsset['trendDirection'], trendStrength: number): Record<FXDuration, { rise: number; fall: number }> {
  const bias = trendDirection === 'RISING' ? (trendStrength / 100) * 0.08 : trendDirection === 'FALLING' ? -(trendStrength / 100) * 0.08 : 0;
  const clamp = (v: number) => Number(Math.max(1.72, Math.min(2.35, v)).toFixed(2));
  return {
    '10m': { rise: clamp(1.88 - bias), fall: clamp(1.88 + bias) },
    '15m': { rise: clamp(1.94 - bias * 0.9), fall: clamp(1.94 + bias * 0.9) },
    '20m': { rise: clamp(2.00 - bias * 0.8), fall: clamp(2.00 + bias * 0.8) },
    '1h': { rise: clamp(2.14 - bias * 0.65), fall: clamp(2.14 + bias * 0.65) },
  };
}

function buildInitialFxAssets(): FXAsset[] {
  const now = Date.now();
  return FX_ASSET_CATALOG.map((tpl, idx) => {
    const history: FXPricePoint[] = [];
    let current = tpl.basePrice * (1 + ((idx % 2 === 0 ? -1 : 1) * 0.0025));
    const openPrice = Number(current.toFixed(tpl.decimals));
    let high = openPrice;
    let low = openPrice;

    for (let i = 49; i >= 0; i -= 1) {
      const wave = Math.sin((50 - i + idx * 3) * 0.32) * 0.45;
      const drift = (Math.random() - 0.48 + wave * 0.25) * tpl.stepScale;
      current = Math.max(tpl.basePrice * 0.85, Math.min(tpl.basePrice * 1.15, current + drift));
      const rounded = Number(current.toFixed(tpl.decimals));
      if (rounded > high) high = rounded;
      if (rounded < low) low = rounded;
      history.push({ time: now - i * 3000, price: rounded });
    }

    const latest = history[history.length - 1].price;
    const recentRef = history[Math.max(0, history.length - 10)].price;
    const slopePct = recentRef > 0 ? ((latest - recentRef) / recentRef) * 100 : 0;
    const trendDirection: FXAsset['trendDirection'] =
      slopePct > 0.015 ? 'RISING' : slopePct < -0.015 ? 'FALLING' : 'FLAT';
    const trendStrength = Math.min(96, Math.max(15, Math.round(Math.abs(slopePct) * 260 + 25)));
    const changePercent = Number((((latest - openPrice) / (openPrice || 1)) * 100).toFixed(2));

    return {
      id: tpl.id,
      symbol: tpl.symbol,
      name: tpl.name,
      category: tpl.category,
      sector: tpl.sector,
      region: tpl.region,
      description: tpl.description,
      price: latest,
      openPrice,
      high24h: high,
      low24h: low,
      decimals: tpl.decimals,
      unitPrefix: tpl.unitPrefix,
      unitSuffix: tpl.unitSuffix,
      spread: tpl.spread,
      yieldOrDividend: tpl.yieldOrDividend,
      volatilityLabel: tpl.volatilityLabel,
      trendDirection,
      trendStrength,
      changePercent,
      oddsByDuration: computeFxOddsByDuration(trendDirection, trendStrength),
      history,
    };
  });
}

function tickFxAssets(assets: FXAsset[], now: number): FXAsset[] {
  return assets.map((asset, idx) => {
    const tpl = FX_ASSET_CATALOG.find(t => t.id === asset.id);
    const stepScale = tpl?.stepScale ?? Math.max(0.0004, asset.price * 0.0012);
    const basePrice = tpl?.basePrice ?? asset.openPrice;
    const meanPull = ((basePrice - asset.price) / (basePrice || 1)) * stepScale * 1.4;
    const prevPrice = asset.history.length >= 2 ? asset.history[asset.history.length - 2].price : asset.price;
    const momentum = (asset.price - prevPrice) * 0.35;
    const noise = (Math.random() - 0.5) * 2.1 * stepScale;
    const wave = Math.sin(now / 14000 + idx * 1.3) * 0.25 * stepScale;

    const rawNext = Math.max(basePrice * 0.82, Math.min(basePrice * 1.18, asset.price + meanPull + momentum + noise + wave));
    const nextPrice = Number(rawNext.toFixed(asset.decimals));
    const nextHistory = [...asset.history.slice(-59), { time: now, price: nextPrice }];
    const recentRef = nextHistory[Math.max(0, nextHistory.length - 10)].price;
    const slopePct = recentRef > 0 ? ((nextPrice - recentRef) / recentRef) * 100 : 0;
    const trendDirection: FXAsset['trendDirection'] =
      slopePct > 0.012 ? 'RISING' : slopePct < -0.012 ? 'FALLING' : 'FLAT';
    const trendStrength = Math.min(98, Math.max(12, Math.round(Math.abs(slopePct) * 280 + 22)));
    const changePercent = Number((((nextPrice - asset.openPrice) / (asset.openPrice || 1)) * 100).toFixed(2));

    return {
      ...asset,
      price: nextPrice,
      high24h: Math.max(asset.high24h, nextPrice),
      low24h: Math.min(asset.low24h, nextPrice),
      changePercent,
      trendDirection,
      trendStrength,
      oddsByDuration: computeFxOddsByDuration(trendDirection, trendStrength),
      history: nextHistory,
    };
  });
}

interface PersistedStore {
  initialized: boolean;
  adminSecret: string;
  clubs: Club[];
  leagues: League[];
  matches: VirtualMatch[];
  tipsterBetcodes: TipsterBetcode[];
  h2hRecords: H2HRecord[];
  fxAssets: FXAsset[];
  leaderboard: LeaderboardEntry[];
  ticker: LiveBetTickerItem[];
  lastScheduleDate?: string;
  scheduleWaveVersion?: number;
}

function getDeterministicAdminSecret(): string {
  return process.env.ADMIN_TOKEN_SECRET || crypto
    .createHash('sha256')
    .update(`cas9i-admin-secret-v1:${ADMIN_EMAIL}:${ADMIN_PASS}`)
    .digest('hex');
}

function createInitialStore(): PersistedStore {
  const initialLeagues: League[] = JSON.parse(JSON.stringify(INITIAL_LEAGUES));
  return {
    initialized: true,
    adminSecret: getDeterministicAdminSecret(),
    clubs: buildInitialRealClubs(initialLeagues, 160),
    leagues: initialLeagues,
    matches: [],
    tipsterBetcodes: [],
    h2hRecords: [],
    fxAssets: buildInitialFxAssets(),
    leaderboard: JSON.parse(JSON.stringify(INITIAL_LEADERBOARD)),
    ticker: JSON.parse(JSON.stringify(INITIAL_TICKER)),
    lastScheduleDate: getDayKey(0),
    scheduleWaveVersion: 2,
  };
}

function parseStoreFile(filePath: string): PersistedStore | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<PersistedStore>;
  if (!parsed || !parsed.initialized) return null;
  return {
    initialized: true,
    adminSecret: getDeterministicAdminSecret(),
    clubs: Array.isArray(parsed.clubs) ? parsed.clubs : [],
    leagues: Array.isArray(parsed.leagues) ? parsed.leagues : JSON.parse(JSON.stringify(INITIAL_LEAGUES)),
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    tipsterBetcodes: Array.isArray(parsed.tipsterBetcodes) ? parsed.tipsterBetcodes : [],
    h2hRecords: Array.isArray(parsed.h2hRecords) ? parsed.h2hRecords : [],
    fxAssets: Array.isArray(parsed.fxAssets) && parsed.fxAssets.length > 0 ? parsed.fxAssets : buildInitialFxAssets(),
    leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : JSON.parse(JSON.stringify(INITIAL_LEADERBOARD)),
    ticker: Array.isArray(parsed.ticker) ? parsed.ticker : JSON.parse(JSON.stringify(INITIAL_TICKER)),
    lastScheduleDate: typeof parsed.lastScheduleDate === 'string' ? parsed.lastScheduleDate : undefined,
    scheduleWaveVersion: typeof parsed.scheduleWaveVersion === 'number' ? parsed.scheduleWaveVersion : 1,
  };
}

function loadStore(): PersistedStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const primary = parseStoreFile(STORE_FILE);
    if (primary) {
      return primary;
    }
  } catch (err) {
    console.error('Primary store read failed, trying backup:', err);
  }

  try {
    const backup = parseStoreFile(STORE_BACKUP_FILE);
    if (backup) {
      saveStore(backup);
      return backup;
    }
  } catch (err) {
    console.error('Backup store read failed, initializing clean store:', err);
  }

  const fresh = createInitialStore();
  saveStore(fresh);
  return fresh;
}

function saveStore(data: PersistedStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    const tmpFile = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, serialized, 'utf8');
    fs.renameSync(tmpFile, STORE_FILE);
    const bakTmpFile = `${STORE_BACKUP_FILE}.tmp`;
    fs.writeFileSync(bakTmpFile, serialized, 'utf8');
    fs.renameSync(bakTmpFile, STORE_BACKUP_FILE);
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

const store = loadStore();
const matchResetTimers = new Map<string, NodeJS.Timeout>();
let stateVersion = Date.now();
const sliceVersions = {
  clubs: stateVersion,
  leagues: stateVersion,
  matches: stateVersion,
  tipster: stateVersion,
  h2h: stateVersion,
  fx: stateVersion,
  leaderboard: stateVersion,
  ticker: stateVersion,
};

function createAdminToken(secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${ADMIN_EMAIL}:${ADMIN_PASS}`).digest('hex');
}

function isValidAdminRequest(req: express.Request): boolean {
  const token = req.header('x-admin-token');
  if (!token) return false;
  const expected = createAdminToken(store.adminSecret);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function ensureLeagueExists(leagueName: string, country: string) {
  const trimmed = leagueName.trim();
  if (!trimmed) return;
  const exists = store.leagues.some(l => l.name.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    const newLeague: League = {
      id: `league-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      country: country.trim() || 'International',
      icon: '🏆',
      isCustom: true,
      createdAt: Date.now()
    };
    store.leagues = [newLeague, ...store.leagues];
  }
}

interface RealClubTemplate {
  name: string;
  shortName: string;
  country: string;
  crest: string;
  attack: number;
  defense: number;
  preferredLeague?: string;
}

const REAL_CLUB_CATALOG: RealClubTemplate[] = [
  // England - Premier League (20 clubs)
  { name: 'Arsenal', shortName: 'ARS', country: 'England', crest: '🔴', attack: 89, defense: 88, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Aston Villa', shortName: 'AVL', country: 'England', crest: '🟣', attack: 84, defense: 81, preferredLeague: 'England - Premier League Virtual' },
  { name: 'AFC Bournemouth', shortName: 'BOU', country: 'England', crest: '🔴', attack: 79, defense: 77, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Brentford', shortName: 'BRE', country: 'England', crest: '🔴', attack: 79, defense: 76, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Brighton & Hove Albion', shortName: 'BHA', country: 'England', crest: '🔵', attack: 81, defense: 79, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Chelsea', shortName: 'CHE', country: 'England', crest: '🔵', attack: 86, defense: 83, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Crystal Palace', shortName: 'CRY', country: 'England', crest: '🔵', attack: 77, defense: 77, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Everton', shortName: 'EVE', country: 'England', crest: '🔵', attack: 75, defense: 77, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Fulham', shortName: 'FUL', country: 'England', crest: '⚪', attack: 78, defense: 77, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Ipswich Town', shortName: 'IPS', country: 'England', crest: '🔵', attack: 73, defense: 72, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Leicester City', shortName: 'LEI', country: 'England', crest: '🔵', attack: 75, defense: 74, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Liverpool', shortName: 'LIV', country: 'England', crest: '🔴', attack: 91, defense: 87, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Manchester City', shortName: 'MCI', country: 'England', crest: '🩵', attack: 92, defense: 87, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Manchester United', shortName: 'MUN', country: 'England', crest: '🔴', attack: 85, defense: 81, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Newcastle United', shortName: 'NEW', country: 'England', crest: '⚫', attack: 84, defense: 82, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Nottingham Forest', shortName: 'NFO', country: 'England', crest: '🔴', attack: 79, defense: 78, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Southampton', shortName: 'SOU', country: 'England', crest: '🔴', attack: 73, defense: 72, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Tottenham Hotspur', shortName: 'TOT', country: 'England', crest: '⚪', attack: 84, defense: 80, preferredLeague: 'England - Premier League Virtual' },
  { name: 'West Ham United', shortName: 'WHU', country: 'England', crest: '🟣', attack: 79, defense: 77, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Wolverhampton Wanderers', shortName: 'WOL', country: 'England', crest: '🟡', attack: 76, defense: 75, preferredLeague: 'England - Premier League Virtual' },

  // Spain - La Liga (20 clubs)
  { name: 'Real Madrid', shortName: 'RMA', country: 'Spain', crest: '👑', attack: 93, defense: 87, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'FC Barcelona', shortName: 'BAR', country: 'Spain', crest: '🔵', attack: 91, defense: 85, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Atletico Madrid', shortName: 'ATM', country: 'Spain', crest: '🔴', attack: 87, defense: 87, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Athletic Bilbao', shortName: 'ATH', country: 'Spain', crest: '🔴', attack: 83, defense: 82, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Real Sociedad', shortName: 'RSO', country: 'Spain', crest: '🔵', attack: 82, defense: 81, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Villarreal', shortName: 'VIL', country: 'Spain', crest: '🟡', attack: 83, defense: 79, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Real Betis', shortName: 'RBT', country: 'Spain', crest: '🟢', attack: 82, defense: 80, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Sevilla', shortName: 'SEV', country: 'Spain', crest: '⚪', attack: 79, defense: 78, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Valencia', shortName: 'VAL', country: 'Spain', crest: '🦇', attack: 78, defense: 77, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Girona', shortName: 'GIR', country: 'Spain', crest: '🔴', attack: 82, defense: 78, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Celta Vigo', shortName: 'CEL', country: 'Spain', crest: '🩵', attack: 78, defense: 75, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Osasuna', shortName: 'OSA', country: 'Spain', crest: '🔴', attack: 77, defense: 77, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'RCD Mallorca', shortName: 'MLL', country: 'Spain', crest: '🔴', attack: 75, defense: 78, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Getafe', shortName: 'GET', country: 'Spain', crest: '🔵', attack: 74, defense: 78, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Rayo Vallecano', shortName: 'RAY', country: 'Spain', crest: '⚡', attack: 76, defense: 75, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Deportivo Alaves', shortName: 'ALA', country: 'Spain', crest: '🔵', attack: 74, defense: 75, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Espanyol', shortName: 'ESP', country: 'Spain', crest: '🔵', attack: 74, defense: 74, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Las Palmas', shortName: 'LPA', country: 'Spain', crest: '🟡', attack: 74, defense: 73, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Real Valladolid', shortName: 'VLL', country: 'Spain', crest: '🟣', attack: 72, defense: 72, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'CD Leganes', shortName: 'LEG', country: 'Spain', crest: '🔵', attack: 72, defense: 73, preferredLeague: 'Spain - La Liga Virtual' },

  // Spain - Copa del Rey (18 Spanish clubs)
  { name: 'Deportivo La Coruna', shortName: 'DEP', country: 'Spain', crest: '🔵', attack: 73, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Malaga CF', shortName: 'MAL', country: 'Spain', crest: '🩵', attack: 72, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Granada CF', shortName: 'GRA', country: 'Spain', crest: '🔴', attack: 74, defense: 73, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Levante UD', shortName: 'LEV', country: 'Spain', crest: '🔵', attack: 74, defense: 73, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Real Oviedo', shortName: 'OVI', country: 'Spain', crest: '🔵', attack: 73, defense: 73, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Real Zaragoza', shortName: 'ZAR', country: 'Spain', crest: '⚪', attack: 72, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Elche CF', shortName: 'ELC', country: 'Spain', crest: '🟢', attack: 73, defense: 73, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Cadiz CF', shortName: 'CAD', country: 'Spain', crest: '🟡', attack: 72, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'UD Almeria', shortName: 'ALM', country: 'Spain', crest: '🔴', attack: 74, defense: 71, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Sporting Gijon', shortName: 'SPO', country: 'Spain', crest: '🔴', attack: 72, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Racing Santander', shortName: 'RAC', country: 'Spain', crest: '🟢', attack: 73, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'SD Eibar', shortName: 'EIB', country: 'Spain', crest: '🔵', attack: 72, defense: 72, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'CD Tenerife', shortName: 'TEN', country: 'Spain', crest: '🔵', attack: 70, defense: 71, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Burgos CF', shortName: 'BUR', country: 'Spain', crest: '⚪', attack: 69, defense: 71, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Albacete Balompie', shortName: 'ALB', country: 'Spain', crest: '⚪', attack: 70, defense: 69, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'SD Huesca', shortName: 'HUE', country: 'Spain', crest: '🔵', attack: 70, defense: 71, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'CD Mirandes', shortName: 'MIR', country: 'Spain', crest: '🔴', attack: 70, defense: 70, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Cordoba CF', shortName: 'COR', country: 'Spain', crest: '🟢', attack: 69, defense: 69, preferredLeague: 'Spain - Copa del Rey' },

  // Germany - Bundesliga (18 clubs)
  { name: 'Bayern Munich', shortName: 'BAY', country: 'Germany', crest: '🔴', attack: 92, defense: 86, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Borussia Dortmund', shortName: 'BVB', country: 'Germany', crest: '🟡', attack: 86, defense: 81, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Bayer Leverkusen', shortName: 'B04', country: 'Germany', crest: '🔴', attack: 88, defense: 84, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'RB Leipzig', shortName: 'RBL', country: 'Germany', crest: '🔴', attack: 85, defense: 82, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'VfB Stuttgart', shortName: 'STU', country: 'Germany', crest: '⚪', attack: 83, defense: 80, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Eintracht Frankfurt', shortName: 'SGE', country: 'Germany', crest: '🦅', attack: 82, defense: 79, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'SC Freiburg', shortName: 'SCF', country: 'Germany', crest: '🔴', attack: 79, defense: 79, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Werder Bremen', shortName: 'SVW', country: 'Germany', crest: '🟢', attack: 78, defense: 76, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'VfL Wolfsburg', shortName: 'WOB', country: 'Germany', crest: '🟢', attack: 78, defense: 77, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Borussia Monchengladbach', shortName: 'BMG', country: 'Germany', crest: '⚫', attack: 78, defense: 75, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'TSG Hoffenheim', shortName: 'TSG', country: 'Germany', crest: '🔵', attack: 77, defense: 74, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Mainz 05', shortName: 'M05', country: 'Germany', crest: '🔴', attack: 77, defense: 76, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Union Berlin', shortName: 'FCU', country: 'Germany', crest: '🔴', attack: 75, defense: 77, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'FC Augsburg', shortName: 'FCA', country: 'Germany', crest: '🟢', attack: 75, defense: 75, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'VfL Bochum', shortName: 'BOC', country: 'Germany', crest: '🔵', attack: 72, defense: 71, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: '1. FC Heidenheim', shortName: 'HEI', country: 'Germany', crest: '🔴', attack: 74, defense: 74, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'FC St. Pauli', shortName: 'STP', country: 'Germany', crest: '🟤', attack: 73, defense: 73, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Holstein Kiel', shortName: 'KIE', country: 'Germany', crest: '🔵', attack: 72, defense: 71, preferredLeague: 'Germany - Bundesliga Virtual' },

  // Italy - Serie A (20 clubs)
  { name: 'Inter Milan', shortName: 'INT', country: 'Italy', crest: '🔵', attack: 89, defense: 87, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'AC Milan', shortName: 'ACM', country: 'Italy', crest: '🔴', attack: 86, defense: 83, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Juventus', shortName: 'JUV', country: 'Italy', crest: '⚫', attack: 85, defense: 86, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Napoli', shortName: 'NAP', country: 'Italy', crest: '🩵', attack: 86, defense: 84, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Atalanta', shortName: 'ATA', country: 'Italy', crest: '🔵', attack: 86, defense: 82, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'AS Roma', shortName: 'ROM', country: 'Italy', crest: '🟡', attack: 83, defense: 81, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Lazio', shortName: 'LAZ', country: 'Italy', crest: '🩵', attack: 82, defense: 80, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Fiorentina', shortName: 'FIO', country: 'Italy', crest: '🟣', attack: 81, defense: 79, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Bologna', shortName: 'BOL', country: 'Italy', crest: '🔴', attack: 80, defense: 79, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Torino', shortName: 'TOR', country: 'Italy', crest: '🔴', attack: 77, defense: 78, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Udinese', shortName: 'UDI', country: 'Italy', crest: '⚫', attack: 76, defense: 76, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Genoa', shortName: 'GEN', country: 'Italy', crest: '🔴', attack: 75, defense: 76, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Parma', shortName: 'PAR', country: 'Italy', crest: '🟡', attack: 75, defense: 74, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Como 1907', shortName: 'COM', country: 'Italy', crest: '🔵', attack: 75, defense: 73, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Empoli', shortName: 'EMP', country: 'Italy', crest: '🔵', attack: 73, defense: 75, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Cagliari', shortName: 'CAG', country: 'Italy', crest: '🔴', attack: 74, defense: 73, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Hellas Verona', shortName: 'VER', country: 'Italy', crest: '🟡', attack: 73, defense: 72, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Lecce', shortName: 'LEC', country: 'Italy', crest: '🟡', attack: 72, defense: 73, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Monza', shortName: 'MON', country: 'Italy', crest: '🔴', attack: 73, defense: 74, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Venezia', shortName: 'VEN', country: 'Italy', crest: '🟠', attack: 72, defense: 71, preferredLeague: 'Italy - Serie A Virtual' },

  // Europe - European Championship U21 Qualification (15 squads)
  { name: 'Spain U21', shortName: 'ES21', country: 'Europe', crest: '🟡', attack: 84, defense: 81, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'France U21', shortName: 'FR21', country: 'Europe', crest: '🔵', attack: 85, defense: 82, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'England U21', shortName: 'EN21', country: 'Europe', crest: '🦁', attack: 84, defense: 81, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Germany U21', shortName: 'DE21', country: 'Europe', crest: '🦅', attack: 83, defense: 80, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Italy U21', shortName: 'IT21', country: 'Europe', crest: '🔵', attack: 82, defense: 82, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Portugal U21', shortName: 'PT21', country: 'Europe', crest: '🟢', attack: 83, defense: 80, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Netherlands U21', shortName: 'NL21', country: 'Europe', crest: '🟠', attack: 82, defense: 79, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Belgium U21', shortName: 'BE21', country: 'Europe', crest: '🔴', attack: 79, defense: 77, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Croatia U21', shortName: 'HR21', country: 'Europe', crest: '🔴', attack: 78, defense: 77, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Denmark U21', shortName: 'DK21', country: 'Europe', crest: '🔴', attack: 78, defense: 77, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Norway U21', shortName: 'NO21', country: 'Europe', crest: '🔴', attack: 77, defense: 75, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Poland U21', shortName: 'PL21', country: 'Europe', crest: '⚪', attack: 76, defense: 75, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Iceland U21', shortName: 'IS21', country: 'Europe', crest: '❄️', attack: 73, defense: 74, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Greece U21', shortName: 'GR21', country: 'Europe', crest: '🏛️', attack: 75, defense: 76, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Switzerland U21', shortName: 'CH21', country: 'Europe', crest: '🔴', attack: 77, defense: 76, preferredLeague: 'Europe - European Championship U21 Qualification' },

  // CONCACAF Nations League (14 national teams)
  { name: 'USA', shortName: 'USA', country: 'Americas', crest: '🦅', attack: 81, defense: 79, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Mexico', shortName: 'MEX', country: 'Americas', crest: '🟢', attack: 80, defense: 78, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Canada', shortName: 'CAN', country: 'Americas', crest: '🍁', attack: 79, defense: 77, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Jamaica', shortName: 'JAM', country: 'Americas', crest: '🟡', attack: 75, defense: 74, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Costa Rica', shortName: 'CRC', country: 'Americas', crest: '🔴', attack: 75, defense: 75, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Panama', shortName: 'PAN', country: 'Americas', crest: '🔴', attack: 74, defense: 74, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Honduras', shortName: 'HON', country: 'Americas', crest: '🔵', attack: 73, defense: 73, preferredLeague: 'CONCACAF Nations League' },
  { name: 'El Salvador', shortName: 'SLV', country: 'Americas', crest: '🔵', attack: 70, defense: 70, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Guatemala', shortName: 'GUA', country: 'Americas', crest: '🩵', attack: 70, defense: 70, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Trinidad and Tobago', shortName: 'TRI', country: 'Americas', crest: '🔴', attack: 71, defense: 70, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Haiti', shortName: 'HAI', country: 'Americas', crest: '🔵', attack: 71, defense: 69, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Curacao', shortName: 'CUW', country: 'Americas', crest: '🔵', attack: 71, defense: 70, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Suriname', shortName: 'SUR', country: 'Americas', crest: '🟢', attack: 70, defense: 69, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Nicaragua', shortName: 'NCA', country: 'Americas', crest: '🔵', attack: 68, defense: 68, preferredLeague: 'CONCACAF Nations League' },

  // 35 Additional Real-World Clubs Shared Across the 7 Leagues (5 per league)
  // England (+5)
  { name: 'Leeds United', shortName: 'LEE', country: 'England', crest: '⚪', attack: 77, defense: 75, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Burnley', shortName: 'BRN', country: 'England', crest: '🟣', attack: 76, defense: 76, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Sheffield United', shortName: 'SHU', country: 'England', crest: '🔴', attack: 75, defense: 74, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Sunderland', shortName: 'SUN', country: 'England', crest: '🔴', attack: 74, defense: 73, preferredLeague: 'England - Premier League Virtual' },
  { name: 'Middlesbrough', shortName: 'MID', country: 'England', crest: '🔴', attack: 74, defense: 72, preferredLeague: 'England - Premier League Virtual' },
  // Spain - La Liga (+5)
  { name: 'FC Cartagena', shortName: 'CAR', country: 'Spain', crest: '⚫', attack: 70, defense: 70, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Racing Ferrol', shortName: 'FER', country: 'Spain', crest: '🟢', attack: 70, defense: 71, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'CD Castellon', shortName: 'CAS', country: 'Spain', crest: '⚪', attack: 71, defense: 70, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'CD Eldense', shortName: 'ELD', country: 'Spain', crest: '🔵', attack: 69, defense: 70, preferredLeague: 'Spain - La Liga Virtual' },
  { name: 'Gimnastic Tarragona', shortName: 'GIM', country: 'Spain', crest: '🔴', attack: 69, defense: 70, preferredLeague: 'Spain - La Liga Virtual' },
  // Spain - Copa del Rey (+5)
  { name: 'SD Ponferradina', shortName: 'PON', country: 'Spain', crest: '🔵', attack: 69, defense: 69, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Cultural Leonesa', shortName: 'CUL', country: 'Spain', crest: '⚪', attack: 68, defense: 69, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Real Union', shortName: 'RUN', country: 'Spain', crest: '⚪', attack: 67, defense: 68, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'UD Ibiza', shortName: 'IBI', country: 'Spain', crest: '🩵', attack: 69, defense: 68, preferredLeague: 'Spain - Copa del Rey' },
  { name: 'Real Murcia', shortName: 'MUR', country: 'Spain', crest: '🔴', attack: 69, defense: 69, preferredLeague: 'Spain - Copa del Rey' },
  // Germany (+5)
  { name: '1. FC Koln', shortName: 'KOE', country: 'Germany', crest: '🔴', attack: 75, defense: 74, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Hamburger SV', shortName: 'HSV', country: 'Germany', crest: '🔵', attack: 75, defense: 73, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Hertha BSC', shortName: 'BSC', country: 'Germany', crest: '🔵', attack: 74, defense: 72, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Schalke 04', shortName: 'S04', country: 'Germany', crest: '🔵', attack: 73, defense: 72, preferredLeague: 'Germany - Bundesliga Virtual' },
  { name: 'Hannover 96', shortName: 'H96', country: 'Germany', crest: '🟢', attack: 72, defense: 72, preferredLeague: 'Germany - Bundesliga Virtual' },
  // Italy (+5)
  { name: 'Sassuolo', shortName: 'SAS', country: 'Italy', crest: '🟢', attack: 75, defense: 73, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Sampdoria', shortName: 'SAM', country: 'Italy', crest: '🔵', attack: 73, defense: 72, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Palermo', shortName: 'PAL2', country: 'Italy', crest: '🩷', attack: 73, defense: 72, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Pisa', shortName: 'PIS', country: 'Italy', crest: '🔵', attack: 72, defense: 72, preferredLeague: 'Italy - Serie A Virtual' },
  { name: 'Cremonese', shortName: 'CRE', country: 'Italy', crest: '🔴', attack: 72, defense: 71, preferredLeague: 'Italy - Serie A Virtual' },
  // Europe U21 (+5)
  { name: 'Sweden U21', shortName: 'SE21', country: 'Europe', crest: '🟡', attack: 76, defense: 75, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Austria U21', shortName: 'AT21', country: 'Europe', crest: '🔴', attack: 75, defense: 74, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Ukraine U21', shortName: 'UA21', country: 'Europe', crest: '🟡', attack: 77, defense: 75, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Serbia U21', shortName: 'RS21', country: 'Europe', crest: '🔴', attack: 76, defense: 74, preferredLeague: 'Europe - European Championship U21 Qualification' },
  { name: 'Czechia U21', shortName: 'CZ21', country: 'Europe', crest: '🔵', attack: 76, defense: 75, preferredLeague: 'Europe - European Championship U21 Qualification' },
  // CONCACAF Nations League (+5)
  { name: 'Cuba', shortName: 'CUB', country: 'Americas', crest: '🔴', attack: 69, defense: 68, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Bermuda', shortName: 'BER', country: 'Americas', crest: '🔵', attack: 67, defense: 67, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Guyana', shortName: 'GUY', country: 'Americas', crest: '🟡', attack: 67, defense: 66, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Belize', shortName: 'BLZ', country: 'Americas', crest: '🔵', attack: 66, defense: 66, preferredLeague: 'CONCACAF Nations League' },
  { name: 'Barbados', shortName: 'BRB', country: 'Americas', crest: '🟡', attack: 66, defense: 65, preferredLeague: 'CONCACAF Nations League' },

  // Additional Real-World Clubs for future Red + / Blue + auto-generation & custom leagues
  { name: 'Norwich City', shortName: 'NOR', country: 'England', crest: '🟡', attack: 74, defense: 72 },
  { name: 'Fortuna Dusseldorf', shortName: 'F95', country: 'Germany', crest: '🔴', attack: 73, defense: 72 },
  { name: 'Spezia', shortName: 'SPE', country: 'Italy', crest: '⚪', attack: 71, defense: 72 },
  { name: 'Romania U21', shortName: 'RO21', country: 'Europe', crest: '🟡', attack: 74, defense: 73 },
  { name: 'Paris Saint-Germain', shortName: 'PSG', country: 'France', crest: '🔵', attack: 91, defense: 85 },
  { name: 'Olympique Marseille', shortName: 'OM', country: 'France', crest: '🩵', attack: 82, defense: 79 },
  { name: 'AS Monaco', shortName: 'ASM', country: 'France', crest: '🔴', attack: 83, defense: 80 },
  { name: 'Olympique Lyon', shortName: 'OL', country: 'France', crest: '⚪', attack: 81, defense: 77 },
  { name: 'LOSC Lille', shortName: 'LIL', country: 'France', crest: '🔴', attack: 82, defense: 80 },
  { name: 'OGC Nice', shortName: 'NIC', country: 'France', crest: '🔴', attack: 79, defense: 79 },
  { name: 'RC Lens', shortName: 'LEN', country: 'France', crest: '🟡', attack: 79, defense: 79 },
  { name: 'Stade Rennais', shortName: 'REN', country: 'France', crest: '🔴', attack: 78, defense: 76 },
  { name: 'FC Porto', shortName: 'POR', country: 'Portugal', crest: '🔵', attack: 83, defense: 82 },
  { name: 'SL Benfica', shortName: 'BEN', country: 'Portugal', crest: '🦅', attack: 84, defense: 82 },
  { name: 'Sporting CP', shortName: 'SCP', country: 'Portugal', crest: '🟢', attack: 85, defense: 82 },
  { name: 'SC Braga', shortName: 'BRA', country: 'Portugal', crest: '🔴', attack: 79, defense: 77 },
  { name: 'Ajax', shortName: 'AJX', country: 'Netherlands', crest: '🔴', attack: 82, defense: 79 },
  { name: 'PSV Eindhoven', shortName: 'PSV', country: 'Netherlands', crest: '🔴', attack: 84, defense: 80 },
  { name: 'Feyenoord', shortName: 'FEY', country: 'Netherlands', crest: '🔴', attack: 82, defense: 79 },
  { name: 'AZ Alkmaar', shortName: 'AZ', country: 'Netherlands', crest: '🔴', attack: 78, defense: 76 },
  { name: 'Celtic', shortName: 'CELT', country: 'Scotland', crest: '🟢', attack: 80, defense: 78 },
  { name: 'Rangers', shortName: 'RAN', country: 'Scotland', crest: '🔵', attack: 79, defense: 77 },
  { name: 'Galatasaray', shortName: 'GAL', country: 'Turkey', crest: '🟡', attack: 83, defense: 79 },
  { name: 'Fenerbahce', shortName: 'FEN', country: 'Turkey', crest: '🟡', attack: 82, defense: 79 },
  { name: 'Besiktas', shortName: 'BES', country: 'Turkey', crest: '⚫', attack: 79, defense: 76 },
  { name: 'Club Brugge', shortName: 'BRU', country: 'Belgium', crest: '🔵', attack: 79, defense: 77 },
  { name: 'RSC Anderlecht', shortName: 'AND', country: 'Belgium', crest: '🟣', attack: 77, defense: 76 },
  { name: 'Shakhtar Donetsk', shortName: 'SHK', country: 'Ukraine', crest: '🟠', attack: 79, defense: 76 },
  { name: 'Red Bull Salzburg', shortName: 'SAL', country: 'Austria', crest: '🔴', attack: 78, defense: 76 },
  { name: 'Olympiacos', shortName: 'OLY', country: 'Greece', crest: '🔴', attack: 79, defense: 77 },
  { name: 'Inter Miami', shortName: 'MIA', country: 'Americas', crest: '🩷', attack: 82, defense: 75 },
  { name: 'LAFC', shortName: 'LAFC', country: 'Americas', crest: '🖤', attack: 79, defense: 76 },
  { name: 'LA Galaxy', shortName: 'LAG', country: 'Americas', crest: '⭐', attack: 78, defense: 75 },
  { name: 'Club America', shortName: 'AME', country: 'Americas', crest: '🦅', attack: 81, defense: 78 },
  { name: 'Monterrey', shortName: 'MTY', country: 'Americas', crest: '🔵', attack: 79, defense: 77 },
  { name: 'Tigres UANL', shortName: 'TIG', country: 'Americas', crest: '🟡', attack: 79, defense: 77 },
  { name: 'Cruz Azul', shortName: 'CRZ', country: 'Americas', crest: '🔵', attack: 78, defense: 76 },
  { name: 'Guadalajara', shortName: 'GDL', country: 'Americas', crest: '🔴', attack: 77, defense: 75 },
  { name: 'Flamengo', shortName: 'FLA', country: 'Brazil', crest: '🔴', attack: 83, defense: 79 },
  { name: 'Palmeiras', shortName: 'PAL', country: 'Brazil', crest: '🟢', attack: 83, defense: 81 },
  { name: 'Botafogo', shortName: 'BOT', country: 'Brazil', crest: '⭐', attack: 81, defense: 79 },
  { name: 'Sao Paulo', shortName: 'SAO', country: 'Brazil', crest: '🔴', attack: 79, defense: 78 },
  { name: 'River Plate', shortName: 'RIV', country: 'Argentina', crest: '🔴', attack: 82, defense: 79 },
  { name: 'Boca Juniors', shortName: 'BOCA', country: 'Argentina', crest: '🔵', attack: 80, defense: 78 },
  { name: 'Al Hilal', shortName: 'HIL', country: 'Saudi Arabia', crest: '🔵', attack: 84, defense: 80 },
  { name: 'Al Nassr', shortName: 'NAS', country: 'Saudi Arabia', crest: '🟡', attack: 83, defense: 77 },
  { name: 'Al Ittihad', shortName: 'ITT', country: 'Saudi Arabia', crest: '🟡', attack: 81, defense: 77 },
  { name: 'Al Ahly', shortName: 'AHL', country: 'Egypt', crest: '🦅', attack: 80, defense: 79 },
  { name: 'Wydad AC', shortName: 'WAC', country: 'Morocco', crest: '🔴', attack: 77, defense: 76 },
  { name: 'Mamelodi Sundowns', shortName: 'MSU', country: 'South Africa', crest: '🟡', attack: 78, defense: 77 },
  { name: 'Enyimba', shortName: 'ENY', country: 'Nigeria', crest: '🐘', attack: 75, defense: 74 },
  { name: 'Urawa Red Diamonds', shortName: 'URA', country: 'Japan', crest: '🔴', attack: 77, defense: 76 },
];

function buildInitialRealClubs(leagues: League[], limit = 160): Club[] {
  const leagueNames = new Set(leagues.map(l => l.name));
  const usedNames = new Set<string>();
  const usedCodes = new Set<string>();
  const result: Club[] = [];

  for (const tpl of REAL_CLUB_CATALOG) {
    if (result.length >= limit) break;
    if (!tpl.preferredLeague) continue;
    const assignedLeague = leagueNames.has(tpl.preferredLeague)
      ? tpl.preferredLeague
      : (leagues.find(l => l.country.toLowerCase() === tpl.country.toLowerCase())?.name || tpl.preferredLeague);

    if (usedNames.has(tpl.name.toLowerCase())) continue;
    usedNames.add(tpl.name.toLowerCase());

    let code = tpl.shortName.toUpperCase().slice(0, 4);
    let suffix = 1;
    while (usedCodes.has(code)) {
      code = `${tpl.shortName.slice(0, 3)}${suffix}`.slice(0, 4).toUpperCase();
      suffix += 1;
    }
    usedCodes.add(code);

    result.push({
      id: `club-${code.toLowerCase()}-${result.length + 1}`,
      name: tpl.name,
      shortName: code,
      country: tpl.country,
      league: assignedLeague,
      crest: tpl.crest,
      attack: tpl.attack,
      defense: tpl.defense,
    });
  }

  return result;
}

function buildExact125RealClubs(leagues: League[]): Club[] {
  return buildInitialRealClubs(leagues, 125);
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function doesClubMatchLeague(template: RealClubTemplate, league: League): boolean {
  const leagueLower = league.name.toLowerCase();
  const countryLower = league.country.toLowerCase();
  const tplCountryLower = template.country.toLowerCase();

  if (template.preferredLeague && template.preferredLeague.toLowerCase() === leagueLower) {
    return true;
  }
  if (leagueLower.includes('u21')) {
    return template.name.toLowerCase().includes('u21');
  }
  if (leagueLower.includes('concacaf')) {
    return tplCountryLower === 'americas';
  }
  if (tplCountryLower === countryLower) {
    return !template.name.toLowerCase().includes('u21');
  }
  if (countryLower === 'europe' || leagueLower.includes('champions') || leagueLower.includes('europa') || leagueLower.includes('europe')) {
    return ['england', 'spain', 'germany', 'italy', 'france', 'portugal', 'netherlands', 'scotland', 'turkey', 'belgium', 'ukraine', 'austria', 'greece'].includes(tplCountryLower) && !template.name.toLowerCase().includes('u21');
  }
  return false;
}

function pickRealClubForLeague(
  targetLeague: League,
  usedNames: Set<string>,
  usedCodes: Set<string>,
  preferLeagueMatch: boolean
): Club | null {
  const unused = REAL_CLUB_CATALOG.filter(t => !usedNames.has(t.name.toLowerCase()));
  if (unused.length === 0) return null;

  let pool = preferLeagueMatch
    ? unused.filter(t => doesClubMatchLeague(t, targetLeague))
    : [];

  if (pool.length === 0) {
    const nonU21 = unused.filter(t => !t.name.toLowerCase().includes('u21'));
    pool = nonU21.length > 0 ? nonU21 : unused;
  }

  const chosen = shuffleArray(pool)[0];
  usedNames.add(chosen.name.toLowerCase());

  let code = chosen.shortName.toUpperCase().slice(0, 4);
  let codeSuffix = 1;
  while (usedCodes.has(code)) {
    code = `${chosen.shortName.slice(0, 3)}${codeSuffix}`.slice(0, 4).toUpperCase();
    codeSuffix += 1;
  }
  usedCodes.add(code);

  return {
    id: `club-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: chosen.name,
    shortName: code,
    country: chosen.country,
    league: targetLeague.name,
    crest: chosen.crest,
    attack: chosen.attack,
    defense: chosen.defense
  };
}

function recalculateOddsOnGoal(match: VirtualMatch) {
  const diff = match.homeScore - match.awayScore;
  const totalGoals = match.homeScore + match.awayScore;
  if (diff > 0) {
    match.oddsDirection['home'] = 'down';
    match.oddsDirection['away'] = 'up';
    match.oddsDirection['draw'] = 'up';
    match.odds.home = Math.max(1.10, Math.round(match.odds.home * 0.88 * 100) / 100);
    match.odds.away = Math.min(18.0, Math.round(match.odds.away * 1.18 * 100) / 100);
    match.odds.draw = Math.min(12.0, Math.round(match.odds.draw * 1.08 * 100) / 100);
  } else if (diff < 0) {
    match.oddsDirection['home'] = 'up';
    match.oddsDirection['away'] = 'down';
    match.oddsDirection['draw'] = 'up';
    match.odds.away = Math.max(1.10, Math.round(match.odds.away * 0.88 * 100) / 100);
    match.odds.home = Math.min(18.0, Math.round(match.odds.home * 1.18 * 100) / 100);
    match.odds.draw = Math.min(12.0, Math.round(match.odds.draw * 1.08 * 100) / 100);
  } else {
    match.oddsDirection['draw'] = 'down';
    match.odds.draw = Math.max(1.80, Math.round(match.odds.draw * 0.90 * 100) / 100);
  }

  if (match.minute <= 30) {
    match.odds.ht1Over10 = Math.max(1.15, Math.round((match.odds.home * 1.04) * 100) / 100);
    match.odds.htXOver10 = Math.max(1.40, Math.round((match.odds.draw * 1.06) * 100) / 100);
    match.odds.ht2Over10 = Math.max(1.15, Math.round((match.odds.away * 1.04) * 100) / 100);
    match.odds.htOver15 = Math.max(1.15, Math.round(match.odds.htOver15 * 0.91 * 100) / 100);
    match.odds.htUnder15 = Math.min(6.5, Math.round(match.odds.htUnder15 * 1.09 * 100) / 100);
  } else {
    match.odds.sh1Over15 = Math.max(1.12, Math.round((match.odds.home * 1.02) * 100) / 100);
    match.odds.shXOver15 = Math.max(1.45, Math.round((match.odds.draw * 1.08) * 100) / 100);
    match.odds.sh2Over15 = Math.max(1.12, Math.round((match.odds.away * 1.02) * 100) / 100);
  }

  if (Array.isArray(match.odds.overUnderLines)) {
    match.odds.overUnderLines = match.odds.overUnderLines.map(item => {
      const nextOver =
        totalGoals > item.line
          ? 2.0
          : Math.max(2.0, Math.min(18.75, Math.round(item.over * 0.94 * 100) / 100));
      const nextUnder =
        totalGoals > item.line
          ? 18.75
          : Math.max(2.0, Math.min(18.75, Math.round(item.under * 1.05 * 100) / 100));
      return { line: item.line, over: nextOver, under: nextUnder };
    });
  }
}

function microFluctuateOdds(match: VirtualMatch) {
  const keys = [
    'home',
    'draw',
    'away',
    'firstGoalHome',
    'firstGoalAway',
    'fiveMinYes',
    'fiveMinNo',
    'fiveMinOver5',
    'ht1Over10',
    'htXOver10',
    'ht2Over10',
    'htOver15',
    'htUnder15',
    'sh1Over15',
    'shXOver15',
    'sh2Over15',
    'oddGoals',
    'evenGoals',
  ] as const;
  const chosenKey = keys[Math.floor(Math.random() * keys.length)];
  const currentVal = match.odds[chosenKey];
  const delta = Math.random() * 0.1 - 0.045;
  const newVal = Math.max(1.05, Math.round((currentVal + delta) * 100) / 100);

  if (newVal !== currentVal) {
    match.oddsDirection[chosenKey] = newVal > currentVal ? 'up' : 'down';
    match.odds[chosenKey] = newVal;
  }

  if (Array.isArray(match.odds.overUnderLines) && match.odds.overUnderLines.length > 0 && Math.random() < 0.35) {
    const idx = Math.floor(Math.random() * match.odds.overUnderLines.length);
    const target = match.odds.overUnderLines[idx];
    const nudge = Math.random() * 0.16 - 0.08;
    match.odds.overUnderLines[idx] = {
      line: target.line,
      over: Number(Math.max(2.0, Math.min(18.75, target.over + nudge)).toFixed(2)),
      under: Number(Math.max(2.0, Math.min(18.75, target.under - nudge)).toFixed(2)),
    };
  }
}

function formatScheduledTimeLabel(kickoffAt: number, dayBucket: 'TODAY' | 'NEXT_DAY'): string {
  const date = new Date(kickoffAt);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (dayBucket === 'NEXT_DAY') {
    return `Tomorrow ${hh}:${mm}`;
  }
  const diffMin = Math.max(1, Math.round((kickoffAt - Date.now()) / 60000));
  if (diffMin <= 60) {
    return `Starts in ${diffMin}m`;
  }
  return `Today ${hh}:${mm}`;
}

function normalizeMatchShape(m: VirtualMatch): VirtualMatch {
  const fallbackOdds = buildHighGoalOdds(78, 76, 77, 75, {
    home: m.odds?.home,
    draw: m.odds?.draw,
    away: m.odds?.away,
  });
  const hasValidOuLines =
    Array.isArray(m.odds?.overUnderLines) &&
    m.odds.overUnderLines.length === 16 &&
    m.odds.overUnderLines.every(
      item =>
        typeof item?.line === 'number' &&
        typeof item?.over === 'number' &&
        typeof item?.under === 'number' &&
        item.over >= 2.0 &&
        item.over <= 18.75 &&
        item.under >= 2.0 &&
        item.under <= 18.75
    );
  const mergedOdds: VirtualMatch['odds'] = {
    home: typeof m.odds?.home === 'number' ? m.odds.home : fallbackOdds.home,
    draw: typeof m.odds?.draw === 'number' ? m.odds.draw : fallbackOdds.draw,
    away: typeof m.odds?.away === 'number' ? m.odds.away : fallbackOdds.away,
    firstGoalHome: typeof m.odds?.firstGoalHome === 'number' ? m.odds.firstGoalHome : fallbackOdds.firstGoalHome,
    firstGoalAway: typeof m.odds?.firstGoalAway === 'number' ? m.odds.firstGoalAway : fallbackOdds.firstGoalAway,
    fiveMinYes: typeof m.odds?.fiveMinYes === 'number' ? m.odds.fiveMinYes : fallbackOdds.fiveMinYes,
    fiveMinNo: typeof m.odds?.fiveMinNo === 'number' ? m.odds.fiveMinNo : fallbackOdds.fiveMinNo,
    fiveMinOver5: typeof m.odds?.fiveMinOver5 === 'number' ? m.odds.fiveMinOver5 : fallbackOdds.fiveMinOver5,
    ht1Over10: typeof m.odds?.ht1Over10 === 'number' ? m.odds.ht1Over10 : fallbackOdds.ht1Over10,
    htXOver10: typeof m.odds?.htXOver10 === 'number' ? m.odds.htXOver10 : fallbackOdds.htXOver10,
    ht2Over10: typeof m.odds?.ht2Over10 === 'number' ? m.odds.ht2Over10 : fallbackOdds.ht2Over10,
    htOver15: typeof m.odds?.htOver15 === 'number' ? m.odds.htOver15 : fallbackOdds.htOver15,
    htUnder15: typeof m.odds?.htUnder15 === 'number' ? m.odds.htUnder15 : fallbackOdds.htUnder15,
    sh1Over15: typeof m.odds?.sh1Over15 === 'number' ? m.odds.sh1Over15 : fallbackOdds.sh1Over15,
    shXOver15: typeof m.odds?.shXOver15 === 'number' ? m.odds.shXOver15 : fallbackOdds.shXOver15,
    sh2Over15: typeof m.odds?.sh2Over15 === 'number' ? m.odds.sh2Over15 : fallbackOdds.sh2Over15,
    oddGoals: typeof m.odds?.oddGoals === 'number' ? m.odds.oddGoals : fallbackOdds.oddGoals,
    evenGoals: typeof m.odds?.evenGoals === 'number' ? m.odds.evenGoals : fallbackOdds.evenGoals,
    overUnderLines: hasValidOuLines ? m.odds.overUnderLines : fallbackOdds.overUnderLines,
    correctScores:
      Array.isArray(m.odds?.correctScores) && m.odds.correctScores.length > 0
        ? m.odds.correctScores
        : fallbackOdds.correctScores,
  };

  return {
    ...m,
    isZoom: Boolean(m.isZoom),
    roundNumber: typeof m.roundNumber === 'number' && m.roundNumber >= 1 ? m.roundNumber : 1,
    hadFiveMinGoal: Boolean(m.hadFiveMinGoal),
    durationMinutes: m.isZoom ? 2 : MATCH_DURATION_MINUTES,
    durationSeconds: m.isZoom ? ZOOM_DURATION_SECONDS : MATCH_DURATION_MINUTES * 60,
    elapsedSeconds: m.isZoom ? (typeof m.elapsedSeconds === 'number' ? m.elapsedSeconds : 0) : undefined,
    firstHalfHomeScore: typeof m.firstHalfHomeScore === 'number' ? m.firstHalfHomeScore : m.homeScore,
    firstHalfAwayScore: typeof m.firstHalfAwayScore === 'number' ? m.firstHalfAwayScore : m.awayScore,
    dayBucket: m.dayBucket || 'TODAY',
    matchDate: m.matchDate || getDayKey(0),
    odds: mergedOdds,
  };
}

function recordMatchResultToH2HAndReset(match: VirtualMatch, now: number): { resetMatch: VirtualMatch; record: H2HRecord } {
  const currentRound = match.roundNumber || 1;
  const record: H2HRecord = {
    id: `h2h-${match.id}-r${currentRound}-${now}-${Math.random().toString(36).substring(2, 5)}`,
    matchId: match.id,
    roundNumber: currentRound,
    league: match.league,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    firstHalfHomeScore: typeof match.firstHalfHomeScore === 'number' ? match.firstHalfHomeScore : match.homeScore,
    firstHalfAwayScore: typeof match.firstHalfAwayScore === 'number' ? match.firstHalfAwayScore : match.awayScore,
    firstGoalTeam: match.firstGoalTeam,
    hadFiveMinGoal: Boolean(match.hadFiveMinGoal),
    isZoom: Boolean(match.isZoom),
    playedAt: now,
  };

  const homeClub = store.clubs.find(c => c.name.toLowerCase() === match.homeTeam.toLowerCase());
  const awayClub = store.clubs.find(c => c.name.toLowerCase() === match.awayTeam.toLowerCase());
  const freshOdds = buildHighGoalOdds(
    homeClub?.attack || 78,
    homeClub?.defense || 76,
    awayClub?.attack || 77,
    awayClub?.defense || 75
  );

  const nextRound = currentRound + 1;
  const isZoomMatch = Boolean(match.isZoom);
  const delayMs = isZoomMatch ? 20000 : 20 * 60000;
  const nextKickoffAt = now + delayMs;
  const startsInSeconds = Math.max(5, Math.ceil(delayMs / 1000));

  const resetMatch: VirtualMatch = {
    ...match,
    homeScore: 0,
    awayScore: 0,
    firstHalfHomeScore: 0,
    firstHalfAwayScore: 0,
    firstGoalTeam: undefined,
    hadFiveMinGoal: false,
    roundNumber: nextRound,
    minute: 0,
    elapsedSeconds: isZoomMatch ? 0 : undefined,
    status: 'UPCOMING',
    kickoffAt: nextKickoffAt,
    startsInSeconds,
    scheduledTime: isZoomMatch
      ? formatZoomTimeLabel(nextKickoffAt)
      : formatScheduledTimeLabel(nextKickoffAt, match.dayBucket || 'TODAY'),
    odds: freshOdds,
    oddsDirection: {},
    stats: {
      possessionHome: match.stats.possessionHome,
      possessionAway: match.stats.possessionAway,
      dangerousAttacksHome: 0,
      dangerousAttacksAway: 0,
      shotsOnTargetHome: 0,
      shotsOnTargetAway: 0,
      cornersHome: 0,
      cornersAway: 0,
    },
    events: [
      {
        minute: 0,
        text: isZoomMatch
          ? `Zoom 90s Round #${nextRound} ready: ${match.homeTeam} vs ${match.awayTeam}`
          : `Virtual 60' Round #${nextRound} ready: ${match.homeTeam} vs ${match.awayTeam}`,
        type: 'whistle',
      },
    ],
  };

  return { resetMatch, record };
}

function buildClubPairsFromStore(targetCount: number): Array<{ home: Club; away: Club; leagueName: string; country: string }> {
  const byLeague = new Map<string, Club[]>();
  for (const club of store.clubs) {
    const key = club.league || 'Virtual League';
    const list = byLeague.get(key) || [];
    list.push(club);
    byLeague.set(key, list);
  }

  const allLeaguePools = Array.from(byLeague.entries())
    .filter(([, list]) => list.length >= 2)
    .map(([leagueName, list]) => ({ leagueName, clubs: shuffleArray(list) }));

  if (allLeaguePools.length === 0 && store.clubs.length >= 2) {
    allLeaguePools.push({ leagueName: store.clubs[0].league || 'Virtual League', clubs: shuffleArray(store.clubs) });
  }

  const pairs: Array<{ home: Club; away: Club; leagueName: string; country: string }> = [];
  const usedPairKeys = new Set<string>();
  let guard = 0;

  while (pairs.length < targetCount && allLeaguePools.length > 0 && guard < 400) {
    const pool = allLeaguePools[guard % allLeaguePools.length];
    guard += 1;
    if (pool.clubs.length < 2) continue;

    const shuffled = shuffleArray(pool.clubs);
    const home = shuffled[0];
    const away = shuffled[1];
    if (!home || !away || home.id === away.id) continue;

    const pairKey = [home.id, away.id].sort().join(':');
    if (usedPairKeys.has(pairKey) && guard < 200) continue;
    usedPairKeys.add(pairKey);

    const matchedLeague = store.leagues.find(l => l.name.toLowerCase() === pool.leagueName.toLowerCase());
    pairs.push({
      home,
      away,
      leagueName: pool.leagueName,
      country: matchedLeague?.country || home.country || 'International',
    });
  }

  return pairs;
}

function createWaveMatch(
  pair: { home: Club; away: Club; leagueName: string; country: string },
  indexInDay: number,
  dayBucket: 'TODAY' | 'NEXT_DAY',
  matchDate: string,
  now: number
): VirtualMatch {
  const odds = buildHighGoalOdds(pair.home.attack, pair.home.defense, pair.away.attack, pair.away.defense);
  const totalPower = pair.home.attack + pair.home.defense + pair.away.attack + pair.away.defense;
  const possessionHome = Math.max(30, Math.min(70, Math.round(((pair.home.attack + pair.home.defense) / totalPower) * 100)));
  const possessionAway = 100 - possessionHome;

  // Wave timing:
  // Today: 0 matches active right now; Wave 0 (5 matches) starts in 22-30m, each wave runs 60m with ~24m break between waves
  // Next Day: 4 waves starting +24h from now
  const waveIdx = Math.floor(indexInDay / MAX_LIVE_DAILY_MATCHES);
  const slotInWave = indexInDay % MAX_LIVE_DAILY_MATCHES;

  const status: 'LIVE' | 'UPCOMING' = 'UPCOMING';
  const minute = 0;
  let kickoffAt = now;
  const homeScore = 0;
  const awayScore = 0;
  const firstHalfHomeScore = 0;
  const firstHalfAwayScore = 0;

  if (dayBucket === 'TODAY') {
    const waveOffsetMins = 22 + waveIdx * 84 + slotInWave * 2;
    kickoffAt = now + waveOffsetMins * 60000;
  } else {
    const nextDayBase = now + 24 * 60 * 60000;
    const waveOffsetMins = waveIdx * 90 + slotInWave * 5;
    kickoffAt = nextDayBase + waveOffsetMins * 60000;
  }

  const startsInSeconds = Math.max(10, Math.ceil((kickoffAt - now) / 1000));

  return {
    id: `daily-${matchDate}-${dayBucket.toLowerCase()}-${indexInDay + 1}-${Math.random().toString(36).substring(2, 6)}`,
    league: pair.leagueName,
    country: pair.country,
    homeTeam: pair.home.name,
    awayTeam: pair.away.name,
    homeScore,
    awayScore,
    firstHalfHomeScore,
    firstHalfAwayScore,
    minute,
    durationMinutes: MATCH_DURATION_MINUTES,
    status,
    scheduledTime: formatScheduledTimeLabel(kickoffAt, dayBucket),
    startsInSeconds,
    kickoffAt,
    dayBucket,
    matchDate,
    isSystemDaily: true,
    isFeatured: dayBucket === 'TODAY' && indexInDay === 0,
    odds,
    oddsDirection: {},
    stats: {
      possessionHome,
      possessionAway,
      dangerousAttacksHome: 0,
      dangerousAttacksAway: 0,
      shotsOnTargetHome: 0,
      shotsOnTargetAway: 0,
      cornersHome: 0,
      cornersAway: 0,
    },
    events: [
      {
        minute: 0,
        text: `Daily fixed match scheduled (60' standard): ${pair.home.name} vs ${pair.away.name}`,
        type: 'whistle',
      },
    ],
  };
}

function formatZoomTimeLabel(kickoffAt: number): string {
  const diffSec = Math.max(1, Math.ceil((kickoffAt - Date.now()) / 1000));
  if (diffSec < 60) {
    return `Starts in ${diffSec}s`;
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin <= 60) {
    return `Starts in ${diffMin}m`;
  }
  const date = new Date(kickoffAt);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `Today ${hh}:${mm}`;
}

function createZoomWaveMatch(
  pair: { home: Club; away: Club; leagueName: string; country: string },
  indexInDay: number,
  matchDate: string,
  now: number
): VirtualMatch {
  const odds = buildHighGoalOdds(pair.home.attack, pair.home.defense, pair.away.attack, pair.away.defense);
  const totalPower = pair.home.attack + pair.home.defense + pair.away.attack + pair.away.defense;
  const possessionHome = Math.max(30, Math.min(70, Math.round(((pair.home.attack + pair.home.defense) / totalPower) * 100)));
  const possessionAway = 100 - possessionHome;

  const waveIdx = Math.floor(indexInDay / ZOOM_WAVE_SIZE);
  const slotInWave = indexInDay % ZOOM_WAVE_SIZE;
  const delaySec = 45 + waveIdx * 120 + slotInWave * 3;
  const kickoffAt = now + delaySec * 1000;
  const startsInSeconds = Math.max(5, Math.ceil((kickoffAt - now) / 1000));

  return {
    id: `zoom-${matchDate}-${indexInDay + 1}-${Math.random().toString(36).substring(2, 6)}`,
    league: pair.leagueName,
    country: pair.country,
    homeTeam: pair.home.name,
    awayTeam: pair.away.name,
    homeScore: 0,
    awayScore: 0,
    firstHalfHomeScore: 0,
    firstHalfAwayScore: 0,
    minute: 0,
    durationMinutes: 2,
    durationSeconds: ZOOM_DURATION_SECONDS,
    elapsedSeconds: 0,
    isZoom: true,
    status: 'UPCOMING',
    scheduledTime: formatZoomTimeLabel(kickoffAt),
    startsInSeconds,
    kickoffAt,
    dayBucket: 'TODAY',
    matchDate,
    isSystemDaily: true,
    isFeatured: false,
    odds,
    oddsDirection: {},
    stats: {
      possessionHome,
      possessionAway,
      dangerousAttacksHome: 0,
      dangerousAttacksAway: 0,
      shotsOnTargetHome: 0,
      shotsOnTargetAway: 0,
      cornersHome: 0,
      cornersAway: 0,
    },
    events: [
      {
        minute: 0,
        text: `Zoom 90s match scheduled: ${pair.home.name} vs ${pair.away.name}`,
        type: 'whistle',
      },
    ],
  };
}

function generateTipsterBetcodes(todayMatches: VirtualMatch[], dayKey: string): TipsterBetcode[] {
  const nonZoomToday = todayMatches.filter(m => !m.isZoom);
  const unfinished = nonZoomToday.filter(m => m.status !== 'FINISHED');
  const pool = unfinished.length >= 4 ? unfinished : nonZoomToday;
  if (pool.length === 0) return [];

  const sortedByFavoriteEdge = [...pool].sort((a, b) => {
    const minA = Math.min(a.odds.home, a.odds.away);
    const minB = Math.min(b.odds.home, b.odds.away);
    return minA - minB;
  });

  const sortedByBalancedDraw = [...pool].sort((a, b) => a.odds.draw - b.odds.draw);
  const sortedByFastGoal = [...pool].sort((a, b) => a.odds.fiveMinYes - b.odds.fiveMinYes);
  const sortedByHighTempo = [...pool].sort((a, b) => a.odds.fiveMinOver5 - b.odds.fiveMinOver5);
  const sortedByFirstHalf = [...pool].sort((a, b) => {
    const minA = Math.min(a.odds.ht1Over10, a.odds.ht2Over10);
    const minB = Math.min(b.odds.ht1Over10, b.odds.ht2Over10);
    return minA - minB;
  });
  const sortedBySecondHalf = [...pool].sort((a, b) => {
    const minA = Math.min(a.odds.sh1Over15, a.odds.sh2Over15);
    const minB = Math.min(b.odds.sh1Over15, b.odds.sh2Over15);
    return minA - minB;
  });

  const pickBest1X2 = (m: VirtualMatch): BetSelection => {
    const isHome = m.odds.home <= m.odds.away;
    const sel = isHome ? 'Home & O15' : 'Away & O15';
    const odds = isHome ? m.odds.home : m.odds.away;
    return {
      matchId: m.id,
      matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
      marketType: '1X2',
      marketName: '1X2',
      selection: sel,
      odds,
      initialOdds: odds,
      isZoom: false,
    };
  };

  const pickDraw1X2 = (m: VirtualMatch): BetSelection => ({
    matchId: m.id,
    matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
    marketType: '1X2',
    marketName: '1X2',
    selection: 'Draw',
    odds: m.odds.draw,
    initialOdds: m.odds.draw,
    isZoom: false,
  });

  const pick5MinGoal = (m: VirtualMatch, type: 'Yes' | 'Over 5 Goals'): BetSelection => {
    const odds = type === 'Over 5 Goals' ? m.odds.fiveMinOver5 : m.odds.fiveMinYes;
    return {
      matchId: m.id,
      matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
      marketType: '5 Min Goal',
      marketName: '5 Min Goal',
      selection: type,
      odds,
      initialOdds: odds,
      isZoom: false,
    };
  };

  const pickFirstHalf = (m: VirtualMatch): BetSelection => {
    const isHome = m.odds.ht1Over10 <= m.odds.ht2Over10;
    const sel = isHome ? 'Home & O10' : 'Away & O10';
    const odds = isHome ? m.odds.ht1Over10 : m.odds.ht2Over10;
    return {
      matchId: m.id,
      matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
      marketType: '1st Half',
      marketName: '1st Half',
      selection: sel,
      odds,
      initialOdds: odds,
      isZoom: false,
    };
  };

  const pickSecondHalf = (m: VirtualMatch): BetSelection => {
    const isHome = m.odds.sh1Over15 <= m.odds.sh2Over15;
    const sel = isHome ? 'Home & O15' : 'Away & O15';
    const odds = isHome ? m.odds.sh1Over15 : m.odds.sh2Over15;
    return {
      matchId: m.id,
      matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
      marketType: '2nd Half',
      marketName: '2nd Half',
      selection: sel,
      odds,
      initialOdds: odds,
      isZoom: false,
    };
  };

  const pickCorrectScore = (m: VirtualMatch, idx = 0): BetSelection => {
    const cs = m.odds.correctScores[idx] || m.odds.correctScores[0] || { score: '10:9', odds: 7.5 };
    return {
      matchId: m.id,
      matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
      marketType: 'Correct Score',
      marketName: 'Correct Score',
      selection: cs.score,
      odds: cs.odds,
      initialOdds: cs.odds,
      isZoom: false,
    };
  };

  const takeUnique = (source: VirtualMatch[], count: number, builder: (m: VirtualMatch, i: number) => BetSelection): BetSelection[] => {
    const seen = new Set<string>();
    const legs: BetSelection[] = [];
    for (const m of source) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      legs.push(builder(m, legs.length));
      if (legs.length >= count) break;
    }
    return legs;
  };

  const strategies: Array<{ code: string; title: string; confidence: number; selections: BetSelection[] }> = [
    {
      code: 'CAS-901',
      title: 'Top Power Favorites',
      confidence: 92,
      selections: takeUnique(sortedByFavoriteEdge, 3, m => pickBest1X2(m)),
    },
    {
      code: 'CAS-902',
      title: 'Fast Strike 5m Double',
      confidence: 90,
      selections: takeUnique(sortedByFastGoal, 3, m => pick5MinGoal(m, 'Yes')),
    },
    {
      code: 'CAS-903',
      title: '1st Half Tempo Trio',
      confidence: 88,
      selections: takeUnique(sortedByFirstHalf, 3, m => pickFirstHalf(m)),
    },
    {
      code: 'CAS-904',
      title: '2nd Half Finishers',
      confidence: 87,
      selections: takeUnique(sortedBySecondHalf, 3, m => pickSecondHalf(m)),
    },
    {
      code: 'CAS-905',
      title: 'Over 5 Goals Blitz',
      confidence: 84,
      selections: takeUnique(sortedByHighTempo, 3, m => pick5MinGoal(m, 'Over 5 Goals')),
    },
    {
      code: 'CAS-906',
      title: 'Daily 4-Fold Acca',
      confidence: 86,
      selections: takeUnique(sortedByFavoriteEdge.slice(2).concat(sortedByFavoriteEdge), 4, (m, i) =>
        i % 2 === 0 ? pickBest1X2(m) : pickSecondHalf(m)
      ),
    },
    {
      code: 'CAS-907',
      title: 'High Possession Combo',
      confidence: 85,
      selections: takeUnique(
        [...pool].sort((a, b) => Math.abs(b.stats.possessionHome - b.stats.possessionAway) - Math.abs(a.stats.possessionHome - a.stats.possessionAway)),
        4,
        (m, i) => (i % 2 === 0 ? pickFirstHalf(m) : pickBest1X2(m))
      ),
    },
    {
      code: 'CAS-908',
      title: 'Balanced Draw Value',
      confidence: 78,
      selections: takeUnique(sortedByBalancedDraw, 2, m => pickDraw1X2(m)),
    },
    {
      code: 'CAS-909',
      title: 'Correct Score Double',
      confidence: 74,
      selections: takeUnique(sortedByFavoriteEdge, 2, m => pickCorrectScore(m, 0)),
    },
    {
      code: 'CAS-910',
      title: 'Super 5-Leg Daily Jackpot',
      confidence: 81,
      selections: takeUnique(sortedByFavoriteEdge, 5, (m, i) => {
        if (i === 0) return pickBest1X2(m);
        if (i === 1) return pick5MinGoal(m, 'Yes');
        if (i === 2) return pickFirstHalf(m);
        if (i === 3) return pickSecondHalf(m);
        return pickBest1X2(m);
      }),
    },
  ];

  return strategies.map((item, idx) => {
    const safeSelections = item.selections.length > 0 ? item.selections : [pickBest1X2(pool[0])];
    const totalOdds = Number(safeSelections.reduce((acc, s) => acc * s.odds, 1).toFixed(2));
    return {
      id: `tip-${dayKey}-${idx + 1}`,
      code: item.code,
      title: item.title,
      confidence: item.confidence,
      totalOdds,
      selections: safeSelections,
    };
  });
}

function ensureDailyMatchesScheduled(): boolean {
  const now = Date.now();
  const todayKey = getDayKey(0);
  const tomorrowKey = getDayKey(1);
  let changed = false;

  // Normalize any legacy matches and archive/reset any leftover FINISHED matches into H2H
  const newStartupH2H: H2HRecord[] = [];
  store.matches = store.matches.map(rawMatch => {
    const normalized = normalizeMatchShape(rawMatch);
    if (normalized.status === 'FINISHED') {
      const { resetMatch, record } = recordMatchResultToH2HAndReset(normalized, now);
      newStartupH2H.push(record);
      changed = true;
      return resetMatch;
    }
    return normalized;
  });
  if (newStartupH2H.length > 0) {
    store.h2hRecords = [...store.h2hRecords, ...newStartupH2H].slice(-600);
    changed = true;
  }

  // If upgrading from v1 wave schedule (where Wave 0 started LIVE), refresh system daily matches to standby v2
  if ((store.scheduleWaveVersion || 1) < 2) {
    store.matches = store.matches.filter(m => !m.isSystemDaily);
    store.scheduleWaveVersion = 2;
    changed = true;
  }

  // Drop old days' system-daily fixtures when a new day starts
  const beforeCount = store.matches.length;
  store.matches = store.matches.filter(m => {
    if (!m.isSystemDaily) return true;
    if (m.isZoom) return m.matchDate === todayKey;
    return m.matchDate === todayKey || m.matchDate === tomorrowKey;
  });
  if (store.matches.length !== beforeCount) {
    changed = true;
  }

  // Promote any yesterday-created NEXT_DAY fixtures whose matchDate is now todayKey
  let promotedIdx = 0;
  store.matches = store.matches.map(m => {
    if (m.isSystemDaily && !m.isZoom && m.matchDate === todayKey && m.dayBucket === 'NEXT_DAY') {
      changed = true;
      const waveIdx = Math.floor(promotedIdx / MAX_LIVE_DAILY_MATCHES);
      const slotInWave = promotedIdx % MAX_LIVE_DAILY_MATCHES;
      promotedIdx += 1;
      const kickoffAt = now + (22 + waveIdx * 84 + slotInWave * 2) * 60000;
      return {
        ...m,
        dayBucket: 'TODAY',
        status: 'UPCOMING',
        minute: 0,
        kickoffAt,
        startsInSeconds: Math.max(10, Math.ceil((kickoffAt - now) / 1000)),
        scheduledTime: formatScheduledTimeLabel(kickoffAt, 'TODAY'),
        isFeatured: promotedIdx === 1,
      };
    }
    return m;
  });

  // Ensure 20 TODAY main matches
  const existingToday = store.matches.filter(m => !m.isZoom && m.dayBucket === 'TODAY' && m.isSystemDaily);
  const missingToday = Math.max(0, DAILY_MATCH_TARGET - existingToday.length);
  if (missingToday > 0 && store.clubs.length >= 2) {
    const pairs = buildClubPairsFromStore(missingToday);
    const startIdx = existingToday.length;
    const generatedToday = pairs.map((pair, idx) =>
      createWaveMatch(pair, startIdx + idx, 'TODAY', todayKey, now)
    );
    store.matches = [...store.matches, ...generatedToday];
    changed = true;
  }

  // Ensure 20 NEXT_DAY (UPCOMING) main matches
  const existingNextDay = store.matches.filter(m => !m.isZoom && m.dayBucket === 'NEXT_DAY' && m.isSystemDaily);
  const missingNextDay = Math.max(0, DAILY_MATCH_TARGET - existingNextDay.length);
  if (missingNextDay > 0 && store.clubs.length >= 2) {
    const pairs = buildClubPairsFromStore(missingNextDay);
    const startIdx = existingNextDay.length;
    const generatedNextDay = pairs.map((pair, idx) =>
      createWaveMatch(pair, startIdx + idx, 'NEXT_DAY', tomorrowKey, now)
    );
    store.matches = [...store.matches, ...generatedNextDay];
    changed = true;
  }

  // Ensure 50 daily ZOOM simulated matches (90 standard seconds each)
  const existingZoomToday = store.matches.filter(m => m.isZoom && m.matchDate === todayKey);
  const missingZoomToday = Math.max(0, ZOOM_DAILY_TARGET - existingZoomToday.length);
  if (missingZoomToday > 0 && store.clubs.length >= 2) {
    const pairs = buildClubPairsFromStore(missingZoomToday);
    const startIdx = existingZoomToday.length;
    const generatedZoom = pairs.map((pair, idx) =>
      createZoomWaveMatch(pair, startIdx + idx, todayKey, now)
    );
    store.matches = [...store.matches, ...generatedZoom];
    changed = true;
  }

  // Ensure exactly one featured non-Zoom match if today matches exist
  const mainMatches = store.matches.filter(m => !m.isZoom);
  if (mainMatches.length > 0 && !mainMatches.some(m => m.isFeatured)) {
    const firstToday = mainMatches.find(m => m.dayBucket === 'TODAY') || mainMatches[0];
    if (firstToday) {
      firstToday.isFeatured = true;
      changed = true;
    }
  }

  // Ensure 10 Tipster Betcodes analyzed from today's 20 daily matches
  const todayMain = store.matches.filter(m => !m.isZoom && m.dayBucket === 'TODAY');
  const todayMatchIds = new Set(todayMain.map(m => m.id));
  const tipsterStale =
    !Array.isArray(store.tipsterBetcodes) ||
    store.tipsterBetcodes.length !== 10 ||
    store.lastScheduleDate !== todayKey ||
    store.tipsterBetcodes.some(tc => tc.selections.some(s => !todayMatchIds.has(s.matchId)));

  if (tipsterStale && todayMain.length > 0) {
    store.tipsterBetcodes = generateTipsterBetcodes(todayMain, todayKey);
    changed = true;
  }

  if (store.lastScheduleDate !== todayKey) {
    store.lastScheduleDate = todayKey;
    changed = true;
  }

  if (changed) {
    saveStore(store);
  }
  return changed;
}

async function startServer() {
  if (!Array.isArray(store.fxAssets) || store.fxAssets.length === 0) {
    store.fxAssets = buildInitialFxAssets();
    saveStore(store);
  }
  ensureDailyMatchesScheduled();

  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const broadcast = (type: string, data: unknown) => {
    let sliceVersion = stateVersion;
    if (type.startsWith('state:')) {
      stateVersion += 1;
      const sliceName = type.replace('state:', '') as keyof typeof sliceVersions;
      if (sliceName in sliceVersions) {
        sliceVersions[sliceName] += 1;
        sliceVersion = sliceVersions[sliceName];
      } else {
        sliceVersion = stateVersion;
      }
    }
    const payload = JSON.stringify({
      type,
      data,
      version: stateVersion,
      sliceVersion,
      versions: sliceVersions
    });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  server.on('upgrade', (request, socket, head) => {
    const urlPath = request.url?.split('?')[0];
    if (urlPath === '/ws') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', ws => {
    ws.send(JSON.stringify({
      type: 'init',
      version: stateVersion,
      versions: sliceVersions,
      data: {
        matches: store.matches,
        tipsterBetcodes: store.tipsterBetcodes,
        h2hRecords: store.h2hRecords,
        fxAssets: store.fxAssets,
        clubs: store.clubs,
        leagues: store.leagues,
        leaderboard: store.leaderboard,
        ticker: store.ticker,
      }
    }));

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed client messages
      }
    });
  });

  // Authoritative 1.5s virtual match simulation loop (60 normal minutes standard / 90 standard seconds Zoom)
  let tickSaveCounter = 0;
  let dayCheckCounter = 0;
  setInterval(() => {
    dayCheckCounter += 1;
    if (dayCheckCounter % 40 === 0) {
      if (ensureDailyMatchesScheduled()) {
        broadcast('state:matches', store.matches);
        broadcast('state:tipster', store.tipsterBetcodes);
      }
    }

    const now = Date.now();
    let matchesChanged = false;
    const newlyRecordedH2H: H2HRecord[] = [];
    let currentLiveDailyCount = store.matches.filter(
      m => !m.isZoom && m.isSystemDaily && m.dayBucket === 'TODAY' && m.status === 'LIVE'
    ).length;

    store.matches = store.matches.map(match => {
      const updated: VirtualMatch = {
        ...match,
        odds: {
          ...match.odds,
          correctScores: [...(match.odds.correctScores || [])],
          overUnderLines: [...(match.odds.overUnderLines || [])],
        },
        stats: { ...match.stats },
        events: [...match.events],
        oddsDirection: {}
      };
      const isZoomMatch = Boolean(updated.isZoom);
      const duration = updated.durationMinutes || MATCH_DURATION_MINUTES;

      if (updated.status === 'UPCOMING') {
        const computedRemaining = updated.kickoffAt
          ? Math.max(0, Math.ceil((updated.kickoffAt - now) / 1000))
          : Math.max(0, updated.startsInSeconds - 1);

        if (computedRemaining !== updated.startsInSeconds) {
          updated.startsInSeconds = computedRemaining;
          if (isZoomMatch && updated.kickoffAt) {
            updated.scheduledTime = formatZoomTimeLabel(updated.kickoffAt);
          } else if (!isZoomMatch && updated.kickoffAt) {
            updated.scheduledTime = formatScheduledTimeLabel(updated.kickoffAt, updated.dayBucket || 'TODAY');
          }
          matchesChanged = true;
        }

        const canStartNow = computedRemaining <= 0;
        const allowedLive = isZoomMatch || !updated.isSystemDaily || currentLiveDailyCount < MAX_LIVE_DAILY_MATCHES;

        if (canStartNow && allowedLive) {
          if (!isZoomMatch && updated.isSystemDaily) {
            currentLiveDailyCount += 1;
          }
          updated.status = 'LIVE';
          updated.kickoffAt = now;
          updated.minute = 1;
          updated.elapsedSeconds = isZoomMatch ? 1 : undefined;
          updated.startsInSeconds = 0;
          updated.scheduledTime = 'Live Now';
          updated.events = [
            {
              minute: 1,
              text: isZoomMatch ? "Kickoff! 90s Zoom simulation is LIVE." : "Kickoff! 60' standard match is now LIVE.",
              type: 'whistle'
            },
            ...updated.events.slice(0, 9)
          ];
          matchesChanged = true;
        }
      }

      if (updated.status === 'LIVE') {
        if (isZoomMatch) {
          const zoomDuration = updated.durationSeconds || ZOOM_DURATION_SECONDS;
          const kickoffMs = updated.kickoffAt || now - Math.max(0, (updated.elapsedSeconds || 1) - 1) * 1000;
          updated.kickoffAt = kickoffMs;
          const elapsedSec = Math.min(zoomDuration, Math.max(1, Math.floor((now - kickoffMs) / 1000) + 1));
          const mappedMinute = Math.min(60, Math.max(1, Math.ceil((elapsedSec / zoomDuration) * 60)));

          if (elapsedSec !== updated.elapsedSeconds || mappedMinute !== updated.minute) {
            updated.elapsedSeconds = elapsedSec;
            updated.minute = mappedMinute;
            matchesChanged = true;
          }

          if (Math.random() < 0.35) {
            matchesChanged = true;
            const isHome = Math.random() < (updated.stats.possessionHome / 100);
            if (isHome) {
              updated.stats.dangerousAttacksHome += 1;
            } else {
              updated.stats.dangerousAttacksAway += 1;
            }
          }

          if (Math.random() < 0.24) {
            matchesChanged = true;
            const homeAdvantage = updated.stats.possessionHome / 100;
            const isHomeGoal = Math.random() < homeAdvantage;
            if (!updated.firstGoalTeam) {
              updated.firstGoalTeam = isHomeGoal ? 'home' : 'away';
            }
            if (updated.minute <= 5) {
              updated.hadFiveMinGoal = true;
            }

            if (isHomeGoal) {
              updated.homeScore += 1;
              if (updated.minute <= 30) {
                updated.firstHalfHomeScore = (updated.firstHalfHomeScore || 0) + 1;
              }
              updated.stats.shotsOnTargetHome += 1;
              updated.events = [
                {
                  minute: elapsedSec,
                  text: `GOAL (${elapsedSec}s)! ${updated.homeTeam} scores! (${updated.homeScore} - ${updated.awayScore})`,
                  type: 'goal',
                  team: 'home'
                },
                ...updated.events.slice(0, 10)
              ];
            } else {
              updated.awayScore += 1;
              if (updated.minute <= 30) {
                updated.firstHalfAwayScore = (updated.firstHalfAwayScore || 0) + 1;
              }
              updated.stats.shotsOnTargetAway += 1;
              updated.events = [
                {
                  minute: elapsedSec,
                  text: `GOAL (${elapsedSec}s)! ${updated.awayTeam} scores! (${updated.homeScore} - ${updated.awayScore})`,
                  type: 'goal',
                  team: 'away'
                },
                ...updated.events.slice(0, 10)
              ];
            }
            recalculateOddsOnGoal(updated);
          } else if (Math.random() < 0.22) {
            matchesChanged = true;
            microFluctuateOdds(updated);
          }

          if (now - kickoffMs >= zoomDuration * 1000) {
            const { resetMatch, record } = recordMatchResultToH2HAndReset(updated, now);
            newlyRecordedH2H.push(record);
            matchesChanged = true;
            return resetMatch;
          }
        } else {
          const kickoffMs = updated.kickoffAt || now - Math.max(0, updated.minute - 1) * 60000;
          updated.kickoffAt = kickoffMs;
          const elapsedNormalMinutes = Math.floor((now - kickoffMs) / 60000) + 1;
          const nextMinute = Math.min(duration, Math.max(1, elapsedNormalMinutes));

          if (nextMinute !== updated.minute) {
            updated.minute = nextMinute;
            matchesChanged = true;
          }

          if (Math.random() < 0.25) {
            matchesChanged = true;
            const isHome = Math.random() < (updated.stats.possessionHome / 100);
            if (isHome) {
              updated.stats.dangerousAttacksHome += 1;
            } else {
              updated.stats.dangerousAttacksAway += 1;
            }
          }

          // High-scoring virtual cadence (~0.34 goals/min across 60 normal minutes => ~20 goals total)
          const goalRand = Math.random();
          if (goalRand < 0.0088) {
            matchesChanged = true;
            const homeAdvantage = updated.stats.possessionHome / 100;
            const isHomeGoal = Math.random() < homeAdvantage;
            if (!updated.firstGoalTeam) {
              updated.firstGoalTeam = isHomeGoal ? 'home' : 'away';
            }
            if (updated.minute <= 5) {
              updated.hadFiveMinGoal = true;
            }

            if (isHomeGoal) {
              updated.homeScore += 1;
              if (updated.minute <= 30) {
                updated.firstHalfHomeScore = (updated.firstHalfHomeScore || 0) + 1;
              }
              updated.stats.shotsOnTargetHome += 1;
              const event: MatchEvent = {
                minute: updated.minute,
                text: `GOAL! ${updated.homeTeam} scores! (${updated.homeScore} - ${updated.awayScore})`,
                type: 'goal',
                team: 'home'
              };
              updated.events = [event, ...updated.events.slice(0, 10)];
              broadcast('event:goal', { match: updated, text: `${updated.homeTeam} ⚽ GOAL!` });
            } else {
              updated.awayScore += 1;
              if (updated.minute <= 30) {
                updated.firstHalfAwayScore = (updated.firstHalfAwayScore || 0) + 1;
              }
              updated.stats.shotsOnTargetAway += 1;
              const event: MatchEvent = {
                minute: updated.minute,
                text: `GOAL! ${updated.awayTeam} finishes clinically! (${updated.homeScore} - ${updated.awayScore})`,
                type: 'goal',
                team: 'away'
              };
              updated.events = [event, ...updated.events.slice(0, 10)];
              broadcast('event:goal', { match: updated, text: `${updated.awayTeam} ⚽ GOAL!` });
            }
            recalculateOddsOnGoal(updated);
          } else if (Math.random() < 0.18) {
            matchesChanged = true;
            microFluctuateOdds(updated);
          }

          if (now - kickoffMs >= duration * 60000) {
            const { resetMatch, record } = recordMatchResultToH2HAndReset(updated, now);
            newlyRecordedH2H.push(record);
            matchesChanged = true;
            return resetMatch;
          }
        }
      }

      return updated;
    });

    if (newlyRecordedH2H.length > 0) {
      store.h2hRecords = [...store.h2hRecords, ...newlyRecordedH2H].slice(-600);
      broadcast('state:h2h', store.h2hRecords);
      saveStore(store);
    }

    store.fxAssets = tickFxAssets(store.fxAssets, now);
    broadcast('state:fx', store.fxAssets);

    if (matchesChanged) {
      broadcast('state:matches', store.matches);
      tickSaveCounter += 1;
      if (tickSaveCounter % 6 === 0) {
        saveStore(store);
      }
    }

    if (Math.random() < 0.45) {
      const virtualUsers = [
        { name: 'Kalu_Express', avatar: '⚡' },
        { name: 'Chinedu99', avatar: '🦁' },
        { name: 'Tariq_Pro', avatar: '🎯' },
        { name: 'BetWizard', avatar: '🧙' },
        { name: 'Elena_V', avatar: '💎' },
        { name: 'Sven_Goal', avatar: '⚽' },
        { name: 'AlphaBet_7', avatar: '🚀' },
        { name: 'BurnaBettor', avatar: '🔥' },
      ];
      const gamesAndMarkets = [
        { name: 'Flight (Aviator)', multRange: [1.2, 28.5] },
        { name: 'Shoot (Penalties)', multRange: [1.9, 8.5] },
        { name: '777 Strike Slot', multRange: [2.5, 45.0] },
        { name: 'Plinko (Peg Drop)', multRange: [1.5, 32.0] },
        { name: 'Spain Copa Virtual', multRange: [1.1, 4.5] },
        { name: 'Premier Virtual 1X2', multRange: [1.4, 3.8] },
        { name: 'Spin & Win +', multRange: [2.0, 20.0] },
      ];
      const user = virtualUsers[Math.floor(Math.random() * virtualUsers.length)];
      const target = gamesAndMarkets[Math.floor(Math.random() * gamesAndMarkets.length)];
      const isWin = Math.random() < 0.68;
      const betAmount = [10, 25, 50, 100, 250, 500][Math.floor(Math.random() * 6)];
      const mult = Number((Math.random() * (target.multRange[1] - target.multRange[0]) + target.multRange[0]).toFixed(2));
      const payout = isWin ? Math.round(betAmount * mult * 100) / 100 : 0;

      const newTicker: LiveBetTickerItem = {
        id: `tick-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        username: user.name,
        avatar: user.avatar,
        gameOrMatch: target.name,
        betAmount,
        multiplier: mult,
        payout,
        timestamp: Date.now(),
        isWin
      };
      store.ticker = [newTicker, ...store.ticker.slice(0, 19)];
      broadcast('state:ticker', store.ticker);

      if (isWin && Math.random() < 0.3 && store.leaderboard.length > 1) {
        const nonUserEntries = store.leaderboard.filter(e => !e.isUser);
        if (nonUserEntries.length > 0) {
          const picked = nonUserEntries[Math.floor(Math.random() * nonUserEntries.length)];
          picked.totalProfit += payout - betAmount;
          picked.recentWin = {
            game: target.name,
            amount: payout,
            multiplier: mult,
            timeAgo: 'Just now'
          };
          store.leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
          store.leaderboard.forEach((entry, idx) => { entry.rank = idx + 1; });
          broadcast('state:leaderboard', store.leaderboard);
        }
      }
    }
  }, 1500);

  // REST API Routes
  app.get('/api/version', (_req, res) => {
    res.json({ version: stateVersion, versions: sliceVersions });
  });

  app.get('/api/state', (_req, res) => {
    res.json({
      version: stateVersion,
      versions: sliceVersions,
      matches: store.matches,
      tipsterBetcodes: store.tipsterBetcodes,
      h2hRecords: store.h2hRecords,
      fxAssets: store.fxAssets,
      clubs: store.clubs,
      leagues: store.leagues,
      leaderboard: store.leaderboard,
      ticker: store.ticker,
    });
  });

  app.get('/api/auth/verify', (req, res) => {
    return res.json({ valid: isValidAdminRequest(req) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (email === ADMIN_EMAIL) {
      if (password === ADMIN_PASS) {
        return res.json({
          ok: true,
          isAdmin: true,
          adminToken: createAdminToken(store.adminSecret)
        });
      }
      return res.status(401).json({ ok: false, error: 'Invalid password for admin@cas9i.com.' });
    }

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Please enter both email and password.' });
    }

    return res.json({ ok: true, isAdmin: false });
  });

  // Admin: Create Permanent Club
  app.post('/api/admin/clubs', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const { name, shortName, country, league, crest, attack, defense } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Club name is required.' });
    }
    const cleanName = String(name).trim();
    const cleanLeague = String(league || 'Virtual League').trim();
    const cleanCountry = String(country || 'International').trim();
    const cleanShort = String(shortName || cleanName.slice(0, 3)).trim().toUpperCase().slice(0, 4);

    const newClub: Club = {
      id: `club-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      shortName: cleanShort,
      country: cleanCountry,
      league: cleanLeague,
      crest: String(crest || '🛡️'),
      attack: Math.max(50, Math.min(99, Number(attack) || 78)),
      defense: Math.max(50, Math.min(99, Number(defense) || 76)),
    };

    const leagueCountBefore = store.leagues.length;
    ensureLeagueExists(cleanLeague, cleanCountry);

    store.clubs = [newClub, ...store.clubs];
    saveStore(store);

    broadcast('state:clubs', store.clubs);
    if (store.leagues.length !== leagueCountBefore) {
      broadcast('state:leagues', store.leagues);
    }

    return res.json({ club: newClub, clubs: store.clubs, leagues: store.leagues, versions: sliceVersions });
  });

  // Admin: Write Multiple Permanent Clubs at Once
  app.post('/api/admin/clubs/bulk', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const entries = Array.isArray(req.body?.clubs) ? req.body.clubs : [];
    const defaultLeague = String(req.body?.defaultLeague || store.leagues[0]?.name || 'Virtual League').trim();
    const defaultCountry = String(req.body?.defaultCountry || 'International').trim();
    if (entries.length === 0) {
      return res.status(400).json({ error: 'Please write at least one club name.' });
    }

    const usedNames = new Set(store.clubs.map(c => c.name.toLowerCase()));
    const usedCodes = new Set(store.clubs.map(c => c.shortName.toUpperCase()));
    const leagueCountBefore = store.leagues.length;
    const createdClubs: Club[] = [];
    const crests = ['🛡️', '⚽', '🔴', '🔵', '🟢', '🟡', '👑', '⚡', '🦁', '🦅'];

    for (const raw of entries) {
      const cleanName = String(raw?.name || '').trim();
      if (!cleanName || usedNames.has(cleanName.toLowerCase())) continue;
      usedNames.add(cleanName.toLowerCase());

      const cleanLeague = String(raw?.league || defaultLeague).trim() || defaultLeague;
      const matchedLeague = store.leagues.find(l => l.name.toLowerCase() === cleanLeague.toLowerCase());
      const cleanCountry = String(raw?.country || matchedLeague?.country || defaultCountry).trim() || 'International';
      ensureLeagueExists(cleanLeague, cleanCountry);

      const baseCode = String(raw?.shortName || cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || 'CLB')
        .trim()
        .toUpperCase()
        .slice(0, 4);
      let code = baseCode || 'CLB';
      let suffix = 1;
      while (usedCodes.has(code)) {
        code = `${baseCode.slice(0, 3)}${suffix}`.slice(0, 4).toUpperCase();
        suffix += 1;
      }
      usedCodes.add(code);

      createdClubs.push({
        id: `club-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${createdClubs.length}`,
        name: cleanName,
        shortName: code,
        country: cleanCountry,
        league: cleanLeague,
        crest: String(raw?.crest || crests[createdClubs.length % crests.length]),
        attack: Math.max(50, Math.min(99, Number(raw?.attack) || 78)),
        defense: Math.max(50, Math.min(99, Number(raw?.defense) || 76)),
      });
    }

    if (createdClubs.length === 0) {
      return res.status(400).json({ error: 'No new unique club names were found to save.' });
    }

    store.clubs = [...createdClubs, ...store.clubs];
    saveStore(store);
    broadcast('state:clubs', store.clubs);
    if (store.leagues.length !== leagueCountBefore) {
      broadcast('state:leagues', store.leagues);
    }

    return res.json({ createdClubs, clubs: store.clubs, leagues: store.leagues, versions: sliceVersions });
  });

  // Admin: Reset all clubs to 0 (leaves leagues and matches intact)
  app.post('/api/admin/clubs/reset-zero', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    store.clubs = [];
    saveStore(store);
    broadcast('state:clubs', store.clubs);
    return res.json({ clubs: store.clubs, versions: sliceVersions });
  });

  // Admin: Reset clubs to 0 and generate 125 real-world clubs matched to their leagues
  app.post('/api/admin/clubs/generate-125', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    store.clubs = [];
    store.clubs = buildExact125RealClubs(store.leagues);
    saveStore(store);
    broadcast('state:clubs', store.clubs);
    return res.json({ count: store.clubs.length, clubs: store.clubs, versions: sliceVersions });
  });

  // Admin: Auto-generate 5 permanent real-world clubs (Red + button)
  app.post('/api/admin/clubs/auto-generate', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    if (store.leagues.length === 0) {
      ensureLeagueExists('England - Premier League Virtual', 'England');
    }

    const usedNames = new Set(store.clubs.map(c => c.name.toLowerCase()));
    const usedCodes = new Set(store.clubs.map(c => c.shortName.toUpperCase()));
    const createdClubs: Club[] = [];
    const offset = Math.floor(Math.random() * store.leagues.length);

    for (let i = 0; i < 5; i += 1) {
      const targetLeague = store.leagues[(offset + i) % store.leagues.length];
      const club = pickRealClubForLeague(targetLeague, usedNames, usedCodes, true);
      if (!club) break;
      createdClubs.push(club);
    }

    if (createdClubs.length === 0) {
      return res.status(400).json({ error: 'All real-world clubs in the catalog have already been deployed.' });
    }

    store.clubs = [...createdClubs, ...store.clubs];
    saveStore(store);
    broadcast('state:clubs', store.clubs);

    return res.json({ createdClubs, clubs: store.clubs, versions: sliceVersions });
  });

  // Admin: Auto-deploy 3 different real-world clubs to each active league (Blue + button)
  app.post('/api/admin/clubs/deploy-per-league', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    if (store.leagues.length === 0) {
      return res.status(400).json({ error: 'No active leagues available.' });
    }

    const usedNames = new Set(store.clubs.map(c => c.name.toLowerCase()));
    const usedCodes = new Set(store.clubs.map(c => c.shortName.toUpperCase()));
    const createdClubs: Club[] = [];

    for (const league of store.leagues) {
      for (let i = 0; i < 3; i += 1) {
        const club = pickRealClubForLeague(league, usedNames, usedCodes, true);
        if (!club) break;
        createdClubs.push(club);
      }
    }

    if (createdClubs.length === 0) {
      return res.status(400).json({ error: 'All real-world clubs in the catalog have already been deployed.' });
    }

    store.clubs = [...createdClubs, ...store.clubs];
    saveStore(store);
    broadcast('state:clubs', store.clubs);

    return res.json({
      createdClubs,
      leagueCount: store.leagues.length,
      clubs: store.clubs,
      versions: sliceVersions
    });
  });

  // Admin: Permanently Delete Club (cannot be undone)
  app.delete('/api/admin/clubs/:id', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const clubId = req.params.id;
    const before = store.clubs.length;
    store.clubs = store.clubs.filter(c => c.id !== clubId);

    if (store.clubs.length !== before) {
      saveStore(store);
      broadcast('state:clubs', store.clubs);
    }

    return res.json({ clubs: store.clubs, versions: sliceVersions });
  });

  // Admin: Create Permanent Custom League
  app.post('/api/admin/leagues', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const name = String(req.body?.name || '').trim();
    const country = String(req.body?.country || 'International').trim();
    const icon = String(req.body?.icon || '🏆').trim();

    if (!name) {
      return res.status(400).json({ error: 'League name is required.' });
    }

    const duplicate = store.leagues.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return res.status(409).json({ error: `League "${duplicate.name}" already exists.` });
    }

    const newLeague: League = {
      id: `league-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      country,
      icon,
      isCustom: true,
      createdAt: Date.now()
    };

    store.leagues = [newLeague, ...store.leagues];
    saveStore(store);
    broadcast('state:leagues', store.leagues);

    return res.json({ league: newLeague, leagues: store.leagues, versions: sliceVersions });
  });

  // Admin: Fix Match Between Clubs (broadcasts immediately to all users and devices)
  app.post('/api/admin/matches/fix', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const { homeClubId, awayClubId, league, status, startsInSeconds, homeOdds, drawOdds, awayOdds, isFeatured } = req.body || {};
    const homeClub = store.clubs.find(c => c.id === homeClubId);
    const awayClub = store.clubs.find(c => c.id === awayClubId);

    if (!homeClub || !awayClub) {
      return res.status(400).json({ error: 'Please select valid Home and Away clubs.' });
    }
    if (homeClub.id === awayClub.id) {
      return res.status(400).json({ error: 'Home Club and Away Club must be different.' });
    }

    const cleanLeague = String(league || homeClub.league).trim() || homeClub.league;
    const leagueCountBefore = store.leagues.length;
    ensureLeagueExists(cleanLeague, homeClub.country);

    const totalPower = homeClub.attack + homeClub.defense + awayClub.attack + awayClub.defense;
    const homePoss = Math.max(25, Math.min(75, Math.round(((homeClub.attack + homeClub.defense) / totalPower) * 100)));
    const awayPoss = 100 - homePoss;

    if (isFeatured) {
      store.matches = store.matches.map(m => ({ ...m, isFeatured: false }));
    }

    const startSec = Math.max(10, Number(startsInSeconds) || 180);
    const hOdds = Math.max(1.02, Number(Number(homeOdds || 2.10).toFixed(2)));
    const dOdds = Math.max(1.05, Number(Number(drawOdds || 3.20).toFixed(2)));
    const aOdds = Math.max(1.02, Number(Number(awayOdds || 3.40).toFixed(2)));
    const matchStatus: 'LIVE' | 'UPCOMING' = status === 'LIVE' ? 'LIVE' : 'UPCOMING';
    const now = Date.now();
    const kickoffAt = matchStatus === 'LIVE' ? now : now + startSec * 1000;

    const newMatch: VirtualMatch = {
      id: `match-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      league: cleanLeague,
      country: homeClub.country,
      homeTeam: homeClub.name,
      awayTeam: awayClub.name,
      homeScore: 0,
      awayScore: 0,
      firstHalfHomeScore: 0,
      firstHalfAwayScore: 0,
      minute: matchStatus === 'LIVE' ? 1 : 0,
      durationMinutes: MATCH_DURATION_MINUTES,
      status: matchStatus,
      scheduledTime: matchStatus === 'LIVE' ? 'Live Now' : `Starts in ${Math.max(1, Math.round(startSec / 60))}m`,
      startsInSeconds: matchStatus === 'LIVE' ? 0 : startSec,
      kickoffAt,
      dayBucket: 'TODAY',
      matchDate: getDayKey(0),
      isSystemDaily: false,
      isFeatured: Boolean(isFeatured),
      odds: buildHighGoalOdds(homeClub.attack, homeClub.defense, awayClub.attack, awayClub.defense, {
        home: hOdds,
        draw: dOdds,
        away: aOdds,
      }),
      oddsDirection: {},
      stats: {
        possessionHome: homePoss,
        possessionAway: awayPoss,
        dangerousAttacksHome: matchStatus === 'LIVE' ? 3 : 0,
        dangerousAttacksAway: matchStatus === 'LIVE' ? 3 : 0,
        shotsOnTargetHome: 0,
        shotsOnTargetAway: 0,
        cornersHome: 0,
        cornersAway: 0,
      },
      events: [
        { minute: matchStatus === 'LIVE' ? 1 : 0, text: `Admin fixed fixture (60' std): ${homeClub.name} vs ${awayClub.name}.`, type: 'whistle' }
      ]
    };

    store.matches = [newMatch, ...store.matches];
    saveStore(store);

    broadcast('state:matches', store.matches);
    if (store.leagues.length !== leagueCountBefore) {
      broadcast('state:leagues', store.leagues);
    }

    return res.json({ match: newMatch, matches: store.matches, leagues: store.leagues, versions: sliceVersions });
  });

  // Admin: Fix Preset Fixtures
  app.post('/api/admin/matches/preset', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const type = req.body?.type as 'featured' | 'copa_and_euro' | 'all';
    const now = Date.now();
    const upsertMatch = (preset: VirtualMatch) => {
      const clone: VirtualMatch = JSON.parse(JSON.stringify(preset));
      clone.kickoffAt = clone.status === 'LIVE' ? now - clone.minute * 60000 : now + clone.startsInSeconds * 1000;
      clone.matchDate = getDayKey(0);
      clone.dayBucket = 'TODAY';
      clone.durationMinutes = MATCH_DURATION_MINUTES;
      ensureLeagueExists(clone.league, clone.country);
      const idx = store.matches.findIndex(m => m.id === clone.id);
      if (idx !== -1) {
        store.matches[idx] = clone;
      } else {
        store.matches = [clone, ...store.matches];
      }
    };

    const leagueCountBefore = store.leagues.length;
    if (type === 'featured') {
      const featured = PRESET_FIXTURES.find(m => m.isFeatured);
      if (featured) upsertMatch(featured);
    } else if (type === 'copa_and_euro') {
      PRESET_FIXTURES.slice(0, 2).forEach(upsertMatch);
    } else {
      PRESET_FIXTURES.forEach(upsertMatch);
    }

    saveStore(store);
    broadcast('state:matches', store.matches);
    if (store.leagues.length !== leagueCountBefore) {
      broadcast('state:leagues', store.leagues);
    }

    return res.json({ matches: store.matches, leagues: store.leagues, versions: sliceVersions });
  });

  // Admin: Kickoff Match Now
  app.post('/api/admin/matches/:id/kickoff', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const matchId = req.params.id;
    const now = Date.now();
    store.matches = store.matches.map(m => {
      if (m.id !== matchId) return m;
      return {
        ...m,
        status: 'LIVE',
        startsInSeconds: 0,
        kickoffAt: now,
        minute: Math.max(1, m.minute),
        durationMinutes: MATCH_DURATION_MINUTES,
        scheduledTime: 'Live Now',
        events: [
          { minute: 1, text: `Admin triggered kickoff: ${m.homeTeam} vs ${m.awayTeam} is now LIVE!`, type: 'whistle' },
          ...m.events
        ]
      };
    });
    saveStore(store);
    broadcast('state:matches', store.matches);
    return res.json({ matches: store.matches, versions: sliceVersions });
  });

  // Admin: Trigger Goal
  app.post('/api/admin/matches/:id/goal', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const matchId = req.params.id;
    const team = req.body?.team === 'away' ? 'away' : 'home';

    store.matches = store.matches.map(m => {
      if (m.id !== matchId || m.status !== 'LIVE') return m;
      const updated: VirtualMatch = {
        ...m,
        odds: {
          ...m.odds,
          correctScores: [...(m.odds.correctScores || [])],
          overUnderLines: [...(m.odds.overUnderLines || [])],
        },
        stats: { ...m.stats },
        events: [...m.events],
        oddsDirection: {}
      };
      const scorerTeam = team === 'home' ? updated.homeTeam : updated.awayTeam;
      if (!updated.firstGoalTeam) {
        updated.firstGoalTeam = team;
      }
      if (updated.minute <= 5) {
        updated.hadFiveMinGoal = true;
      }
      if (team === 'home') {
        updated.homeScore += 1;
        if (updated.minute <= 30) {
          updated.firstHalfHomeScore = (updated.firstHalfHomeScore || 0) + 1;
        }
        updated.stats.shotsOnTargetHome += 1;
      } else {
        updated.awayScore += 1;
        if (updated.minute <= 30) {
          updated.firstHalfAwayScore = (updated.firstHalfAwayScore || 0) + 1;
        }
        updated.stats.shotsOnTargetAway += 1;
      }
      const event: MatchEvent = {
        minute: updated.minute,
        text: `GOAL! ${scorerTeam} finds the net!`,
        type: 'goal',
        team
      };
      updated.events = [event, ...updated.events.slice(0, 10)];
      recalculateOddsOnGoal(updated);
      broadcast('event:goal', { match: updated, text: `${scorerTeam} ⚽ GOAL!` });
      return updated;
    });

    saveStore(store);
    broadcast('state:matches', store.matches);
    return res.json({ matches: store.matches, versions: sliceVersions });
  });

  // Admin: Remove Single Match
  app.delete('/api/admin/matches/:id', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    const matchId = req.params.id;
    const timer = matchResetTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      matchResetTimers.delete(matchId);
    }
    store.matches = store.matches.filter(m => m.id !== matchId);
    saveStore(store);
    broadcast('state:matches', store.matches);
    return res.json({ matches: store.matches, versions: sliceVersions });
  });

  // Admin: Reset & Re-fix Daily Schedule (never deletes clubs or leagues!)
  app.post('/api/admin/matches/reset', (req, res) => {
    if (!isValidAdminRequest(req)) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    matchResetTimers.forEach(t => clearTimeout(t));
    matchResetTimers.clear();
    store.matches = [];
    store.tipsterBetcodes = [];
    ensureDailyMatchesScheduled();
    saveStore(store);
    broadcast('state:matches', store.matches);
    broadcast('state:tipster', store.tipsterBetcodes);
    return res.json({ matches: store.matches, tipsterBetcodes: store.tipsterBetcodes, versions: sliceVersions });
  });

  // User Win Ticker Update
  app.post('/api/ticker/win', (req, res) => {
    const username = String(req.body?.username || 'Player').trim() || 'Player';
    const amount = Number(req.body?.amount) || 0;
    const multiplier = Math.max(1, Number(req.body?.multiplier) || 1);
    const game = String(req.body?.game || 'Casino').trim();

    if (amount <= 0) {
      return res.status(400).json({ error: 'Invalid payout amount' });
    }

    const newTickerItem: LiveBetTickerItem = {
      id: `tick-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username,
      avatar: '🌟',
      gameOrMatch: game,
      betAmount: Math.round(amount / multiplier),
      multiplier: Number(multiplier.toFixed(2)),
      payout: Math.round(amount * 100) / 100,
      timestamp: Date.now(),
      isWin: true
    };

    store.ticker = [newTickerItem, ...store.ticker.slice(0, 19)];

    const userEntry = store.leaderboard.find(e => e.isUser);
    if (userEntry) {
      userEntry.totalProfit += amount;
      userEntry.recentWin = {
        game,
        amount,
        multiplier: Number(multiplier.toFixed(2)),
        timeAgo: 'Just now'
      };
      store.leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
      store.leaderboard.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });
    }

    saveStore(store);
    broadcast('state:ticker', store.ticker);
    broadcast('state:leaderboard', store.leaderboard);
    return res.json({ ticker: store.ticker, leaderboard: store.leaderboard, versions: sliceVersions });
  });

  // Vite middleware in development, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CAS9i full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
