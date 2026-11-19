import type {
  DaySchedule,
  HierarchyMember,
  HierarchyTier,
  HierarchyUnitKey,
  InventoryItem,
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
      { id: 'lun_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'lun_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'lun_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'mar_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mar_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mar_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'mer_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mer_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mer_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'jeu_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'jeu_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'jeu_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'ven_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'ven_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'ven_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'sam_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'sam_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'sam_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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
      { id: 'dim_drg_1', name: 'Clef de Drogues #1 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'dim_drg_2', name: 'Clef de Drogues #2 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'dim_drg_3', name: 'Clef de Drogues #3 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
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

export const INVENTORY_ITEMS: InventoryItem[] = [
  { key: 'sup', name: 'Outils de supérettes', price: 1000, category: 'tool' },
  { key: 'atm', name: 'Corde lourde (ATM)', price: 500, category: 'tool' },
  { key: 'mai', name: 'Outil de hacking (Vol de Maison)', price: 1500, category: 'tool' },
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
  { key: 'boite_bijoux', name: 'Boîte à Bijoux', defaultVal: 250 },
  { key: 'montre_or', name: 'Montre en Or', defaultVal: 50 },
  { key: 'collier_or', name: 'Collier en Or', defaultVal: 35 },
  { key: 'vetement_luxe', name: 'Vêtement de Luxe', defaultVal: 35 },
  { key: 'processeur', name: 'Processeur', defaultVal: 125 },
  { key: 'lunette_luxe', name: 'Lunette de Luxe', defaultVal: 35 },
  { key: 'carte_graphique', name: 'Carte Graphique', defaultVal: 125 },
  { key: 'lingot_or', name: "Lingot d'Or", defaultVal: 200 },
  { key: 'peinture_volee', name: 'Peinture Volée', defaultVal: 600 },
];

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
