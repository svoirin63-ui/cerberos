import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DAY_NAMES, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import type {
  HierarchyMember,
  InventoryStock,
  Mission,
  MissionStates,
  MissionStatus,
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
  onSetMissionStatus: (id: string, status: Exclude<MissionStatus, ''>) => void;
  onUpdateMissionGain: (id: string, value: number) => void;
  onUpdateMissionExtra: (id: string, value: number) => void;
  onToggleMissionPlayer: (id: string, playerId: string) => void;
  onToggleWholeDay: (dayName: string) => void;
  onToggleAllWeek: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  missionStates,
  inventoryStock,
  members,
  readonly,
  onSetMissionStatus,
  onUpdateMissionGain,
  onUpdateMissionExtra,
  onToggleMissionPlayer,
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

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      ),
    [members]
  );

  const renderPlayerSelector = (missionId: string, selectedIds: string[]) => {
    const selectedMembers = sortedMembers.filter((m) => selectedIds.includes(m.id));

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-zinc-400">
            <span className="text-gold">👥</span> Joueurs participants :
          </span>
          <span className="text-[10px] font-mono tabular-nums text-zinc-400">
            {selectedMembers.length > 0
              ? `${selectedMembers.length} sélectionné${selectedMembers.length > 1 ? 's' : ''}`
              : 'Aucun'}
          </span>
        </div>

        {readonly ? (
          selectedMembers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedMembers.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gold/15 text-gold-light border border-gold/40"
                >
                  ✓ {member.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic text-zinc-500">Aucun joueur renseigné</p>
          )
        ) : sortedMembers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sortedMembers.map((member) => {
              const isSelected = selectedIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onToggleMissionPlayer(missionId, member.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                    isSelected
                      ? 'bg-gold/20 border-gold text-gold-light font-semibold shadow-sm'
                      : 'bg-zinc-950/85 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {member.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] italic text-zinc-500">
            Ajoutez des membres dans l&apos;onglet Hiérarchie pour les sélectionner ici.
          </p>
        )}
      </div>
    );
  };

  const single = activeFilter !== 'ALL';
  const filteredDays = single
    ? WEEKLY_SCHEDULE.filter((d) => d.day === activeFilter)
    : WEEKLY_SCHEDULE;

  const renderSingleDayRows = (missions: Mission[]) => {
    const cols = 'lg:grid-cols-[minmax(0,2.4fr)_95px_205px_135px_135px_115px]';
    const inputCls = (active: boolean, color: string) =>
      `w-full bg-zinc-950/90 border ${
        active ? color : 'border-zinc-700/80 text-zinc-200'
      } focus:border-gold rounded-lg pl-2 pr-6 py-1.5 text-right text-xs font-mono tabular-nums focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed`;

    return (
      <div className="p-3 sm:p-4">
        <div
          className={`hidden lg:grid ${cols} gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500`}
        >
          <span>Mission</span>
          <span className="text-right">Matériel</span>
          <span className="text-center">Statut</span>
          <span className="text-right">Gains</span>
          <span className="text-right">Perte armes / autre</span>
          <span className="text-right">Résultat</span>
        </div>
        <div className="space-y-1.5">
          {missions.map((m) => {
            const st = getMissionEntry(missionStates, m.id);
            const f = missionFin(m, missionStates);
            const selectedPlayers = Array.isArray(st.players) ? st.players : [];
            const hasStock = checkStockAvailability(m.gearKey, inventoryStock).available;
            const isTenMin = m.wait === '10 min';
            const rowClass = f.success
              ? 'bg-emerald-950/30 border-emerald-500/50'
              : f.fail
                ? 'bg-red-950/30 border-red-500/50'
                : hasStock
                  ? 'bg-charcoal/60 border-zinc-700/70'
                  : 'bg-zinc-950/40 border-zinc-800/60';
            const gainVal = Number(st.gain) > 0 ? String(st.gain) : '';
            const extraVal = Number(st.extra) > 0 ? String(st.extra) : '';
            const gainDis = readonly || !f.success;
            const extraDis = readonly || !f.done;

            const btnBase =
              'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer';
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={readonly}
                    onClick={() => onSetMissionStatus(m.id, 'success')}
                    className={okBtn}
                  >
                    ✅ Réussie
                  </button>
                  <button
                    type="button"
                    disabled={readonly}
                    onClick={() => onSetMissionStatus(m.id, 'fail')}
                    className={koBtn}
                  >
                    ❌ Échec
                  </button>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Gains
                  </span>
                  <div className="relative w-32 lg:w-full">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={gainVal}
                      placeholder={f.fail ? '—' : '0'}
                      disabled={gainDis}
                      onChange={(e) =>
                        onUpdateMissionGain(m.id, Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className={inputCls(f.gain > 0, 'border-emerald-500/50 text-emerald-300')}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                      $
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Perte armes / autre
                  </span>
                  <div className="relative w-32 lg:w-full">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={extraVal}
                      placeholder="0"
                      disabled={extraDis}
                      onChange={(e) =>
                        onUpdateMissionExtra(m.id, Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className={inputCls(f.extra > 0, 'border-red-500/50 text-red-300')}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                      $
                    </span>
                  </div>
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

                {f.done && (
                  <div className="lg:col-span-full pt-2 mt-1 border-t border-zinc-800/70">
                    {renderPlayerSelector(m.id, selectedPlayers)}
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
              Règlement GTA RP : 5 min d&apos;attente (10 min gros coups).
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
                    renderSingleDayRows(dayObj.missions)
                  ) : (
                    <div className="p-3.5 sm:p-4 space-y-2.5 flex-1">
                      {dayObj.missions.map((mission) => {
                        const st = getMissionEntry(missionStates, mission.id);
                        const f = missionFin(mission, missionStates);
                        const selectedPlayers = Array.isArray(st.players) ? st.players : [];
                        const gainVal = Number(st.gain) > 0 ? String(st.gain) : '';
                        const extraVal = Number(st.extra) > 0 ? String(st.extra) : '';
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
                          'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
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
                                disabled={readonly}
                                onClick={() => onSetMissionStatus(mission.id, 'success')}
                                className={okBtn}
                              >
                                ✅ Réussie
                              </button>
                              <button
                                type="button"
                                disabled={readonly}
                                onClick={() => onSetMissionStatus(mission.id, 'fail')}
                                className={koBtn}
                              >
                                ❌ Échouée
                              </button>
                            </div>

                            {f.done && (
                              <div className="mt-2.5 pt-2 border-t border-zinc-800/70 space-y-2">
                                {f.success ? (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-zinc-400">
                                      <span className="text-emerald-400">💰</span> Gains récoltés :
                                    </span>
                                    <div className="relative w-32">
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={gainVal}
                                        placeholder="0"
                                        disabled={readonly}
                                        onChange={(e) =>
                                          onUpdateMissionGain(
                                            mission.id,
                                            Math.max(0, parseInt(e.target.value, 10) || 0)
                                          )
                                        }
                                        className={`w-full bg-zinc-950/90 border ${
                                          f.gain > 0
                                            ? 'border-emerald-500/50 text-emerald-300'
                                            : 'border-zinc-700/80 text-zinc-200'
                                        } focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right text-xs font-mono tabular-nums focus:outline-none disabled:opacity-60`}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                                        $
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-zinc-400">
                                      <span className="text-red-400">💥</span> Mission échouée : aucun gain
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-zinc-400">
                                    <span className="text-amber-300">📦</span> Matériel utilisé (auto) :
                                  </span>
                                  <span className="font-mono tabular-nums text-xs font-bold text-amber-300">
                                    -{formatMoney(f.cost)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-zinc-400">
                                    <span className="text-red-400">🔫</span> Perte armes / autre :
                                  </span>
                                  <div className="relative w-32">
                                    <input
                                      type="number"
                                      min="0"
                                      step="100"
                                      value={extraVal}
                                      placeholder="0"
                                      disabled={readonly}
                                      onChange={(e) =>
                                        onUpdateMissionExtra(
                                          mission.id,
                                          Math.max(0, parseInt(e.target.value, 10) || 0)
                                        )
                                      }
                                      className={`w-full bg-zinc-950/90 border ${
                                        f.extra > 0
                                          ? 'border-red-500/50 text-red-300'
                                          : 'border-zinc-700/80 text-zinc-200'
                                      } focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right text-xs font-mono tabular-nums focus:outline-none disabled:opacity-60`}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                                      $
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-1.5 border-t border-zinc-800/70">
                                  {renderPlayerSelector(mission.id, selectedPlayers)}
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-800/70">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                    Résultat mission
                                  </span>
                                  <span
                                    className={`font-mono tabular-nums text-sm font-extrabold ${netClass(
                                      f.net
                                    )}`}
                                  >
                                    {formatSigned(f.net)}
                                  </span>
                                </div>
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
