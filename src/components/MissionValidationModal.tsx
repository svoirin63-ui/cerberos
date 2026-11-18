import React, { useEffect, useMemo, useState } from 'react';
import { INVENTORY_ITEMS, REWARD_ITEMS } from '@/src/data/cartelData';
import type {
  HierarchyMember,
  InventoryStock,
  LostWeaponRecord,
  Mission,
  MissionStateEntry,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import { formatMoney, getStatus, getWeaponHolderName } from '@/src/utils/finance';

export interface MissionValidationPayload {
  missionId: string;
  status: 'success' | 'fail';
  consumeGear: boolean;
  loot: Record<string, number>;
  cashGain: number;
  lostWeapons: LostWeaponRecord[];
  cashLoss: number;
  treasuryDebitAccount: 'none' | 'illegal' | 'legal';
  treasuryDebitAmount: number;
  players: string[];
}

interface MissionValidationModalProps {
  open: boolean;
  mission: Mission | null;
  dayName: string;
  entry: MissionStateEntry;
  inventoryStock: InventoryStock;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  members: HierarchyMember[];
  onClose: () => void;
  onConfirm: (payload: MissionValidationPayload) => void;
  onResetMission: (missionId: string) => void;
}

export const MissionValidationModal: React.FC<MissionValidationModalProps> = ({
  open,
  mission,
  dayName,
  entry,
  inventoryStock,
  weaponsStock,
  rewardStocks,
  treasuryMoney,
  members,
  onClose,
  onConfirm,
  onResetMission,
}) => {
  const [status, setStatus] = useState<'success' | 'fail'>('success');
  const [consumeGear, setConsumeGear] = useState(true);
  const [loot, setLoot] = useState<Record<string, number>>({});
  const [cashGain, setCashGain] = useState<string>('');
  const [lostWeapons, setLostWeapons] = useState<LostWeaponRecord[]>([]);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [cashLoss, setCashLoss] = useState<string>('');
  const [treasuryDebitAccount, setTreasuryDebitAccount] = useState<'none' | 'illegal' | 'legal'>('none');
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !mission) return;

    const currentStatus = getStatus(entry);
    setStatus(currentStatus === 'fail' ? 'fail' : 'success');

    const hasTrackableGear =
      mission.gearKey !== 'none' && INVENTORY_ITEMS.some((i) => i.key === mission.gearKey);
    const currentGearStock = inventoryStock[mission.gearKey] || 0;
    setConsumeGear(
      hasTrackableGear && (Boolean(entry.gearConsumed) || currentGearStock > 0)
    );

    const initLoot: Record<string, number> = {};
    let initLootVal = 0;
    if (entry.loot && typeof entry.loot === 'object') {
      Object.entries(entry.loot).forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (qty > 0) {
          initLoot[k] = qty;
          const itemRef = REWARD_ITEMS.find((i) => i.key === k);
          const unitVal =
            rewardStocks[k]?.val !== undefined
              ? Math.max(0, Number(rewardStocks[k].val) || 0)
              : itemRef?.defaultVal || 0;
          initLootVal += qty * unitVal;
        }
      });
    }
    setLoot(initLoot);

    const existingGain = Math.max(0, Number(entry.gain) || 0);
    const initialCash = Math.max(0, existingGain - initLootVal);
    setCashGain(initialCash > 0 ? String(initialCash) : '');

    const initLost = Array.isArray(entry.lostWeapons) ? [...entry.lostWeapons] : [];
    setLostWeapons(initLost);
    const initLostVal = initLost.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
    const existingExtra = Math.max(0, Number(entry.extra) || 0);
    const initialOtherLoss = Math.max(0, existingExtra - initLostVal);
    setCashLoss(initialOtherLoss > 0 ? String(initialOtherLoss) : '');
    setTreasuryDebitAccount('none');
    setPlayers(Array.isArray(entry.players) ? [...entry.players] : []);
  }, [open, mission, entry, inventoryStock, rewardStocks]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      ),
    [members]
  );

  // Pool of available weapons = current stock + previously lost on this mission - currently staged lost in modal
  const availableWeapons = useMemo(() => {
    const map: WeaponsStock = {};
    Object.values(weaponsStock).forEach((w) => {
      if (w && (Number(w.qty) || 0) > 0) {
        map[w.id] = { ...w, qty: Math.floor(Number(w.qty) || 0) };
      }
    });
    const prevLost = Array.isArray(entry.lostWeapons) ? entry.lostWeapons : [];
    prevLost.forEach((lw) => {
      if (!lw.id) return;
      if (map[lw.id]) {
        map[lw.id] = { ...map[lw.id], qty: map[lw.id].qty + 1 };
      } else {
        map[lw.id] = {
          id: lw.id,
          name: lw.name,
          value: Math.max(0, Number(lw.value) || 0),
          qty: 1,
          holderId: lw.holderId || 'coffre',
          notes: '',
        };
      }
    });
    lostWeapons.forEach((lw) => {
      if (!lw.id || !map[lw.id]) return;
      if (map[lw.id].qty <= 1) {
        delete map[lw.id];
      } else {
        map[lw.id] = { ...map[lw.id], qty: map[lw.id].qty - 1 };
      }
    });
    return Object.values(map)
      .filter((w) => w.qty > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'));
  }, [weaponsStock, entry.lostWeapons, lostWeapons]);

  if (!open || !mission) return null;

  const gearItem = INVENTORY_ITEMS.find((i) => i.key === mission.gearKey);
  const currentGearStock = inventoryStock[mission.gearKey] || 0;
  const maxAvailableGear = currentGearStock + (entry.gearConsumed ? 1 : 0);
  const gearWillBeDebited = Boolean(gearItem) && consumeGear && maxAvailableGear > 0;

  const lootTotalVal =
    status === 'success'
      ? REWARD_ITEMS.reduce((sum, item) => {
          const q = Math.max(0, Number(loot[item.key]) || 0);
          const unitVal =
            rewardStocks[item.key]?.val !== undefined
              ? Math.max(0, Number(rewardStocks[item.key].val) || 0)
              : item.defaultVal;
          return sum + q * unitVal;
        }, 0)
      : 0;

  const parsedCashGain = status === 'success' ? Math.max(0, Number(cashGain) || 0) : 0;
  const totalMissionGain = lootTotalVal + parsedCashGain;
  const weaponsLossVal = lostWeapons.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
  const parsedCashLoss = Math.max(0, Number(cashLoss) || 0);
  const totalMissionExtra = weaponsLossVal + parsedCashLoss;
  const netEstimate = totalMissionGain - mission.cost - totalMissionExtra;

  const chosenWeaponId =
    selectedWeaponId && availableWeapons.some((w) => w.id === selectedWeaponId)
      ? selectedWeaponId
      : availableWeapons[0]?.id || '';

  const adjustLoot = (key: string, delta: number) => {
    setLoot((prev) => {
      const nextQty = Math.max(0, (prev[key] || 0) + delta);
      const copy = { ...prev };
      if (nextQty === 0) delete copy[key];
      else copy[key] = nextQty;
      return copy;
    });
  };

  const addLostWeapon = () => {
    if (!chosenWeaponId) return;
    const weapon = availableWeapons.find((w) => w.id === chosenWeaponId);
    if (!weapon) return;
    setLostWeapons((prev) => [
      ...prev,
      {
        id: weapon.id,
        name: weapon.name,
        value: Math.max(0, Number(weapon.value) || 0),
        holderId: weapon.holderId || 'coffre',
        holderName: getWeaponHolderName(weapon.holderId, members),
      },
    ]);
  };

  const removeLostWeapon = (idx: number) => {
    setLostWeapons((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePlayer = (pid: string) => {
    setPlayers((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const debitAmount =
      treasuryDebitAccount !== 'none' ? parsedCashLoss : 0;
    onConfirm({
      missionId: mission.id,
      status,
      consumeGear: gearWillBeDebited,
      loot: status === 'success' ? loot : {},
      cashGain: parsedCashGain,
      lostWeapons,
      cashLoss: parsedCashLoss,
      treasuryDebitAccount,
      treasuryDebitAmount: debitAmount,
      players,
    });
  };

  const wasAlreadyDone = getStatus(entry) !== '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-charcoal gold-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold block">
              {dayName} · Validation de mission
            </span>
            <h3 className="font-display text-lg sm:text-xl font-extrabold text-white mt-0.5">
              {mission.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              👥 {mission.crims} · ⏱️ {mission.wait} · 📦 {mission.gearName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl font-bold leading-none cursor-pointer px-1"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        {/* 1. ISSUE DE LA MISSION */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            1. Résultat de l&apos;opération
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStatus('success')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                status === 'success'
                  ? 'bg-emerald-500 text-obsidian border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-obsidian/80 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
              }`}
            >
              ✅ Mission Réussie
            </button>
            <button
              type="button"
              onClick={() => setStatus('fail')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                status === 'fail'
                  ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/20'
                  : 'bg-obsidian/80 text-red-300 border-red-500/30 hover:bg-red-500/15'
              }`}
            >
              ❌ Mission Échouée / Perdue
            </button>
          </div>
        </div>

        {/* 2. MATÉRIEL UTILISÉ */}
        {gearItem && (
          <div className="bg-obsidian/75 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="text-amber-300">📦</span> Matériel utilisé : {gearItem.name}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                Stock disponible :{' '}
                <strong className={maxAvailableGear > 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {maxAvailableGear}
                </strong>{' '}
                · Coût comptable :{' '}
                <strong className="text-amber-300">-{formatMoney(mission.cost)}</strong>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={gearWillBeDebited}
                disabled={maxAvailableGear <= 0}
                onChange={(e) => setConsumeGear(e.target.checked)}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer disabled:opacity-40"
              />
              <span>
                {maxAvailableGear > 0
                  ? 'Débiter 1 du stock Inventaire'
                  : 'Stock à 0 (aucun débit stock)'}
              </span>
            </label>
          </div>
        )}

        {/* 3. ITEMS RÉCUPÉRÉS & GAINS (SI RÉUSSIE) */}
        {status === 'success' && (
          <div className="bg-emerald-950/15 border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                💎 2. Objets récupérés (→ Inventaire &amp; Trésorerie)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-300 tabular-nums">
                Valeur objets : +{formatMoney(lootTotalVal)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {REWARD_ITEMS.map((item) => {
                const qty = loot[item.key] || 0;
                const unitVal =
                  rewardStocks[item.key]?.val !== undefined
                    ? Math.max(0, Number(rewardStocks[item.key].val) || 0)
                    : item.defaultVal;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                      qty > 0
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                        : 'bg-zinc-950/80 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {formatMoney(unitVal)} / u
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => adjustLoot(item.key, -1)}
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-gold w-5 text-center tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustLoot(item.key, 1)}
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-emerald-500/20 flex-wrap">
              <label className="text-xs font-semibold text-zinc-300">
                💵 Gains cash supplémentaires ($) :
              </label>
              <div className="relative w-40">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cashGain}
                  onChange={(e) => setCashGain(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-400 rounded-lg pl-3 pr-7 py-1.5 text-right text-xs font-mono tabular-nums text-emerald-300 focus:outline-none"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                  $
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. ARMES PERDUES & PERTES TRÉSORERIE */}
        <div
          className={`rounded-xl p-4 space-y-3 border ${
            status === 'fail'
              ? 'bg-red-950/25 border-red-500/45'
              : 'bg-obsidian/70 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-red-300">
              🔫 {status === 'success' ? '3.' : '2.'} Armes perdues &amp; Débit Trésorerie
            </span>
            {totalMissionExtra > 0 && (
              <span className="text-xs font-mono font-bold text-red-300 tabular-nums">
                Total pertes : -{formatMoney(totalMissionExtra)}
              </span>
            )}
          </div>

          {lostWeapons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lostWeapons.map((lw, idx) => (
                <span
                  key={`${lw.id}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-950/70 border border-red-500/50 text-red-200 tabular-nums"
                >
                  <span>
                    {lw.name} ({lw.holderName}) · -{formatMoney(lw.value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLostWeapon(idx)}
                    className="text-red-300 hover:text-white font-bold cursor-pointer"
                    title="Retirer cette arme perdue"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {availableWeapons.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={chosenWeaponId}
                onChange={(e) => setSelectedWeaponId(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                {availableWeapons.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {getWeaponHolderName(w.holderId, members)} ({formatMoney(w.value)}) [x{w.qty}]
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addLostWeapon}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-crimson/35 hover:bg-crimson/55 text-red-100 border border-crimson-light/40 transition whitespace-nowrap cursor-pointer"
              >
                + Déclarer perdue (-1)
              </button>
            </div>
          ) : (
            <p className="text-[11px] italic text-zinc-400">
              Aucune arme disponible en stock dans l&apos;Armurerie.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/70">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Autre montant perdu / Amende ($) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cashLoss}
                  onChange={(e) => setCashLoss(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg pl-3 pr-7 py-1.5 text-right text-xs font-mono tabular-nums text-red-300 focus:outline-none"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                  $
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Débiter ce montant cash de la caisse :
              </label>
              <select
                value={treasuryDebitAccount}
                disabled={parsedCashLoss <= 0}
                onChange={(e) =>
                  setTreasuryDebitAccount(e.target.value as 'none' | 'illegal' | 'legal')
                }
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none disabled:opacity-45"
              >
                <option value="none">Comptabilité seule (ne pas toucher au cash)</option>
                <option value="illegal">
                  Déduire de l&apos;Argent Illégal ({formatMoney(treasuryMoney.illegal || 0)})
                </option>
                <option value="legal">
                  Déduire de l&apos;Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                </option>
              </select>
            </div>
          </div>
          {weaponsLossVal > 0 && (
            <p className="text-[11px] text-red-200/80">
              ℹ️ Les armes perdues ({formatMoney(weaponsLossVal)}) sont automatiquement déduites du stock Armurerie, de la Trésorerie &amp; Actifs Totaux, et ajoutées aux pertes de la mission.
            </p>
          )}
        </div>

        {/* 5. JOUEURS PARTICIPANTS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              👥 Joueurs participants ({players.length})
            </span>
          </div>
          {sortedMembers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sortedMembers.map((member) => {
                const selected = players.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => togglePlayer(member.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                      selected
                        ? 'bg-gold/20 border-gold text-gold-light font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {member.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500">Aucun membre configuré.</p>
          )}
        </div>

        {/* RÉCAP & ACTIONS */}
        <div className="bg-obsidian/90 border border-gold/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs space-y-0.5 tabular-nums">
            <div className="text-zinc-400">
              Gains : <strong className="text-emerald-400">+{formatMoney(totalMissionGain)}</strong> ·
              Matériel : <strong className="text-amber-300">-{formatMoney(mission.cost)}</strong> ·
              Pertes : <strong className="text-red-400">-{formatMoney(totalMissionExtra)}</strong>
            </div>
            <div className="font-bold text-white">
              Résultat net mission :{' '}
              <span className={netEstimate >= 0 ? 'text-emerald-400' : 'text-crimson-light'}>
                {netEstimate >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(netEstimate))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {wasAlreadyDone && (
              <button
                type="button"
                onClick={() => {
                  onResetMission(mission.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-red-300 border border-red-500/30 transition cursor-pointer"
              >
                Annuler statut
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg cursor-pointer"
            >
              ✅ Valider la mission
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
