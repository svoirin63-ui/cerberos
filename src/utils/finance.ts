import {
  DAY_NAMES,
  DEFAULT_CATALOG_GROUPS,
  DISTINCTION_DEFS,
  INVENTORY_ITEMS,
  RANK_LEVELS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  CatalogItem,
  CatalogItemCategory,
  CurrentWeekPayrollState,
  DistinctionKey,
  GearKey,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MemberRankingsMap,
  Mission,
  MissionFinance,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  PayrollBasis,
  PayrollMemberRow,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
  WeeklyArchiveDayRow,
  WeeklyArchiveMissionRow,
  WeeklyArchiveRecord,
} from '@/src/types/cartel';
import { getEffectiveSchedule } from '@/src/utils/schedule';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIso(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function currentWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function isWeekStale(missionStates: MissionStates): boolean {
  const w = missionStates.__week;
  return !!w && w !== isoDate(currentWeekStart());
}

export function displayWeekStart(missionStates: MissionStates): Date {
  const w = missionStates.__week;
  return w && isWeekStale(missionStates) ? parseIso(w) : currentWeekStart();
}

export function dayDate(dayName: string, missionStates: MissionStates): Date {
  const base = displayWeekStart(missionStates);
  const d = new Date(base);
  const idx = DAY_NAMES.indexOf(dayName);
  d.setDate(base.getDate() + (idx >= 0 ? idx : 0));
  return d;
}

export function fmtShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function fmtLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function isTodayName(dayName: string, missionStates: MissionStates): boolean {
  return !isWeekStale(missionStates) && isoDate(dayDate(dayName, missionStates)) === isoDate(new Date());
}

export function weekRangeText(missionStates: MissionStates): string {
  const start = displayWeekStart(missionStates);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `du ${fmtLong(start)} au ${fmtLong(end)} ${end.getFullYear()}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' $';
}

export function formatSigned(v: number): string {
  return (v > 0 ? '+' : v < 0 ? '-' : '') + formatMoney(Math.abs(v));
}

export function netClass(v: number): string {
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-crimson-light' : 'text-zinc-400';
}

export function getMissionEntry(
  missionStates: MissionStates,
  id: string
): MissionStateEntry {
  const raw = missionStates[id];
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return {};
}

export function getStatus(st?: MissionStateEntry): MissionStatus {
  if (!st) return '';
  if (st.status) return st.status;
  return st.completed ? 'success' : '';
}

export function getCatalogStockKey(itemId: string): string {
  const safe = itemId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28);
  return `cat_${safe || 'item'}`;
}

export interface CatalogExtraInventoryItem {
  key: string;
  itemId: string;
  groupId: string;
  groupName: string;
  name: string;
  price: number;
  category: CatalogItemCategory;
}

export function getCatalogExtraInventoryItems(
  catalogGroups?: CatalogGroupsMap
): CatalogExtraInventoryItem[] {
  if (!catalogGroups) return [];
  const seenKeys = new Set<string>();
  const result: CatalogExtraInventoryItem[] = [];
  Object.values(catalogGroups)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'))
    .forEach((group) => {
      group.items.forEach((item) => {
        if (item.tradeType !== 'sell') return;
        if (item.linkedGearKey) return;
        if (item.category === 'reparation' || item.category === 'butin') return;
        const key = getCatalogStockKey(item.id);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        result.push({
          key,
          itemId: item.id,
          groupId: group.id,
          groupName: group.name,
          name: item.name,
          price: Math.max(0, Math.round(Number(item.price) || 0)),
          category: item.category,
        });
      });
    });
  return result;
}

export const REWARD_KEY_TO_CATALOG_BUYBACK_ID: Record<string, string> = {
  boite_bijoux: 'br_bijoux',
  peinture_volee: 'br_peinture',
  lingot_or: 'br_lingot',
  carte_graphique: 'br_gpu',
  processeur: 'br_cpu',
  montre_or: 'br_montre',
  collier_or: 'br_collier',
  vetement_luxe: 'br_vetement',
  lunette_luxe: 'br_lunette',
  whiskey_luxe: 'em_whiskey',
};

export const CATALOG_BUYBACK_ID_TO_REWARD_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(REWARD_KEY_TO_CATALOG_BUYBACK_ID).map(([rewardKey, catId]) => [catId, rewardKey])
);

export function resolveCatalogSellItemPrice(
  item: CatalogItem,
  inventoryPrices?: InventoryPrices
): number {
  const fallback = Math.max(0, Math.round(Number(item.price) || 0));
  if (item.tradeType !== 'sell') return fallback;
  let stockKey: string | null = null;
  if (item.linkedGearKey && INVENTORY_ITEMS.some((inv) => inv.key === item.linkedGearKey)) {
    stockKey = item.linkedGearKey;
  } else if (item.category !== 'reparation' && item.category !== 'butin') {
    stockKey = getCatalogStockKey(item.id);
  }
  if (stockKey && inventoryPrices && inventoryPrices[stockKey] !== undefined) {
    return Math.max(0, Math.round(Number(inventoryPrices[stockKey]) || 0));
  }
  return fallback;
}

export function getCatalogFallbackPriceByStockKey(
  key: string,
  catalogGroups?: CatalogGroupsMap
): number | undefined {
  const checkGroups = (groups?: CatalogGroupsMap): number | undefined => {
    if (!groups) return undefined;
    for (const group of Object.values(groups)) {
      for (const item of group.items) {
        if (item.tradeType !== 'sell') continue;
        if (item.linkedGearKey === key) {
          return Math.max(0, Math.round(Number(item.price) || 0));
        }
        if (!item.linkedGearKey && getCatalogStockKey(item.id) === key) {
          return Math.max(0, Math.round(Number(item.price) || 0));
        }
      }
    }
    return undefined;
  };

  const fromCustom = checkGroups(catalogGroups);
  if (fromCustom !== undefined) return fromCustom;
  return checkGroups(DEFAULT_CATALOG_GROUPS);
}

export function getInventoryItemPrice(
  key: string,
  inventoryPrices?: InventoryPrices,
  fallbackPrice?: number,
  catalogGroups?: CatalogGroupsMap
): number {
  if (inventoryPrices && inventoryPrices[key] !== undefined) {
    return Math.max(0, Number(inventoryPrices[key]) || 0);
  }
  const found = INVENTORY_ITEMS.find((i) => i.key === key);
  if (found) return found.price;
  if (fallbackPrice !== undefined) {
    return Math.max(0, Number(fallbackPrice) || 0);
  }
  const catFallback = getCatalogFallbackPriceByStockKey(key, catalogGroups);
  return catFallback !== undefined ? catFallback : 0;
}

export function calcUsedGearCost(
  usedGear: Record<string, number> | undefined,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): { cost: number; hasItems: boolean } {
  if (!usedGear || typeof usedGear !== 'object') {
    return { cost: 0, hasItems: false };
  }
  let cost = 0;
  let hasItems = false;
  Object.entries(usedGear).forEach(([key, rawQty]) => {
    const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
    if (qty <= 0) return;
    hasItems = true;
    const unitPrice = getInventoryItemPrice(key, inventoryPrices, undefined, catalogGroups);
    cost += qty * unitPrice;
  });
  return { cost, hasItems };
}

export function getMissionCost(
  m: Mission,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): number {
  if (m.gearKey && m.gearKey !== 'none') {
    if (INVENTORY_ITEMS.some((i) => i.key === m.gearKey)) {
      return getInventoryItemPrice(m.gearKey, inventoryPrices, m.cost, catalogGroups);
    }
    if (m.gearKey === 'amu') {
      return getInventoryItemPrice('cat_em_cle_ammunation', inventoryPrices, m.cost, catalogGroups);
    }
  }
  return Math.max(0, Number(m.cost) || 0);
}

export function getMissionGearLabel(
  m: Mission,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): string {
  if (!m.gearKey || m.gearKey === 'none' || m.gearKey === 'fbi' || m.gearKey === 'uni') {
    return m.gearName;
  }
  const liveCost = getMissionCost(m, inventoryPrices, catalogGroups);
  if (m.gearKey === 'drg') {
    return `Clé USB 3.1 (${liveCost > 0 ? formatMoney(liveCost) : 'Prix à définir'})`;
  }
  const baseName = m.gearName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${baseName} (${liveCost > 0 ? formatMoney(liveCost) : 'Prix à définir'})`;
}

export function missionFin(
  m: Mission,
  missionStates: MissionStates,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): MissionFinance {
  const st = getMissionEntry(missionStates, m.id);
  const status = getStatus(st);
  const done = status !== '';
  const success = status === 'success';
  const fail = status === 'fail';
  let cost = 0;
  if (done) {
    const used = calcUsedGearCost(st.usedGear, inventoryPrices, catalogGroups);
    cost = used.hasItems ? used.cost : getMissionCost(m, inventoryPrices, catalogGroups);
  }
  const gain = success ? Number(st.gain) || 0 : 0;
  const extra = done ? Number(st.extra) || 0 : 0;
  return {
    status,
    done,
    success,
    fail,
    cost,
    gain,
    extra,
    net: gain - cost - extra,
  };
}

export function checkStockAvailability(
  gearKey: GearKey,
  inventoryStock: InventoryStock
): { available: boolean; count: number } {
  if (!gearKey || gearKey === 'none') {
    return { available: true, count: 999 };
  }
  const currentStock = inventoryStock[gearKey] || 0;
  return { available: currentStock > 0, count: currentStock };
}

export interface ItemAutonomyInfo {
  key: string;
  coveredDays: number;
  hasMoreThan30: boolean;
  ruptureDayName: string | null;
  neededPerWeek: number;
  todayNeeded: number;
  todayShortage: number;
}

export interface StockAutonomyResult {
  startDay: string;
  minDaysCovered: number;
  allOver30Days: boolean;
  limitingItems: Array<{ key: string; name: string; coveredDays: number; ruptureDayName: string | null }>;
  byKey: Record<string, ItemAutonomyInfo>;
}

export function calcStockAutonomy(params: {
  inventoryStock: InventoryStock;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  startDayName?: string;
  excludeDone?: boolean;
}): StockAutonomyResult {
  const { inventoryStock, missionStates, scheduleMeta, startDayName, excludeDone = true } = params;
  const detectedToday = DAY_NAMES.find((d) => isTodayName(d, missionStates)) || 'Lundi';
  const safeStartDay =
    startDayName && DAY_NAMES.includes(startDayName) ? startDayName : detectedToday;
  const startIdx = Math.max(0, DAY_NAMES.indexOf(safeStartDay));
  const effectiveDays = getEffectiveSchedule(missionStates, scheduleMeta).days;

  // Weekly baseline requirement per gear key
  const weeklyNeeds: Record<string, number> = {};
  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      if (m.gearKey === 'none') return;
      if (!INVENTORY_ITEMS.some((i) => i.key === m.gearKey)) return;
      weeklyNeeds[m.gearKey] = (weeklyNeeds[m.gearKey] || 0) + 1;
    });
  });

  // Remaining mission requirement for a given simulated day offset d (0..34)
  const MAX_SIM_DAYS = 35;
  const byKey: Record<string, ItemAutonomyInfo> = {};

  INVENTORY_ITEMS.forEach((item) => {
    const startStock = Math.max(0, Math.floor(Number(inventoryStock[item.key]) || 0));
    const neededPerWeek = weeklyNeeds[item.key] || 0;

    // First day requirement
    const firstSchedule = effectiveDays[startIdx] || WEEKLY_SCHEDULE[startIdx];
    let todayNeeded = 0;
    if (firstSchedule) {
      firstSchedule.missions.forEach((m) => {
        if (m.gearKey !== item.key) return;
        if (excludeDone && getStatus(getMissionEntry(missionStates, m.id)) !== '') return;
        todayNeeded++;
      });
    }
    const todayShortage = Math.max(0, todayNeeded - startStock);

    if (neededPerWeek === 0) {
      byKey[item.key] = {
        key: item.key,
        coveredDays: 30,
        hasMoreThan30: true,
        ruptureDayName: null,
        neededPerWeek: 0,
        todayNeeded: 0,
        todayShortage: 0,
      };
      return;
    }

    let remaining = startStock;
    let coveredDays = 0;
    let ruptureDayName: string | null = null;

    for (let d = 0; d < MAX_SIM_DAYS; d++) {
      const rawIdx = startIdx + d;
      const dayIdx = rawIdx % 7;
      const isNextCycle = rawIdx >= 7;
      const schedule = isNextCycle
        ? WEEKLY_SCHEDULE[dayIdx]
        : effectiveDays[dayIdx] || WEEKLY_SCHEDULE[dayIdx];
      let dayNeed = 0;
      if (schedule) {
        schedule.missions.forEach((m) => {
          if (m.gearKey !== item.key) return;
          if (!isNextCycle && excludeDone && getStatus(getMissionEntry(missionStates, m.id)) !== '') {
            return;
          }
          dayNeed++;
        });
      }

      if (remaining >= dayNeed) {
        remaining -= dayNeed;
        coveredDays++;
      } else {
        ruptureDayName = schedule?.day || null;
        break;
      }
    }

    const hasMoreThan30 = coveredDays >= 31;
    byKey[item.key] = {
      key: item.key,
      coveredDays: hasMoreThan30 ? 30 : coveredDays,
      hasMoreThan30,
      ruptureDayName: hasMoreThan30 ? null : ruptureDayName,
      neededPerWeek,
      todayNeeded,
      todayShortage,
    };
  });

  const scheduledEntries = INVENTORY_ITEMS.filter(
    (item) => (weeklyNeeds[item.key] || 0) > 0
  ).map((item) => ({
    item,
    info: byKey[item.key],
  }));

  const minDaysCovered =
    scheduledEntries.length > 0
      ? Math.min(...scheduledEntries.map((e) => e.info.coveredDays))
      : 30;
  const allOver30Days =
    scheduledEntries.length > 0 && scheduledEntries.every((e) => e.info.hasMoreThan30);

  const limitingItems = scheduledEntries
    .filter((e) => !allOver30Days && e.info.coveredDays === minDaysCovered)
    .map((e) => ({
      key: e.item.key,
      name: e.item.name,
      coveredDays: e.info.coveredDays,
      ruptureDayName: e.info.ruptureDayName,
    }));

  return {
    startDay: safeStartDay,
    minDaysCovered,
    allOver30Days,
    limitingItems,
    byKey,
  };
}

