import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_SECRET_CODE, HIER_DEFAULTS } from '@/src/data/cartelData';
import {
  ADMIN_EMAIL,
  CARTEL_ID,
  db,
  handleFirestoreError,
  OperationType,
} from '@/src/firebase';
import type {
  HierarchyMember,
  InventoryStock,
  LostWeaponRecord,
  MissionStateEntry,
  MissionStates,
  RewardStockEntry,
  RewardStocks,
  TreasuryMoney,
  WeaponEntry,
  WeaponsStock,
} from '@/src/types/cartel';
import { currentWeekStart, isoDate } from '@/src/utils/finance';

export type MemberRole = 'viewer' | 'editor';

export interface LocalSeedData {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  weaponsLossAmount: number;
  secretCode: string;
  hierMembers: HierarchyMember[];
}

export interface SyncedCartelData {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRole: MemberRole;
}

export function isAdminUser(user: User | null): boolean {
  return (
    !!user &&
    user.emailVerified === true &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function sanitizeDisplayName(raw: string): string {
  const cleaned = raw.trim().slice(0, 80);
  return cleaned || 'Membre Cartel';
}

function sanitizeMissionEntry(value: MissionStateEntry): MissionStateEntry {
  const cleanLoot: Record<string, number> = {};
  if (value.loot && typeof value.loot === 'object') {
    Object.entries(value.loot)
      .slice(0, 30)
      .forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (k && qty > 0) cleanLoot[k.slice(0, 64)] = qty;
      });
  }

  const cleanUsedGear: Record<string, number> = {};
  if (value.usedGear && typeof value.usedGear === 'object') {
    Object.entries(value.usedGear)
      .slice(0, 20)
      .forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (k && qty > 0) cleanUsedGear[k.slice(0, 64)] = qty;
      });
  }

  const cleanLostWeapons: LostWeaponRecord[] = Array.isArray(value.lostWeapons)
    ? value.lostWeapons
        .filter((w): w is LostWeaponRecord => !!w && typeof w === 'object' && typeof w.name === 'string')
        .slice(0, 20)
        .map((w) => ({
          id: String(w.id || '').slice(0, 64),
          name: String(w.name).trim().slice(0, 80),
          value: Math.max(0, Number(w.value) || 0),
          holderId: String(w.holderId || 'coffre').slice(0, 80),
          holderName: String(w.holderName || 'Coffre Cartel').slice(0, 80),
        }))
    : [];

  return {
    status: value.status || '',
    completed: Boolean(value.completed),
    gain: Math.max(0, Number(value.gain) || 0),
    cashGain: Math.max(0, Number(value.cashGain) || 0),
    extra: Math.max(0, Number(value.extra) || 0),
    players: Array.isArray(value.players)
      ? value.players.filter((p): p is string => typeof p === 'string').slice(0, 30)
      : [],
    gearConsumed: Boolean(value.gearConsumed) || Object.keys(cleanUsedGear).length > 0,
    usedGear: cleanUsedGear,
    loot: cleanLoot,
    lostWeapons: cleanLostWeapons,
  };
}

function splitMissionStates(ms: MissionStates): {
  week: string;
  entries: Record<string, MissionStateEntry>;
} {
  const week =
    typeof ms.__week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(ms.__week)
      ? ms.__week
      : isoDate(currentWeekStart());
  const entries: Record<string, MissionStateEntry> = {};
  Object.entries(ms).forEach(([key, value]) => {
    if (key === '__week' || !value || typeof value !== 'object') return;
    entries[key] = sanitizeMissionEntry(value);
  });
  return { week, entries };
}

function membersArrayToMap(
  list: HierarchyMember[]
): Record<string, HierarchyMember> {
  const map: Record<string, HierarchyMember> = {};
  list.slice(0, 100).forEach((m) => {
    if (!m || !m.id) return;
    map[m.id] = {
      id: m.id,
      name: m.name.trim().slice(0, 80),
      unit: m.unit,
      order: Number(m.order) || 0,
      dossier: (m.dossier || '').trim().slice(0, 500),
    };
  });
  return map;
}

function membersMapToArray(
  raw: unknown
): HierarchyMember[] {
  if (!raw || typeof raw !== 'object') return HIER_DEFAULTS;
  const list = Object.values(raw as Record<string, HierarchyMember>).filter(
    (m) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.name === 'string'
  );
  return list.length > 0 ? list : HIER_DEFAULTS;
}

