import {
  DAY_NAMES,
  DISTINCTION_DEFS,
  INVENTORY_ITEMS,
  RANK_LEVELS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import type {
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
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
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

export function getInventoryItemPrice(
  key: string,
  inventoryPrices?: InventoryPrices
): number {
  if (inventoryPrices && inventoryPrices[key] !== undefined) {
    return Math.max(0, Number(inventoryPrices[key]) || 0);
  }
  const found = INVENTORY_ITEMS.find((i) => i.key === key);
  return found ? found.price : 0;
}

export function getMissionCost(
  m: Mission,
  inventoryPrices?: InventoryPrices
): number {
  if (
    m.gearKey &&
    m.gearKey !== 'none' &&
    INVENTORY_ITEMS.some((i) => i.key === m.gearKey)
  ) {
    return getInventoryItemPrice(m.gearKey, inventoryPrices);
  }
  return Math.max(0, Number(m.cost) || 0);
}

export function missionFin(
  m: Mission,
  missionStates: MissionStates,
  inventoryPrices?: InventoryPrices
): MissionFinance {
  const st = getMissionEntry(missionStates, m.id);
  const status = getStatus(st);
  const done = status !== '';
  const success = status === 'success';
  const fail = status === 'fail';
  const cost = done ? getMissionCost(m, inventoryPrices) : 0;
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
  inventoryPrices?: InventoryPrices
): number {
  return INVENTORY_ITEMS.reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    const price = getInventoryItemPrice(item.key, inventoryPrices);
    return sum + qty * price;
  }, 0);
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
}): number {
  const {
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock = {},
  } = params;
  return (
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0) +
    calcRewardsTotalValue(rewardStocks) +
    calcInventoryTotalValue(inventoryStock, inventoryPrices) +
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
}): RankedMemberEntry[] {
  const { members, missionStates, weaponsStock, memberRankings, inventoryPrices } = params;
  const stats = new Map<
    string,
    {
      missionsOk: number;
      missionsKo: number;
      heistsOk: number;
      smallOpsOk: number;
      estimatedRevenue: number;
    }
  >();

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices);
      if (!f.done) return;
      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      if (players.length === 0) return;
      const revShare = f.success ? Math.round(f.gain / players.length) : 0;

      players.forEach((pid) => {
        const cur = stats.get(pid) || {
          missionsOk: 0,
          missionsKo: 0,
          heistsOk: 0,
          smallOpsOk: 0,
          estimatedRevenue: 0,
        };
        if (f.success) {
          cur.missionsOk++;
          if (m.major) cur.heistsOk++;
          else cur.smallOpsOk++;
          cur.estimatedRevenue += revShare;
        } else if (f.fail) {
          cur.missionsKo++;
        }
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
      estimatedRevenue: 0,
    };
    const wp = weaponsByHolder.get(member.id) || { count: 0, value: 0 };
    const adj = memberRankings[member.id];
    const bonusPoints = adj ? Math.trunc(Number(adj.bonusPoints) || 0) : 0;
    const manualBadges = Array.isArray(adj?.manualBadges)
      ? adj.manualBadges.filter((b): b is DistinctionKey => validBadgeKeys.has(b))
      : [];
    const note = typeof adj?.note === 'string' ? adj.note.trim() : '';

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
      estimatedRevenue: st.estimatedRevenue,
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

  const inventoryValTotal = calcInventoryTotalValue(inventoryStock, inventoryPrices);
  INVENTORY_ITEMS.forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      const price = getInventoryItemPrice(i.key, inventoryPrices);
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
      const f = missionFin(m, missionStates, inventoryPrices);
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
      const f = missionFin(m, missionStates, inventoryPrices);
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
