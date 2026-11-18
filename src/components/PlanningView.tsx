import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DAY_NAMES, INVENTORY_ITEMS, REWARD_ITEMS, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import type {
  HierarchyMember,
  InventoryStock,
  Mission,
  MissionStateEntry,
  MissionStates,
} from '@/src/types/cartel';
import {
  checkStockAvailability,
  dayDate,
  displayWeekStart,
  fmtLong,
  fmtShort,
  formatMoney,
  formatSigned,
  getMissionEntry,
  isTodayName,
  missionFin,
  netClass,
} from '@/src/utils/finance';

interface PlanningViewProps {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  members: HierarchyMember[];
  readonly: boolean;
  onOpenMissionValidation: (
    mission: Mission,
    dayName: string,
    initialStatus: 'success' | 'fail'
  ) => void;
  onResetMission: (missionId: string) => void;
  onToggleWholeDay: (dayName: string) => void;
  onToggleAllWeek: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  missionStates,
  inventoryStock,
  members,
  readonly,
  onOpenMissionValidation,
  onResetMission,
  onToggleWholeDay,
  onToggleAllWeek,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [openDays, setOpenDays] = useState<Set<string>>(() => {
    const today = DAY_NAMES.find((d) => isTodayName(d, missionStates));
    return new Set(today ? [today] : []);
  });
  const didScrollTodayRef = useRef(false);
  const todayCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!didScrollTodayRef.current && activeFilter === 'ALL' && todayCardRef.current) {
      didScrollTodayRef.current = true;
      const el = todayCardRef.current;
      const timer = window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [activeFilter]);

  const start = displayWeekStart(missionStates);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const handleFilterDay = (day: string) => {
    setActiveFilter(day);
    if (day !== 'ALL') {
      setOpenDays((prev) => {
        const next = new Set(prev);
        next.add(day);
        return next;
      });
    }
  };

  const toggleDay = (day: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleAllDays = () => {
    setOpenDays((prev) => {
      if (prev.size >= DAY_NAMES.length) return new Set();
      return new Set(DAY_NAMES);
    });
  };

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [members]);

  const renderValidatedSummaryBadges = (st: MissionStateEntry) => {
    const usedGearEntries =
      st.usedGear && typeof st.usedGear === 'object'
        ? Object.entries(st.usedGear).filter(([, q]) => (Number(q) || 0) > 0)
        : [];
    const cashGainVal =
      st.status !== 'fail' ? Math.max(0, Number(st.cashGain) || 0) : 0;
    const lootItems = REWARD_ITEMS.filter(
      (item) => st.loot && (Number(st.loot[item.key]) || 0) > 0
    );
    const lostWeapons = Array.isArray(st.lostWeapons) ? st.lostWeapons : [];
    const playerIds = Array.isArray(st.players) ? st.players : [];
    const playerNames = playerIds
      .map((id) => memberNameMap.get(id))
      .filter((n): n is string => Boolean(n));

    if (
      usedGearEntries.length === 0 &&
      !st.gearConsumed &&
      cashGainVal <= 0 &&
      lootItems.length === 0 &&
      lostWeapons.length === 0 &&
      playerNames.length === 0
    ) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {usedGearEntries.length > 0 ? (
          usedGearEntries.map(([gKey, qty]) => {
            const gItem = INVENTORY_ITEMS.find((i) => i.key === gKey);
            return (
              <span
                key={gKey}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 tabular-nums"
              >
                📦 -{qty} {gItem?.name || gKey}
              </span>
            );
          })
        ) : st.gearConsumed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            📦 -1 matériel débité
          </span>
        ) : null}
        {cashGainVal > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/15 text-red-200 border border-red-500/35 tabular-nums">
            💰 +{formatMoney(cashGainVal)} Argent Sale
          </span>
        )}
        {lootItems.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-200 border border-emerald-500/35 tabular-nums"
          >
            💎 {item.name} &times;{st.loot![item.key]}
          </span>
        ))}
        {lostWeapons.map((lw, idx) => (
          <span
            key={`${lw.id}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-950/60 text-red-200 border border-red-500/40 tabular-nums"
          >
            🔫 {lw.name} ({lw.holderName}) · -{formatMoney(lw.value)}
          </span>
        ))}
        {playerNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gold/15 text-gold-light border border-gold/35"
          >
            👥 {name}
          </span>
        ))}
      </div>
    );
  };

  const single = activeFilter !== 'ALL';
  const filteredDays = single
    ? WEEKLY_SCHEDULE.filter((d) => d.day === activeFilter)
    : WEEKLY_SCHEDULE;

  const renderSingleDayRows = (dayName: string, missions: Mission[]) => {
    const cols = 'lg:grid-cols-[minmax(0,2.4fr)_90px_230px_110px_110px_110px]';

    return (
      <div className="p-3 sm:p-4">
        <div
          className={`hidden lg:grid ${cols} gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500`}
        >
          <span>Mission</span>
          <span className="text-right">Matériel</span>
          <span className="text-center">Statut</span>
          <span className="text-right">Gains</span>
          <span className="text-right">Pertes</span>
          <span className="text-right">Résultat</span>
        </div>
        <div className="space-y-1.5">
          {missions.map((m) => {
            const st = getMissionEntry(missionStates, m.id);
            const f = missionFin(m, missionStates);
            const hasStock = checkStockAvailability(m.gearKey, inventoryStock).available;
            const isTenMin = m.wait === '10 min';
            const rowClass = f.success
              ? 'bg-emerald-950/30 border-emerald-500/50'
              : f.fail
                ? 'bg-red-950/30 border-red-500/50'
                : hasStock
                  ? 'bg-charcoal/60 border-zinc-700/70'
                  : 'bg-zinc-950/40 border-zinc-800/60';

            const btnBase =
              'flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition whitespace-nowrap cursor-pointer';
            const okBtn =
              btnBase +
              (f.success
                ? ' bg-emerald-500 text-obsidian border-emerald-400'
                : ' bg-zinc-900 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15');
            const koBtn =
              btnBase +
              (f.fail
                ? ' bg-red-600 text-white border-red-400'
                : ' bg-zinc-900 text-red-300 border-red-500/40 hover:bg-red-500/15');

            const badges = f.done ? renderValidatedSummaryBadges(st) : null;

            return (
              <div
                key={m.id}
                className={`border rounded-xl px-3 py-2.5 grid grid-cols-1 ${cols} gap-2 lg:gap-3 lg:items-center transition ${rowClass}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-zinc-100">{m.name}</span>
                    {m.major && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gradient-to-r from-gold to-amber-300 text-obsidian">
                        Gros Coup
                      </span>
                    )}
                    {f.done && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gold/20 text-gold-light border border-gold/40">
                        ✓ Validée
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                    <span>👥 {m.crims}</span>
                    <span className={`font-mono tabular-nums ${isTenMin ? 'text-red-300 font-semibold' : ''}`}>
                      ⏱️ {m.wait}
                    </span>
                    <span className={hasStock ? 'text-emerald-300' : 'text-red-300'}>
                      {hasStock ? '✅ Matériel OK' : '⚠️ Stock insuffisant'}
                    </span>
                    <span className="text-zinc-500 truncate">{m.gearName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Matériel
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      m.cost > 0 ? 'text-amber-300' : 'text-zinc-500'
                    }`}
                  >
                    {m.cost > 0 ? '-' + formatMoney(m.cost) : '0 $'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenMissionValidation(m, dayName, 'success')}
                    className={okBtn}
                    title="Ouvrir le formulaire de validation (Réussie)"
                  >
                    ✅ Réussie
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMissionValidation(m, dayName, 'fail')}
                    className={koBtn}
                    title="Ouvrir le formulaire de validation (Échouée)"
                  >
                    ❌ Échec
                  </button>
                  {f.done && !readonly && (
                    <button
                      type="button"
                      onClick={() => onResetMission(m.id)}
                      title="Annuler la validation"
                      className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-300 border border-zinc-700 transition cursor-pointer"
                    >
                      ↺
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Gains
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      f.gain > 0 ? 'text-emerald-300' : 'text-zinc-500'
                    }`}
                  >
                    {f.success ? formatMoney(f.gain) : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Pertes
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      f.extra > 0 ? 'text-red-300' : 'text-zinc-500'
                    }`}
                  >
                    {f.done && f.extra > 0 ? '-' + formatMoney(f.extra) : '0 $'}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Résultat
                  </span>
                  <span
                    className={`font-mono tabular-nums text-sm font-extrabold ${
                      f.done ? netClass(f.net) : 'text-zinc-600'
                    }`}
                  >
                    {f.done ? formatSigned(f.net) : '—'}
                  </span>
                </div>

                {badges && (
                  <div className="lg:col-span-full pt-2 mt-1 border-t border-zinc-800/70">
                    {badges}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleFilterDay('ALL')}
            className={
              activeFilter === 'ALL'
                ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian transition whitespace-nowrap cursor-pointer'
                : 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-charcoal text-zinc-300 hover:text-white border border-zinc-800 transition whitespace-nowrap cursor-pointer'
            }
          >
            Toute la semaine ({fmtShort(start)} → {fmtShort(end)})
          </button>
          {DAY_NAMES.map((day) => {
            const isToday = isTodayName(day, missionStates);
            const isActive = activeFilter === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => handleFilterDay(day)}
                className={
                  isActive
                    ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian transition whitespace-nowrap cursor-pointer'
                    : 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-charcoal text-zinc-300 hover:text-white border border-zinc-800 transition whitespace-nowrap cursor-pointer'
                }
              >
                {isToday ? '• ' : ''}
                {day} {fmtShort(dayDate(day, missionStates))}
              </button>
            );
          })}
        </div>

        {!readonly && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={toggleAllDays}
              className="text-xs font-semibold text-zinc-300 hover:text-white underline underline-offset-4 transition cursor-pointer"
            >
              Tout déplier / replier
            </button>
            <button
              type="button"
              onClick={onToggleAllWeek}
              className="text-xs font-semibold text-gold hover:text-gold-light underline underline-offset-4 transition cursor-pointer"
            >
              Tout cocher / décocher
            </button>
            <p className="text-xs text-zinc-400 italic">
              Cliquez sur Réussie ou Échouée pour renseigner et valider la mission.
            </p>
          </div>
        )}
      </div>

      <div
        className={
          single
            ? 'grid grid-cols-1 gap-4 items-start'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start'
        }
      >
        {filteredDays.map((dayObj) => {
          let okCount = 0;
          let koCount = 0;
          let dayCost = 0;
          let dayExtra = 0;
          let dayGains = 0;

          dayObj.missions.forEach((m) => {
            const f = missionFin(m, missionStates);
            if (f.success) okCount++;
            if (f.fail) koCount++;
            dayCost += f.cost;
            dayExtra += f.extra;
            dayGains += f.gain;
          });

          const dayNet = dayGains - dayCost - dayExtra;
          const isDayFullyDone = okCount + koCount === dayObj.missions.length;
          const todayCard = isTodayName(dayObj.day, missionStates);
          const isOpen = single || openDays.has(dayObj.day);

          return (
            <div
              key={dayObj.day}
              ref={todayCard ? todayCardRef : undefined}
              className={`bg-charcoal/85 gold-border rounded-2xl shadow-xl overflow-hidden flex flex-col transition hover:border-gold/60 ${
                todayCard ? 'ring-2 ring-gold/80' : ''
              }`}
            >
              <div
                onClick={single ? undefined : () => toggleDay(dayObj.day)}
                className={`p-3 sm:p-4 ${
                  single ? '' : 'cursor-pointer select-none hover:brightness-125'
                } transition bg-gradient-to-r from-crimson-dark/40 via-slateDark to-obsidian ${
                  isOpen ? 'border-b' : ''
                } border-gold/20 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-obsidian border border-gold/40 flex items-center justify-center font-display font-extrabold text-gold text-sm shadow-inner">
                    {dayObj.day.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white tracking-wider flex items-center gap-2 flex-wrap">
                      {!single && (
                        <span className="text-zinc-500 text-xs">{isOpen ? '▾' : '▸'}</span>
                      )}
                      {dayObj.day}{' '}
                      <span className="font-sans text-xs font-semibold text-gold">
                        {fmtLong(dayDate(dayObj.day, missionStates))}
                      </span>
                      {todayCard && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gold text-obsidian">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] font-medium tabular-nums">
                      <span className="text-emerald-400">✅ {okCount}</span>{' '}
                      <span className="text-red-400 ml-1">❌ {koCount}</span>{' '}
                      <span className="text-zinc-500 ml-1">/ {dayObj.missions.length}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 block">
                    Résultat du jour
                  </span>
                  <span className={`font-mono tabular-nums text-xs font-bold ${netClass(dayNet)}`}>
                    {formatSigned(dayNet)}
                  </span>
                </div>
              </div>

              {isOpen && (
                <>
                  {single ? (
                    renderSingleDayRows(dayObj.day, dayObj.missions)
                  ) : (
                    <div className="p-3.5 sm:p-4 space-y-2.5 flex-1">
                      {dayObj.missions.map((mission) => {
                        const st = getMissionEntry(missionStates, mission.id);
                        const f = missionFin(mission, missionStates);
                        const isTenMin = mission.wait === '10 min';
                        const hasStock = checkStockAvailability(
                          mission.gearKey,
                          inventoryStock
                        ).available;

                        const cardClass = f.success
                          ? 'bg-emerald-950/30 border-emerald-500/50'
                          : f.fail
                            ? 'bg-red-950/30 border-red-500/50'
                            : hasStock
                              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                              : 'bg-zinc-950/40 border-zinc-800/60 opacity-75';

                        const btnBase =
                          'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer';
                        const okBtn =
                          btnBase +
                          (f.success
                            ? ' bg-emerald-500 text-obsidian border-emerald-400'
                            : ' bg-zinc-900 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15');
                        const koBtn =
                          btnBase +
                          (f.fail
                            ? ' bg-red-600 text-white border-red-400'
                            : ' bg-zinc-900 text-red-300 border-red-500/40 hover:bg-red-500/15');

                        const badges = f.done ? renderValidatedSummaryBadges(st) : null;

                        return (
                          <div
                            key={mission.id}
                            className={`border rounded-xl p-3 transition ${cardClass}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-zinc-100 leading-snug">
                                {mission.name}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {mission.major && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gradient-to-r from-gold to-amber-300 text-obsidian shadow-sm">
                                    Gros Coup
                                  </span>
                                )}
                                <span
                                  className={`font-mono tabular-nums text-xs font-bold ${
                                    mission.cost > 0 ? 'text-amber-300/90' : 'text-zinc-500'
                                  }`}
                                >
                                  {mission.cost > 0 ? '-' + formatMoney(mission.cost) : '0 $'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800">
                                👥 {mission.crims}
                              </span>
                              <span
                                className={`font-mono tabular-nums inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                  isTenMin
                                    ? 'bg-crimson/25 text-red-200 border-crimson-light/40 font-semibold'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                                }`}
                              >
                                ⏱️ {mission.wait}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                  hasStock
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-300 border-red-500/30'
                                }`}
                              >
                                {hasStock ? '✅ Matériel OK' : '⚠️ Stock insuffisant'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                              <span className="text-zinc-500">Matériel :</span> {mission.gearName}
                            </p>

                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMissionValidation(mission, dayObj.day, 'success')
                                }
                                className={okBtn}
                              >
                                ✅ Réussie
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMissionValidation(mission, dayObj.day, 'fail')
                                }
                                className={koBtn}
                              >
                                ❌ Échouée
                              </button>
                            </div>

                            {f.done && (
                              <div className="mt-2.5 pt-2 border-t border-zinc-800/70 space-y-2">
                                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                                  <span className="text-zinc-400">
                                    {f.success ? (
                                      <>
                                        Gains :{' '}
                                        <strong className="font-mono text-emerald-300">
                                          +{formatMoney(f.gain)}
                                        </strong>
                                      </>
                                    ) : (
                                      <span className="text-red-300 font-semibold">
                                        Mission échouée
                                      </span>
                                    )}
                                    {f.extra > 0 && (
                                      <span className="ml-2">
                                        · Pertes :{' '}
                                        <strong className="font-mono text-red-300">
                                          -{formatMoney(f.extra)}
                                        </strong>
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={`font-mono font-extrabold ${netClass(f.net)}`}
                                  >
                                    {formatSigned(f.net)}
                                  </span>
                                </div>

                                {badges}

                                {!readonly && (
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenMissionValidation(
                                          mission,
                                          dayObj.day,
                                          f.fail ? 'fail' : 'success'
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-gold-light border border-gold/40 transition cursor-pointer"
                                    >
                                      ✎ Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onResetMission(mission.id)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-red-300 border border-red-500/30 transition cursor-pointer"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 py-2.5 bg-obsidian/85 border-t border-zinc-800/80 flex items-center justify-between text-xs gap-2 flex-wrap">
                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap tabular-nums">
                      <span className="text-zinc-400">
                        Matériel :{' '}
                        <strong className="font-mono text-amber-300">
                          {formatMoney(dayCost)}
                        </strong>
                      </span>
                      {dayExtra > 0 && (
                        <>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400">
                            Pertes :{' '}
                            <strong className="font-mono text-red-400">
                              {formatMoney(dayExtra)}
                            </strong>
                          </span>
                        </>
                      )}
                      {dayGains > 0 && (
                        <>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400">
                            Gains :{' '}
                            <strong className="font-mono text-emerald-400">
                              {formatMoney(dayGains)}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => onToggleWholeDay(dayObj.day)}
                        className="text-gold hover:text-gold-light font-semibold transition cursor-pointer"
                      >
                        {isDayFullyDone ? 'Tout remettre à zéro' : 'Tout valider (réussies)'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
