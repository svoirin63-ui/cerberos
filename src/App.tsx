import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  BarChart3,
  Calendar,
  ClipboardCopy,
  Lock,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { AccountingView } from '@/src/components/AccountingView';
import { AuthModal } from '@/src/components/AuthModal';
import { HierarchyView } from '@/src/components/HierarchyView';
import { InventoryView } from '@/src/components/InventoryView';
import {
  MissionValidationModal,
  type MissionValidationPayload,
} from '@/src/components/MissionValidationModal';
import { PlanningView } from '@/src/components/PlanningView';
import { RankingView } from '@/src/components/RankingView';
import { ResetModal } from '@/src/components/ResetModal';
import { Toast, type ToastVariant } from '@/src/components/Toast';
import { TreasuryView } from '@/src/components/TreasuryView';
import {
  DEFAULT_SECRET_CODE,
  HIER_DEFAULTS,
  INVENTORY_ITEMS,
  PREVIOUS_REWARD_DEFAULTS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import { auth, googleProvider } from '@/src/firebase';
import {
  bootstrapAndJoinCartel,
  type LocalSeedData,
  lockEditorRole,
  type MemberRole,
  resetAllInventory,
  saveAllMissionEntries,
  saveAllMissionEntriesWithSideEffects,
  saveHierarchyMembers,
  saveInventoryItem,
  saveInventoryItemPrice,
  saveInventoryOrderReceipt,
  saveMemberRankings,
  saveMissionEntry,
  saveMissionWithSideEffects,
  saveRewardItem,
  saveRewardPricesBatch,
  saveSchedulePlan,
  saveTreasuryMoneyField,
  saveWeaponLossGlobal,
  saveWeaponsLoss,
  saveWeaponsStock,
  subscribeCartelState,
  unlockEditorWithCode,
  updateCartelSecretCode,
} from '@/src/services/cartelFirestore';
import type {
  HierarchyMember,
  HierarchyUnitKey,
  InventoryPrices,
  InventoryStock,
  LostWeaponRecord,
  MemberRankingsMap,
  Mission,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  RewardStockEntry,
  RewardStocks,
  TabKey,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  buildDiscordReport,
  calcRewardsTotalValue,
  calcTotalWealth,
  currentWeekStart,
  formatMoney,
  getInventoryItemPrice,
  getMissionEntry,
  getStatus,
  isoDate,
  isWeekStale,
  missionFin,
  weekRangeText,
} from '@/src/utils/finance';
import {
  EMPTY_SCHEDULE_META,
  computeRecalculatedSchedule,
  getCurrentWeekTodayName,
  getEffectiveSchedule,
  getMsUntilNextDailyRecalc,
  isPastDailyRecalcTime,
} from '@/src/utils/schedule';

const LEGACY_STORAGE_KEYS = {
  missions: 'los_cerberos_local_state',
  inventory: 'los_cerberos_inventory_stock',
  treasury: 'los_cerberos_treasury_money',
  rewards: 'los_cerberos_rewards',
  weaponsLoss: 'los_cerberos_weapons_loss',
  secretCode: 'los_cerberos_secret_code',
  hierarchy: 'los_cerberos_hierarchy_members',
} as const;

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeReadString(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readLegacyLocalSeed(): LocalSeedData {
  const loadedMissions = safeReadJson<MissionStates>(LEGACY_STORAGE_KEYS.missions, {});
  if (!loadedMissions.__week) {
    loadedMissions.__week = isoDate(currentWeekStart());
  }
  const savedHier = safeReadJson<HierarchyMember[] | null>(LEGACY_STORAGE_KEYS.hierarchy, null);
  const weaponsVal = Number(safeReadString(LEGACY_STORAGE_KEYS.weaponsLoss, '0'));
  return {
    missionStates: loadedMissions,
    inventoryStock: safeReadJson<InventoryStock>(LEGACY_STORAGE_KEYS.inventory, {}),
    treasuryMoney: safeReadJson<TreasuryMoney>(LEGACY_STORAGE_KEYS.treasury, {
      legal: 0,
      illegal: 0,
    }),
    rewardStocks: safeReadJson<RewardStocks>(LEGACY_STORAGE_KEYS.rewards, {}),
    weaponsLossAmount: Number.isFinite(weaponsVal) ? Math.max(0, weaponsVal) : 0,
    secretCode: safeReadString(LEGACY_STORAGE_KEYS.secretCode, DEFAULT_SECRET_CODE),
    hierMembers:
      savedHier && Array.isArray(savedHier) && savedHier.length > 0
        ? savedHier
        : HIER_DEFAULTS,
  };
}

function extractEntriesRecord(
  states: MissionStates
): Record<string, MissionStateEntry> {
  const entries: Record<string, MissionStateEntry> = {};
  Object.entries(states).forEach(([k, v]) => {
    if (k !== '__week' && v && typeof v === 'object') {
      entries[k] = v;
    }
  });
  return entries;
}

function buildValidationStockAlert(params: {
  debitedKeys: string[];
  missionGearKey: string;
  nextInventory: InventoryStock;
}): { variant: ToastVariant; message: string } | null {
  const { debitedKeys, missionGearKey, nextInventory } = params;
  const alerts: Array<{ variant: ToastVariant; text: string }> = [];

  const keysToCheck =
    debitedKeys.length > 0
      ? debitedKeys
      : missionGearKey !== 'none'
        ? [missionGearKey]
        : [];

  keysToCheck.forEach((gKey) => {
    const item = INVENTORY_ITEMS.find((i) => i.key === gKey);
    if (!item) return;
    const remaining = Math.max(0, Math.floor(Number(nextInventory[gKey]) || 0));

    if (item.category === 'heist_pack') {
      if (remaining === 0) {
        alerts.push({
          variant: 'critical',
          text:
            debitedKeys.includes(gKey)
              ? `Dernier ${item.name} utilisé (0 restant en stock)`
              : `Stock à 0 : ${item.name} manquant`,
        });
      }
      return;
    }

    if (item.category === 'tool') {
      if (remaining === 0) {
        alerts.push({
          variant: 'critical',
          text: debitedKeys.includes(gKey)
            ? `Stock épuisé : 0 ${item.name} restant`
            : `Stock à 0 : ${item.name} manquant`,
        });
      } else if (remaining === 1 && debitedKeys.includes(gKey)) {
        alerts.push({
          variant: 'warning',
          text: `Plus que 1 ${item.name} en stock`,
        });
      }
    }
  });

  if (alerts.length === 0) return null;
  const hasCritical = alerts.some((a) => a.variant === 'critical');
  const prefix = hasCritical ? '🚨' : '⚠️';
  return {
    variant: hasCritical ? 'critical' : 'warning',
    message: `${prefix} ${alerts.map((a) => a.text).join(' · ')}`,
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cartelStatus, setCartelStatus] = useState<'loading' | 'ready' | 'uninitialized'>(
    'loading'
  );
  const [memberRole, setMemberRole] = useState<MemberRole>('viewer');
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  const [missionStates, setMissionStates] = useState<MissionStates>(() => ({
    __week: isoDate(currentWeekStart()),
  }));
  const [scheduleMeta, setScheduleMeta] = useState<MissionScheduleMeta>(EMPTY_SCHEDULE_META);
  const [scheduleSynced, setScheduleSynced] = useState(false);
  const [inventoryStock, setInventoryStock] = useState<InventoryStock>({});
  const [inventoryPrices, setInventoryPrices] = useState<InventoryPrices>({});
  const [weaponsStock, setWeaponsStock] = useState<WeaponsStock>({});
  const [treasuryMoney, setTreasuryMoney] = useState<TreasuryMoney>({
    legal: 0,
    illegal: 0,
  });
  const [rewardStocks, setRewardStocks] = useState<RewardStocks>({});
  const [weaponsLossAmount, setWeaponsLossAmount] = useState<number>(0);
  const [hierMembers, setHierMembers] = useState<HierarchyMember[]>(HIER_DEFAULTS);
  const [memberRankings, setMemberRankings] = useState<MemberRankingsMap>({});

  const [currentTab, setCurrentTab] = useState<TabKey>('planning');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [validatingMission, setValidatingMission] = useState<{
    mission: Mission;
    dayName: string;
    initialStatus: 'success' | 'fail';
  } | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    variant: ToastVariant;
    withStockShortcut: boolean;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setDayTick] = useState(() => isoDate(new Date()));
  const [recalcClockTick, setRecalcClockTick] = useState(() => Date.now());
  const toastTimerRef = useRef<number | null>(null);
  const didMigrateRewardPricesRef = useRef(false);
  const autoRecalcAttemptedDateRef = useRef<string>('');

  if (syncError) {
    throw syncError;
  }

  const showToast = useCallback(
    (
      msg: string,
      options?: {
        variant?: ToastVariant;
        durationMs?: number;
        withStockShortcut?: boolean;
      }
    ) => {
      const variant = options?.variant ?? 'default';
      const durationMs = options?.durationMs ?? (variant === 'default' ? 3500 : 6500);
      setToastState({
        message: msg,
        variant,
        withStockShortcut: Boolean(options?.withStockShortcut),
      });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setCartelStatus('loading');
        setMemberRole('viewer');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;

    let cancelled = false;
    let unsubSync: (() => void) | null = null;
    setCartelStatus('loading');
    setScheduleSynced(false);

    const startSync = async () => {
      try {
        const seed = readLegacyLocalSeed();
        const status = await bootstrapAndJoinCartel(authUser, seed);
        if (cancelled) return;
        if (status === 'uninitialized') {
          setCartelStatus('uninitialized');
          return;
        }
        setCartelStatus('ready');
        unsubSync = subscribeCartelState(authUser.uid, {
          onMissions: (ms) => setMissionStates(ms),
          onScheduleMeta: (meta) => {
            setScheduleMeta(meta);
            setScheduleSynced(true);
          },
          onInventory: (stock) => setInventoryStock(stock),
          onInventoryPrices: (prices) => setInventoryPrices(prices),
          onWeapons: (weapons) => setWeaponsStock(weapons),
          onTreasury: (data) => {
            setTreasuryMoney(data.treasuryMoney);
            setRewardStocks(data.rewardStocks);
            setWeaponsLossAmount(data.weaponsLossAmount);
          },
          onHierarchy: (members) => setHierMembers(members),
          onMemberRankings: (rankings) => setMemberRankings(rankings),
          onRole: (role) => setMemberRole(role),
          onError: (err) => setSyncError(err),
        });
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      setScheduleSynced(false);
      if (unsubSync) unsubSync();
    };
  }, [authReady, authUser, retryCounter]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = isoDate(new Date());
      setDayTick((prev) => (prev !== now ? now : prev));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ms = getMsUntilNextDailyRecalc(new Date());
    const timer = window.setTimeout(() => {
      setRecalcClockTick(Date.now());
    }, ms);
    return () => window.clearTimeout(timer);
  }, [recalcClockTick]);

  const isUnlocked = memberRole === 'editor';
  const readonly = !isUnlocked;

  // Automatic daily 09:30 schedule recalculation for uncompleted overdue missions
  useEffect(() => {
    if (
      cartelStatus !== 'ready' ||
      !scheduleSynced ||
      !isUnlocked ||
      !authUser ||
      isWeekStale(missionStates)
    ) {
      return;
    }

    const now = new Date();
    const todayIso = isoDate(now);
    if (!isPastDailyRecalcTime(now)) return;
    if (scheduleMeta.lastRecalcDate === todayIso) return;
    if (autoRecalcAttemptedDateRef.current === todayIso) return;

    const todayDayName = getCurrentWeekTodayName(missionStates, now);
    if (!todayDayName) return;

    autoRecalcAttemptedDateRef.current = todayIso;
    const res = computeRecalculatedSchedule({
      missionStates,
      currentMeta: scheduleMeta,
      targetStartDayName: todayDayName,
      now,
    });

    setScheduleMeta(res.meta);
    void saveSchedulePlan(authUser.uid, res.meta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    if (res.changed && (res.movedCount > 0 || res.unplacedCount > 0)) {
      const msg =
        res.unplacedCount > 0
          ? `Recalcul 09h30 : ${res.movedCount} mission(s) reportée(s), ${res.unplacedCount} hors quota.`
          : `Recalcul 09h30 : ${res.movedCount} mission(s) reportée(s) sur le reste de la semaine.`;
      showToast(msg);
    }
  }, [
    cartelStatus,
    scheduleSynced,
    isUnlocked,
    authUser,
    missionStates,
    scheduleMeta,
    recalcClockTick,
    showToast,
  ]);

  useEffect(() => {
    if (
      didMigrateRewardPricesRef.current ||
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser ||
      Object.keys(rewardStocks).length === 0
    ) {
      return;
    }

    didMigrateRewardPricesRef.current = true;
    const patch: Record<string, RewardStockEntry> = {};

    REWARD_ITEMS.forEach((item) => {
      const prevDefault = PREVIOUS_REWARD_DEFAULTS[item.key];
      const existing = rewardStocks[item.key];
      if (
        prevDefault !== undefined &&
        existing &&
        Number(existing.val) === prevDefault
      ) {
        patch[item.key] = {
          qty: Math.max(0, Number(existing.qty) || 0),
          val: item.defaultVal,
        };
      }
    });

    if (Object.keys(patch).length === 0) return;

    setRewardStocks((prev) => ({
      ...prev,
      ...patch,
    }));
    void saveRewardPricesBatch(authUser.uid, patch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, rewardStocks]);

  const kpis = useMemo(() => {
    let totalCost = 0;
    let extraLoss = 0;
    let grossGains = 0;
    let successCount = 0;
    let failCount = 0;

    WEEKLY_SCHEDULE.forEach((day) => {
      day.missions.forEach((mission) => {
        const f = missionFin(mission, missionStates, inventoryPrices);
        if (f.success) successCount++;
        if (f.fail) failCount++;
        totalCost += f.cost;
        extraLoss += f.extra;
        grossGains += f.gain;
      });
    });

    const netProfit = grossGains - (totalCost + extraLoss + weaponsLossAmount);

    const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
    const rewardsItemCount = REWARD_ITEMS.reduce(
      (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
      0
    );

    const totalWealth = calcTotalWealth({
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      inventoryPrices,
      weaponsStock,
    });

    return {
      successCount,
      failCount,
      grossGains,
      netProfit,
      totalWealth,
      rewardsValTotal,
      rewardsItemCount,
    };
  }, [missionStates, weaponsLossAmount, rewardStocks, treasuryMoney, inventoryStock, inventoryPrices, weaponsStock]);

  const handleGoToOrderPrep = useCallback(() => {
    setToastState(null);
    setCurrentTab('inventory');
    window.setTimeout(() => {
      const el = document.getElementById('order-prep-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }, []);

  const staleWeek = isWeekStale(missionStates);
  const todayText = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Connexion annulée.');
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        const msg = `Domaine non autorisé (${host}). Ajoutez "${host}" dans Firebase Console > Authentication > Settings > Domaines autorisés.`;
        setAuthError(msg);
        showToast('Domaine non autorisé pour la connexion Google.');
        return;
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'La fenêtre pop-up Google a été bloquée par le navigateur. Autorisez les pop-ups pour ce site puis réessayez.';
        setAuthError(msg);
        showToast('Pop-up bloquée par le navigateur.');
        return;
      }
      const msg = `Erreur lors de la connexion Google${code ? ` (${code})` : ''}.`;
      setAuthError(msg);
      showToast(msg);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Déconnecté.');
    } catch {
      showToast('Erreur lors de la déconnexion.');
    }
  };

  const handleSetMissionStatus = (id: string, status: Exclude<MissionStatus, ''>) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, id);
    const prevStatus = getStatus(cur);
    const next = prevStatus === status ? '' : status;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find((m) => m.id === id);

    let nextGearConsumed = Boolean(cur.gearConsumed);
    let nextUsedGear: Record<string, number> =
      cur.usedGear && typeof cur.usedGear === 'object' ? { ...cur.usedGear } : {};
    if (
      Object.keys(nextUsedGear).length === 0 &&
      cur.gearConsumed &&
      mission &&
      mission.gearKey !== 'none' &&
      INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)
    ) {
      nextUsedGear[mission.gearKey] = 1;
    }

    let inventoryPatch: Record<string, number> | undefined;
    if (prevStatus === '' && next !== '' && mission && mission.gearKey !== 'none') {
      const currentQty = inventoryStock[mission.gearKey] || 0;
      if (currentQty > 0) {
        const updatedQty = currentQty - 1;
        inventoryPatch = { [mission.gearKey]: updatedQty };
        nextGearConsumed = true;
        nextUsedGear = { ...nextUsedGear, [mission.gearKey]: (nextUsedGear[mission.gearKey] || 0) + 1 };
        setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
      }
    } else if (prevStatus !== '' && next === '') {
      const keysToRestore = Object.keys(nextUsedGear);
      if (keysToRestore.length > 0) {
        inventoryPatch = {};
        const updatedStock = { ...inventoryStock };
        keysToRestore.forEach((gKey) => {
          const count = Math.max(0, Number(nextUsedGear[gKey]) || 0);
          if (count <= 0) return;
          const updatedQty = (updatedStock[gKey] || 0) + count;
          updatedStock[gKey] = updatedQty;
          inventoryPatch![gKey] = updatedQty;
        });
        setInventoryStock(updatedStock);
        nextUsedGear = {};
        nextGearConsumed = false;
      } else if (cur.gearConsumed && mission && mission.gearKey !== 'none') {
        const updatedQty = (inventoryStock[mission.gearKey] || 0) + 1;
        inventoryPatch = { [mission.gearKey]: updatedQty };
        nextGearConsumed = false;
        setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
      }
    }

    let nextGain = Number(cur.gain) || 0;
    let nextCashGain = Math.max(0, Number(cur.cashGain) || 0);
    let nextLoot = cur.loot ? { ...cur.loot } : {};
    let rewardPatches: Record<string, RewardStockEntry> | undefined;
    let resetTreasuryPatch: Partial<TreasuryMoney> | undefined;

    if (prevStatus === 'success' && next !== 'success') {
      if (Object.keys(nextLoot).length > 0) {
        rewardPatches = {};
        const nextRewards = { ...rewardStocks };
        Object.entries(nextLoot).forEach(([rKey, lQty]) => {
          const count = Math.max(0, Number(lQty) || 0);
          if (count <= 0) return;
          const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
          const existing = nextRewards[rKey] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
          const unitVal = existing.val !== undefined ? Number(existing.val) : itemRef ? itemRef.defaultVal : 200;
          const updatedEntry: RewardStockEntry = {
            qty: Math.max(0, (Number(existing.qty) || 0) - count),
            val: unitVal,
          };
          nextRewards[rKey] = updatedEntry;
          rewardPatches![rKey] = updatedEntry;
          nextGain = Math.max(0, nextGain - count * unitVal);
        });
        setRewardStocks(nextRewards);
        nextLoot = {};
      }
      if (nextCashGain > 0) {
        const updatedIllegal = Math.max(0, (Number(treasuryMoney.illegal) || 0) - nextCashGain);
        resetTreasuryPatch = { illegal: updatedIllegal };
        setTreasuryMoney((prev) => ({ ...prev, illegal: updatedIllegal }));
        nextGain = Math.max(0, nextGain - nextCashGain);
        nextCashGain = 0;
      }
    }

    let nextExtra = Number(cur.extra) || 0;
    let nextLostWeapons: LostWeaponRecord[] = Array.isArray(cur.lostWeapons)
      ? [...cur.lostWeapons]
      : [];
    let nextWeaponsArg: WeaponsStock | undefined;
    if (prevStatus !== '' && next === '' && nextLostWeapons.length > 0) {
      const updatedWeapons = { ...weaponsStock };
      nextLostWeapons.forEach((lw) => {
        nextExtra = Math.max(0, nextExtra - (Number(lw.value) || 0));
        const existing = updatedWeapons[lw.id];
        if (existing) {
          updatedWeapons[lw.id] = {
            ...existing,
            qty: Math.max(1, (Number(existing.qty) || 0) + 1),
          };
        } else if (lw.id) {
          updatedWeapons[lw.id] = {
            id: lw.id,
            name: lw.name,
            value: Math.max(0, Number(lw.value) || 0),
            qty: 1,
            holderId: lw.holderId || 'coffre',
            notes: '',
          };
        }
      });
      setWeaponsStock(updatedWeapons);
      nextWeaponsArg = updatedWeapons;
      nextLostWeapons = [];
    }

    const updatedEntry: MissionStateEntry = {
      ...cur,
      status: next,
      completed: next !== '',
      gain: nextGain,
      cashGain: nextCashGain,
      extra: nextExtra,
      players: Array.isArray(cur.players) ? cur.players : [],
      gearConsumed: nextGearConsumed,
      usedGear: nextUsedGear,
      loot: nextLoot,
      lostWeapons: nextLostWeapons,
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));

    if (inventoryPatch || rewardPatches || nextWeaponsArg !== undefined || resetTreasuryPatch) {
      void saveMissionWithSideEffects(authUser.uid, id, updatedEntry, {
        inventoryPatch,
        rewardPatches,
        weapons: nextWeaponsArg,
        treasuryMoneyPatch: resetTreasuryPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    if (prevStatus === '' && next !== '' && mission && INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)) {
      const invItem = INVENTORY_ITEMS.find((i) => i.key === mission.gearKey);
      const itemPrice = getInventoryItemPrice(mission.gearKey, inventoryPrices);
      const updatedMap = inventoryPatch
        ? { ...inventoryStock, ...inventoryPatch }
        : inventoryStock;
      const stockAlert = buildValidationStockAlert({
        debitedKeys: inventoryPatch ? [mission.gearKey] : [],
        missionGearKey: mission.gearKey,
        nextInventory: updatedMap,
      });

      if (stockAlert) {
        const baseMsg = inventoryPatch
          ? `Mission validée (-1 ${invItem?.name || 'matériel'})`
          : `Mission validée`;
        showToast(`${stockAlert.message} · ${baseMsg}`, {
          variant: stockAlert.variant,
          withStockShortcut: true,
        });
      } else if (inventoryPatch) {
        showToast(
          `Mission validée — 1× ${invItem?.name || 'matériel'} débité de l'inventaire (-${formatMoney(itemPrice)}).`
        );
      } else {
        showToast(`Mission validée (stock ${invItem?.name || 'matériel'} déjà à 0).`);
      }
    } else if (prevStatus !== '' && next === '' && inventoryPatch) {
      showToast('Mission annulée — matériel remis en inventaire.');
    }
  };

  const handleOpenMissionValidation = (
    mission: Mission,
    dayName: string,
    initialStatus: 'success' | 'fail'
  ) => {
    if (readonly) {
      setAuthModalOpen(true);
      showToast("Déverrouillez l'édition avec le code secret pour valider une mission.");
      return;
    }
    setValidatingMission({ mission, dayName, initialStatus });
  };

  const handleConfirmMissionValidation = (payload: MissionValidationPayload) => {
    if (readonly || !authUser) return;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find(
      (m) => m.id === payload.missionId
    );
    if (!mission) return;

    const cur = getMissionEntry(missionStates, payload.missionId);

    // 1. Material stock diff (supports any inventory items used on the mission)
    const prevUsedGear: Record<string, number> = {};
    if (cur.usedGear && typeof cur.usedGear === 'object') {
      Object.entries(cur.usedGear).forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (qty > 0) prevUsedGear[k] = qty;
      });
    }
    if (
      Object.keys(prevUsedGear).length === 0 &&
      cur.gearConsumed &&
      mission.gearKey !== 'none' &&
      INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)
    ) {
      prevUsedGear[mission.gearKey] = 1;
    }

    const nextUsedGear: Record<string, number> = {};
    const inventoryPatch: Record<string, number> = {};
    const nextInventory = { ...inventoryStock };
    const newlyDebitedLabels: string[] = [];
    const newlyDebitedKeys: string[] = [];
    const allGearKeys = new Set([
      ...Object.keys(prevUsedGear),
      ...Object.keys(payload.usedGear || {}),
    ]);

    allGearKeys.forEach((gKey) => {
      const oldQty = Math.max(0, Math.floor(Number(prevUsedGear[gKey]) || 0));
      const wantQty = Math.max(0, Math.floor(Number(payload.usedGear[gKey]) || 0));
      const curStock = Math.max(0, Math.floor(Number(nextInventory[gKey]) || 0));
      const maxAllowed = curStock + oldQty;
      const clampedNext = Math.min(wantQty, maxAllowed);
      if (clampedNext > 0) {
        nextUsedGear[gKey] = clampedNext;
      }
      const diff = clampedNext - oldQty;
      if (diff !== 0) {
        const updatedStockQty = Math.max(0, curStock - diff);
        nextInventory[gKey] = updatedStockQty;
        inventoryPatch[gKey] = updatedStockQty;
        if (diff > 0) {
          const gName = INVENTORY_ITEMS.find((i) => i.key === gKey)?.name || gKey;
          newlyDebitedLabels.push(`-${diff} ${gName}`);
          newlyDebitedKeys.push(gKey);
        }
      }
    });

    const hasInventoryPatch = Object.keys(inventoryPatch).length > 0;
    if (hasInventoryPatch) {
      setInventoryStock(nextInventory);
    }
    const nextGearConsumed = Object.keys(nextUsedGear).length > 0;

    // 2. Loot & Reward stock diff
    const prevLoot = cur.loot || {};
    const nextLoot = payload.status === 'success' ? payload.loot : {};
    const allLootKeys = new Set([...Object.keys(prevLoot), ...Object.keys(nextLoot)]);
    const rewardPatches: Record<string, RewardStockEntry> = {};
    const nextRewards = { ...rewardStocks };
    let lootValTotal = 0;

    allLootKeys.forEach((rKey) => {
      const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
      if (!itemRef) return;
      const oldQty = Math.max(0, Number(prevLoot[rKey]) || 0);
      const newQty = Math.max(0, Number(nextLoot[rKey]) || 0);
      const existing = nextRewards[rKey] || { qty: 0, val: itemRef.defaultVal };
      const unitVal =
        existing.val !== undefined ? Math.max(0, Number(existing.val) || 0) : itemRef.defaultVal;
      lootValTotal += newQty * unitVal;
      const diff = newQty - oldQty;
      if (diff !== 0) {
        const updatedReward: RewardStockEntry = {
          qty: Math.max(0, (Number(existing.qty) || 0) + diff),
          val: unitVal,
        };
        nextRewards[rKey] = updatedReward;
        rewardPatches[rKey] = updatedReward;
      }
    });
    if (Object.keys(rewardPatches).length > 0) {
      setRewardStocks(nextRewards);
    }

    // 3. Weapons stock diff (restore previous lost weapons then deduct new lost weapons)
    const prevLost = Array.isArray(cur.lostWeapons) ? cur.lostWeapons : [];
    const nextLost = payload.lostWeapons;
    const nextWeapons = { ...weaponsStock };
    let weaponsTouched = prevLost.length > 0 || nextLost.length > 0;

    if (weaponsTouched) {
      prevLost.forEach((lw) => {
        if (!lw.id) return;
        const existing = nextWeapons[lw.id];
        if (existing) {
          nextWeapons[lw.id] = {
            ...existing,
            qty: Math.max(1, (Number(existing.qty) || 0) + 1),
          };
        } else {
          nextWeapons[lw.id] = {
            id: lw.id,
            name: lw.name,
            value: Math.max(0, Number(lw.value) || 0),
            qty: 1,
            holderId: lw.holderId || 'coffre',
            notes: '',
          };
        }
      });

      nextLost.forEach((lw) => {
        if (!lw.id) return;
        const existing = nextWeapons[lw.id];
        if (!existing) return;
        if ((Number(existing.qty) || 0) <= 1) {
          delete nextWeapons[lw.id];
        } else {
          nextWeapons[lw.id] = {
            ...existing,
            qty: existing.qty - 1,
          };
        }
      });

      setWeaponsStock(nextWeapons);
    } else {
      weaponsTouched = false;
    }

    // 4. Credit mission dirty cash gain to Argent Sale (illegal) & apply optional treasury cash debit
    let nextLegal = Math.max(0, Number(treasuryMoney.legal) || 0);
    let nextIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
    let legalTouched = false;
    let illegalTouched = false;

    const prevCashGain = Math.max(0, Number(cur.cashGain) || 0);
    const nextCashGain =
      payload.status === 'success' ? Math.max(0, Number(payload.cashGain) || 0) : 0;
    const cashGainDiff = nextCashGain - prevCashGain;
    if (cashGainDiff !== 0) {
      nextIllegal = Math.max(0, nextIllegal + cashGainDiff);
      illegalTouched = true;
    }

    if (payload.treasuryDebitAccount !== 'none' && payload.treasuryDebitAmount > 0) {
      if (payload.treasuryDebitAccount === 'legal') {
        nextLegal = Math.max(0, nextLegal - payload.treasuryDebitAmount);
        legalTouched = true;
      } else {
        nextIllegal = Math.max(0, nextIllegal - payload.treasuryDebitAmount);
        illegalTouched = true;
      }
    }

    let treasuryMoneyPatch: Partial<TreasuryMoney> | undefined;
    if (legalTouched || illegalTouched) {
      treasuryMoneyPatch = {};
      if (legalTouched) treasuryMoneyPatch.legal = nextLegal;
      if (illegalTouched) treasuryMoneyPatch.illegal = nextIllegal;
      setTreasuryMoney((prev) => ({
        ...prev,
        ...(legalTouched ? { legal: nextLegal } : {}),
        ...(illegalTouched ? { illegal: nextIllegal } : {}),
      }));
    }

    const weaponsLossVal = nextLost.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
    const nextGain = payload.status === 'success' ? lootValTotal + nextCashGain : 0;
    const nextExtra = weaponsLossVal + Math.max(0, payload.cashLoss);

    const updatedEntry: MissionStateEntry = {
      ...cur,
      status: payload.status,
      completed: true,
      gain: nextGain,
      cashGain: nextCashGain,
      extra: nextExtra,
      players: payload.players,
      gearConsumed: nextGearConsumed,
      usedGear: nextUsedGear,
      loot: nextLoot,
      lostWeapons: nextLost,
    };

    setMissionStates((prev) => ({ ...prev, [payload.missionId]: updatedEntry }));
    setValidatingMission(null);

    const hasSideEffects =
      hasInventoryPatch ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched ||
      Boolean(treasuryMoneyPatch);

    if (hasSideEffects) {
      void saveMissionWithSideEffects(authUser.uid, payload.missionId, updatedEntry, {
        inventoryPatch: hasInventoryPatch ? inventoryPatch : undefined,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
        treasuryMoneyPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, payload.missionId, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    const gearSummary =
      newlyDebitedLabels.length > 0 ? ` · Stock débité : ${newlyDebitedLabels.join(', ')}` : '';
    const cashSummary =
      cashGainDiff > 0
        ? ` · Argent Sale : +${formatMoney(cashGainDiff)}`
        : cashGainDiff < 0
          ? ` · Argent Sale : -${formatMoney(Math.abs(cashGainDiff))}`
          : '';

    const stockAlert = buildValidationStockAlert({
      debitedKeys: newlyDebitedKeys,
      missionGearKey: mission.gearKey,
      nextInventory,
    });

    if (stockAlert) {
      showToast(
        `${stockAlert.message} · Mission "${mission.name}" validée${cashSummary}`,
        {
          variant: stockAlert.variant,
          withStockShortcut: true,
        }
      );
    } else {
      showToast(
        `Mission "${mission.name}" validée (${payload.status === 'success' ? 'Réussie' : 'Échouée'})${gearSummary}${cashSummary} !`
      );
    }
  };

  const handleResetMissionFromModal = (missionId: string) => {
    const cur = getMissionEntry(missionStates, missionId);
    const currentStatus = getStatus(cur);
    if (currentStatus) {
      handleSetMissionStatus(missionId, currentStatus);
    }
  };

  const bulkToggleMissions = (missions: Mission[]): boolean => {
    if (!authUser) return false;
    const allDone = missions.every((m) => getStatus(getMissionEntry(missionStates, m.id)) !== '');
    const week = missionStates.__week || isoDate(currentWeekStart());
    const nextStates: MissionStates = { ...missionStates, __week: week };
    const nextInventory = { ...inventoryStock };
    const inventoryPatch: Record<string, number> = {};
    const nextRewards = { ...rewardStocks };
    const rewardPatches: Record<string, RewardStockEntry> = {};
    const nextWeapons = { ...weaponsStock };
    let weaponsTouched = false;
    let illegalCashRollback = 0;

    missions.forEach((m) => {
      const cur = getMissionEntry(missionStates, m.id);
      const prevStatus = getStatus(cur);
      const status: MissionStatus = allDone ? '' : prevStatus || 'success';

      let nextGearConsumed = Boolean(cur.gearConsumed);
      let nextUsedGear: Record<string, number> =
        cur.usedGear && typeof cur.usedGear === 'object' ? { ...cur.usedGear } : {};
      if (
        Object.keys(nextUsedGear).length === 0 &&
        cur.gearConsumed &&
        m.gearKey !== 'none' &&
        INVENTORY_ITEMS.some((i) => i.key === m.gearKey)
      ) {
        nextUsedGear[m.gearKey] = 1;
      }

      if (prevStatus === '' && status !== '' && m.gearKey !== 'none') {
        const curQty = nextInventory[m.gearKey] || 0;
        if (curQty > 0) {
          nextInventory[m.gearKey] = curQty - 1;
          inventoryPatch[m.gearKey] = curQty - 1;
          nextGearConsumed = true;
          nextUsedGear = { ...nextUsedGear, [m.gearKey]: (nextUsedGear[m.gearKey] || 0) + 1 };
        }
      } else if (prevStatus !== '' && status === '') {
        const keys = Object.keys(nextUsedGear);
        if (keys.length > 0) {
          keys.forEach((gKey) => {
            const count = Math.max(0, Number(nextUsedGear[gKey]) || 0);
            if (count <= 0) return;
            const updatedQty = (nextInventory[gKey] || 0) + count;
            nextInventory[gKey] = updatedQty;
            inventoryPatch[gKey] = updatedQty;
          });
          nextUsedGear = {};
          nextGearConsumed = false;
        } else if (cur.gearConsumed && m.gearKey !== 'none') {
          const updatedQty = (nextInventory[m.gearKey] || 0) + 1;
          nextInventory[m.gearKey] = updatedQty;
          inventoryPatch[m.gearKey] = updatedQty;
          nextGearConsumed = false;
        }
      }

      let nextGain = Number(cur.gain) || 0;
      let nextCashGain = Math.max(0, Number(cur.cashGain) || 0);
      let nextLoot = cur.loot ? { ...cur.loot } : {};
      if (prevStatus === 'success' && status !== 'success') {
        if (Object.keys(nextLoot).length > 0) {
          Object.entries(nextLoot).forEach(([rKey, lQty]) => {
            const count = Math.max(0, Number(lQty) || 0);
            if (count <= 0) return;
            const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
            const existing = nextRewards[rKey] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
            const unitVal = existing.val !== undefined ? Number(existing.val) : itemRef ? itemRef.defaultVal : 200;
            const updatedEntry: RewardStockEntry = {
              qty: Math.max(0, (Number(existing.qty) || 0) - count),
              val: unitVal,
            };
            nextRewards[rKey] = updatedEntry;
            rewardPatches[rKey] = updatedEntry;
            nextGain = Math.max(0, nextGain - count * unitVal);
          });
          nextLoot = {};
        }
        if (nextCashGain > 0) {
          illegalCashRollback += nextCashGain;
          nextGain = Math.max(0, nextGain - nextCashGain);
          nextCashGain = 0;
        }
      }

      let nextExtra = Number(cur.extra) || 0;
      let nextLostWeapons: LostWeaponRecord[] = Array.isArray(cur.lostWeapons)
        ? [...cur.lostWeapons]
        : [];
      if (prevStatus !== '' && status === '' && nextLostWeapons.length > 0) {
        nextLostWeapons.forEach((lw) => {
          nextExtra = Math.max(0, nextExtra - (Number(lw.value) || 0));
          const existing = nextWeapons[lw.id];
          if (existing) {
            nextWeapons[lw.id] = {
              ...existing,
              qty: Math.max(1, (Number(existing.qty) || 0) + 1),
            };
          } else if (lw.id) {
            nextWeapons[lw.id] = {
              id: lw.id,
              name: lw.name,
              value: Math.max(0, Number(lw.value) || 0),
              qty: 1,
              holderId: lw.holderId || 'coffre',
              notes: '',
            };
          }
          weaponsTouched = true;
        });
        nextLostWeapons = [];
      }

      nextStates[m.id] = {
        ...cur,
        status,
        completed: status !== '',
        gain: nextGain,
        cashGain: nextCashGain,
        extra: nextExtra,
        players: Array.isArray(cur.players) ? cur.players : [],
        gearConsumed: nextGearConsumed,
        usedGear: nextUsedGear,
        loot: nextLoot,
        lostWeapons: nextLostWeapons,
      };
    });

    if (Object.keys(inventoryPatch).length > 0) setInventoryStock(nextInventory);
    if (Object.keys(rewardPatches).length > 0) setRewardStocks(nextRewards);
    if (weaponsTouched) setWeaponsStock(nextWeapons);

    let bulkTreasuryPatch: Partial<TreasuryMoney> | undefined;
    if (illegalCashRollback > 0) {
      const updatedIllegal = Math.max(0, (Number(treasuryMoney.illegal) || 0) - illegalCashRollback);
      bulkTreasuryPatch = { illegal: updatedIllegal };
      setTreasuryMoney((prev) => ({ ...prev, illegal: updatedIllegal }));
    }

    setMissionStates(nextStates);

    const hasSideEffects =
      Object.keys(inventoryPatch).length > 0 ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched ||
      Boolean(bulkTreasuryPatch);

    if (hasSideEffects) {
      void saveAllMissionEntriesWithSideEffects(authUser.uid, week, extractEntriesRecord(nextStates), {
        inventoryPatch: Object.keys(inventoryPatch).length > 0 ? inventoryPatch : undefined,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
        treasuryMoneyPatch: bulkTreasuryPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveAllMissionEntries(authUser.uid, week, extractEntriesRecord(nextStates)).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }
    return allDone;
  };

  const handleToggleWholeDay = (dayName: string) => {
    if (readonly) return;
    const effective = getEffectiveSchedule(missionStates, scheduleMeta);
    const dayObj = effective.days.find((d) => d.day === dayName);
    if (!dayObj) return;
    const cleared = bulkToggleMissions(dayObj.missions);
    showToast(cleared ? `${dayName} remis à zéro` : `Journée de ${dayName} validée !`);
  };

  const handleRecalculateScheduleNow = () => {
    if (readonly || !authUser) return;
    if (isWeekStale(missionStates)) {
      showToast('Démarrez d’abord la nouvelle semaine avant de recalculer le planning.');
      return;
    }
    const now = new Date();
    const targetStartDayName = getCurrentWeekTodayName(missionStates, now) || 'Lundi';
    const res = computeRecalculatedSchedule({
      missionStates,
      currentMeta: scheduleMeta,
      targetStartDayName,
      now,
    });
    autoRecalcAttemptedDateRef.current = res.meta.lastRecalcDate;
    setScheduleMeta(res.meta);
    void saveSchedulePlan(authUser.uid, res.meta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    if (res.movedCount === 0 && res.unplacedCount === 0) {
      showToast('Planning à jour : aucune mission en retard à reporter.');
    } else if (res.unplacedCount > 0) {
      showToast(
        `Planning recalculé : ${res.movedCount} reportée(s), ${res.unplacedCount} hors quota règlement.`
      );
    } else {
      showToast(`Planning recalculé : ${res.movedCount} mission(s) répartie(s) sur la semaine !`);
    }
  };

  const handleResetScheduleOverrides = () => {
    if (readonly || !authUser) return;
    const now = new Date();
    const todayIso = isoDate(now);
    const nextMeta: MissionScheduleMeta = {
      scheduleOverrides: {},
      unplacedMissionIds: [],
      lastRecalcDate: todayIso,
      lastRecalcAt: now.toISOString(),
    };
    autoRecalcAttemptedDateRef.current = todayIso;
    setScheduleMeta(nextMeta);
    void saveSchedulePlan(authUser.uid, nextMeta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast("Planning d'origine restauré !");
  };

  const handleToggleAllWeek = () => {
    if (readonly) return;
    const cleared = bulkToggleMissions(WEEKLY_SCHEDULE.flatMap((d) => d.missions));
    showToast(
      cleared ? 'Toutes les missions remises à zéro' : 'Toute la semaine validée !'
    );
  };

  const handleStartNewWeek = () => {
    if (readonly || !authUser) return;
    const newWeek = isoDate(currentWeekStart());
    autoRecalcAttemptedDateRef.current = '';
    setMissionStates({ __week: newWeek });
    setScheduleMeta(EMPTY_SCHEDULE_META);
    setWeaponsLossAmount(0);
    void Promise.all([
      saveAllMissionEntries(authUser.uid, newWeek, {}, EMPTY_SCHEDULE_META),
      saveWeaponsLoss(authUser.uid, 0),
    ]).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    showToast('Nouvelle semaine démarrée !');
  };

  const handleConfirmResetWeek = () => {
    if (readonly || !authUser) return;
    const newWeek = isoDate(currentWeekStart());
    autoRecalcAttemptedDateRef.current = '';
    setMissionStates({ __week: newWeek });
    setScheduleMeta(EMPTY_SCHEDULE_META);
    setResetModalOpen(false);
    void saveAllMissionEntries(authUser.uid, newWeek, {}, EMPTY_SCHEDULE_META).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Semaine réinitialisée !');
  };

  const handleUpdateStock = (key: string, delta: number) => {
    if (readonly || !authUser) return;
    const nextQty = Math.max(0, (inventoryStock[key] || 0) + delta);
    setInventoryStock((prev) => ({
      ...prev,
      [key]: nextQty,
    }));
    void saveInventoryItem(authUser.uid, key, nextQty).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateItemPrice = (key: string, price: number) => {
    if (readonly || !authUser) return;
    const cleanPrice = Math.max(0, Math.round(Number(price) || 0));
    setInventoryPrices((prev) => ({
      ...prev,
      [key]: cleanPrice,
    }));
    void saveInventoryItemPrice(authUser.uid, key, cleanPrice).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleResetStock = () => {
    if (readonly || !authUser) return;
    setInventoryStock({});
    void resetAllInventory(authUser.uid).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Inventaire remis à zéro !');
  };

  const handleSaveWeapon = (payload: {
    id?: string;
    name: string;
    value: number;
    qty: number;
    holderId: string;
    notes: string;
  }) => {
    if (readonly || !authUser) return;
    const id = payload.id || 'w_' + Date.now().toString(36);
    const nextWeapons: WeaponsStock = {
      ...weaponsStock,
      [id]: {
        id,
        name: payload.name.trim().slice(0, 80),
        value: Math.max(0, Number(payload.value) || 0),
        qty: Math.max(1, Math.floor(Number(payload.qty) || 1)),
        holderId: payload.holderId || 'coffre',
        notes: payload.notes.trim().slice(0, 160),
      },
    };
    setWeaponsStock(nextWeapons);
    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(payload.id ? 'Arme mise à jour.' : 'Arme ajoutée à l’arsenal.');
  };

  const handleUpdateWeaponQty = (id: string, delta: number) => {
    if (readonly || !authUser) return;
    const existing = weaponsStock[id];
    if (!existing) return;
    const nextQty = Math.max(1, Math.floor((Number(existing.qty) || 1) + delta));
    const nextWeapons: WeaponsStock = {
      ...weaponsStock,
      [id]: { ...existing, qty: nextQty },
    };
    setWeaponsStock(nextWeapons);
    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleDeleteWeapon = (id: string) => {
    if (readonly || !authUser) return;
    const nextWeapons = { ...weaponsStock };
    delete nextWeapons[id];
    setWeaponsStock(nextWeapons);
    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Arme retirée de l’arsenal.');
  };

  const handleLoseWeaponGlobal = (weaponId: string) => {
    if (readonly || !authUser) return;
    const weapon = weaponsStock[weaponId];
    if (!weapon || (Number(weapon.qty) || 0) <= 0) return;

    const weaponVal = Math.max(0, Number(weapon.value) || 0);
    const nextWeapons = { ...weaponsStock };
    if (weapon.qty <= 1) {
      delete nextWeapons[weaponId];
    } else {
      nextWeapons[weaponId] = { ...weapon, qty: weapon.qty - 1 };
    }
    const nextLossAmount = Math.max(0, (Number(weaponsLossAmount) || 0) + weaponVal);

    setWeaponsStock(nextWeapons);
    setWeaponsLossAmount(nextLossAmount);
    void saveWeaponLossGlobal(authUser.uid, nextWeapons, nextLossAmount).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `${weapon.name} déclarée perdue (-1 en stock, +${formatMoney(weaponVal)} en pertes globales).`
    );
  };

  const handleReceiveOrder = (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => {
    if (readonly || !authUser) return;
    const stockPatch: Record<string, number> = {};
    const nextStock = { ...inventoryStock };
    let totalAdded = 0;

    Object.entries(orderMap).forEach(([k, qty]) => {
      const addQty = Math.max(0, Math.floor(Number(qty) || 0));
      if (addQty <= 0) return;
      const updated = Math.max(0, Math.floor(Number(nextStock[k]) || 0)) + addQty;
      nextStock[k] = updated;
      stockPatch[k] = updated;
      totalAdded += addQty;
    });

    if (totalAdded <= 0) return;
    setInventoryStock(nextStock);

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (debitAccount !== 'none' && debitAmount > 0) {
      const current = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      const updatedBal = Math.max(0, current - debitAmount);
      treasuryPatch = { [debitAccount]: updatedBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: updatedBal }));
    }

    void saveInventoryOrderReceipt(authUser.uid, stockPatch, treasuryPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const debitMsg =
      debitAccount !== 'none' && debitAmount > 0
        ? ` (-${formatMoney(debitAmount)} ${debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale'})`
        : '';
    showToast(`Commande réceptionnée : +${totalAdded} pièce${totalAdded > 1 ? 's' : ''} ajoutée${totalAdded > 1 ? 's' : ''} au stock${debitMsg} !`);
  };

  const handleUpdateTreasuryMoney = (type: keyof TreasuryMoney, val: number) => {
    if (readonly || !authUser) return;
    const cleanVal = Math.max(0, Number(val) || 0);
    setTreasuryMoney((prev) => ({
      ...prev,
      [type]: cleanVal,
    }));
    void saveTreasuryMoneyField(authUser.uid, type, cleanVal).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateRewardQty = (key: string, delta: number) => {
    if (readonly || !authUser) return;
    const itemRef = REWARD_ITEMS.find((i) => i.key === key);
    const existing = rewardStocks[key] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
    const nextEntry = {
      ...existing,
      qty: Math.max(0, (Number(existing.qty) || 0) + delta),
    };
    setRewardStocks((prev) => ({
      ...prev,
      [key]: nextEntry,
    }));
    void saveRewardItem(authUser.uid, key, nextEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateRewardValue = (key: string, val: number) => {
    if (readonly || !authUser) return;
    const itemRef = REWARD_ITEMS.find((i) => i.key === key);
    const existing = rewardStocks[key] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
    const nextEntry = {
      ...existing,
      val: Math.max(0, val),
    };
    setRewardStocks((prev) => ({
      ...prev,
      [key]: nextEntry,
    }));
    void saveRewardItem(authUser.uid, key, nextEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleApplyOfficialRewardPrices = () => {
    if (readonly || !authUser) return;
    const patch: Record<string, RewardStockEntry> = {};
    REWARD_ITEMS.forEach((item) => {
      const existing = rewardStocks[item.key];
      patch[item.key] = {
        qty: Math.max(0, Number(existing?.qty) || 0),
        val: item.defaultVal,
      };
    });
    setRewardStocks((prev) => ({
      ...prev,
      ...patch,
    }));
    void saveRewardPricesBatch(authUser.uid, patch)
      .then(() => {
        showToast('Tarifs officiels du receleur mis à jour !');
      })
      .catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
  };

  const handleUpdateWeaponsLoss = (val: number) => {
    if (readonly || !authUser) return;
    const cleanVal = Math.max(0, Number(val) || 0);
    setWeaponsLossAmount(cleanVal);
    void saveWeaponsLoss(authUser.uid, cleanVal).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleSaveHierarchyMember = (payload: {
    id?: string;
    name: string;
    unit: HierarchyUnitKey;
    dossier: string;
  }) => {
    if (readonly || !authUser) return;
    const nextMembers = payload.id
      ? hierMembers.map((m) =>
          m.id === payload.id
            ? { ...m, name: payload.name, unit: payload.unit, dossier: payload.dossier }
            : m
        )
      : [
          ...hierMembers,
          {
            id: 'm' + Date.now().toString(36),
            name: payload.name,
            unit: payload.unit,
            order: Math.max(0, ...hierMembers.map((m) => m.order || 0)) + 1,
            dossier: payload.dossier,
          },
        ];
    setHierMembers(nextMembers);
    void saveHierarchyMembers(authUser.uid, nextMembers).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(payload.id ? 'Membre modifié.' : 'Membre ajouté.');
  };

  const handleDeleteHierarchyMember = (id: string) => {
    if (readonly || !authUser) return;
    const nextMembers = hierMembers.filter((m) => m.id !== id);
    setHierMembers(nextMembers);
    void saveHierarchyMembers(authUser.uid, nextMembers).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Membre supprimé.');
  };

  const handleUpdateMemberRankings = (nextRankings: MemberRankingsMap) => {
    if (readonly || !authUser) return;
    setMemberRankings(nextRankings);
    void saveMemberRankings(authUser.uid, nextRankings).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleVerifySecretCode = async (code: string): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const ok = await unlockEditorWithCode(authUser, code);
      if (ok) {
        setMemberRole('editor');
        setAuthModalOpen(false);
        showToast('Mode Éditeur déverrouillé !');
        return true;
      }
      showToast('Code secret incorrect.');
      return false;
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };

  const handleLockEditMode = async () => {
    if (!authUser) return;
    try {
      await lockEditorRole(authUser);
      setMemberRole('viewer');
      setAuthModalOpen(false);
      showToast('Session verrouillée en lecture seule.');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdateSecretCode = async (newCode: string) => {
    if (readonly || !authUser) return;
    const trimmed = newCode.trim();
    if (trimmed.length < 4) {
      showToast('Le code doit contenir au moins 4 caractères.');
      return;
    }
    try {
      await updateCartelSecretCode(authUser.uid, trimmed);
      showToast('Nouveau code secret enregistré !');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCopyReport = async () => {
    const discordText = buildDiscordReport({
      missionStates,
      scheduleMeta,
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      inventoryPrices,
      weaponsStock,
      weaponsLossAmount,
      hierMembers,
    });
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(discordText);
        showToast('Bilan comptable copié dans le presse-papiers !');
        return;
      }
    } catch {
      // Fallback below
    }

    const textarea = document.createElement('textarea');
    textarea.value = discordText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Bilan comptable copié dans le presse-papiers !');
    } catch {
      showToast('Erreur de copie.');
    }
    document.body.removeChild(textarea);
  };

  const tabBtnClass = (tab: TabKey) =>
    currentTab === tab
      ? 'px-3 py-2 rounded-lg text-xs font-bold bg-charcoal text-gold-light border-b-2 border-crimson border-t border-x border-t-gold/30 border-x-gold/30 transition flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0'
      : 'px-3 py-2 rounded-lg text-xs font-semibold bg-charcoal/70 hover:bg-charcoal text-zinc-300 hover:text-white border border-bronze/40 hover:border-gold/50 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0';

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/90 gold-border rounded-2xl px-8 py-6 text-center space-y-3 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-xl bg-obsidian border-2 border-gold/80 overflow-hidden">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-display text-sm font-bold tracking-wider text-gold">
            CONNEXION À LOS CERBEROS...
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/95 gold-border rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-obsidian border-2 border-gold/80 overflow-hidden shadow-xl shadow-crimson/30">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-[0.3em] text-red-500 uppercase block">
              GTA RP • Cartel Paramilitaire
            </span>
            <h1 className="font-display text-2xl font-extrabold tracking-wider text-white">
              LOS CERBEROS
            </h1>
            <p className="text-gold text-xs font-bold tracking-widest">
              JURAMENTADOS POR LA SANGRE
            </p>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Connectez-vous avec votre compte Google pour accéder au semainier, à l&apos;inventaire, à la trésorerie et à la comptabilité synchronisés en temps réel avec tout le cartel.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-5 rounded-xl text-sm font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Se connecter avec Google
          </button>
          {authError && (
            <div className="rounded-xl bg-red-950/60 border border-red-500/40 px-3.5 py-2.5 text-left text-xs text-red-200 leading-relaxed">
              {authError}
            </div>
          )}
          <Toast message={toastState?.message ?? null} />
        </div>
      </div>
    );
  }

  if (cartelStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/90 gold-border rounded-2xl px-8 py-6 text-center space-y-3 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-xl bg-obsidian border-2 border-gold/80 overflow-hidden">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-display text-sm font-bold tracking-wider text-gold">
            SYNCHRONISATION EN TEMPS RÉEL...
          </p>
        </div>
      </div>
    );
  }

  if (cartelStatus === 'uninitialized') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/95 gold-border rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-5">
          <h2 className="font-display text-xl font-bold text-gold">
            Espace en attente d&apos;initialisation
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            L&apos;espace partagé du cartel n&apos;a pas encore été initialisé par le responsable. Demandez-lui d&apos;ouvrir l&apos;application une première fois avec son compte, puis cliquez sur Réessayer.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {/* EN-TÊTE & DASHBOARD GLOBAL */}
      <header className="sticky top-0 z-40 bg-obsidian/95 backdrop-blur-md border-b border-crimson/70 shadow-2xl">
        <div className="border-b border-bronze/35 bg-charcoal/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3 text-[10px] tracking-[0.26em] uppercase">
            <span className="text-gold-light/90 font-semibold truncate">
              Traicionados por el Estado · Juramentados por la Sangre
            </span>
            <span className="hidden sm:inline text-zinc-400 font-semibold whitespace-nowrap">
              Discipline · Loyauté · Respect · Fraternité
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
            {/* Logo & Titre Cartel GTA RP */}
            <div className="flex items-center gap-3.5">
              <div className="relative w-14 h-14 rounded-xl bg-charcoal border-2 border-gold/80 flex items-center justify-center shadow-xl shadow-crimson/35 shrink-0 overflow-hidden group">
                <img
                  src="/assets/emblem.webp"
                  alt="Emblème Los Cerberos"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-bold tracking-[0.28em] text-crimson-light uppercase">
                    Organisation Paramilitaire · GTA RP
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className={
                      isUnlocked
                        ? 'text-[11px] font-bold text-gold-light hover:text-gold underline underline-offset-4 transition cursor-pointer whitespace-nowrap'
                        : 'text-[11px] font-semibold text-zinc-400 hover:text-gold-light underline underline-offset-4 transition cursor-pointer whitespace-nowrap'
                    }
                  >
                    {isUnlocked ? '👑 Éditeur Actif' : '🔒 Lecture Seule (Déverrouiller)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    title={`Connecté en tant que ${authUser.displayName || authUser.email}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3 h-3" />
                    Déconnexion
                  </button>
                </div>
                <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-wider text-white mt-0.5">
                  LOS CERBEROS{' '}
                  <span className="text-crimson font-normal">—</span>{' '}
                  <span className="text-gold text-sm sm:text-base font-bold">
                    GESTION CARTEL
                  </span>
                </h1>
              </div>
            </div>

            {/* Actions globales (Onglets) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentTab('planning')}
                className={tabBtnClass('planning')}
              >
                <Calendar className="w-3.5 h-3.5" />
                Planning
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('inventory')}
                className={tabBtnClass('inventory')}
              >
                <Package className="w-3.5 h-3.5" />
                Inventaire
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('treasury')}
                className={tabBtnClass('treasury')}
              >
                <Wallet className="w-3.5 h-3.5" />
                Trésorerie
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('accounting')}
                className={tabBtnClass('accounting')}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Comptabilité
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('ranking')}
                className={tabBtnClass('ranking')}
              >
                <Trophy className="w-3.5 h-3.5" />
                Classement
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('hierarchy')}
                className={tabBtnClass('hierarchy')}
              >
                <Users className="w-3.5 h-3.5" />
                Hiérarchie
              </button>
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center gap-1.5 shadow-md shadow-gold/10 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copier Bilan
              </button>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-crimson-dark/60 hover:bg-crimson text-red-100 border border-crimson-light/50 transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* KPIs / COMPTEURS EN TEMPS RÉEL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3.5">
            <div className="bg-charcoal/95 bronze-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Missions Réussies
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-display text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {kpis.successCount} / {TOTAL_WEEKLY_MISSIONS}
                </span>
                <span className="text-[10px] text-crimson-light font-mono tabular-nums">
                  ❌ {kpis.failCount} échec{kpis.failCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="bg-charcoal/95 gold-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Trésorerie &amp; Actifs Totaux
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-display text-lg sm:text-xl font-extrabold text-gold tabular-nums">
                  {formatMoney(kpis.totalWealth)}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Coffre Cartel</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentTab('treasury')}
              title="Voir le détail des objets à vendre dans la Trésorerie"
              className="bg-charcoal/95 border border-gold/45 hover:border-gold rounded-xl p-3 flex flex-col justify-between text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase tracking-wider text-gold-light font-semibold">
                💎 Objets à Vendre (Recel)
              </span>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="font-display text-lg sm:text-xl font-extrabold text-gold tabular-nums">
                  {formatMoney(kpis.rewardsValTotal)}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                  {kpis.rewardsItemCount} objet{kpis.rewardsItemCount > 1 ? 's' : ''}
                </span>
              </div>
            </button>

            <div className="bg-charcoal/95 bronze-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Gains Bruts Encaissés
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-display text-lg sm:text-xl font-extrabold text-emerald-400 tabular-nums">
                  {formatMoney(kpis.grossGains)}
                </span>
                <span className="text-[10px] text-emerald-500/80 font-mono">Butin total</span>
              </div>
            </div>

            <div className="bg-charcoal/95 bronze-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Bénéfice Net du Cartel
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span
                  className={`font-display text-lg sm:text-xl font-extrabold mt-0.5 truncate tabular-nums ${
                    kpis.netProfit > 0
                      ? 'text-emerald-400'
                      : kpis.netProfit < 0
                        ? 'text-crimson-light'
                        : 'text-white'
                  }`}
                >
                  {formatMoney(kpis.netProfit)}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Gains - Mat. - Pertes
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* BANNIÈRE SEMAINE */}
        {staleWeek ? (
          <div className="bg-gold/10 border border-gold/45 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-gold-light text-xs">
            <span>
              ⚠️ Les données affichées sont celles de la{' '}
              <strong>semaine {weekRangeText(missionStates)}</strong>. Une nouvelle semaine a commencé (aujourd&apos;hui : {todayText}). Pense à <strong>Copier Bilan</strong> avant de passer à la suite.
            </span>
            {readonly ? (
              <span className="italic text-gold-light/80">
                Un membre autorisé doit démarrer la nouvelle semaine.
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStartNewWeek}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shrink-0 cursor-pointer"
              >
                Démarrer la nouvelle semaine
              </button>
            )}
          </div>
        ) : (
          <div className="bg-charcoal/95 gold-border rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <span className="text-zinc-300">
              📅 <strong className="text-gold">Semaine {weekRangeText(missionStates)}</strong>
            </span>
            <span className="text-zinc-400 capitalize">Aujourd&apos;hui : {todayText}</span>
          </div>
        )}

        {/* BANNIÈRE AVERTISSEMENT LECTURE SEULE */}
        {readonly && (
          <div className="bg-gold/10 border border-gold/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-gold-light text-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-gold shrink-0" />
              <span>
                <strong>Accès Consultation (Lecture Seule) :</strong> Tout le cartel voit le planning et la comptabilité en temps réel. Seuls les membres autorisés avec le code secret peuvent modifier.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-1.5 bg-gold hover:bg-gold-light text-obsidian font-bold rounded-lg transition whitespace-nowrap shadow-sm cursor-pointer"
            >
              🔑 Déverrouiller l&apos;édition
            </button>
          </div>
        )}

        {currentTab === 'planning' && (
          <PlanningView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            members={hierMembers}
            readonly={readonly}
            onOpenMissionValidation={handleOpenMissionValidation}
            onResetMission={handleResetMissionFromModal}
            onToggleWholeDay={handleToggleWholeDay}
            onToggleAllWeek={handleToggleAllWeek}
            onRecalculateSchedule={handleRecalculateScheduleNow}
            onResetScheduleOverrides={handleResetScheduleOverrides}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryView
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            treasuryMoney={treasuryMoney}
            members={hierMembers}
            readonly={readonly}
            onUpdateStock={handleUpdateStock}
            onUpdateItemPrice={handleUpdateItemPrice}
            onResetStock={handleResetStock}
            onReceiveOrder={handleReceiveOrder}
            onSaveWeapon={handleSaveWeapon}
            onUpdateWeaponQty={handleUpdateWeaponQty}
            onDeleteWeapon={handleDeleteWeapon}
            onLoseWeaponGlobal={handleLoseWeaponGlobal}
            onUpdateRewardQty={handleUpdateRewardQty}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'treasury' && (
          <TreasuryView
            treasuryMoney={treasuryMoney}
            rewardStocks={rewardStocks}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            missionStates={missionStates}
            weaponsLossAmount={weaponsLossAmount}
            members={hierMembers}
            readonly={readonly}
            onUpdateTreasuryMoney={handleUpdateTreasuryMoney}
            onUpdateRewardQty={handleUpdateRewardQty}
            onUpdateRewardValue={handleUpdateRewardValue}
            onApplyOfficialRewardPrices={handleApplyOfficialRewardPrices}
          />
        )}

        {currentTab === 'accounting' && (
          <AccountingView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            members={hierMembers}
            weaponsStock={weaponsStock}
            weaponsLossAmount={weaponsLossAmount}
            inventoryPrices={inventoryPrices}
            readonly={readonly}
            onUpdateWeaponsLoss={handleUpdateWeaponsLoss}
            onLoseWeaponGlobal={handleLoseWeaponGlobal}
          />
        )}

        {currentTab === 'ranking' && (
          <RankingView
            members={hierMembers}
            missionStates={missionStates}
            weaponsStock={weaponsStock}
            memberRankings={memberRankings}
            inventoryPrices={inventoryPrices}
            readonly={readonly}
            onUpdateMemberRankings={handleUpdateMemberRankings}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'hierarchy' && (
          <HierarchyView
            members={hierMembers}
            readonly={readonly}
            onSaveMember={handleSaveHierarchyMember}
            onDeleteMember={handleDeleteHierarchyMember}
            onShowToast={showToast}
          />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 border-t border-bronze/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] tracking-[0.24em] uppercase text-zinc-500">
        <span className="text-gold/80 font-semibold">
          TRAICIONADOS POR EL ESTADO, JURAMENTADOS POR LA SANGRE
        </span>
        <span>LOS CERBEROS · GTA RP</span>
      </footer>

      <AuthModal
        open={authModalOpen}
        isUnlocked={isUnlocked}
        onClose={() => setAuthModalOpen(false)}
        onVerifyCode={handleVerifySecretCode}
        onLock={handleLockEditMode}
        onUpdateSecretCode={handleUpdateSecretCode}
      />

      <ResetModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmResetWeek}
      />

      <MissionValidationModal
        open={Boolean(validatingMission)}
        mission={validatingMission?.mission || null}
        dayName={validatingMission?.dayName || ''}
        initialStatus={validatingMission?.initialStatus}
        entry={
          validatingMission
            ? getMissionEntry(missionStates, validatingMission.mission.id)
            : {}
        }
        inventoryStock={inventoryStock}
        inventoryPrices={inventoryPrices}
        weaponsStock={weaponsStock}
        rewardStocks={rewardStocks}
        treasuryMoney={treasuryMoney}
        members={hierMembers}
        onClose={() => setValidatingMission(null)}
        onConfirm={handleConfirmMissionValidation}
        onResetMission={handleResetMissionFromModal}
      />

      <Toast
        message={toastState?.message ?? null}
        variant={toastState?.variant}
        actionLabel={toastState?.withStockShortcut ? 'Voir stock' : undefined}
        onAction={toastState?.withStockShortcut ? handleGoToOrderPrep : undefined}
        onDismiss={() => setToastState(null)}
      />
    </div>
  );
}