export function calcInventoryTotalValue(
  inventoryStock: InventoryStock,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): number {
  const staticSum = INVENTORY_ITEMS.reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    const price = getInventoryItemPrice(item.key, inventoryPrices, item.price, catalogGroups);
    return sum + qty * price;
  }, 0);
  const dynamicSum = getCatalogExtraInventoryItems(catalogGroups).reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    const price = getInventoryItemPrice(item.key, inventoryPrices, item.price, catalogGroups);
    return sum + qty * price;
  }, 0);
  return staticSum + dynamicSum;
}

export function calcRewardsTotalValue(rewardStocks: RewardStocks): number {
  return REWARD_ITEMS.reduce((sum, item) => {
    const dat = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
    const qty = Math.max(0, Number(dat.qty) || 0);
    const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : item.defaultVal;
    return sum + qty * val;
  }, 0);
}

export function calcWeaponsTotalValue(weaponsStock: WeaponsStock): number {
  return Object.values(weaponsStock).reduce((sum, w) => {
    if (!w || typeof w !== 'object') return sum;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    return sum + qty * val;
  }, 0);
}

export function getWeaponHolderName(
  holderId: string,
  members: HierarchyMember[]
): string {
  if (!holderId || holderId === 'coffre') return 'Coffre Cartel';
  const found = members.find((m) => m.id === holderId);
  return found ? found.name : 'Ancien membre';
}

