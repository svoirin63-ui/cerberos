import {
  DAY_NAMES,
  INVENTORY_ITEMS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import type {
  GearKey,
  HierarchyMember,
  InventoryStock,
  Mission,
  MissionFinance,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';

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

export function missionFin(m: Mission, missionStates: MissionStates): MissionFinance {
  const st = getMissionEntry(missionStates, m.id);
  const status = getStatus(st);
  const done = status !== '';
  const success = status === 'success';
  const fail = status === 'fail';
  const cost = done ? m.cost : 0;
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

export function calcInventoryTotalValue(inventoryStock: InventoryStock): number {
  return INVENTORY_ITEMS.reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    return sum + qty * item.price;
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
  weaponsStock?: WeaponsStock;
}): number {
  const { treasuryMoney, rewardStocks, inventoryStock, weaponsStock = {} } = params;
  return (
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0) +
    calcRewardsTotalValue(rewardStocks) +
    calcInventoryTotalValue(inventoryStock) +
    calcWeaponsTotalValue(weaponsStock)
  );
}

export function buildDiscordReport(params: {
  missionStates: MissionStates;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock?: InventoryStock;
  weaponsStock?: WeaponsStock;
  weaponsLossAmount: number;
  hierMembers?: HierarchyMember[];
}): string {
  const {
    missionStates,
    treasuryMoney,
    rewardStocks,
    inventoryStock = {},
    weaponsStock = {},
    weaponsLossAmount,
    hierMembers = [],
  } = params;
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

  const inventoryValTotal = calcInventoryTotalValue(inventoryStock);
  INVENTORY_ITEMS.forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      discordText += `- [Stock] ${i.name} (${qty}x) : ${formatMoney(qty * i.price)}\n`;
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
    calcTotalWealth({ treasuryMoney, rewardStocks, inventoryStock, weaponsStock })
  )}\n`;
  discordText += `---------------------------------------------\n`;

  let totalCost = 0;
  let totalExtra = 0;
  let totalGains = 0;
  let totalOk = 0;
  let totalKo = 0;

  WEEKLY_SCHEDULE.forEach((day) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates);
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
      const f = missionFin(m, missionStates);
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
