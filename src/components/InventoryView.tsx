import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Layers,
  Package,
  Search,
  Target,
  Wrench,
} from 'lucide-react';
import { LootSaleSection } from '@/src/components/LootSaleSection';
import {
  CATALOG_ITEM_CATEGORY_LABELS,
  INVENTORY_ITEMS,
  REWARD_ITEMS,
} from '@/src/data/cartelData';
import {
  EMINENCE_KEY_ITEM_IDS_LIST,
  EMINENCE_MISSIONS,
  EMINENCE_MISSION_ITEM_IDS,
  EMINENCE_UTILITY_ITEM_IDS_LIST,
  getEminenceCatalogItemsMap,
  resolveCatalogItemStockKey,
} from '@/src/data/eminenceMissions';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MissionScheduleMeta,
  MissionStates,
  RewardStocks,
  TreasuryMoney,
  WeaponEntry,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcRewardsTotalValue,
  calcStockAutonomy,
  calcWeaponsTotalValue,
  formatMoney,
  getCatalogExtraInventoryItems,
  getInventoryItemPrice,
  getWeaponHolderName,
} from '@/src/utils/finance';

interface InventoryViewProps {
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  catalogGroups: CatalogGroupsMap;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  treasuryMoney: TreasuryMoney;
  members: HierarchyMember[];
  readonly: boolean;
  onUpdateStock: (key: string, delta: number, deductIllegal?: boolean) => void;
  onUpdateItemPrice: (key: string, price: number) => void;
  onResetStock: () => void;
  onSaveWeapon: (payload: {
    id?: string;
    name: string;
    value: number;
    qty: number;
    holderId: string;
    notes: string;
    deductIllegal?: boolean;
  }) => void;
  onUpdateWeaponQty: (id: string, delta: number, deductIllegal?: boolean) => void;
  onDeleteWeapon: (id: string) => void;
  onLoseWeaponGlobal: (id: string) => void;
  onUpdateRewardQty: (key: string, delta: number) => void;
  onSellRewards: (
    soldQuantities: Record<string, number>,
    channelLabel: string,
    customAmountOverride?: number
  ) => void;
  onShowToast: (msg: string) => void;
}