export function calcTotalWealth(params: {
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  weaponsStock?: WeaponsStock;
  catalogGroups?: CatalogGroupsMap;
}): number {
  const {
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock = {},
    catalogGroups,
  } = params;
  return (
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0) +
    calcRewardsTotalValue(rewardStocks) +
    calcInventoryTotalValue(inventoryStock, inventoryPrices, catalogGroups) +
    calcWeaponsTotalValue(weaponsStock)
  );
}

export interface RankedMemberEntry {
  member: HierarchyMember;
  rank: number;
  missionsOk: number;
  missionsKo: number;
  missionsTotal: number;
  heistsOk: number;
  smallOpsOk: number;
  estimatedRevenue: number;
  grossRevenue: number;
  materialCostShare: number;
  lossShare: number;
  weaponsHeldCount: number;
  weaponsHeldValue: number;
  autoPoints: number;
  bonusPoints: number;
  totalPoints: number;
  levelTitle: string;
  autoBadges: DistinctionKey[];
  manualBadges: DistinctionKey[];
  unlockedBadges: DistinctionKey[];
  note: string;
}

export function computeMemberLeaderboard(params: {
  members: HierarchyMember[];
  missionStates: MissionStates;
  weaponsStock: WeaponsStock;
  memberRankings: MemberRankingsMap;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
}): RankedMemberEntry[] {
  const {
    members,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  } = params;
  const stats = new Map<
    string,
    {
      missionsOk: number;
      missionsKo: number;
      heistsOk: number;
      smallOpsOk: number;
      grossSum: number;
      costSum: number;
      lossSum: number;
    }
  >();

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      if (players.length === 0) return;

      const grossPerPlayer = f.success ? f.gain / players.length : 0;
      const costPerPlayer = f.cost / players.length;
      const lossPerPlayer = f.extra / players.length;

      players.forEach((pid) => {
        const cur = stats.get(pid) || {
          missionsOk: 0,
          missionsKo: 0,
          heistsOk: 0,
          smallOpsOk: 0,
          grossSum: 0,
          costSum: 0,
          lossSum: 0,
        };
        if (f.success) {
          cur.missionsOk++;
          if (m.major) cur.heistsOk++;
          else cur.smallOpsOk++;
          cur.grossSum += grossPerPlayer;
        } else if (f.fail) {
          cur.missionsKo++;
        }
        cur.costSum += costPerPlayer;
        cur.lossSum += lossPerPlayer;
        stats.set(pid, cur);
      });
    });
  });

  const weaponsByHolder = new Map<string, { count: number; value: number }>();
  Object.values(weaponsStock).forEach((w) => {
    if (!w || !w.holderId || w.holderId === 'coffre') return;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    if (qty <= 0) return;
    const cur = weaponsByHolder.get(w.holderId) || { count: 0, value: 0 };
    cur.count += qty;
    cur.value += qty * val;
    weaponsByHolder.set(w.holderId, cur);
  });

  const validBadgeKeys = new Set(DISTINCTION_DEFS.map((d) => d.key));

  const preliminary = members.map((member) => {
    const st = stats.get(member.id) || {
      missionsOk: 0,
      missionsKo: 0,
      heistsOk: 0,
      smallOpsOk: 0,
      grossSum: 0,
      costSum: 0,
      lossSum: 0,
    };
    const wp = weaponsByHolder.get(member.id) || { count: 0, value: 0 };
    const adj = memberRankings[member.id];
    const bonusPoints = adj ? Math.trunc(Number(adj.bonusPoints) || 0) : 0;
    const manualBadges = Array.isArray(adj?.manualBadges)
      ? adj.manualBadges.filter((b): b is DistinctionKey => validBadgeKeys.has(b))
      : [];
    const note = typeof adj?.note === 'string' ? adj.note.trim() : '';

    const grossRevenue = Math.round(st.grossSum);
    const materialCostShare = Math.round(st.costSum);
    const lossShare = Math.round(st.lossSum);
    const estimatedRevenue = grossRevenue - materialCostShare - lossShare;

    const autoPoints = st.smallOpsOk * 100 + st.heistsOk * 250 + st.missionsKo * 25;
    const totalPoints = Math.max(0, autoPoints + bonusPoints);
    const missionsTotal = st.missionsOk + st.missionsKo;

    const levelObj =
      RANK_LEVELS.find((lvl) => totalPoints >= lvl.minPoints) ||
      RANK_LEVELS[RANK_LEVELS.length - 1];

    const autoBadges: DistinctionKey[] = [];
    if (missionsTotal >= 10) autoBadges.push('sang_fidele');
    if (st.missionsOk >= 5) autoBadges.push('frere_armes');
    if (st.smallOpsOk >= 3) autoBadges.push('loup_solitaire');
    if (st.heistsOk >= 2) autoBadges.push('stratege');
    if (totalPoints >= 1200) autoBadges.push('homme_confiance');
    if (totalPoints >= 2500) autoBadges.push('legende');

    return {
      member,
      rank: 1,
      missionsOk: st.missionsOk,
      missionsKo: st.missionsKo,
      missionsTotal,
      heistsOk: st.heistsOk,
      smallOpsOk: st.smallOpsOk,
      estimatedRevenue,
      grossRevenue,
      materialCostShare,
      lossShare,
      weaponsHeldCount: wp.count,
      weaponsHeldValue: wp.value,
      autoPoints,
      bonusPoints,
      totalPoints,
      levelTitle: levelObj.title,
      autoBadges,
      manualBadges,
      unlockedBadges: Array.from(new Set<DistinctionKey>([...autoBadges, ...manualBadges])),
      note,
    };
  });

  preliminary.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.missionsOk - a.missionsOk ||
      b.heistsOk - a.heistsOk ||
      b.estimatedRevenue - a.estimatedRevenue ||
      (a.member.order || 0) - (b.member.order || 0) ||
      a.member.name.localeCompare(b.member.name, 'fr-FR')
  );

  return preliminary.map((entry, idx) => {
    const rank = idx + 1;
    let unlocked = entry.unlockedBadges;
    let auto = entry.autoBadges;
    if (rank === 1 && entry.totalPoints > 0 && !auto.includes('legende')) {
      auto = [...auto, 'legende'];
      unlocked = Array.from(new Set<DistinctionKey>([...auto, ...entry.manualBadges]));
    }
    return {
      ...entry,
      rank,
      autoBadges: auto,
      unlockedBadges: unlocked,
    };
  });
}

