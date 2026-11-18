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
import { ResetModal } from '@/src/components/ResetModal';
import { Toast } from '@/src/components/Toast';
import { TreasuryView } from '@/src/components/TreasuryView';
import {
  DEFAULT_SECRET_CODE,
  HIER_DEFAULTS,
  INVENTORY_ITEMS,
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
  saveMissionEntry,
  saveMissionWithSideEffects,
  saveRewardItem,
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
  InventoryStock,
  LostWeaponRecord,
  Mission,
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
  calcTotalWealth,
  currentWeekStart,
  formatMoney,
  getMissionEntry,
  getStatus,
  getWeaponHolderName,
  isoDate,
  isWeekStale,
  missionFin,
  weekRangeText,
} from '@/src/utils/finance';

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
  const [inventoryStock, setInventoryStock] = useState<InventoryStock>({});
  const [weaponsStock, setWeaponsStock] = useState<WeaponsStock>({});
  const [treasuryMoney, setTreasuryMoney] = useState<TreasuryMoney>({
    legal: 0,
    illegal: 0,
  });
  const [rewardStocks, setRewardStocks] = useState<RewardStocks>({});
  const [weaponsLossAmount, setWeaponsLossAmount] = useState<number>(0);
  const [hierMembers, setHierMembers] = useState<HierarchyMember[]>(HIER_DEFAULTS);

  const [currentTab, setCurrentTab] = useState<TabKey>('planning');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [validatingMission, setValidatingMission] = useState<{
    mission: Mission;
    dayName: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setDayTick] = useState(() => isoDate(new Date()));
  const toastTimerRef = useRef<number | null>(null);

  if (syncError) {
    throw syncError;
  }

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

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
          onInventory: (stock) => setInventoryStock(stock),
          onWeapons: (weapons) => setWeaponsStock(weapons),
          onTreasury: (data) => {
            setTreasuryMoney(data.treasuryMoney);
            setRewardStocks(data.rewardStocks);
            setWeaponsLossAmount(data.weaponsLossAmount);
          },
          onHierarchy: (members) => setHierMembers(members),
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

  const isUnlocked = memberRole === 'editor';
  const readonly = !isUnlocked;

  const kpis = useMemo(() => {
    let totalCost = 0;
    let extraLoss = 0;
    let grossGains = 0;
    let successCount = 0;
    let failCount = 0;

    WEEKLY_SCHEDULE.forEach((day) => {
      day.missions.forEach((mission) => {
        const f = missionFin(mission, missionStates);
        if (f.success) successCount++;
        if (f.fail) failCount++;
        totalCost += f.cost;
        extraLoss += f.extra;
        grossGains += f.gain;
      });
    });

    const netProfit = grossGains - (totalCost + extraLoss + weaponsLossAmount);

    const totalWealth = calcTotalWealth({
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      weaponsStock,
    });

    return {
      successCount,
      failCount,
      grossGains,
      netProfit,
      totalWealth,
    };
  }, [missionStates, weaponsLossAmount, rewardStocks, treasuryMoney, inventoryStock, weaponsStock]);

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
    let inventoryPatch: Record<string, number> | undefined;
    if (mission && mission.gearKey !== 'none') {
      if (prevStatus === '' && next !== '') {
        const currentQty = inventoryStock[mission.gearKey] || 0;
        if (currentQty > 0) {
          const updatedQty = currentQty - 1;
          inventoryPatch = { [mission.gearKey]: updatedQty };
          nextGearConsumed = true;
          setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
        }
      } else if (prevStatus !== '' && next === '' && cur.gearConsumed) {
        const updatedQty = (inventoryStock[mission.gearKey] || 0) + 1;
        inventoryPatch = { [mission.gearKey]: updatedQty };
        nextGearConsumed = false;
        setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
      }
    }

    let nextGain = Number(cur.gain) || 0;
    let nextLoot = cur.loot ? { ...cur.loot } : {};
    let rewardPatches: Record<string, RewardStockEntry> | undefined;
    if (prevStatus === 'success' && next !== 'success' && Object.keys(nextLoot).length > 0) {
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
      extra: nextExtra,
      players: Array.isArray(cur.players) ? cur.players : [],
      gearConsumed: nextGearConsumed,
      loot: nextLoot,
      lostWeapons: nextLostWeapons,
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));

    if (inventoryPatch || rewardPatches || nextWeaponsArg !== undefined) {
      void saveMissionWithSideEffects(authUser.uid, id, updatedEntry, {
        inventoryPatch,
        rewardPatches,
        weapons: nextWeaponsArg,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    if (prevStatus === '' && next !== '' && mission && INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)) {
      const invItem = INVENTORY_ITEMS.find((i) => i.key === mission.gearKey);
      if (inventoryPatch) {
        showToast(
          `Mission validée — 1× ${invItem?.name || 'matériel'} débité de l'inventaire (-${formatMoney(mission.cost)}).`
        );
      } else {
        showToast(`Mission validée (stock ${invItem?.name || 'matériel'} déjà à 0).`);
      }
    } else if (prevStatus !== '' && next === '' && inventoryPatch) {
      showToast('Mission annulée — matériel remis en inventaire (+1).');
    }
  };

  const handleUpdateMissionGain = (id: string, value: number) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, id);
    const status = getStatus(cur) || 'success';
    const updatedEntry: MissionStateEntry = {
      ...cur,
      status,
      completed: true,
      gain: value,
      extra: Number(cur.extra) || 0,
      players: Array.isArray(cur.players) ? cur.players : [],
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));
    void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateMissionExtra = (id: string, value: number) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, id);
    const status = getStatus(cur);
    const updatedEntry: MissionStateEntry = {
      ...cur,
      status,
      completed: status !== '',
      gain: Number(cur.gain) || 0,
      extra: value,
      players: Array.isArray(cur.players) ? cur.players : [],
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));
    void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleToggleMissionPlayer = (id: string, playerId: string) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, id);
    const currentPlayers = Array.isArray(cur.players) ? cur.players : [];
    const nextPlayers = currentPlayers.includes(playerId)
      ? currentPlayers.filter((p) => p !== playerId)
      : [...currentPlayers, playerId];
    const status = getStatus(cur);
    const updatedEntry: MissionStateEntry = {
      ...cur,
      status,
      completed: status !== '',
      gain: Number(cur.gain) || 0,
      extra: Number(cur.extra) || 0,
      players: nextPlayers,
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));
    void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleAdjustMissionLoot = (
    missionId: string,
    rewardKey: string,
    delta: number
  ) => {
    if (readonly || !authUser) return;
    const itemRef = REWARD_ITEMS.find((i) => i.key === rewardKey);
    if (!itemRef) return;
    const cur = getMissionEntry(missionStates, missionId);
    const currentLoot = { ...(cur.loot || {}) };
    const curLootQty = Math.max(0, Number(currentLoot[rewardKey]) || 0);
    const nextLootQty = Math.max(0, curLootQty + delta);
    const actualDelta = nextLootQty - curLootQty;
    if (actualDelta === 0) return;

    if (nextLootQty === 0) delete currentLoot[rewardKey];
    else currentLoot[rewardKey] = nextLootQty;

    const existingReward = rewardStocks[rewardKey] || {
      qty: 0,
      val: itemRef.defaultVal,
    };
    const unitVal =
      existingReward.val !== undefined
        ? Math.max(0, Number(existingReward.val) || 0)
        : itemRef.defaultVal;
    const nextRewardEntry: RewardStockEntry = {
      qty: Math.max(0, (Number(existingReward.qty) || 0) + actualDelta),
      val: unitVal,
    };

    const nextGain = Math.max(0, (Number(cur.gain) || 0) + actualDelta * unitVal);
    const status = getStatus(cur) || 'success';
    const updatedEntry: MissionStateEntry = {
      ...cur,
      status,
      completed: true,
      gain: nextGain,
      loot: currentLoot,
    };

    setMissionStates((prev) => ({ ...prev, [missionId]: updatedEntry }));
    setRewardStocks((prev) => ({ ...prev, [rewardKey]: nextRewardEntry }));
    void saveMissionWithSideEffects(authUser.uid, missionId, updatedEntry, {
      rewardPatches: { [rewardKey]: nextRewardEntry },
    }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
  };

  const handleDeclareMissionWeaponLoss = (missionId: string, weaponId: string) => {
    if (readonly || !authUser) return;
    const weapon = weaponsStock[weaponId];
    if (!weapon || (Number(weapon.qty) || 0) <= 0) return;

    const cur = getMissionEntry(missionStates, missionId);
    const holderName = getWeaponHolderName(weapon.holderId, hierMembers);
    const weaponVal = Math.max(0, Number(weapon.value) || 0);
    const nextWeapons = { ...weaponsStock };
    if (weapon.qty <= 1) {
      delete nextWeapons[weaponId];
    } else {
      nextWeapons[weaponId] = { ...weapon, qty: weapon.qty - 1 };
    }

    const lostRecord: LostWeaponRecord = {
      id: weapon.id,
      name: weapon.name,
      value: weaponVal,
      holderId: weapon.holderId || 'coffre',
      holderName,
    };
    const nextLost = [...(Array.isArray(cur.lostWeapons) ? cur.lostWeapons : []), lostRecord];
    const nextExtra = Math.max(0, (Number(cur.extra) || 0) + weaponVal);
    const status = getStatus(cur) || 'fail';
    const updatedEntry: MissionStateEntry = {
      ...cur,
      status,
      completed: true,
      extra: nextExtra,
      lostWeapons: nextLost,
    };

    setWeaponsStock(nextWeapons);
    setMissionStates((prev) => ({ ...prev, [missionId]: updatedEntry }));
    void saveMissionWithSideEffects(authUser.uid, missionId, updatedEntry, {
      weapons: nextWeapons,
    }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    showToast(`${weapon.name} déclarée perdue (-1 en stock, +${formatMoney(weaponVal)}).`);
  };

  const handleRevertMissionWeaponLoss = (missionId: string, lostIndex: number) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, missionId);
    const curLost = Array.isArray(cur.lostWeapons) ? cur.lostWeapons : [];
    const target = curLost[lostIndex];
    if (!target) return;

    const nextLost = curLost.filter((_, idx) => idx !== lostIndex);
    const nextExtra = Math.max(0, (Number(cur.extra) || 0) - (Number(target.value) || 0));
    const nextWeapons = { ...weaponsStock };
    const wId = target.id || 'w_' + Date.now().toString(36);
    if (nextWeapons[wId]) {
      nextWeapons[wId] = {
        ...nextWeapons[wId],
        qty: Math.max(1, (Number(nextWeapons[wId].qty) || 0) + 1),
      };
    } else {
      nextWeapons[wId] = {
        id: wId,
        name: target.name,
        value: Math.max(0, Number(target.value) || 0),
        qty: 1,
        holderId: target.holderId || 'coffre',
        notes: '',
      };
    }

    const updatedEntry: MissionStateEntry = {
      ...cur,
      extra: nextExtra,
      lostWeapons: nextLost,
    };
    setWeaponsStock(nextWeapons);
    setMissionStates((prev) => ({ ...prev, [missionId]: updatedEntry }));
    void saveMissionWithSideEffects(authUser.uid, missionId, updatedEntry, {
      weapons: nextWeapons,
    }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    showToast(`Perte annulée : ${target.name} remise en inventaire.`);
  };

  const handleOpenMissionValidation = (mission: Mission, dayName: string) => {
    if (readonly) {
      setAuthModalOpen(true);
      showToast("Déverrouillez l'édition avec le code secret pour valider une mission.");
      return;
    }
    setValidatingMission({ mission, dayName });
  };

  const handleConfirmMissionValidation = (payload: MissionValidationPayload) => {
    if (readonly || !authUser) return;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find(
      (m) => m.id === payload.missionId
    );
    if (!mission) return;

    const cur = getMissionEntry(missionStates, payload.missionId);

    // 1. Material stock diff
    let nextGearConsumed = Boolean(cur.gearConsumed);
    let inventoryPatch: Record<string, number> | undefined;
    if (mission.gearKey !== 'none') {
      const prevConsumed = Boolean(cur.gearConsumed);
      const wantConsumed = payload.consumeGear;
      const delta = (prevConsumed ? 1 : 0) - (wantConsumed ? 1 : 0);
      if (delta !== 0) {
        const curQty = inventoryStock[mission.gearKey] || 0;
        const updatedQty = Math.max(0, curQty + delta);
        inventoryPatch = { [mission.gearKey]: updatedQty };
        nextGearConsumed = wantConsumed && (delta > 0 || curQty > 0);
        setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
      } else {
        nextGearConsumed = wantConsumed;
      }
    }

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

    // 4. Optional treasury cash debit
    let treasuryMoneyPatch: Partial<TreasuryMoney> | undefined;
    if (payload.treasuryDebitAccount !== 'none' && payload.treasuryDebitAmount > 0) {
      const account = payload.treasuryDebitAccount;
      const currentBalance = Math.max(0, Number(treasuryMoney[account]) || 0);
      const updatedBalance = Math.max(0, currentBalance - payload.treasuryDebitAmount);
      treasuryMoneyPatch = { [account]: updatedBalance };
      setTreasuryMoney((prev) => ({ ...prev, [account]: updatedBalance }));
    }

    const weaponsLossVal = nextLost.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
    const nextGain = payload.status === 'success' ? lootValTotal + Math.max(0, payload.cashGain) : 0;
    const nextExtra = weaponsLossVal + Math.max(0, payload.cashLoss);

    const updatedEntry: MissionStateEntry = {
      ...cur,
      status: payload.status,
      completed: true,
      gain: nextGain,
      extra: nextExtra,
      players: payload.players,
      gearConsumed: nextGearConsumed,
      loot: nextLoot,
      lostWeapons: nextLost,
    };

    setMissionStates((prev) => ({ ...prev, [payload.missionId]: updatedEntry }));
    setValidatingMission(null);

    const hasSideEffects =
      Boolean(inventoryPatch) ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched ||
      Boolean(treasuryMoneyPatch);

    if (hasSideEffects) {
      void saveMissionWithSideEffects(authUser.uid, payload.missionId, updatedEntry, {
        inventoryPatch,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
        treasuryMoneyPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, payload.missionId, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    showToast(
      `Mission "${mission.name}" validée (${payload.status === 'success' ? 'Réussie' : 'Échouée'}) !`
    );
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

    missions.forEach((m) => {
      const cur = getMissionEntry(missionStates, m.id);
      const prevStatus = getStatus(cur);
      const status: MissionStatus = allDone ? '' : prevStatus || 'success';

      let nextGearConsumed = Boolean(cur.gearConsumed);
      if (m.gearKey !== 'none') {
        if (prevStatus === '' && status !== '') {
          const curQty = nextInventory[m.gearKey] || 0;
          if (curQty > 0) {
            nextInventory[m.gearKey] = curQty - 1;
            inventoryPatch[m.gearKey] = curQty - 1;
            nextGearConsumed = true;
          }
        } else if (prevStatus !== '' && status === '' && cur.gearConsumed) {
          const updatedQty = (nextInventory[m.gearKey] || 0) + 1;
          nextInventory[m.gearKey] = updatedQty;
          inventoryPatch[m.gearKey] = updatedQty;
          nextGearConsumed = false;
        }
      }

      let nextGain = Number(cur.gain) || 0;
      let nextLoot = cur.loot ? { ...cur.loot } : {};
      if (prevStatus === 'success' && status !== 'success' && Object.keys(nextLoot).length > 0) {
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
        extra: nextExtra,
        players: Array.isArray(cur.players) ? cur.players : [],
        gearConsumed: nextGearConsumed,
        loot: nextLoot,
        lostWeapons: nextLostWeapons,
      };
    });

    if (Object.keys(inventoryPatch).length > 0) setInventoryStock(nextInventory);
    if (Object.keys(rewardPatches).length > 0) setRewardStocks(nextRewards);
    if (weaponsTouched) setWeaponsStock(nextWeapons);
    setMissionStates(nextStates);

    const hasSideEffects =
      Object.keys(inventoryPatch).length > 0 ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched;

    if (hasSideEffects) {
      void saveAllMissionEntriesWithSideEffects(authUser.uid, week, extractEntriesRecord(nextStates), {
        inventoryPatch: Object.keys(inventoryPatch).length > 0 ? inventoryPatch : undefined,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
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
    const dayObj = WEEKLY_SCHEDULE.find((d) => d.day === dayName);
    if (!dayObj) return;
    const cleared = bulkToggleMissions(dayObj.missions);
    showToast(cleared ? `${dayName} remis à zéro` : `Journée de ${dayName} validée !`);
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
    setMissionStates({ __week: newWeek });
    setWeaponsLossAmount(0);
    void Promise.all([
      saveAllMissionEntries(authUser.uid, newWeek, {}),
      saveWeaponsLoss(authUser.uid, 0),
    ]).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    showToast('Nouvelle semaine démarrée !');
  };

  const handleConfirmResetWeek = () => {
    if (readonly || !authUser) return;
    const newWeek = isoDate(currentWeekStart());
    setMissionStates({ __week: newWeek });
    setResetModalOpen(false);
    void saveAllMissionEntries(authUser.uid, newWeek, {}).catch((err) =>
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
      treasuryMoney,
      rewardStocks,
      inventoryStock,
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
      ? 'px-3.5 py-2 rounded-lg text-xs font-bold bg-gold text-obsidian transition flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0'
      : 'px-3.5 py-2 rounded-lg text-xs font-bold bg-charcoal hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0';

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
          <Toast message={toastMessage} />
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
      <header className="sticky top-0 z-40 bg-obsidian/95 backdrop-blur-md border-b border-crimson/60 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Logo & Titre Cartel GTA RP */}
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-xl bg-charcoal border-2 border-gold/80 flex items-center justify-center shadow-2xl shadow-crimson/40 shrink-0 overflow-hidden group">
                <img
                  src="/assets/emblem.webp"
                  alt="Emblème Los Cerberos"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold tracking-[0.3em] text-red-500 uppercase">
                    GTA RP • Cartel Paramilitaire
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className={
                      isUnlocked
                        ? 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/20 text-gold-light border border-gold/50 hover:bg-gold/30 transition cursor-pointer'
                        : 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-gold transition cursor-pointer'
                    }
                  >
                    {isUnlocked
                      ? '👑 Éditeur Autorisé (Actif)'
                      : '🔒 Lecture Seule (Cliquer pour déverrouiller)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    title={`Connecté en tant que ${authUser.displayName || authUser.email}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-600 transition cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    Déconnexion
                  </button>
                </div>
                <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-wider text-white">
                  LOS CERBEROS <span className="text-crimson-light font-normal">—</span>{' '}
                  <span className="text-gold text-sm sm:text-lg font-bold">
                    JURAMENTADOS POR LA SANGRE
                  </span>
                </h1>
              </div>
            </div>

            {/* Actions globales (Onglets) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentTab('planning')}
                className={tabBtnClass('planning')}
              >
                <Calendar className="w-4 h-4" />
                Planning
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('inventory')}
                className={tabBtnClass('inventory')}
              >
                <Package className="w-4 h-4" />
                Inventaire
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('treasury')}
                className={tabBtnClass('treasury')}
              >
                <Wallet className="w-4 h-4" />
                Trésorerie
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('accounting')}
                className={tabBtnClass('accounting')}
              >
                <BarChart3 className="w-4 h-4" />
                Comptabilité (Bilan)
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('hierarchy')}
                className={tabBtnClass('hierarchy')}
              >
                <Users className="w-4 h-4" />
                Hiérarchie
              </button>
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center gap-1.5 shadow-md shadow-gold/10 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardCopy className="w-4 h-4" />
                Copier Bilan
              </button>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-crimson/35 to-crimson-dark/50 hover:from-crimson/50 hover:to-crimson-dark/70 text-red-200 border border-crimson-light/50 transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* KPIs / COMPTEURS EN TEMPS RÉEL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className="bg-charcoal/90 gold-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Missions Réussies
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-display text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {kpis.successCount} / {TOTAL_WEEKLY_MISSIONS}
                </span>
                <span className="text-[10px] text-red-400 font-mono tabular-nums">
                  ❌ {kpis.failCount} échec{kpis.failCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="bg-charcoal/90 gold-border rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Trésorerie &amp; Actifs Totaux
              </span>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-display text-lg sm:text-xl font-extrabold text-amber-300 tabular-nums">
                  {formatMoney(kpis.totalWealth)}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Coffre Cartel</span>
              </div>
            </div>

            <div className="bg-charcoal/90 gold-border rounded-xl p-3 flex flex-col justify-between">
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

            <div className="bg-charcoal/90 gold-border rounded-xl p-3 flex flex-col justify-between">
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
                  Gains - Matériel - Pertes
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
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 text-xs">
            <span>
              ⚠️ Les données affichées sont celles de la{' '}
              <strong>semaine {weekRangeText(missionStates)}</strong>. Une nouvelle semaine a commencé (aujourd&apos;hui : {todayText}). Pense à <strong>Copier Bilan</strong> avant de passer à la suite.
            </span>
            {readonly ? (
              <span className="italic text-amber-300/80">
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
          <div className="bg-charcoal/90 gold-border rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <span className="text-zinc-300">
              📅 <strong className="text-gold">Semaine {weekRangeText(missionStates)}</strong>
            </span>
            <span className="text-zinc-400 capitalize">Aujourd&apos;hui : {todayText}</span>
          </div>
        )}

        {/* BANNIÈRE AVERTISSEMENT LECTURE SEULE */}
        {readonly && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 text-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
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
            inventoryStock={inventoryStock}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            members={hierMembers}
            readonly={readonly}
            onSetMissionStatus={handleSetMissionStatus}
            onUpdateMissionGain={handleUpdateMissionGain}
            onUpdateMissionExtra={handleUpdateMissionExtra}
            onToggleMissionPlayer={handleToggleMissionPlayer}
            onAdjustMissionLoot={handleAdjustMissionLoot}
            onDeclareMissionWeaponLoss={handleDeclareMissionWeaponLoss}
            onRevertMissionWeaponLoss={handleRevertMissionWeaponLoss}
            onOpenMissionValidation={handleOpenMissionValidation}
            onToggleWholeDay={handleToggleWholeDay}
            onToggleAllWeek={handleToggleAllWeek}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryView
            inventoryStock={inventoryStock}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            members={hierMembers}
            readonly={readonly}
            onUpdateStock={handleUpdateStock}
            onResetStock={handleResetStock}
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
            weaponsStock={weaponsStock}
            missionStates={missionStates}
            weaponsLossAmount={weaponsLossAmount}
            members={hierMembers}
            readonly={readonly}
            onUpdateTreasuryMoney={handleUpdateTreasuryMoney}
            onUpdateRewardQty={handleUpdateRewardQty}
            onUpdateRewardValue={handleUpdateRewardValue}
          />
        )}

        {currentTab === 'accounting' && (
          <AccountingView
            missionStates={missionStates}
            members={hierMembers}
            weaponsStock={weaponsStock}
            weaponsLossAmount={weaponsLossAmount}
            readonly={readonly}
            onUpdateWeaponsLoss={handleUpdateWeaponsLoss}
            onLoseWeaponGlobal={handleLoseWeaponGlobal}
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
        entry={
          validatingMission
            ? getMissionEntry(missionStates, validatingMission.mission.id)
            : {}
        }
        inventoryStock={inventoryStock}
        weaponsStock={weaponsStock}
        rewardStocks={rewardStocks}
        treasuryMoney={treasuryMoney}
        members={hierMembers}
        onClose={() => setValidatingMission(null)}
        onConfirm={handleConfirmMissionValidation}
        onResetMission={handleResetMissionFromModal}
      />

      <Toast message={toastMessage} />
    </div>
  );
}