interface MissionGearEntry {
  stockKey: string;
  name: string;
  defaultPrice: number;
  kindLabel: string;
  sharedNote?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  rewardStocks,
  catalogGroups,
  missionStates,
  scheduleMeta,
  treasuryMoney,
  members,
  readonly,
  onUpdateStock,
  onUpdateItemPrice,
  onResetStock,
  onSaveWeapon,
  onUpdateWeaponQty,
  onDeleteWeapon,
  onLoseWeaponGlobal,
  onUpdateRewardQty,
  onSellRewards,
  onShowToast,
}) => {
  const [missionViewMode, setMissionViewMode] = useState<'by_mission' | 'by_type'>('by_mission');
  const [missionFilter, setMissionFilter] = useState<'ALL' | 'ready' | 'missing' | 'major' | 'standard'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'packs' | 'keys' | 'utilities'>('ALL');
  const [missionSearch, setMissionSearch] = useState<string>('');
  const [showAutonomyBoard, setShowAutonomyBoard] = useState<boolean>(false);
  const [autoDebitGearIllegal, setAutoDebitGearIllegal] = useState<boolean>(true);
  const [autoDebitProtectionIllegal, setAutoDebitProtectionIllegal] = useState<boolean>(true);
  const [autoDebitAccessoriesIllegal, setAutoDebitAccessoriesIllegal] = useState<boolean>(true);
  const [autoDebitArsenalQtyIllegal, setAutoDebitArsenalQtyIllegal] = useState<boolean>(true);
  const [deductWeaponFormIllegal, setDeductWeaponFormIllegal] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weaponName, setWeaponName] = useState('');
  const [weaponValue, setWeaponValue] = useState('');
  const [weaponQty, setWeaponQty] = useState('1');
  const [weaponHolderId, setWeaponHolderId] = useState('coffre');
  const [weaponNotes, setWeaponNotes] = useState('');
  const [holderFilter, setHolderFilter] = useState<string>('ALL');
  const [delArmId, setDelArmId] = useState<string | null>(null);
  const [loseArmId, setLoseArmId] = useState<string | null>(null);

  const heistGearItems = useMemo(
    () => INVENTORY_ITEMS.filter((i) => i.category === 'tool' || i.category === 'heist_pack'),
    []
  );
  const protectionItems = useMemo(
    () => INVENTORY_ITEMS.filter((i) => i.category === 'protection'),
    []
  );

  const allCatalogExtraItems = useMemo(
    () => getCatalogExtraInventoryItems(catalogGroups),
    [catalogGroups]
  );

  const eminenceItemsById = useMemo(
    () => getEminenceCatalogItemsMap(catalogGroups),
    [catalogGroups]
  );

  const eminenceMissionExtraItems = useMemo(
    () => allCatalogExtraItems.filter((c) => EMINENCE_MISSION_ITEM_IDS.has(c.itemId)),
    [allCatalogExtraItems]
  );

  const accessoryAndCatalogItems = useMemo(() => {
    const baseAccessories = INVENTORY_ITEMS.filter((i) => i.category === 'accessory').map(
      (i) => ({
        key: i.key as string,
        name: i.name,
        defaultPrice: i.price,
        badgeLabel: 'Accessoire arme',
      })
    );
    const dynamicNonMissionCatalog = allCatalogExtraItems
      .filter((c) => !EMINENCE_MISSION_ITEM_IDS.has(c.itemId))
      .map((c) => ({
        key: c.key,
        name: c.name,
        defaultPrice: c.price,
        badgeLabel: `${CATALOG_ITEM_CATEGORY_LABELS[c.category] || 'Catalogue'} · ${c.groupName}`,
      }));
    return [...baseAccessories, ...dynamicNonMissionCatalog];
  }, [allCatalogExtraItems]);

  const packsTypeEntries = useMemo<MissionGearEntry[]>(() => {
    const base = heistGearItems.map((i) => ({
      stockKey: i.key as string,
      name: i.name,
      defaultPrice: i.price,
      kindLabel: i.category === 'heist_pack' ? 'Pack Gros Coup' : 'Pack / Outil',
    }));
    const conteneurs = eminenceItemsById.get('em_pack_08_conteneurs');
    const conteneursKey = resolveCatalogItemStockKey(conteneurs);
    if (conteneurs && conteneursKey && !base.some((b) => b.stockKey === conteneursKey)) {
      base.push({
        stockKey: conteneursKey,
        name: conteneurs.name,
        defaultPrice: conteneurs.price,
        kindLabel: 'Pack Braquage',
      });
    }
    return base;
  }, [heistGearItems, eminenceItemsById]);

  const keysTypeEntries = useMemo<MissionGearEntry[]>(() => {
    return EMINENCE_KEY_ITEM_IDS_LIST.map((itemId) => {
      const catItem = eminenceItemsById.get(itemId);
      const stockKey = resolveCatalogItemStockKey(catItem);
      if (!catItem || !stockKey) return null;
      return {
        stockKey,
        name: catItem.name,
        defaultPrice: catItem.price,
        kindLabel: 'Clé / Accès',
      };
    }).filter((x): x is MissionGearEntry => x !== null);
  }, [eminenceItemsById]);

  const utilitiesTypeEntries = useMemo<MissionGearEntry[]>(() => {
    return EMINENCE_UTILITY_ITEM_IDS_LIST.map((itemId): MissionGearEntry | null => {
      const catItem = eminenceItemsById.get(itemId);
      const stockKey = resolveCatalogItemStockKey(catItem);
      if (!catItem || !stockKey) return null;
      const isShared = Boolean(catItem.linkedGearKey);
      return {
        stockKey,
        name: catItem.name,
        defaultPrice: catItem.price,
        kindLabel: 'Item utilitaire',
        ...(isShared ? { sharedNote: 'Synchro pack planning' } : {}),
      };
    }).filter((x): x is MissionGearEntry => x !== null);
  }, [eminenceItemsById]);

  const staticMissionValTotal = heistGearItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices),
    0
  );
  const eminenceExtraValTotal = eminenceMissionExtraItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices, item.price),
    0
  );
  const heistGearValTotal = staticMissionValTotal + eminenceExtraValTotal;

  const packsBreakdownVal = packsTypeEntries.reduce((sum, entry) => {
    const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
    return sum + qty * getInventoryItemPrice(entry.stockKey, inventoryPrices, entry.defaultPrice);
  }, 0);
  const keysBreakdownVal = keysTypeEntries.reduce((sum, entry) => {
    const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
    return sum + qty * getInventoryItemPrice(entry.stockKey, inventoryPrices, entry.defaultPrice);
  }, 0);
  const utilitiesUniqueBreakdownVal = utilitiesTypeEntries
    .filter((entry) => !entry.sharedNote)
    .reduce((sum, entry) => {
      const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
      return sum + qty * getInventoryItemPrice(entry.stockKey, inventoryPrices, entry.defaultPrice);
    }, 0);

  const totalMissionGearQty =
    heistGearItems.reduce(
      (sum, item) => sum + Math.max(0, Number(inventoryStock[item.key]) || 0),
      0
    ) +
    eminenceMissionExtraItems.reduce(
      (sum, item) => sum + Math.max(0, Number(inventoryStock[item.key]) || 0),
      0
    );

  const protectionValTotal = protectionItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices),
    0
  );
  const totalProtectionQty = protectionItems.reduce(
    (sum, item) => sum + Math.max(0, Number(inventoryStock[item.key]) || 0),
    0
  );
  const accessoriesValTotal = accessoryAndCatalogItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices, item.defaultPrice),
    0
  );
  const totalAccessoriesQty = accessoryAndCatalogItems.reduce(
    (sum, item) => sum + Math.max(0, Number(inventoryStock[item.key]) || 0),
    0
  );

  const autonomy = useMemo(
    () =>
      calcStockAutonomy({
        inventoryStock,
        missionStates,
        scheduleMeta,
        excludeDone: true,
      }),
    [inventoryStock, missionStates, scheduleMeta]
  );

  const missionCardsData = useMemo(() => {
    return EMINENCE_MISSIONS.map((mission) => {
      const packCatalogItem = mission.packItemId
        ? eminenceItemsById.get(mission.packItemId)
        : undefined;
      const packStockKey = resolveCatalogItemStockKey(packCatalogItem);
      const packStaticInv = packStockKey
        ? INVENTORY_ITEMS.find((i) => i.key === packStockKey)
        : undefined;
      const packQty = packStockKey
        ? Math.max(0, Math.floor(Number(inventoryStock[packStockKey]) || 0))
        : 0;
      const packUnitPrice = packStockKey
        ? getInventoryItemPrice(
            packStockKey,
            inventoryPrices,
            packStaticInv?.price ?? packCatalogItem?.price ?? 0
          )
        : 0;
      const packDisplayName =
        packStaticInv?.name || packCatalogItem?.name || `Pack ${mission.code}`;

      const resolvedReqs = mission.requirements
        .map((req) => {
          const catItem = eminenceItemsById.get(req.itemId);
          const stockKey = resolveCatalogItemStockKey(catItem);
          if (!catItem || !stockKey) return null;
          const staticInv = INVENTORY_ITEMS.find((i) => i.key === stockKey);
          const stockQty = Math.max(0, Math.floor(Number(inventoryStock[stockKey]) || 0));
          const unitPrice = getInventoryItemPrice(
            stockKey,
            inventoryPrices,
            staticInv?.price ?? catItem.price
          );
          return {
            req,
            catItem,
            stockKey,
            displayName: staticInv?.name || catItem.name,
            stockQty,
            unitPrice,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Avoid double counting when the pack and single utility share the exact same key (e.g. 01 ATM, 02 Maison)
      const distinctReqs = resolvedReqs.filter((r) => r.stockKey !== packStockKey);
      const isSingleUnifiedKey =
        Boolean(packStockKey) && (resolvedReqs.length === 0 || distinctReqs.length === 0);

      let soloReadyRuns = 0;
      const missingComponents: Array<{ name: string; missingQty: number; cost: number }> = [];
      let hasAnyPartialReq = false;

      if (!isSingleUnifiedKey && distinctReqs.length > 0) {
        soloReadyRuns = Math.min(
          ...distinctReqs.map((r) => Math.floor(r.stockQty / Math.max(1, r.req.qty)))
        );
        distinctReqs.forEach((r) => {
          if (r.stockQty > 0) hasAnyPartialReq = true;
          const missingQty = Math.max(0, r.req.qty - r.stockQty);
          if (missingQty > 0) {
            missingComponents.push({
              name: missingQty > 1 ? `${missingQty}× ${r.displayName}` : r.displayName,
              missingQty,
              cost: missingQty * r.unitPrice,
            });
          }
        });
      }

      const readyRuns = isSingleUnifiedKey ? packQty : packQty + soloReadyRuns;
      const missingToCompleteOne = missingComponents.reduce((s, m) => s + m.cost, 0);
      const isPartial = readyRuns === 0 && hasAnyPartialReq;

      const autoKey =
        mission.planningGearKey && mission.planningGearKey !== 'amu'
          ? mission.planningGearKey
          : undefined;
      const autoInfo = autoKey ? autonomy.byKey[autoKey] : undefined;

      return {
        mission,
        packStockKey,
        packDisplayName,
        packQty,
        packUnitPrice,
        resolvedReqs,
        distinctReqs,
        isSingleUnifiedKey,
        soloReadyRuns,
        readyRuns,
        isPartial,
        missingComponents,
        missingToCompleteOne,
        autoInfo,
      };
    });
  }, [eminenceItemsById, inventoryStock, inventoryPrices, autonomy.byKey]);

  const readyMissionCount = useMemo(
    () => missionCardsData.filter((m) => m.readyRuns > 0).length,
    [missionCardsData]
  );
  const missingMissionCount = useMemo(
    () => missionCardsData.filter((m) => m.readyRuns === 0).length,
    [missionCardsData]
  );

  const normalizedMissionQuery = missionSearch
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const filteredMissionCards = useMemo(() => {
    return missionCardsData.filter((card) => {
      if (missionFilter === 'ready' && card.readyRuns <= 0) return false;
      if (missionFilter === 'missing' && card.readyRuns > 0) return false;
      if (missionFilter === 'major' && !card.mission.major) return false;
      if (missionFilter === 'standard' && card.mission.major) return false;

      if (normalizedMissionQuery) {
        const reqNames = card.resolvedReqs.map((r) => r.displayName).join(' ');
        const hay = `${card.mission.code} ${card.mission.title} ${card.mission.summary} ${card.packDisplayName} ${reqNames}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (!hay.includes(normalizedMissionQuery)) return false;
      }
      return true;
    });
  }, [missionCardsData, missionFilter, normalizedMissionQuery]);

  const filterBySearch = (entries: MissionGearEntry[]) => {
    if (!normalizedMissionQuery) return entries;
    return entries.filter((entry) => {
      const hay = `${entry.name} ${entry.kindLabel}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return hay.includes(normalizedMissionQuery);
    });
  };

  const filteredPacksEntries = useMemo(
    () => filterBySearch(packsTypeEntries),
    [packsTypeEntries, normalizedMissionQuery]
  );
  const filteredKeysEntries = useMemo(
    () => filterBySearch(keysTypeEntries),
    [keysTypeEntries, normalizedMissionQuery]
  );
  const filteredUtilitiesEntries = useMemo(
    () => filterBySearch(utilitiesTypeEntries),
    [utilitiesTypeEntries, normalizedMissionQuery]
  );

  const weaponsValTotal = calcWeaponsTotalValue(weaponsStock);
  const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
  const totalRewardsQty = REWARD_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
    0
  );
  const receleurValTotal = REWARD_ITEMS.filter((i) => i.buyerGroup !== 'whiskey').reduce(
    (sum, item) => {
      const dat = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
      const qty = Math.max(0, Number(dat.qty) || 0);
      const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : item.defaultVal;
      return sum + qty * val;
    },
    0
  );
  const whiskeyValTotal = Math.max(0, rewardsValTotal - receleurValTotal);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      ),
    [members]
  );

  const weaponsList = useMemo(
    () =>
      Object.values(weaponsStock).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr-FR')
      ),
    [weaponsStock]
  );

  const holderSummaries = useMemo(() => {
    const map = new Map<
      string,
      { holderId: string; label: string; count: number; totalVal: number }
    >();
    weaponsList.forEach((w) => {
      const hid = w.holderId || 'coffre';
      const label = getWeaponHolderName(hid, members);
      const cur = map.get(hid) || { holderId: hid, label, count: 0, totalVal: 0 };
      const qty = Math.max(0, Number(w.qty) || 0);
      const val = Math.max(0, Number(w.value) || 0);
      cur.count += qty;
      cur.totalVal += qty * val;
      map.set(hid, cur);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.holderId === 'coffre') return -1;
      if (b.holderId === 'coffre') return 1;
      return b.totalVal - a.totalVal || a.label.localeCompare(b.label, 'fr-FR');
    });
  }, [weaponsList, members]);

  const totalWeaponsCount = useMemo(
    () => weaponsList.reduce((sum, w) => sum + Math.max(0, Number(w.qty) || 0), 0),
    [weaponsList]
  );

  const filteredWeapons = useMemo(() => {
    if (holderFilter === 'ALL') return weaponsList;
    return weaponsList.filter((w) => (w.holderId || 'coffre') === holderFilter);
  }, [weaponsList, holderFilter]);

  const resetForm = () => {
    setEditingId(null);
    setWeaponName('');
    setWeaponValue('');
    setWeaponQty('1');
    setWeaponHolderId('coffre');
    setWeaponNotes('');
    setDeductWeaponFormIllegal(true);
  };

  const handleEditWeapon = (w: WeaponEntry) => {
    setEditingId(w.id);
    setWeaponName(w.name);
    setWeaponValue(String(w.value || 0));
    setWeaponQty(String(w.qty || 1));
    setWeaponHolderId(w.holderId || 'coffre');
    setWeaponNotes(w.notes || '');
    setDeductWeaponFormIllegal(false);
  };

  const handleSubmitWeapon = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly) return;
    const trimmedName = weaponName.trim();
    if (!trimmedName) {
      onShowToast("Indique le nom de l'arme.");
      return;
    }
    const val = Math.max(0, Number(weaponValue) || 0);
    const qty = Math.max(1, Math.floor(Number(weaponQty) || 1));
    onSaveWeapon({
      id: editingId || undefined,
      name: trimmedName,
      value: val,
      qty,
      holderId: weaponHolderId || 'coffre',
      notes: weaponNotes.trim(),
      deductIllegal: deductWeaponFormIllegal,
    });
    resetForm();
  };

  const handleDeleteClick = (id: string) => {
    if (readonly) return;
    if (delArmId !== id) {
      setDelArmId(id);
      setLoseArmId(null);
      return;
    }
    setDelArmId(null);
    if (editingId === id) resetForm();
    onDeleteWeapon(id);
  };

  const handleLoseClick = (id: string) => {
    if (readonly) return;
    if (loseArmId !== id) {
      setLoseArmId(id);
      setDelArmId(null);
      return;
    }
    setLoseArmId(null);
    if (editingId === id) resetForm();
    onLoseWeaponGlobal(id);
  };

  const globalAutonomyLabel = autonomy.allOver30Days
    ? '30+ jours'
    : `${autonomy.minDaysCovered} jour${autonomy.minDaysCovered > 1 ? 's' : ''}`;

  const parsedFormValue = Math.max(0, Number(weaponValue) || 0);
  const parsedFormQty = Math.max(1, Math.floor(Number(weaponQty) || 1));
  const editingWeaponPrevQty = editingId
    ? Math.max(1, Math.floor(Number(weaponsStock[editingId]?.qty) || 1))
    : 0;
  const weaponFormPurchaseCost = editingId
    ? Math.max(0, parsedFormQty - editingWeaponPrevQty) * parsedFormValue
    : parsedFormQty * parsedFormValue;

  return (
    <div className="space-y-6">
      {/* SYNTHÈSE DISSOCIÉE DES 4 PÔLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-charcoal/95 border border-gold/45 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-light">
              💣 Matériel Missions
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalMissionGearQty} pièce{totalMissionGearQty > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-gold tabular-nums">
            {formatMoney(heistGearValTotal)}
          </div>
          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
            Packs {formatMoney(packsBreakdownVal)} · Clés {formatMoney(keysBreakdownVal)} · Utilit.{' '}
            {formatMoney(utilitiesUniqueBreakdownVal)}
          </div>
        </div>

        <div className="bg-charcoal/95 border border-crimson/55 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-crimson-light">
              🔫 Armurerie (Armes)
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalWeaponsCount} arme{totalWeaponsCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-white tabular-nums">
            {formatMoney(weaponsValTotal)}
          </div>
          <div className="text-[11px] text-zinc-400">
            Armes enregistrées par détenteur
          </div>
        </div>

        <div className="bg-charcoal/95 border border-amber-500/45 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              🦺 Gilets, Munitions &amp; Acc.
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalProtectionQty + totalAccessoriesQty} pièce
              {totalProtectionQty + totalAccessoriesQty > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-amber-200 tabular-nums">
            {formatMoney(protectionValTotal + accessoriesValTotal)}
          </div>
          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
            Gilets/Mun. {formatMoney(protectionValTotal)} · Acc. {formatMoney(accessoriesValTotal)}
          </div>
        </div>

        <div className="bg-charcoal/95 border border-bronze/60 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              💎 Objets à Vendre
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalRewardsQty} objet{totalRewardsQty > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-emerald-300 tabular-nums">
            {formatMoney(rewardsValTotal)}
          </div>
          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
            Receleur {formatMoney(receleurValTotal)} · Whiskey {formatMoney(whiskeyValTotal)}
          </div>
        </div>
      </div>

      {/* MATÉRIEL DE BRAQUAGE & MISSIONS + AUTONOMIE */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">💣</span> Matériel &amp; Préparation des Missions
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chaque mission regroupe son Pack complet ainsi que ses Clés et Utilitaires à l&apos;unité en coffre — pour voir immédiatement ce qui est prêt ou manquant.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Valeur Totale Matériel
              </span>
              <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                {formatMoney(heistGearValTotal)}
              </span>
            </div>
            {!readonly && (
              <button
                type="button"
                onClick={onResetStock}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-gunmetal text-zinc-300 transition border border-bronze/60 cursor-pointer"
              >
                Remettre le matériel à 0
              </button>
            )}
          </div>
        </div>

        {/* BARRE SYNTHÈSE AUTONOMIE DU STOCK (JOURS RESTANTS) */}
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            autonomy.minDaysCovered === 0
              ? 'bg-crimson-dark/25 border-crimson-light/55'
              : autonomy.minDaysCovered < 3
                ? 'bg-gold/10 border-gold/50'
                : 'bg-obsidian/80 border-emerald-500/40'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  autonomy.minDaysCovered === 0
                    ? 'bg-crimson/25 border-crimson-light/50 text-red-200'
                    : autonomy.minDaysCovered < 3
                      ? 'bg-gold/15 border-gold/50 text-gold'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {autonomy.minDaysCovered === 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : autonomy.minDaysCovered < 3 ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-sm font-bold text-white uppercase tracking-wide">
                    Autonomie du stock (à partir de {autonomy.startDay}) :{' '}
                    <span
                      className={
                        autonomy.minDaysCovered === 0
                          ? 'text-crimson-light'
                          : autonomy.minDaysCovered < 3
                            ? 'text-gold'
                            : 'text-emerald-300'
                      }
                    >
                      {globalAutonomyLabel}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">
                  {autonomy.allOver30Days ? (
                    'Tous les articles du planning couvrent plus de 30 jours d’opérations.'
                  ) : autonomy.limitingItems.length > 0 ? (
                    <>
                      Point limitant :{' '}
                      <strong className="text-gold-light">
                        {autonomy.limitingItems
                          .slice(0, 3)
                          .map(
                            (li) =>
                              `${li.name} (${li.coveredDays}j${li.ruptureDayName ? ` · manque ${li.ruptureDayName}` : ''})`
                          )
                          .join(' · ')}
                        {autonomy.limitingItems.length > 3
                          ? ` +${autonomy.limitingItems.length - 3} autres`
                          : ''}
                      </strong>
                    </>
                  ) : (
                    'Calcul basé sur le calendrier hebdomadaire des missions restantes.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAutonomyBoard((v) => !v)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-charcoal text-gold-light border border-gold/45 transition cursor-pointer whitespace-nowrap shrink-0 self-start md:self-center"
            >
              {showAutonomyBoard
                ? 'Masquer le détail des jours restants'
                : '⏳ Voir l’autonomie détaillée (par article)'}
            </button>
          </div>

          {showAutonomyBoard && (
            <div className="pt-3 border-t border-bronze/35 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {heistGearItems.map((item) => {
                const info = autonomy.byKey[item.key];
                const qty = inventoryStock[item.key] || 0;
                const unscheduled = (info?.neededPerWeek || 0) === 0;
                const days = info?.coveredDays ?? 0;
                const over30 = info?.hasMoreThan30 ?? false;
                return (
                  <div
                    key={item.key}
                    className="bg-charcoal/90 border border-bronze/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        Stock : <strong className="text-zinc-200">{qty}</strong>
                        {!unscheduled && (
                          <> · Besoin/sem : {info?.neededPerWeek}</>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      {unscheduled ? (
                        <span className="text-zinc-400 text-[11px]">Hors planning</span>
                      ) : over30 ? (
                        <span className="text-emerald-300 font-bold">30+ jours</span>
                      ) : days === 0 ? (
                        <span className="text-crimson-light font-bold">
                          0 j ({info?.ruptureDayName})
                        </span>
                      ) : (
                        <span
                          className={`font-bold ${
                            days < 3 ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          {days} jour{days > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BARRE DE MODE D'AFFICHAGE + FILTRES + RECHERCHE + ARGENT SALE */}
        <div className="bg-obsidian/70 border border-bronze/40 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex bg-charcoal border border-bronze/50 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setMissionViewMode('by_mission')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    missionViewMode === 'by_mission'
                      ? 'bg-gold text-obsidian shadow'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  Par Mission ({EMINENCE_MISSIONS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMissionViewMode('by_type')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    missionViewMode === 'by_type'
                      ? 'bg-gold text-obsidian shadow'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Packs / Clés / Utilitaires
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={missionSearch}
                  onChange={(e) => setMissionSearch(e.target.value)}
                  placeholder="Mission, clé, perceuse, bombe..."
                  className="w-full bg-charcoal border border-bronze/50 focus:border-gold rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {!readonly && (
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer select-none transition ${
                  autoDebitGearIllegal
                    ? 'bg-red-950/30 border-red-500/45 text-red-200'
                    : 'bg-charcoal/80 border-bronze/40 text-zinc-400'
                }`}
                title="Déduit automatiquement le prix unitaire de l'Argent Sale quand vous cliquez sur +"
              >
                <input
                  type="checkbox"
                  checked={autoDebitGearIllegal}
                  onChange={(e) => setAutoDebitGearIllegal(e.target.checked)}
                  className="accent-crimson rounded cursor-pointer"
                />
                <span>
                  💸 Déduire les ajouts (<strong className="text-white">+</strong>) de l&apos;Argent Sale ·{' '}
                  <strong className="font-mono text-gold-light tabular-nums">
                    {formatMoney(treasuryMoney.illegal || 0)}
                  </strong>
                </span>
              </label>
            )}
          </div>

          {missionViewMode === 'by_mission' ? (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-bronze/25">
              <button
                type="button"
                onClick={() => setMissionFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  missionFilter === 'ALL'
                    ? 'bg-gold text-obsidian border-gold'
                    : 'bg-charcoal text-zinc-300 border-bronze/45 hover:border-gold/50'
                }`}
              >
                Toutes les missions ({missionCardsData.length})
              </button>
              <button
                type="button"
                onClick={() => setMissionFilter('ready')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                  missionFilter === 'ready'
                    ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-emerald-500/50'
                }`}
              >
                ✅ Prêtes en coffre ({readyMissionCount})
              </button>
              <button
                type="button"
                onClick={() => setMissionFilter('missing')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                  missionFilter === 'missing'
                    ? 'bg-crimson/25 text-red-200 border-crimson-light'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-crimson/50'
                }`}
              >
                ⚠️ Incomplètes / Rupture ({missingMissionCount})
              </button>
              <button
                type="button"
                onClick={() => setMissionFilter('major')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  missionFilter === 'major'
                    ? 'bg-gold/20 text-gold-light border-gold'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
                }`}
              >
                Gros Coups
              </button>
              <button
                type="button"
                onClick={() => setMissionFilter('standard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  missionFilter === 'standard'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
                }`}
              >
                Missions rapides
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-bronze/25">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  typeFilter === 'ALL'
                    ? 'bg-gold text-obsidian border-gold'
                    : 'bg-charcoal text-zinc-300 border-bronze/45 hover:border-gold/50'
                }`}
              >
                Tout le matériel ({packsTypeEntries.length + keysTypeEntries.length + utilitiesTypeEntries.length}) ·{' '}
                {formatMoney(heistGearValTotal)}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('packs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                  typeFilter === 'packs'
                    ? 'bg-gold/20 text-gold-light border-gold'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
                }`}
              >
                📦 Packs ({packsTypeEntries.length}) ·{' '}
                <span className="font-mono text-gold">{formatMoney(packsBreakdownVal)}</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('keys')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                  typeFilter === 'keys'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
                }`}
              >
                🔑 Clés &amp; Accès ({keysTypeEntries.length}) ·{' '}
                <span className="font-mono text-amber-200">{formatMoney(keysBreakdownVal)}</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('utilities')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                  typeFilter === 'utilities'
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                    : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
                }`}
              >
                🛠️ Items utilitaires ({utilitiesTypeEntries.length})
              </button>
            </div>
          )}
        </div>

        {/* VUE 1 : PAR MISSION (PACK + CLÉS + UTILITAIRES RÉQUIS) */}
        {missionViewMode === 'by_mission' && (
          <>
            {filteredMissionCards.length === 0 ? (
              <div className="bg-obsidian/60 border border-bronze/35 rounded-xl p-6 text-center text-xs text-zinc-400">
                Aucune mission ne correspond à votre recherche ou filtre.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMissionCards.map((card) => {
                  const {
                    mission,
                    packStockKey,
                    packDisplayName,
                    packQty,
                    packUnitPrice,
                    distinctReqs,
                    isSingleUnifiedKey,
                    soloReadyRuns,
                    readyRuns,
                    isPartial,
                    missingComponents,
                    missingToCompleteOne,
                    autoInfo,
                  } = card;

                  const unscheduled = !autoInfo || autoInfo.neededPerWeek === 0;
                  const autoDays = autoInfo?.coveredDays ?? 0;
                  const over30 = autoInfo?.hasMoreThan30 ?? false;

                  return (
                    <div
                      key={mission.code}
                      className={`bg-obsidian/85 border rounded-xl overflow-hidden flex flex-col justify-between shadow-md transition ${
                        readyRuns > 0
                          ? 'border-emerald-500/45'
                          : isPartial
                            ? 'border-amber-500/50'
                            : 'border-bronze/45'
                      }`}
                    >
                      {/* EN-TÊTE MISSION + STATUT PRÊT / MANQUANT */}
                      <div className="p-4 bg-charcoal/60 border-b border-bronze/30 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`font-mono text-xs font-extrabold px-2.5 py-1.5 rounded-lg border shrink-0 tabular-nums ${
                              mission.major
                                ? 'bg-gold/15 text-gold-light border-gold/45'
                                : 'bg-charcoal text-zinc-300 border-bronze/45'
                            }`}
                          >
                            {mission.code}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-display font-bold text-base text-white">
                                {mission.title}
                              </h4>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  mission.major ? 'text-gold' : 'text-zinc-400'
                                }`}
                              >
                                {mission.major ? '· Gros Coup' : '· Mission'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{mission.summary}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1 tabular-nums">
                          {readyRuns > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                              <Check className="w-3 h-3" />
                              {readyRuns} prête{readyRuns > 1 ? 's' : ''}
                            </div>
                          ) : isPartial ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                              Partiel
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/50 border border-red-500/35 text-crimson-light text-[11px] font-bold">
                              Rupture (0)
                            </div>
                          )}

                          <div className="text-[10px] font-mono">
                            {unscheduled ? (
                              <span className="text-zinc-500">Hors planning</span>
                            ) : over30 ? (
                              <span className="text-emerald-300">Autonomie : 30+ j</span>
                            ) : autoDays === 0 ? (
                              <span className="text-crimson-light font-semibold">
                                0 j · Manque {autoInfo?.ruptureDayName}
                              </span>
                            ) : (
                              <span className={autoDays < 3 ? 'text-amber-300' : 'text-emerald-300'}>
                                Autonomie : {autoDays} j
                                {autoInfo?.ruptureDayName ? ` → ${autoInfo.ruptureDayName}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* STOCK DU PACK + STOCK DES ITEMS À L'UNITÉ */}
                      <div className="p-4 space-y-3">
                        {/* RÉCAP MIXTE SI PACK ET KITS SOLO */}
                        {readyRuns > 0 && !isSingleUnifiedKey && distinctReqs.length > 0 && (
                          <div className="text-[11px] font-mono text-emerald-300/90 bg-emerald-950/20 border border-emerald-500/25 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap tabular-nums">
                            <span>Capacité en coffre :</span>
                            <span>
                              {packQty > 0 ? `${packQty} pack${packQty > 1 ? 's' : ''}` : ''}
                              {packQty > 0 && soloReadyRuns > 0 ? ' + ' : ''}
                              {soloReadyRuns > 0
                                ? `${soloReadyRuns} kit${soloReadyRuns > 1 ? 's' : ''} complet${soloReadyRuns > 1 ? 's' : ''} en items seuls`
                                : ''}
                            </span>
                          </div>
                        )}

                        {/* MANQUANTS SI PARTIEL */}
                        {readyRuns === 0 && missingComponents.length > 0 && isPartial && (
                          <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap tabular-nums">
                            <span>
                              Manque pour 1 kit :{' '}
                              <strong>{missingComponents.map((m) => m.name).join(', ')}</strong>
                            </span>
                            <span className="font-mono font-bold text-gold-light">
                              {formatMoney(missingToCompleteOne)}
                            </span>
                          </div>
                        )}

                        {/* CONTRÔLE DU PACK (OU STOCK UNIFIÉ POUR ATM/MAISON/SUPÉRETTES) */}
                        {packStockKey && (
                          <div className="bg-charcoal/80 border border-bronze/35 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-gold shrink-0" />
                                  <span className="truncate">{packDisplayName}</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                  {isSingleUnifiedKey
                                    ? 'Matériel complet de mission (Pack / Unité)'
                                    : 'Pack complet prêt à l’emploi'}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={readonly || packQty <= 0}
                                  onClick={() => onUpdateStock(packStockKey, -1, false)}
                                  className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span
                                  className={`font-mono tabular-nums text-sm font-extrabold w-8 text-center ${
                                    packQty > 0 ? 'text-emerald-300' : 'text-zinc-400'
                                  }`}
                                >
                                  {packQty}
                                </span>
                                <button
                                  type="button"
                                  disabled={readonly}
                                  onClick={() =>
                                    onUpdateStock(packStockKey, 1, autoDebitGearIllegal)
                                  }
                                  title={
                                    autoDebitGearIllegal && packUnitPrice > 0
                                      ? `Ajouter +1 et déduire ${formatMoney(packUnitPrice)} de l'Argent Sale`
                                      : 'Ajouter +1 au stock'
                                  }
                                  className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-bronze/25">
                              <span className="text-[11px] text-zinc-400">Prix unitaire ($) :</span>
                              <div className="relative w-28">
                                <input
                                  type="number"
                                  min="0"
                                  step="50"
                                  value={packUnitPrice}
                                  disabled={readonly}
                                  onChange={(e) =>
                                    onUpdateItemPrice(
                                      packStockKey,
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  className="w-full bg-obsidian border border-bronze/55 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                                  $
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ITEMS À L'UNITÉ REQUIS POUR LA MISSION (CLÉS + UTILITAIRES) */}
                        {!isSingleUnifiedKey && distinctReqs.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                              {packStockKey
                                ? 'Ou en items seuls (Clés & Utilitaires en coffre)'
                                : 'Matériel requis en coffre'}
                            </div>
                            <div className="divide-y divide-bronze/20 border border-bronze/30 rounded-lg bg-charcoal/45">
                              {distinctReqs.map(
                                ({ req, stockKey, displayName, stockQty, unitPrice }) => {
                                  const ok = stockQty >= req.qty;
                                  return (
                                    <div
                                      key={`${mission.code}-${stockKey}`}
                                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums flex-wrap sm:flex-nowrap"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono text-[11px] font-bold text-gold-light">
                                            {req.qty}&times;
                                          </span>
                                          <span className="font-semibold text-zinc-100 truncate">
                                            {displayName}
                                          </span>
                                        </div>
                                        <div className="text-[10px] mt-0.5 flex items-center gap-2 flex-wrap">
                                          <span
                                            className={`font-mono font-semibold ${
                                              ok
                                                ? 'text-emerald-300'
                                                : stockQty > 0
                                                  ? 'text-amber-300'
                                                  : 'text-zinc-500'
                                            }`}
                                          >
                                            Coffre : {stockQty}
                                            {ok ? ' ✓' : ` / ${req.qty} requis`}
                                          </span>
                                          <span className="text-zinc-500">·</span>
                                          <span className="font-mono text-zinc-400">
                                            {unitPrice > 0
                                              ? `${formatMoney(unitPrice)}/u`
                                              : 'Prix à définir'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="relative w-20">
                                          <input
                                            type="number"
                                            min="0"
                                            step="50"
                                            value={unitPrice}
                                            disabled={readonly}
                                            onChange={(e) =>
                                              onUpdateItemPrice(
                                                stockKey,
                                                Math.max(0, Number(e.target.value) || 0)
                                              )
                                            }
                                            title={`Modifier le prix unitaire de ${displayName}`}
                                            className="w-full bg-obsidian border border-bronze/45 focus:border-gold rounded pl-1.5 pr-4 py-0.5 text-right font-mono text-[11px] font-bold text-gold-light focus:outline-none disabled:opacity-60"
                                          />
                                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500 pointer-events-none">
                                            $
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            disabled={readonly || stockQty <= 0}
                                            onClick={() => onUpdateStock(stockKey, -1, false)}
                                            className="w-6 h-6 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                          >
                                            -
                                          </button>
                                          <span
                                            className={`font-mono text-xs font-bold w-6 text-center ${
                                              ok ? 'text-emerald-300' : 'text-white'
                                            }`}
                                          >
                                            {stockQty}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={readonly}
                                            onClick={() =>
                                              onUpdateStock(stockKey, 1, autoDebitGearIllegal)
                                            }
                                            title={
                                              autoDebitGearIllegal && unitPrice > 0
                                                ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                                                : 'Ajouter +1 au stock'
                                            }
                                            className="w-6 h-6 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* VUE 2 : PAR TYPE (PACKS / CLÉS / UTILITAIRES SANS DOUBLON) */}
        {missionViewMode === 'by_type' && (
          <div className="space-y-5">
            {(typeFilter === 'ALL' || typeFilter === 'packs') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Packs de Braquage &amp; Kits Planning ({filteredPacksEntries.length})
                  </h3>
                  <span className="font-mono text-xs font-bold text-gold tabular-nums">
                    {formatMoney(packsBreakdownVal)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPacksEntries.map((entry) => {
                    const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
                    const unitPrice = getInventoryItemPrice(
                      entry.stockKey,
                      inventoryPrices,
                      entry.defaultPrice
                    );
                    const auto = autonomy.byKey[entry.stockKey];
                    const unscheduled = !auto || (auto.neededPerWeek || 0) === 0;
                    const days = auto?.coveredDays ?? 0;
                    const over30 = auto?.hasMoreThan30 ?? false;

                    return (
                      <div
                        key={entry.stockKey}
                        className={`bg-obsidian/80 border ${
                          qty > 0 ? 'border-emerald-500/40' : 'border-bronze/45'
                        } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-white">{entry.name}</h4>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {entry.kindLabel} ·{' '}
                              <span
                                className={`font-mono font-semibold ${
                                  unitPrice === 0 ? 'text-amber-300' : 'text-gold'
                                }`}
                              >
                                {unitPrice > 0 ? `${formatMoney(unitPrice)} / u` : 'Prix à définir'}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                              qty > 0 ? 'text-emerald-300' : 'text-crimson-light'
                            }`}
                          >
                            {qty > 0 ? `Stock (${qty})` : 'Rupture'}
                          </span>
                        </div>

                        <div className="bg-charcoal/85 border border-bronze/35 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums">
                          <span className="text-zinc-400">Autonomie restante :</span>
                          {unscheduled ? (
                            <span className="font-mono text-zinc-400">Hors planning</span>
                          ) : over30 ? (
                            <span className="font-mono font-bold text-emerald-300">30+ jours</span>
                          ) : days === 0 ? (
                            <span className="font-mono font-bold text-crimson-light">
                              0 jour · Manque {auto?.ruptureDayName}
                            </span>
                          ) : (
                            <span
                              className={`font-mono font-bold ${
                                days < 3 ? 'text-amber-300' : 'text-emerald-300'
                              }`}
                            >
                              {days} jour{days > 1 ? 's' : ''}
                              {auto?.ruptureDayName ? ` (→ ${auto.ruptureDayName})` : ''}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-bronze/35">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                            <div className="relative w-28">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={unitPrice}
                                disabled={readonly}
                                onChange={(e) =>
                                  onUpdateItemPrice(
                                    entry.stockKey,
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                                $
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={readonly || qty <= 0}
                                onClick={() => onUpdateStock(entry.stockKey, -1, false)}
                                className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={readonly}
                                onClick={() =>
                                  onUpdateStock(entry.stockKey, 1, autoDebitGearIllegal)
                                }
                                title={
                                  autoDebitGearIllegal && unitPrice > 0
                                    ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                                    : 'Ajouter +1 au stock'
                                }
                                className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(typeFilter === 'ALL' || typeFilter === 'keys') && (
              <div className="space-y-3 pt-2 border-t border-bronze/30">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Clés &amp; Accès Éminences ({filteredKeysEntries.length})
                  </h3>
                  <span className="font-mono text-xs font-bold text-amber-200 tabular-nums">
                    {formatMoney(keysBreakdownVal)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredKeysEntries.map((entry) => {
                    const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
                    const unitPrice = getInventoryItemPrice(
                      entry.stockKey,
                      inventoryPrices,
                      entry.defaultPrice
                    );
                    const subTotal = qty * unitPrice;

                    return (
                      <div
                        key={entry.stockKey}
                        className={`bg-obsidian/80 border ${
                          qty > 0 ? 'border-amber-500/45' : 'border-bronze/45'
                        } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-white">{entry.name}</h4>
                            <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                              <span className="text-amber-300 font-semibold">{entry.kindLabel}</span>{' '}
                              ·{' '}
                              <span className="font-mono font-semibold text-gold">
                                {formatMoney(unitPrice)} / u
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`font-mono text-[11px] font-bold tabular-nums block ${
                                qty > 0 ? 'text-emerald-300' : 'text-zinc-500'
                              }`}
                            >
                              {qty > 0 ? `Stock (${qty})` : '0 en coffre'}
                            </span>
                            {subTotal > 0 && (
                              <span className="font-mono text-[11px] font-bold text-gold tabular-nums">
                                {formatMoney(subTotal)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-bronze/35">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                            <div className="relative w-28">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={unitPrice}
                                disabled={readonly}
                                onChange={(e) =>
                                  onUpdateItemPrice(
                                    entry.stockKey,
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                                $
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={readonly || qty <= 0}
                                onClick={() => onUpdateStock(entry.stockKey, -1, false)}
                                className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={readonly}
                                onClick={() =>
                                  onUpdateStock(entry.stockKey, 1, autoDebitGearIllegal)
                                }
                                title={
                                  autoDebitGearIllegal && unitPrice > 0
                                    ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                                    : 'Ajouter +1 au stock'
                                }
                                className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                +1
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(typeFilter === 'ALL' || typeFilter === 'utilities') && (
              <div className="space-y-3 pt-2 border-t border-bronze/30">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Items Utilitaires de Mission ({filteredUtilitiesEntries.length})
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    Outils individuels pour composer vos missions
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUtilitiesEntries.map((entry) => {
                    const qty = Math.max(0, Number(inventoryStock[entry.stockKey]) || 0);
                    const unitPrice = getInventoryItemPrice(
                      entry.stockKey,
                      inventoryPrices,
                      entry.defaultPrice
                    );
                    const subTotal = qty * unitPrice;

                    return (
                      <div
                        key={entry.stockKey}
                        className={`bg-obsidian/80 border ${
                          qty > 0 ? 'border-sky-500/45' : 'border-bronze/45'
                        } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-white">{entry.name}</h4>
                            <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                              <span className="text-sky-300 font-semibold">{entry.kindLabel}</span>{' '}
                              ·{' '}
                              <span className="font-mono font-semibold text-gold">
                                {unitPrice > 0 ? `${formatMoney(unitPrice)} / u` : 'Prix à définir'}
                              </span>
                            </div>
                            {entry.sharedNote && (
                              <div className="text-[10px] text-zinc-500 mt-0.5">
                                {entry.sharedNote}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`font-mono text-[11px] font-bold tabular-nums block ${
                                qty > 0 ? 'text-emerald-300' : 'text-zinc-500'
                              }`}
                            >
                              {qty > 0 ? `Stock (${qty})` : '0 en coffre'}
                            </span>
                            {subTotal > 0 && (
                              <span className="font-mono text-[11px] font-bold text-gold tabular-nums">
                                {formatMoney(subTotal)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-bronze/35">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                            <div className="relative w-28">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={unitPrice}
                                disabled={readonly}
                                onChange={(e) =>
                                  onUpdateItemPrice(
                                    entry.stockKey,
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                                $
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={readonly || qty <= 0}
                                onClick={() => onUpdateStock(entry.stockKey, -1, false)}
                                className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={readonly}
                                onClick={() =>
                                  onUpdateStock(entry.stockKey, 1, autoDebitGearIllegal)
                                }
                                title={
                                  autoDebitGearIllegal && unitPrice > 0
                                    ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                                    : 'Ajouter +1 au stock'
                                }
                                className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                disabled={readonly}
                                onClick={() =>
                                  onUpdateStock(entry.stockKey, 5, autoDebitGearIllegal)
                                }
                                title={
                                  autoDebitGearIllegal && unitPrice > 0
                                    ? `Ajouter +5 et déduire ${formatMoney(unitPrice * 5)} de l'Argent Sale`
                                    : 'Ajouter +5 au stock'
                                }
                                className="px-2 h-7 bg-gunmetal hover:bg-sky-400 hover:text-obsidian disabled:opacity-40 text-sky-200 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                              >
                                +5
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ARMURERIE (ARMES UNIQUEMENT) */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-crimson-light">🔫</span> Armurerie &amp; Détention des Armes
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Enregistrez uniquement les armes du cartel, leur prix d&apos;achat (déduit de l&apos;Argent Sale) et leur détenteur.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!readonly && (
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer select-none transition ${
                  autoDebitArsenalQtyIllegal
                    ? 'bg-red-950/30 border-red-500/45 text-red-200'
                    : 'bg-obsidian/70 border-bronze/40 text-zinc-400'
                }`}
                title="Déduit automatiquement le prix unitaire de l'Argent Sale quand vous cliquez sur + sur une arme"
              >
                <input
                  type="checkbox"
                  checked={autoDebitArsenalQtyIllegal}
                  onChange={(e) => setAutoDebitArsenalQtyIllegal(e.target.checked)}
                  className="accent-crimson rounded cursor-pointer"
                />
                <span>
                  💸 Déduire les <strong className="text-white">+1</strong> de l&apos;Argent Sale
                </span>
              </label>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Valeur Totale Armes ({totalWeaponsCount} arme{totalWeaponsCount > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                {formatMoney(weaponsValTotal)}
              </span>
            </div>
          </div>
        </div>

        {!readonly && (
          <form
            onSubmit={handleSubmitWeapon}
            className="rounded-xl border border-gold/40 bg-obsidian/75 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gold">
                {editingId ? `Modifier l'arme : ${weaponName}` : 'Ajouter une arme'}
              </div>
              <span className="text-[11px] text-zinc-400 tabular-nums">
                Argent Sale dispo :{' '}
                <strong className="font-mono text-red-300">
                  {formatMoney(treasuryMoney.illegal || 0)}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <input
                type="text"
                maxLength={80}
                value={weaponName}
                onChange={(e) => setWeaponName(e.target.value)}
                placeholder="Nom de l'arme (ex: AK-47, .50, Pompe, Pistolet...)"
                className="lg:col-span-2 bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={weaponValue}
                  onChange={(e) => setWeaponValue(e.target.value)}
                  placeholder="Prix unitaire ($)"
                  className="w-full bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg pl-3 pr-7 py-2 text-sm text-right font-mono tabular-nums text-white"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                  $
                </span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={weaponQty}
                onChange={(e) => setWeaponQty(e.target.value)}
                placeholder="Qté"
                title="Quantité"
                className="bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-right font-mono tabular-nums text-white"
              />
              <select
                value={weaponHolderId}
                onChange={(e) => setWeaponHolderId(e.target.value)}
                className="bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="coffre">🏛️ Coffre Cartel</option>
                {sortedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              <input
                type="text"
                maxLength={160}
                value={weaponNotes}
                onChange={(e) => setWeaponNotes(e.target.value)}
                placeholder="Détails optionnels (calibre, accessoires, n° série...)"
                className="flex-1 bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-xs text-zinc-200"
              />
              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer select-none shrink-0 ${
                  deductWeaponFormIllegal
                    ? 'bg-red-950/30 border-red-500/45 text-red-200'
                    : 'bg-charcoal border-bronze/40 text-zinc-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={deductWeaponFormIllegal}
                  onChange={(e) => setDeductWeaponFormIllegal(e.target.checked)}
                  className="accent-crimson rounded cursor-pointer"
                />
                <span className="tabular-nums">
                  {editingId ? 'Déduire ajout qté' : "Déduire de l'Argent Sale"}
                  {deductWeaponFormIllegal && weaponFormPurchaseCost > 0
                    ? ` (-${formatMoney(weaponFormPurchaseCost)})`
                    : ''}
                </span>
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
                >
                  {editingId ? 'Enregistrer' : 'Ajouter à l’armurerie'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-charcoal border border-gunmetal text-zinc-300 hover:bg-gunmetal transition cursor-pointer"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* FILTRE & RÉPARTITION PAR DÉTENTEUR */}
        {holderSummaries.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setHolderFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                holderFilter === 'ALL'
                  ? 'bg-gold text-obsidian border-gold'
                  : 'bg-obsidian/80 text-zinc-300 border-bronze/50 hover:border-gold/50'
              }`}
            >
              Tous ({totalWeaponsCount}) · {formatMoney(weaponsValTotal)}
            </button>
            {holderSummaries.map((h) => {
              const active = holderFilter === h.holderId;
              return (
                <button
                  key={h.holderId}
                  type="button"
                  onClick={() => setHolderFilter(active ? 'ALL' : h.holderId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                    active
                      ? 'bg-gold/20 text-gold-light border-gold'
                      : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
                  }`}
                >
                  {h.holderId === 'coffre' ? '🏛️ ' : '👤 '}
                  {h.label} ({h.count}) ·{' '}
                  <span className="font-mono text-gold">{formatMoney(h.totalVal)}</span>
                </button>
              );
            })}
          </div>
        )}

        {filteredWeapons.length === 0 ? (
          <div className="bg-obsidian/50 border border-bronze/35 rounded-xl p-6 text-center text-xs text-zinc-400">
            {weaponsList.length === 0
              ? 'Aucune arme enregistrée dans l’arsenal pour le moment.'
              : 'Aucune arme pour ce détenteur.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWeapons.map((w) => {
              const qty = Math.max(1, Number(w.qty) || 1);
              const unitVal = Math.max(0, Number(w.value) || 0);
              const subTotal = qty * unitVal;
              const holderName = getWeaponHolderName(w.holderId, members);
              const isCoffre = !w.holderId || w.holderId === 'coffre';

              return (
                <div
                  key={w.id}
                  className="bg-obsidian/80 border border-bronze/45 hover:border-gold/50 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white truncate">{w.name}</h4>
                        <span className="text-xs font-mono tabular-nums text-zinc-400">
                          {formatMoney(unitVal)} l&apos;unité
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-gold tabular-nums shrink-0">
                        {formatMoney(subTotal)}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-zinc-300">
                      {isCoffre ? '🏛️' : '👤'} Détenue par :{' '}
                      <span className={isCoffre ? 'text-zinc-200' : 'text-gold-light'}>
                        {holderName}
                      </span>
                    </div>

                    {w.notes && (
                      <p className="text-[11px] text-zinc-400 leading-snug">{w.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-bronze/35">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={readonly || qty <= 1}
                        onClick={() => onUpdateWeaponQty(w.id, -1, false)}
                        className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() =>
                          onUpdateWeaponQty(w.id, 1, autoDebitArsenalQtyIllegal)
                        }
                        title={
                          autoDebitArsenalQtyIllegal && unitVal > 0
                            ? `Ajouter +1 et déduire ${formatMoney(unitVal)} de l'Argent Sale`
                            : 'Ajouter +1 en stock'
                        }
                        className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>

                    {!readonly && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          title="Déclarer une arme perdue (-1 stock, +valeur aux pertes)"
                          onClick={() => handleLoseClick(w.id)}
                          className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                            loseArmId === w.id
                              ? 'bg-red-600 text-white border-red-400 font-bold'
                              : 'bg-crimson/20 border-crimson/40 text-red-200 hover:bg-crimson/35'
                          }`}
                        >
                          {loseArmId === w.id ? 'Confirmer perte ?' : '💥 Perdue'}
                        </button>
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => handleEditWeapon(w)}
                          className="text-zinc-400 hover:text-gold text-xs px-2 py-1 rounded bg-charcoal border border-gunmetal cursor-pointer"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          onClick={() => handleDeleteClick(w.id)}
                          className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                            delArmId === w.id
                              ? 'bg-red-600/20 border-red-500/60 text-red-300 font-bold'
                              : 'bg-charcoal border-gunmetal text-zinc-400 hover:text-red-400'
                          }`}
                        >
                          {delArmId === w.id ? 'Confirmer ?' : '✕'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GILETS & MUNITIONS */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-300">🦺</span> Gilets Pare-Balles &amp; Munitions
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Stock dédié aux gilets et calibres de munitions — configurez leurs prix élevés et déduisez chaque achat de l&apos;Argent Sale.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!readonly && (
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer select-none transition ${
                  autoDebitProtectionIllegal
                    ? 'bg-red-950/30 border-red-500/45 text-red-200'
                    : 'bg-obsidian/70 border-bronze/40 text-zinc-400'
                }`}
                title="Déduit automatiquement le prix d'achat de l'Argent Sale quand vous cliquez sur +1 ou +5"
              >
                <input
                  type="checkbox"
                  checked={autoDebitProtectionIllegal}
                  onChange={(e) => setAutoDebitProtectionIllegal(e.target.checked)}
                  className="accent-crimson rounded cursor-pointer"
                />
                <span>
                  💸 Déduire les ajouts (<strong className="text-white">+1/+5</strong>) de l&apos;Argent Sale ·{' '}
                  <strong className="font-mono text-gold-light tabular-nums">
                    {formatMoney(treasuryMoney.illegal || 0)}
                  </strong>
                </span>
              </label>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Valeur Gilets &amp; Munitions ({totalProtectionQty} unité{totalProtectionQty > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-amber-200 tabular-nums">
                {formatMoney(protectionValTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {protectionItems.map((item) => {
            const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
            const unitPrice = getInventoryItemPrice(item.key, inventoryPrices);
            const subTotal = qty * unitPrice;
            const isVest = item.key === 'gilet';

            return (
              <div
                key={item.key}
                className={`bg-obsidian/80 border ${
                  qty > 0 ? 'border-amber-500/45' : 'border-bronze/45'
                } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                      <span
                        className={
                          isVest ? 'text-sky-300 font-semibold' : 'text-amber-300 font-semibold'
                        }
                      >
                        {isVest ? 'Protection' : 'Munitions · Prix élevé'}
                      </span>{' '}
                      ·{' '}
                      <span
                        className={`font-mono font-semibold ${
                          unitPrice === 0 ? 'text-amber-300' : 'text-gold'
                        }`}
                      >
                        {unitPrice > 0 ? `${formatMoney(unitPrice)} / u` : 'Prix à définir'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-[11px] font-bold tabular-nums block ${
                        qty > 0 ? 'text-emerald-300' : 'text-crimson-light'
                      }`}
                    >
                      {qty > 0 ? `Stock (${qty})` : 'Rupture'}
                    </span>
                    {subTotal > 0 && (
                      <span className="font-mono text-[11px] font-bold text-gold tabular-nums">
                        {formatMoney(subTotal)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-bronze/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                    <div className="relative w-32">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={unitPrice}
                        disabled={readonly}
                        onChange={(e) =>
                          onUpdateItemPrice(
                            item.key,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                        $
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={readonly || qty <= 0}
                        onClick={() => onUpdateStock(item.key, -1, false)}
                        className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() => onUpdateStock(item.key, 1, autoDebitProtectionIllegal)}
                        title={
                          autoDebitProtectionIllegal && unitPrice > 0
                            ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                            : 'Ajouter +1 au stock'
                        }
                        className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() => onUpdateStock(item.key, 5, autoDebitProtectionIllegal)}
                        title={
                          autoDebitProtectionIllegal && unitPrice > 0
                            ? `Ajouter +5 et déduire ${formatMoney(unitPrice * 5)} de l'Argent Sale`
                            : 'Ajouter +5 au stock'
                        }
                        className="px-2 h-7 bg-gunmetal hover:bg-amber-400 hover:text-obsidian disabled:opacity-40 text-amber-200 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACCESSOIRES D'ARMES (MARABUNTA) */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-sky-300">🔩</span> Accessoires d&apos;Armes &amp; Équipement
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chargeurs, lunettes et poignées pour vos armes — synchronisés avec le coffre.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!readonly && (
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer select-none transition ${
                  autoDebitAccessoriesIllegal
                    ? 'bg-red-950/30 border-red-500/45 text-red-200'
                    : 'bg-obsidian/70 border-bronze/40 text-zinc-400'
                }`}
                title="Déduit automatiquement le prix d'achat de l'Argent Sale quand vous cliquez sur +1 ou +5"
              >
                <input
                  type="checkbox"
                  checked={autoDebitAccessoriesIllegal}
                  onChange={(e) => setAutoDebitAccessoriesIllegal(e.target.checked)}
                  className="accent-crimson rounded cursor-pointer"
                />
                <span>
                  💸 Déduire les ajouts (<strong className="text-white">+1/+5</strong>) de l&apos;Argent Sale ·{' '}
                  <strong className="font-mono text-gold-light tabular-nums">
                    {formatMoney(treasuryMoney.illegal || 0)}
                  </strong>
                </span>
              </label>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Valeur Accessoires ({totalAccessoriesQty} pièce{totalAccessoriesQty > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-sky-200 tabular-nums">
                {formatMoney(accessoriesValTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessoryAndCatalogItems.map((item) => {
            const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
            const unitPrice = getInventoryItemPrice(
              item.key,
              inventoryPrices,
              item.defaultPrice
            );
            const subTotal = qty * unitPrice;

            return (
              <div
                key={item.key}
                className={`bg-obsidian/80 border ${
                  qty > 0 ? 'border-sky-500/45' : 'border-bronze/45'
                } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                      <span className="text-sky-300 font-semibold">{item.badgeLabel}</span> ·{' '}
                      <span
                        className={`font-mono font-semibold ${
                          unitPrice === 0 ? 'text-amber-300' : 'text-gold'
                        }`}
                      >
                        {unitPrice > 0 ? `${formatMoney(unitPrice)} / u` : 'Prix à définir'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-[11px] font-bold tabular-nums block ${
                        qty > 0 ? 'text-emerald-300' : 'text-zinc-500'
                      }`}
                    >
                      {qty > 0 ? `Stock (${qty})` : '0 en coffre'}
                    </span>
                    {subTotal > 0 && (
                      <span className="font-mono text-[11px] font-bold text-gold tabular-nums">
                        {formatMoney(subTotal)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-bronze/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                    <div className="relative w-32">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={unitPrice}
                        disabled={readonly}
                        onChange={(e) =>
                          onUpdateItemPrice(
                            item.key,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                        $
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={readonly || qty <= 0}
                        onClick={() => onUpdateStock(item.key, -1, false)}
                        className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() =>
                          onUpdateStock(item.key, 1, autoDebitAccessoriesIllegal)
                        }
                        title={
                          autoDebitAccessoriesIllegal && unitPrice > 0
                            ? `Ajouter +1 et déduire ${formatMoney(unitPrice)} de l'Argent Sale`
                            : 'Ajouter +1 au stock'
                        }
                        className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() =>
                          onUpdateStock(item.key, 5, autoDebitAccessoriesIllegal)
                        }
                        title={
                          autoDebitAccessoriesIllegal && unitPrice > 0
                            ? `Ajouter +5 et déduire ${formatMoney(unitPrice * 5)} de l'Argent Sale`
                            : 'Ajouter +5 au stock'
                        }
                        className="px-2 h-7 bg-gunmetal hover:bg-sky-400 hover:text-obsidian disabled:opacity-40 text-sky-200 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OBJETS À VENDRE : RECELEUR (BRAD) SÉPARÉ DU WHISKEY */}
      <LootSaleSection
        rewardStocks={rewardStocks}
        treasuryMoney={treasuryMoney}
        readonly={readonly}
        onUpdateRewardQty={onUpdateRewardQty}
        onSellRewards={onSellRewards}
      />
    </div>
  );
};