export function buildDiscordReport(params: {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock?: InventoryStock;
  inventoryPrices?: InventoryPrices;
  weaponsStock?: WeaponsStock;
  weaponsLossAmount: number;
  hierMembers?: HierarchyMember[];
  catalogGroups?: CatalogGroupsMap;
}): string {
  const {
    missionStates,
    scheduleMeta,
    treasuryMoney,
    rewardStocks,
    inventoryStock = {},
    inventoryPrices,
    weaponsStock = {},
    weaponsLossAmount,
    hierMembers = [],
    catalogGroups,
  } = params;
  const effectiveScheduleDays = getEffectiveSchedule(missionStates, scheduleMeta).days;
  let discordText = '```asciidoc\n';
  discordText += '= BILAN COMPTABLE & TRÉSORERIE LOS CERBEROS =\n';
  discordText += `Semaine ${weekRangeText(missionStates)}\n\n`;

  discordText += `Argent Légal en Caisse  : ${formatMoney(treasuryMoney.legal || 0)}\n`;
  discordText += `Argent Illégal en Caisse: ${formatMoney(treasuryMoney.illegal || 0)}\n`;

  let rewardsValTotal = 0;
  REWARD_ITEMS.forEach((i) => {
    const dat = rewardStocks[i.key] || { qty: 0, val: i.defaultVal };
    const qty = Math.max(0, Number(dat.qty) || 0);
    const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : i.defaultVal;
    const sub = qty * val;
    rewardsValTotal += sub;
    if (qty > 0) {
      discordText += `- ${i.name} (${qty}x) : ${formatMoney(sub)}\n`;
    }
  });

  const inventoryValTotal = calcInventoryTotalValue(
    inventoryStock,
    inventoryPrices,
    catalogGroups
  );
  INVENTORY_ITEMS.forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      const price = getInventoryItemPrice(i.key, inventoryPrices, i.price, catalogGroups);
      discordText += `- [Stock] ${i.name} (${qty}x) : ${formatMoney(qty * price)}\n`;
    }
  });
  getCatalogExtraInventoryItems(catalogGroups).forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      const price = getInventoryItemPrice(i.key, inventoryPrices, i.price, catalogGroups);
      discordText += `- [Stock] ${i.name} (${qty}x) : ${formatMoney(qty * price)}\n`;
    }
  });

  const weaponsValTotal = calcWeaponsTotalValue(weaponsStock);
  Object.values(weaponsStock).forEach((w) => {
    if (!w) return;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    if (qty > 0) {
      const holderName = getWeaponHolderName(w.holderId, hierMembers);
      discordText += `- [Arme] ${w.name} (${qty}x) — ${holderName} : ${formatMoney(qty * val)}\n`;
    }
  });

  discordText += `Valeur Marché Noir (Total): ${formatMoney(rewardsValTotal)}\n`;
  discordText += `Valeur Inventaire (Stock) : ${formatMoney(inventoryValTotal)}\n`;
  discordText += `Valeur Arsenal (Armes)    : ${formatMoney(weaponsValTotal)}\n`;
  discordText += `PATRIMOINE GLOBAL CARTEL  : ${formatMoney(
    calcTotalWealth({
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      inventoryPrices,
      weaponsStock,
      catalogGroups,
    })
  )}\n`;
  discordText += `---------------------------------------------\n`;

  let totalCost = 0;
  let totalExtra = 0;
  let totalGains = 0;
  let totalOk = 0;
  let totalKo = 0;

  effectiveScheduleDays.forEach((day) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) ok++;
      if (f.fail) ko++;
      cost += f.cost;
      extra += f.extra;
      gains += f.gain;
    });
    totalOk += ok;
    totalKo += ko;
    totalCost += cost;
    totalExtra += extra;
    totalGains += gains;
    discordText += `[ ${day.day} ${fmtShort(dayDate(day.day, missionStates))} ] : ${ok} réussies / ${ko} échouées | Matériel: ${formatMoney(cost)} | Pertes: ${formatMoney(extra)} | Gains: ${formatMoney(gains)}\n`;
  });

  const playerStats = new Map<string, { ok: number; ko: number }>();
  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      players.forEach((pid) => {
        const cur = playerStats.get(pid) || { ok: 0, ko: 0 };
        if (f.success) cur.ok++;
        else if (f.fail) cur.ko++;
        playerStats.set(pid, cur);
      });
    });
  });

  const net = totalGains - (totalCost + totalExtra + weaponsLossAmount);
  discordText += `\nMatériel utilisé      : ${formatMoney(totalCost)}\n`;
  discordText += `Pertes missions       : ${formatMoney(totalExtra)}\n`;
  discordText += `Pertes globales armes : ${formatMoney(weaponsLossAmount)}\n`;
  discordText += `Missions              : ${totalOk} réussies / ${totalKo} échouées (sur ${TOTAL_WEEKLY_MISSIONS})\n`;
  discordText += `BÉNÉFICE NET          : ${formatMoney(net)}\n`;

  if (playerStats.size > 0) {
    discordText += `\nParticipations joueurs:\n`;
    const sorted = [...hierMembers].sort(
      (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
    );
    sorted.forEach((member) => {
      const stats = playerStats.get(member.id);
      if (stats && stats.ok + stats.ko > 0) {
        discordText += `- ${member.name} : ${stats.ok} réussie(s) / ${stats.ko} échouée(s)\n`;
      }
    });
  }

  discordText += '```';

  return discordText;
}

