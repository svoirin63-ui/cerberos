import type {
  DaySchedule,
  DistinctionKey,
  HierarchyMember,
  HierarchyTier,
  HierarchyUnitKey,
  InventoryItem,
  MissionRegulationRule,
  MissionTypeKey,
  RewardItem,
} from '@/src/types/cartel';

export const DEFAULT_SECRET_CODE = 'CERBEROS2026';

export const WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    day: 'Lundi',
    missions: [
      { id: 'lun_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'lun_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'lun_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'lun_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'lun_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'lun_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'lun_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'lun_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'lun_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'lun_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'lun_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'lun_fle_1', name: 'Banque Fleeca (Gros Coup)', crims: '4 à 10', wait: '5 min', gearKey: 'fle', gearName: 'Perceuse de forage / Pack Fleeca (3 300 $)', cost: 3300, major: true },
    ],
  },
  {
    day: 'Mardi',
    missions: [
      { id: 'mar_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mar_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mar_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mar_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mar_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mar_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mar_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'mar_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mar_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mar_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mar_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mar_bij_1', name: 'Bijouterie (Gros Coup)', crims: '6 à 15', wait: '10 min', gearKey: 'bij', gearName: 'Bombe adhésive, drone, perceuse, masque à gaz (5 600 $)', cost: 5600, major: true },
    ],
  },
  {
    day: 'Mercredi',
    missions: [
      { id: 'mer_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mer_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mer_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mer_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mer_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mer_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mer_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'mer_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mer_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mer_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'mer_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mer_pal_1', name: 'Banque de Paleto (Gros Coup)', crims: '5 à 9', wait: '5 min', gearKey: 'pal', gearName: 'Bombe adhésive, perceuse (4 800 $)', cost: 4800, major: true },
    ],
  },
  {
    day: 'Jeudi',
    missions: [
      { id: 'jeu_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'jeu_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'jeu_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'jeu_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'jeu_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'jeu_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'jeu_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'jeu_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'jeu_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'jeu_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'jeu_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'jeu_pac_1', name: 'Pacific Bank (Gros Coup)', crims: '6 à 15', wait: '10 min', gearKey: 'pac', gearName: 'Drone, bombes adhésives, outil de hacking (7 800 $)', cost: 7800, major: true },
    ],
  },
  {
    day: 'Vendredi',
    missions: [
      { id: 'ven_sup_1', name: 'Supérette #1 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'ven_sup_2', name: 'Supérette #2 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'ven_atm_1', name: 'Distributeur ATM #1 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'ven_atm_2', name: 'Distributeur ATM #2 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'ven_mai_1', name: 'Maison #1 (Fin quota)', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'ven_mai_2', name: 'Maison #2 (Fin quota)', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'ven_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'ven_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'ven_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'ven_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'ven_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'ven_amu_1', name: 'Amunation (Gros Coup)', crims: '6 à 10', wait: '10 min', gearKey: 'amu', gearName: 'Sans pack tarifé', cost: 0, major: true },
      { id: 'ven_trn_1', name: 'Train #1 (Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'trn', gearName: 'Meuleuse de forage (3 800 $)', cost: 3800, major: true },
      { id: 'ven_bob_1', name: 'Bobcat #1 (Gros Coup)', crims: '3 à 10', wait: '5 min', gearKey: 'bob', gearName: 'Bombes adhésives (4 500 $)', cost: 4500, major: true },
    ],
  },
  {
    day: 'Samedi',
    missions: [
      { id: 'sam_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'sam_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'sam_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'sam_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'sam_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'sam_fbi_1', name: 'FBI (Gros Coup)', crims: '8 à 15', wait: '10 min', gearKey: 'fbi', gearName: 'Sans pack tarifé', cost: 0, major: true },
      { id: 'sam_yac_1', name: 'Yacht #1 (Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'yac', gearName: 'Items utilitaires (4 000 $)', cost: 4000, major: true },
      { id: 'sam_trn_2', name: 'Train #2 (Fin quota Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'trn', gearName: 'Meuleuse de forage (3 800 $)', cost: 3800, major: true },
    ],
  },
  {
    day: 'Dimanche',
    missions: [
      { id: 'dim_frg_1', name: 'Fourgon Blindé (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Perceuse de forage (1 050 $)', cost: 1050, major: false },
      { id: 'dim_drg_1', name: 'Clef de Drogues #1 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'dim_drg_2', name: 'Clef de Drogues #2 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'dim_drg_3', name: 'Clef de Drogues #3 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1', cost: 0, major: false },
      { id: 'dim_ket_1', name: 'Carte de Kétamine (Fin quota)', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'dim_uni_1', name: 'Union Depository (Gros Coup)', crims: '8 à 15', wait: '10 min', gearKey: 'uni', gearName: 'Sans pack tarifé', cost: 0, major: true },
      { id: 'dim_yac_2', name: 'Yacht #2 (Fin quota Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'yac', gearName: 'Items utilitaires (4 000 $)', cost: 4000, major: true },
      { id: 'dim_bob_2', name: 'Bobcat #2 (Fin quota Gros Coup)', crims: '3 à 10', wait: '5 min', gearKey: 'bob', gearName: 'Bombes adhésives (4 500 $)', cost: 4500, major: true },
    ],
  },
];

export const DAY_NAMES = WEEKLY_SCHEDULE.map((d) => d.day);

export const TOTAL_WEEKLY_MISSIONS = WEEKLY_SCHEDULE.reduce(
  (sum, day) => sum + day.missions.length,
  0
);

export const DAILY_RECALC_HOUR = 9;
export const DAILY_RECALC_MINUTE = 30;

export const MISSION_REGULATION: Record<MissionTypeKey, MissionRegulationRule> = {
  sup: { typeKey: 'sup', label: 'Supérettes', criminals: '2 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  atm: { typeKey: 'atm', label: 'Distributeur (ATM)', criminals: '2 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  mai: { typeKey: 'mai', label: 'Maison', criminals: '1 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  frg: { typeKey: 'frg', label: 'Fourgon Blindé', criminals: '2 à 4', dailyLimit: 1, weeklyLimit: 7, waitMinutes: 5, major: false },
  trn: { typeKey: 'trn', label: 'Train', criminals: '3 à 8', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  yac: { typeKey: 'yac', label: 'Yacht', criminals: '3 à 8', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  bob: { typeKey: 'bob', label: 'Bobcat', criminals: '3 à 10', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  fle: { typeKey: 'fle', label: 'Fleeca', criminals: '4 à 10', dailyLimit: null, weeklyLimit: 1, waitMinutes: 5, major: true },
  pal: { typeKey: 'pal', label: 'Paleto', criminals: '5 à 9', dailyLimit: null, weeklyLimit: 1, waitMinutes: 5, major: true },
  pac: { typeKey: 'pac', label: 'Pacific', criminals: '6 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  bij: { typeKey: 'bij', label: 'Bijouterie', criminals: '6 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  drg: { typeKey: 'drg', label: 'Clef de Drogues', criminals: '3 à 6', dailyLimit: 3, weeklyLimit: 21, waitMinutes: 5, major: false },
  fbi: { typeKey: 'fbi', label: 'FBI', criminals: '8 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  amu: { typeKey: 'amu', label: 'Amunation', criminals: '6 à 10', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  uni: { typeKey: 'uni', label: 'Union Depository', criminals: '8 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  ket: { typeKey: 'ket', label: 'Carte de Kétamine', criminals: '-', dailyLimit: 1, weeklyLimit: 7, waitMinutes: 5, major: false },
};

export const REGULATION_TABLE_ROWS: Array<{
  label: string;
  criminals: string;
  daily: string;
  weekly: number;
  inPlanning: boolean;
}> = [
  { label: 'Supérettes', criminals: '2 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Distributeur (ATM)', criminals: '2 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Maison', criminals: '1 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Conteneurs', criminals: '2 à 4', daily: '3', weekly: 21, inPlanning: false },
  { label: 'Fourgon Blindé', criminals: '2 à 4', daily: '1', weekly: 7, inPlanning: true },
  { label: 'Train', criminals: '3 à 8', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Yacht', criminals: '3 à 8', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Bobcat', criminals: '3 à 10', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Fleeca', criminals: '4 à 10', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Paleto', criminals: '5 à 9', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Pacific', criminals: '6 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Bijouterie', criminals: '6 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Clef de Drogues', criminals: '3 à 6', daily: '3', weekly: 21, inPlanning: true },
  { label: 'FBI', criminals: '8 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Amunation', criminals: '6 à 10', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Union Depository', criminals: '8 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Carte de Kétamine', criminals: '-', daily: '1', weekly: 7, inPlanning: true },
];

export const REGULATION_FAIRPLAY_NOTE =
  'Fair-play : attendre 5 minutes sur place après le braquage. Pour Pacific, Bijouterie, FBI, Amunation et Union Depository : attendre 10 minutes.';

export const INVENTORY_ITEMS: InventoryItem[] = [
  { key: 'sup', name: 'Outils de supérettes', price: 1000, category: 'tool' },
  { key: 'atm', name: 'Corde lourde (ATM)', price: 500, category: 'tool' },
  { key: 'mai', name: 'Outil de hacking (Vol de Maison)', price: 1500, category: 'tool' },
  { key: 'drg', name: 'Clé USB 3.1 (Clef de Drogues)', price: 0, category: 'tool' },
  { key: 'veh', name: 'Items utilitaires (Vol de Véhicule)', price: 1500, category: 'tool' },
  { key: 'frg', name: 'Perceuse de forage (Fourgon)', price: 1050, category: 'tool' },
  { key: 'fle', name: 'Pack Banque Fleeca', price: 3300, category: 'heist_pack' },
  { key: 'bij', name: 'Pack Bijouterie', price: 5600, category: 'heist_pack' },
  { key: 'pal', name: 'Pack Banque de Paleto', price: 4800, category: 'heist_pack' },
  { key: 'pac', name: 'Pack Pacific Bank', price: 7800, category: 'heist_pack' },
  { key: 'trn', name: 'Pack Train', price: 3800, category: 'heist_pack' },
  { key: 'yac', name: 'Pack Yacht', price: 4000, category: 'heist_pack' },
  { key: 'bob', name: 'Pack Bobcat', price: 4500, category: 'heist_pack' },
];

export const REWARD_ITEMS: RewardItem[] = [
  { key: 'boite_bijoux', name: 'Boîte à Bijoux', defaultVal: 220 },
  { key: 'montre_or', name: 'Montre en Or', defaultVal: 40 },
  { key: 'collier_or', name: 'Collier en Or', defaultVal: 30 },
  { key: 'vetement_luxe', name: 'Vêtement de Luxe', defaultVal: 30 },
  { key: 'whiskey_luxe', name: 'Whiskey de Luxe', defaultVal: 15 },
  { key: 'processeur', name: 'Processeur', defaultVal: 110 },
  { key: 'lunette_luxe', name: 'Lunette de Luxe', defaultVal: 30 },
  { key: 'carte_graphique', name: 'Carte Graphique', defaultVal: 110 },
  { key: 'lingot_or', name: "Lingot d'Or", defaultVal: 180 },
  { key: 'peinture_volee', name: 'Peinture Volée', defaultVal: 450 },
];

export const PREVIOUS_REWARD_DEFAULTS: Record<string, number> = {
  boite_bijoux: 250,
  montre_or: 50,
  collier_or: 35,
  vetement_luxe: 35,
  processeur: 125,
  lunette_luxe: 35,
  carte_graphique: 125,
  lingot_or: 200,
  peinture_volee: 600,
};

export const HIER_UNITS: Record<HierarchyUnitKey, string> = {
  mando: 'EL MANDO',
  ojos: 'LOS OJOS',
  bocas: 'LAS BOCAS',
  brazos: 'LOS BRAZOS',
  cerebros: 'LOS CEREBROS',
  cerberos: 'LOS CERBEROS',
};

export const HIER_TIERS: HierarchyTier[] = [
  { grade: 'Grade 1 • Lead du groupe', title: 'EL MANDO', units: ['mando'], top: true },
  { grade: 'Grade 2', title: 'LOS ESPÍAS', units: ['ojos', 'bocas'] },
  { grade: 'Grade 3', title: 'LOS TENIENTES', units: ['brazos', 'cerebros'] },
  { grade: 'Grade 4', title: 'LOS CERBEROS', units: ['cerberos'], flat: true },
];

export const RANK_LEVELS = [
  { minPoints: 5000, title: 'Légende du Cartel' },
  { minPoints: 2500, title: 'Homme de Confiance' },
  { minPoints: 1200, title: 'Vétéran' },
  { minPoints: 600, title: 'Sicario' },
  { minPoints: 250, title: 'Soldado' },
  { minPoints: 0, title: 'Recrue' },
] as const;

export const DISTINCTION_DEFS: Array<{
  key: DistinctionKey;
  title: string;
  subtitle: string;
  autoRule?: string;
}> = [
  {
    key: 'sang_fidele',
    title: 'Sang Fidèle',
    subtitle: 'Loyauté & discipline constante',
    autoRule: '10+ opérations validées',
  },
  {
    key: 'frere_armes',
    title: "Frère d'Armes",
    subtitle: 'Engagement collectif sur le terrain',
    autoRule: '5+ missions réussies',
  },
  {
    key: 'loup_solitaire',
    title: 'Loup Solitaire',
    subtitle: 'Efficacité sur opérations rapides',
    autoRule: '3+ opérations courantes réussies',
  },
  {
    key: 'stratege',
    title: 'Stratège',
    subtitle: 'Maîtrise des Gros Coups majeurs',
    autoRule: '2+ Gros Coups réussis',
  },
  {
    key: 'homme_confiance',
    title: 'Homme de Confiance',
    subtitle: 'Distinction de la direction',
    autoRule: '1 200+ points',
  },
  {
    key: 'legende',
    title: 'Légende',
    subtitle: 'Contribution exceptionnelle au cartel',
    autoRule: 'N°1 du classement ou 2 500+ points',
  },
];

const GD = 'https://docs.google.com/document/';

export const HIER_DEFAULTS: HierarchyMember[] = [
  { id: 'tito', name: 'Tito Flores', unit: 'mando', order: 1, dossier: GD + 'u/0/d/1-BYbICmzGfMGUncjqrsSJTzwE6Jv7O3uLnBwiYOPyPE/edit' },
  { id: 'juanito', name: 'Juanito Fernandez', unit: 'ojos', order: 2, dossier: GD + 'd/1K8481f9Ha41lsRdKGBrLXBD32dks3TaL6tjzpaXVZPA/edit?tab=t.0' },
  { id: 'nicolas', name: 'Nicolás Salcedo', unit: 'bocas', order: 3, dossier: GD + 'u/0/d/12KV57gybGqckGvfKKf7naqJGdy4QbdX0nMJOC_XjBWU/edit' },
  { id: 'santiago', name: 'Santiago Fuentes', unit: 'bocas', order: 4, dossier: GD + 'd/1kFPJMIOzDkCwDL5qTi0TRYlAgoz2NtC4EwiN9iTuF3k/edit?tab=t.0' },
  { id: 'catalina', name: 'Catalina Flores', unit: 'brazos', order: 5, dossier: GD + 'u/0/d/1qM9W8zsBJg_82y5RAhnwuQunBr89m1OKWyv8LJTZm3s/edit' },
  { id: 'gino', name: 'Gino Da Silva', unit: 'cerberos', order: 6, dossier: GD + 'u/0/d/13mZArzn0JO2E3oCRSbxs_1m2m5cxV5k8Dz7fryHZSGU/edit' },
  { id: 'jose', name: 'José Chavez', unit: 'cerberos', order: 7, dossier: GD + 'u/0/d/19ZxLCUTOn4zAGuJZPZmWn-XlXVrCWyqYmEvC_BHsPu0/edit' },
  { id: 'emilio', name: 'Emilio Rojas', unit: 'cerberos', order: 8, dossier: GD + 'd/1hzDaA3O36RkrgHGnyIDLn7M_M6nZ6y0IUviiEzkvSdA/edit?tab=t.0' },
  { id: 'joao', name: 'Joao Cristo', unit: 'cerberos', order: 9, dossier: '' },
];