function sanitizeWeaponsMap(raw: unknown): WeaponsStock {
  if (!raw || typeof raw !== 'object') return {};
  const clean: WeaponsStock = {};
  Object.entries(raw as Record<string, WeaponEntry>)
    .slice(0, 150)
    .forEach(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const id = (typeof entry.id === 'string' ? entry.id : key)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '';
      if (!id || !name) return;
      clean[id] = {
        id,
        name,
        value: Math.max(0, Number(entry.value) || 0),
        qty: Math.max(1, Math.floor(Number(entry.qty) || 1)),
        holderId:
          typeof entry.holderId === 'string' && entry.holderId.trim()
            ? entry.holderId.trim().slice(0, 80)
            : 'coffre',
        notes: typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 160) : '',
      };
    });
  return clean;
}

export async function bootstrapAndJoinCartel(
  user: User,
  seed: LocalSeedData
): Promise<'ready' | 'uninitialized'> {
  const cartelPath = `cartels/${CARTEL_ID}`;
  const cartelRef = doc(db, 'cartels', CARTEL_ID);
  const authConfigPath = `cartels/${CARTEL_ID}/private/auth`;
  const authConfigRef = doc(db, 'cartels', CARTEL_ID, 'private', 'auth');
  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  const memberRef = doc(db, 'cartels', CARTEL_ID, 'members', user.uid);
  const admin = isAdminUser(user);

  if (admin) {
    let cartelSnap;
    try {
      cartelSnap = await getDoc(cartelRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, cartelPath);
    }
    if (!cartelSnap.exists()) {
      try {
        await setDoc(cartelRef, {
          name: 'LOS CERBEROS',
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, cartelPath);
      }
    }

    let authSnap;
    try {
      authSnap = await getDoc(authConfigRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, authConfigPath);
    }
    if (!authSnap.exists()) {
      const code = (seed.secretCode || DEFAULT_SECRET_CODE).trim().slice(0, 64);
      try {
        await setDoc(authConfigRef, {
          secretCode: code.length >= 4 ? code : DEFAULT_SECRET_CODE,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, authConfigPath);
      }
    }

    const missionsRef = doc(db, 'cartels', CARTEL_ID, 'state', 'missions');
    let missionsSnap;
    try {
      missionsSnap = await getDoc(missionsRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/missions`);
    }
    if (!missionsSnap.exists()) {
      const { week, entries } = splitMissionStates(seed.missionStates);
      try {
        await setDoc(missionsRef, {
          week,
          entries,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/missions`);
      }
    }

    const inventoryRef = doc(db, 'cartels', CARTEL_ID, 'state', 'inventory');
    let inventorySnap;
    try {
      inventorySnap = await getDoc(inventoryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/inventory`);
    }
    if (!inventorySnap.exists()) {
      try {
        await setDoc(inventoryRef, {
          stock: seed.inventoryStock || {},
          weapons: {},
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/inventory`);
      }
    }

    const treasuryRef = doc(db, 'cartels', CARTEL_ID, 'state', 'treasury');
    let treasurySnap;
    try {
      treasurySnap = await getDoc(treasuryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/treasury`);
    }
    if (!treasurySnap.exists()) {
      try {
        await setDoc(treasuryRef, {
          legal: Math.max(0, Number(seed.treasuryMoney?.legal) || 0),
          illegal: Math.max(0, Number(seed.treasuryMoney?.illegal) || 0),
          rewards: seed.rewardStocks || {},
          weaponsLossAmount: Math.max(0, Number(seed.weaponsLossAmount) || 0),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/treasury`);
      }
    }

    const hierarchyRef = doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy');
    let hierarchySnap;
    try {
      hierarchySnap = await getDoc(hierarchyRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/hierarchy`);
    }
    if (!hierarchySnap.exists()) {
      try {
        await setDoc(hierarchyRef, {
          members: membersArrayToMap(
            seed.hierMembers?.length > 0 ? seed.hierMembers : HIER_DEFAULTS
          ),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/hierarchy`);
      }
    }
  }

  let memberSnap;
  try {
    memberSnap = await getDoc(memberRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, memberPath);
  }

  if (!memberSnap.exists()) {
    try {
      await setDoc(memberRef, {
        uid: user.uid,
        displayName: sanitizeDisplayName(user.displayName || user.email || 'Membre'),
        role: admin ? 'editor' : 'viewer',
        accessCode: '',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!admin && msg.toLowerCase().includes('permission')) {
        return 'uninitialized';
      }
      handleFirestoreError(error, OperationType.CREATE, memberPath);
    }
  }

  return 'ready';
}