export interface SundayPayrollResult {
  week: string;
  weekLabel: string;
  cartelPercent: number;
  membersPercent: number;
  basis: PayrollBasis;
  grossGains: number;
  materialCost: number;
  missionLoss: number;
  weaponsLossAmount: number;
  netWeekProfit: number;
  distributableBase: number;
  payrollPoolAmount: number;
  cartelShareAmount: number;
  unattributedNet: number;
  rows: PayrollMemberRow[];
  totalMemberPositiveNet: number;
  paidTotalAmount: number;
  unpaidTotalAmount: number;
  paidMembersCount: number;
  eligibleMembersCount: number;
}

export function computeSundayPayroll(params: {
  members: HierarchyMember[];
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  weaponsLossAmount: number;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  cartelPercent?: number;
  basis?: PayrollBasis;
  paidMemberIds?: string[];
}): SundayPayrollResult {
  const {
    members,
    missionStates,
    scheduleMeta,
    weaponsLossAmount,
    inventoryPrices,
    catalogGroups,
    cartelPercent: rawCartelPercent = 70,
    basis = 'net_cartel',
    paidMemberIds = [],
  } = params;

  const cartelPercent = Math.max(0, Math.min(100, Math.round(Number(rawCartelPercent) || 70)));
  const membersPercent = 100 - cartelPercent;
  const paidSet = new Set(paidMemberIds);

  const memberNameMap = new Map(members.map((m) => [m.id, m]));
  const stats = new Map<
    string,
    {
      missionsOk: number;
      missionsKo: number;
      heistsOk: number;
      grossSum: number;
      costSum: number;
      lossSum: number;
    }
  >();

  let grossGains = 0;
  let materialCost = 0;
  let missionLoss = 0;
  let unattributedNet = 0;

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      grossGains += f.gain;
      materialCost += f.cost;
      missionLoss += f.extra;

      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      if (players.length === 0) {
        unattributedNet += f.net;
        return;
      }

      const grossPerPlayer = f.success ? f.gain / players.length : 0;
      const costPerPlayer = f.cost / players.length;
      const lossPerPlayer = f.extra / players.length;

      players.forEach((pid) => {
        const cur = stats.get(pid) || {
          missionsOk: 0,
          missionsKo: 0,
          heistsOk: 0,
          grossSum: 0,
          costSum: 0,
          lossSum: 0,
        };
        if (f.success) {
          cur.missionsOk++;
          if (m.major) cur.heistsOk++;
          cur.grossSum += grossPerPlayer;
        } else if (f.fail) {
          cur.missionsKo++;
        }
        cur.costSum += costPerPlayer;
        cur.lossSum += lossPerPlayer;
        stats.set(pid, cur);
      });
    });
  });

  // Ensure even unassigned/former participant IDs still appear if they have missions recorded
  const allParticipantIds = new Set<string>(members.map((m) => m.id));
  stats.forEach((_val, pid) => allParticipantIds.add(pid));

  const cleanWeaponsLoss = Math.max(0, Math.round(Number(weaponsLossAmount) || 0));
  const netWeekProfit = grossGains - materialCost - missionLoss - cleanWeaponsLoss;

  const baseRows = Array.from(allParticipantIds).map((pid) => {
    const memberObj = memberNameMap.get(pid);
    const st = stats.get(pid) || {
      missionsOk: 0,
      missionsKo: 0,
      heistsOk: 0,
      grossSum: 0,
      costSum: 0,
      lossSum: 0,
    };
    const grossRevenue = Math.round(st.grossSum);
    const materialCostShare = Math.round(st.costSum);
    const lossShare = Math.round(st.lossSum);
    const netContribution = grossRevenue - materialCostShare - lossShare;
    return {
      memberId: pid,
      memberName: memberObj?.name || 'Ancien membre',
      unit: memberObj?.unit || 'cerberos',
      order: memberObj?.order ?? 999,
      missionsOk: st.missionsOk,
      missionsKo: st.missionsKo,
      heistsOk: st.heistsOk,
      grossRevenue,
      materialCostShare,
      lossShare,
      netContribution,
      positiveContribution: Math.max(0, netContribution),
    };
  });

  const totalMemberPositiveNet = baseRows.reduce((s, r) => s + r.positiveContribution, 0);

  let distributableBase = 0;
  const payoutByMemberId = new Map<string, number>();

  if (basis === 'net_member') {
    distributableBase = totalMemberPositiveNet;
    baseRows.forEach((r) => {
      payoutByMemberId.set(
        r.memberId,
        r.positiveContribution > 0
          ? Math.round((r.positiveContribution * membersPercent) / 100)
          : 0
      );
    });
  } else {
    distributableBase =
      netWeekProfit > 0 && totalMemberPositiveNet > 0
        ? Math.min(netWeekProfit, totalMemberPositiveNet)
        : 0;
    const targetPool = Math.round((distributableBase * membersPercent) / 100);
    if (targetPool > 0 && totalMemberPositiveNet > 0) {
      const exacts = baseRows.map((r) => {
        const exact = (targetPool * r.positiveContribution) / totalMemberPositiveNet;
        const floored = Math.floor(exact);
        return {
          memberId: r.memberId,
          floored,
          remainder: exact - floored,
          positive: r.positiveContribution,
        };
      });
      let remaining =
        targetPool - exacts.reduce((sum, item) => sum + item.floored, 0);
      const byRemainder = [...exacts]
        .filter((e) => e.positive > 0)
        .sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
        byRemainder[i].floored += 1;
        remaining -= 1;
      }
      exacts.forEach((e) => {
        payoutByMemberId.set(e.memberId, e.floored);
      });
    }
  }

  const rows: PayrollMemberRow[] = baseRows
    .map((r) => {
      const payrollAmount = payoutByMemberId.get(r.memberId) || 0;
      const sharePercent =
        totalMemberPositiveNet > 0 && r.positiveContribution > 0
          ? Math.round((r.positiveContribution / totalMemberPositiveNet) * 1000) / 10
          : 0;
      return {
        memberId: r.memberId,
        memberName: r.memberName,
        unit: r.unit,
        missionsOk: r.missionsOk,
        missionsKo: r.missionsKo,
        heistsOk: r.heistsOk,
        grossRevenue: r.grossRevenue,
        materialCostShare: r.materialCostShare,
        lossShare: r.lossShare,
        netContribution: r.netContribution,
        sharePercent,
        payrollAmount,
        paid: paidSet.has(r.memberId),
      };
    })
    .filter(
      (r) =>
        r.missionsOk + r.missionsKo > 0 ||
        r.payrollAmount > 0 ||
        memberNameMap.has(r.memberId)
    )
    .sort(
      (a, b) =>
        b.payrollAmount - a.payrollAmount ||
        b.netContribution - a.netContribution ||
        b.missionsOk - a.missionsOk ||
        a.memberName.localeCompare(b.memberName, 'fr-FR')
    );

  const payrollPoolAmount = rows.reduce((s, r) => s + r.payrollAmount, 0);
  const cartelShareAmount = netWeekProfit - payrollPoolAmount;

  let paidTotalAmount = 0;
  let unpaidTotalAmount = 0;
  let paidMembersCount = 0;
  let eligibleMembersCount = 0;
  rows.forEach((r) => {
    if (r.payrollAmount > 0) {
      eligibleMembersCount++;
      if (r.paid) {
        paidMembersCount++;
        paidTotalAmount += r.payrollAmount;
      } else {
        unpaidTotalAmount += r.payrollAmount;
      }
    }
  });

  // Preserve unused parameter lint safety if scheduleMeta passed for future daily context
  void scheduleMeta;

  const week =
    typeof missionStates.__week === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(missionStates.__week)
      ? missionStates.__week
      : isoDate(currentWeekStart());

  return {
    week,
    weekLabel: weekRangeText(missionStates),
    cartelPercent,
    membersPercent,
    basis,
    grossGains,
    materialCost,
    missionLoss,
    weaponsLossAmount: cleanWeaponsLoss,
    netWeekProfit,
    distributableBase,
    payrollPoolAmount,
    cartelShareAmount,
    unattributedNet,
    rows,
    totalMemberPositiveNet,
    paidTotalAmount,
    unpaidTotalAmount,
    paidMembersCount,
    eligibleMembersCount,
  };
}

