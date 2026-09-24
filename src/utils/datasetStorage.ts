import { StandardReview } from '../types';

export interface DatasetRecord {
  id: string;
  fileName: string;
  importTime: string;
  rowCount: number;
  avgRating: number;
  reviews: StandardReview[];
}

const STORAGE_KEY = 'sea_review_datasets_history_v2';
const ACTIVE_KEY = 'sea_review_active_dataset_id_v2';

export function getDatasetHistory(): DatasetRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse dataset history from localStorage', err);
    return [];
  }
}

export function saveDatasetRecord(record: DatasetRecord): void {
  try {
    const history = getDatasetHistory().filter(h => h.id !== record.id);
    // 最多保留 10 份历史表格
    const updated = [record, ...history].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setActiveDatasetId(record.id);
  } catch (err) {
    console.error('Failed to save dataset record to localStorage', err);
  }
}

export function deleteDatasetRecord(id: string): DatasetRecord[] {
  try {
    const history = getDatasetHistory().filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    if (getActiveDatasetId() === id) {
      if (history.length > 0) {
        setActiveDatasetId(history[0].id);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    }
    return history;
  } catch (err) {
    console.error('Failed to delete dataset record', err);
    return [];
  }
}

export function getActiveDatasetId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveDatasetId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch (err) {
    console.error('Failed to set active dataset id', err);
  }
}