export function subscribeCartelState(
  uid: string,
  callbacks: {
    onMissions: (ms: MissionStates) => void;
    onInventory: (stock: InventoryStock) => void;
    onWeapons: (weapons: WeaponsStock) => void;
    onTreasury: (data: {
      treasuryMoney: TreasuryMoney;
      rewardStocks: RewardStocks;
      weaponsLossAmount: number;
    }) => void;
    onHierarchy: (members: HierarchyMember[]) => void;
    onRole: (role: MemberRole) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubMissions = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'missions'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const week =
        typeof data.week === 'string' ? data.week : isoDate(currentWeekStart());
      const entries =
        data.entries && typeof data.entries === 'object'
          ? (data.entries as Record<string, MissionStateEntry>)
          : {};
      callbacks.onMissions({ __week: week, ...entries });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/missions`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubInventory = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const stock =
        data.stock && typeof data.stock === 'object'
          ? (data.stock as InventoryStock)
          : {};
      callbacks.onInventory(stock);
      callbacks.onWeapons(sanitizeWeaponsMap(data.weapons));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/inventory`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubTreasury = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onTreasury({
        treasuryMoney: {
          legal: Math.max(0, Number(data.legal) || 0),
          illegal: Math.max(0, Number(data.illegal) || 0),
        },
        rewardStocks:
          data.rewards && typeof data.rewards === 'object'
            ? (data.rewards as RewardStocks)
            : {},
        weaponsLossAmount: Math.max(0, Number(data.weaponsLossAmount) || 0),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/treasury`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubHierarchy = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onHierarchy(membersMapToArray(data.members));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/hierarchy`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubMember = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'members', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onRole(data.role === 'editor' ? 'editor' : 'viewer');
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/members/${uid}`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  return () => {
    unsubMissions();
    unsubInventory();
    unsubTreasury();
    unsubHierarchy();
    unsubMember();
  };
}

export async function saveMissionEntry(
  uid: string,
  missionId: string,
  entry: MissionStateEntry
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntry = sanitizeMissionEntry(entry);
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
      [`entries.${missionId}`]: cleanEntry,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveMissionWithSideEffects(
  uid: string,
  missionId: string,
  entry: MissionStateEntry,
  sideEffects?: {
    inventoryPatch?: Record<string, number>;
    weapons?: WeaponsStock;
    rewardPatches?: Record<string, RewardStockEntry>;
    treasuryMoneyPatch?: Partial<TreasuryMoney>;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    [`entries.${missionId}`]: sanitizeMissionEntry(entry),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    sideEffects?.inventoryPatch ||
    sideEffects?.weapons !== undefined
  ) {
    const invUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects.inventoryPatch) {
      Object.entries(sideEffects.inventoryPatch).forEach(([k, q]) => {
        invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
      });
    }
    if (sideEffects.weapons !== undefined) {
      invUpdate.weapons = sanitizeWeaponsMap(sideEffects.weapons);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);
  }

  const hasRewards =
    sideEffects?.rewardPatches && Object.keys(sideEffects.rewardPatches).length > 0;
  const hasMoneyPatch =
    sideEffects?.treasuryMoneyPatch &&
    (sideEffects.treasuryMoneyPatch.legal !== undefined ||
      sideEffects.treasuryMoneyPatch.illegal !== undefined);

  if (hasRewards || hasMoneyPatch) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects?.rewardPatches) {
      Object.entries(sideEffects.rewardPatches).forEach(([k, val]) => {
        treasUpdate[`rewards.${k}`] = {
          qty: Math.max(0, Math.floor(Number(val.qty) || 0)),
          val: Math.max(0, Number(val.val) || 0),
        };
      });
    }
    if (sideEffects?.treasuryMoneyPatch?.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.legal) || 0);
    }
    if (sideEffects?.treasuryMoneyPatch?.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAllMissionEntries(
  uid: string,
  week: string,
  entries: Record<string, MissionStateEntry>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntries: Record<string, MissionStateEntry> = {};
  Object.entries(entries).forEach(([k, v]) => {
    if (k === '__week' || !v) return;
    cleanEntries[k] = sanitizeMissionEntry(v);
  });
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
      week,
      entries: cleanEntries,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAllMissionEntriesWithSideEffects(
  uid: string,
  week: string,
  entries: Record<string, MissionStateEntry>,
  sideEffects?: {
    inventoryPatch?: Record<string, number>;
    weapons?: WeaponsStock;
    rewardPatches?: Record<string, RewardStockEntry>;
    treasuryMoneyPatch?: Partial<TreasuryMoney>;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntries: Record<string, MissionStateEntry> = {};
  Object.entries(entries).forEach(([k, v]) => {
    if (k === '__week' || !v) return;
    cleanEntries[k] = sanitizeMissionEntry(v);
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    week,
    entries: cleanEntries,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    (sideEffects?.inventoryPatch && Object.keys(sideEffects.inventoryPatch).length > 0) ||
    sideEffects?.weapons !== undefined
  ) {
    const invUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects.inventoryPatch) {
      Object.entries(sideEffects.inventoryPatch).forEach(([k, q]) => {
        invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
      });
    }
    if (sideEffects.weapons !== undefined) {
      invUpdate.weapons = sanitizeWeaponsMap(sideEffects.weapons);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);
  }

  const hasRewards =
    sideEffects?.rewardPatches && Object.keys(sideEffects.rewardPatches).length > 0;
  const hasMoneyPatch =
    sideEffects?.treasuryMoneyPatch &&
    (sideEffects.treasuryMoneyPatch.legal !== undefined ||
      sideEffects.treasuryMoneyPatch.illegal !== undefined);

  if (hasRewards || hasMoneyPatch) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects?.rewardPatches) {
      Object.entries(sideEffects.rewardPatches).forEach(([k, val]) => {
        treasUpdate[`rewards.${k}`] = {
          qty: Math.max(0, Math.floor(Number(val.qty) || 0)),
          val: Math.max(0, Number(val.val) || 0),
        };
      });
    }
    if (sideEffects?.treasuryMoneyPatch?.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.legal) || 0);
    }
    if (sideEffects?.treasuryMoneyPatch?.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryItem(
  uid: string,
  key: string,
  qty: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      [`stock.${key}`]: Math.max(0, Math.floor(qty)),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resetAllInventory(uid: string): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      stock: {},
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryOrderReceipt(
  uid: string,
  stockPatch: Record<string, number>,
  treasuryMoneyPatch?: Partial<TreasuryMoney>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const batch = writeBatch(db);
  const invUpdate: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  Object.entries(stockPatch).forEach(([k, q]) => {
    invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
  });
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);

  if (
    treasuryMoneyPatch &&
    (treasuryMoneyPatch.legal !== undefined || treasuryMoneyPatch.illegal !== undefined)
  ) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (treasuryMoneyPatch.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(treasuryMoneyPatch.legal) || 0);
    }
    if (treasuryMoneyPatch.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponsStock(
  uid: string,
  weapons: WeaponsStock
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      weapons: sanitizeWeaponsMap(weapons),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponLossGlobal(
  uid: string,
  weapons: WeaponsStock,
  weaponsLossAmount: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
    weapons: sanitizeWeaponsMap(weapons),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
    weaponsLossAmount: Math.max(0, Number(weaponsLossAmount) || 0),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveTreasuryMoneyField(
  uid: string,
  type: keyof TreasuryMoney,
  value: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      [type]: Math.max(0, Number(value) || 0),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveRewardItem(
  uid: string,
  key: string,
  entry: RewardStockEntry
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      [`rewards.${key}`]: {
        qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
        val: Math.max(0, Number(entry.val) || 0),
      },
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponsLoss(uid: string, amount: number): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      weaponsLossAmount: Math.max(0, Number(amount) || 0),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveHierarchyMembers(
  uid: string,
  members: HierarchyMember[]
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/hierarchy`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'), {
      members: membersArrayToMap(members),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unlockEditorWithCode(
  user: User,
  code: string
): Promise<boolean> {
  const trimmed = code.trim().slice(0, 64);
  if (!trimmed) return false;

  if (isAdminUser(user)) {
    const authConfigPath = `cartels/${CARTEL_ID}/private/auth`;
    try {
      const snap = await getDoc(doc(db, 'cartels', CARTEL_ID, 'private', 'auth'));
      const currentSecret = snap.exists() ? String(snap.data().secretCode || '') : DEFAULT_SECRET_CODE;
      if (trimmed !== currentSecret) {
        return false;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, authConfigPath);
    }
  }

  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'members', user.uid), {
      role: 'editor',
      accessCode: trimmed,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission')) {
      return false;
    }
    handleFirestoreError(error, OperationType.UPDATE, memberPath);
  }
}

export async function lockEditorRole(user: User): Promise<void> {
  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'members', user.uid), {
      role: 'viewer',
      accessCode: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, memberPath);
  }
}

export async function updateCartelSecretCode(
  uid: string,
  newCode: string
): Promise<void> {
  const trimmed = newCode.trim().slice(0, 64);
  const path = `cartels/${CARTEL_ID}/private/auth`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'private', 'auth'), {
      secretCode: trimmed,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