export function buildArchiveRecordFromWeek(params: {
  archiveId: string;
  archivedBy: string;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  weaponsLossAmount: number;
  members: HierarchyMember[];
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  currentPayroll?: CurrentWeekPayrollState;
}): WeeklyArchiveRecord {
  const {
    archiveId,
    archivedBy,
    missionStates,
    scheduleMeta,
    weaponsLossAmount,
    members,
    inventoryPrices,
    catalogGroups,
    currentPayroll,
  } = params;

  const week =
    typeof missionStates.__week === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(missionStates.__week)
      ? missionStates.__week
      : isoDate(currentWeekStart());

  const effectiveDays = getEffectiveSchedule(missionStates, scheduleMeta).days;
  const dailyRows: WeeklyArchiveDayRow[] = [];
  const missions: WeeklyArchiveMissionRow[] = [];
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));

  let successCount = 0;
  let failCount = 0;
  let totalMissions = 0;
  let grossGains = 0;
  let materialCost = 0;
  let missionLoss = 0;

  effectiveDays.forEach((dayObj) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;
    dayObj.missions.forEach((m) => {
      totalMissions++;
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) ok++;
      if (f.fail) ko++;
      cost += f.cost;
      extra += f.extra;
      gains += f.gain;

      if (f.done && (f.status === 'success' || f.status === 'fail')) {
        const entry = getMissionEntry(missionStates, m.id);
        const players = Array.isArray(entry.players)
          ? entry.players.map((pid) => memberNameById.get(pid) || pid).slice(0, 20)
          : [];
        missions.push({
          id: m.id,
          name: m.name,
          day: dayObj.day,
          major: Boolean(m.major),
          status: f.status,
          gain: f.gain,
          cost: f.cost,
          extra: f.extra,
          net: f.net,
          players,
        });
      }
    });
    successCount += ok;
    failCount += ko;
    grossGains += gains;
    materialCost += cost;
    missionLoss += extra;

    dailyRows.push({
      day: dayObj.day,
      dateLabel: fmtLong(dayDate(dayObj.day, missionStates)),
      ok,
      ko,
      totalMissions: dayObj.missions.length,
      cost,
      extra,
      gains,
      net: gains - cost - extra,
    });
  });

  const cleanWeaponsLoss = Math.max(0, Math.round(Number(weaponsLossAmount) || 0));
  const netProfit = grossGains - materialCost - missionLoss - cleanWeaponsLoss;

  const isSameWeekPayroll = !currentPayroll?.week || currentPayroll.week === week;
  const payrollCalc = computeSundayPayroll({
    members,
    missionStates,
    scheduleMeta,
    weaponsLossAmount: cleanWeaponsLoss,
    inventoryPrices,
    catalogGroups,
    cartelPercent: isSameWeekPayroll ? currentPayroll?.cartelPercent ?? 70 : 70,
    basis: isSameWeekPayroll ? currentPayroll?.basis ?? 'net_cartel' : 'net_cartel',
    paidMemberIds: isSameWeekPayroll ? currentPayroll?.paidMemberIds ?? [] : [],
  });

  return {
    id: archiveId,
    week,
    label: weekRangeText(missionStates),
    archivedAt: new Date().toISOString().slice(0, 40),
    archivedBy: archivedBy.slice(0, 80),
    summary: {
      successCount,
      failCount,
      totalMissions,
      grossGains,
      materialCost,
      missionLoss,
      weaponsLossAmount: cleanWeaponsLoss,
      netProfit,
    },
    dailyRows,
    missions,
    payroll: {
      cartelPercent: payrollCalc.cartelPercent,
      membersPercent: payrollCalc.membersPercent,
      basis: payrollCalc.basis,
      distributableBase: payrollCalc.distributableBase,
      cartelShareAmount: payrollCalc.cartelShareAmount,
      payrollPoolAmount: payrollCalc.payrollPoolAmount,
      unattributedNet: payrollCalc.unattributedNet,
      settled: isSameWeekPayroll ? Boolean(currentPayroll?.settled) : false,
      settledAt: isSameWeekPayroll ? currentPayroll?.settledAt || '' : '',
      settledBy: isSameWeekPayroll ? currentPayroll?.settledBy || '' : '',
      debitAccount: isSameWeekPayroll ? currentPayroll?.debitAccount || 'none' : 'none',
      debitAmount: isSameWeekPayroll ? Math.max(0, Number(currentPayroll?.debitAmount) || 0) : 0,
      rows: payrollCalc.rows,
    },
  };
}

