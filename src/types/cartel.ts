export type MissionStatus = '' | 'success' | 'fail';

export type GearKey =
  | 'none'
  | 'sup'
  | 'atm'
  | 'mai'
  | 'veh'
  | 'frg'
  | 'fle'
  | 'bij'
  | 'pal'
  | 'pac'
  | 'amu'
  | 'trn'
  | 'fbi'
  | 'yac'
  | 'uni'
  | 'bob';

export interface Mission {
  id: string;
  name: string;
  crims: string;
  wait: string;
  gearKey: GearKey;
  gearName: string;
  cost: number;
  major: boolean;
}

export interface DaySchedule {
  day: string;
  missions: Mission[];
}

export interface MissionStateEntry {
  status?: MissionStatus;
  completed?: boolean;
  gain?: number;
  extra?: number;
  players?: string[];
}

export interface MissionStates {
  __week?: string;
  [missionId: string]: MissionStateEntry | string | undefined;
}

export interface MissionFinance {
  status: MissionStatus;
  done: boolean;
  success: boolean;
  fail: boolean;
  cost: number;
  gain: number;
  extra: number;
  net: number;
}

export interface InventoryItem {
  key: Exclude<GearKey, 'none' | 'amu' | 'fbi' | 'uni'>;
  name: string;
  price: number;
}

export type InventoryStock = Record<string, number>;

export interface TreasuryMoney {
  legal: number;
  illegal: number;
}

export interface RewardItem {
  key: string;
  name: string;
  defaultVal: number;
}

export interface RewardStockEntry {
  qty: number;
  val: number;
}

export type RewardStocks = Record<string, RewardStockEntry>;

export type HierarchyUnitKey =
  | 'mando'
  | 'ojos'
  | 'bocas'
  | 'brazos'
  | 'cerebros'
  | 'cerberos';

export interface HierarchyMember {
  id: string;
  name: string;
  unit: HierarchyUnitKey;
  order: number;
  dossier: string;
}

export interface HierarchyTier {
  grade: string;
  title: string;
  units: HierarchyUnitKey[];
  top?: boolean;
  flat?: boolean;
}

export type TabKey = 'planning' | 'inventory' | 'treasury' | 'accounting' | 'hierarchy';