export function buildDiscordPayrollReport(params: {
  weekLabel: string;
  cartelPercent: number;
  membersPercent: number;
  netWeekProfit: number;
  cartelShareAmount: number;
  payrollPoolAmount: number;
  rows: PayrollMemberRow[];
  settled?: boolean;
}): string {
  const {
    weekLabel,
    cartelPercent,
    membersPercent,
    netWeekProfit,
    cartelShareAmount,
    payrollPoolAmount,
    rows,
    settled,
  } = params;

  let text = '```asciidoc\n';
  text += '= PAYE DU DIMANCHE LOS CERBEROS =\n';
  text += `Semaine ${weekLabel}\n`;
  text += `Répartition : ${cartelPercent}% Cartel / ${membersPercent}% Paie membres\n`;
  if (settled) {
    text += `Statut      : PAYE VALIDÉE\n`;
  }
  text += `\nBénéfice Net Semaine  : ${formatSigned(netWeekProfit)}\n`;
  text += `Part Cartel (${cartelPercent}%)     : ${formatMoney(Math.max(0, cartelShareAmount))}\n`;
  text += `Enveloppe Paie (${membersPercent}%)  : ${formatMoney(payrollPoolAmount)}\n`;
  text += `---------------------------------------------\n`;

  const activeRows = rows.filter((r) => r.payrollAmount > 0 || r.missionsOk + r.missionsKo > 0);
  if (activeRows.length === 0) {
    text += 'Aucune participation enregistrée cette semaine.\n';
  } else {
    activeRows.forEach((r) => {
      const statusMark = r.payrollAmount > 0 ? (r.paid ? '[PAYÉ]' : '[À PAYER]') : '[0 $]';
      text += `- ${r.memberName.padEnd(18, ' ')} ${statusMark} : ${formatMoney(r.payrollAmount)} `;
      text += `(Apport net: ${formatSigned(r.netContribution)} · ${r.missionsOk}✓/${r.missionsKo}✗)\n`;
    });
  }

  text += '```';
  return text;
}

export function buildArchivedWeekDiscordReport(archive: WeeklyArchiveRecord): string {
  let text = '```asciidoc\n';
  text += '= ARCHIVE BILAN & PAYE LOS CERBEROS =\n';
  text += `Semaine ${archive.label}\n\n`;

  archive.dailyRows.forEach((d) => {
    text += `[ ${d.day} ] : ${d.ok} réussies / ${d.ko} échouées | Mat.: ${formatMoney(d.cost)} | Pertes: ${formatMoney(d.extra)} | Gains: ${formatMoney(d.gains)} | Net: ${formatSigned(d.net)}\n`;
  });

  if (archive.summary.weaponsLossAmount > 0) {
    text += `\nPertes globales armes : -${formatMoney(archive.summary.weaponsLossAmount)}\n`;
  }
  text += `---------------------------------------------\n`;
  text += `Missions       : ${archive.summary.successCount} réussies / ${archive.summary.failCount} échouées\n`;
  text += `Gains bruts    : ${formatMoney(archive.summary.grossGains)}\n`;
  text += `Matériel + Pertes : -${formatMoney(archive.summary.materialCost + archive.summary.missionLoss + archive.summary.weaponsLossAmount)}\n`;
  text += `BÉNÉFICE NET   : ${formatSigned(archive.summary.netProfit)}\n`;
  text += `Part Cartel (${archive.payroll.cartelPercent}%) : ${formatMoney(Math.max(0, archive.payroll.cartelShareAmount))}\n`;
  text += `Enveloppe Paie (${archive.payroll.membersPercent}%) : ${formatMoney(archive.payroll.payrollPoolAmount)}\n`;

  const paidRows = archive.payroll.rows.filter((r) => r.payrollAmount > 0);
  if (paidRows.length > 0) {
    text += `\nPayes du Dimanche :\n`;
    paidRows.forEach((r) => {
      text += `- ${r.memberName} : ${formatMoney(r.payrollAmount)} (${r.paid ? 'Payé' : 'En attente'})\n`;
    });
  }

  text += '```';
  return text;
}
