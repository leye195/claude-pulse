import fs from "fs";
import os from "os";
import path from "path";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings,
  type DeepPartial,
} from "../src/types/settings.js";

const SETTINGS_DIR = path.join(os.homedir(), ".claude-pulse");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");
const BACKUP_PATH = path.join(SETTINGS_DIR, "settings.json.bak");

type Listener = (settings: AppSettings) => void;

let current: AppSettings = mergeSettings({}, DEFAULT_SETTINGS);
const listeners = new Set<Listener>();

function ensureDir(): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

function writeAtomic(data: AppSettings): void {
  ensureDir();
  const tmp = `${SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, SETTINGS_PATH);
}

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      current = mergeSettings({}, DEFAULT_SETTINGS);
      writeAtomic(current);
      return current;
    }
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    current = mergeSettings(parsed, DEFAULT_SETTINGS);
    return current;
  } catch (err) {
    console.error("[configStore] load failed, falling back to defaults:", err);
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        fs.copyFileSync(SETTINGS_PATH, BACKUP_PATH);
      }
    } catch (backupErr) {
      console.warn("[configStore] backup failed:", backupErr);
    }
    current = mergeSettings({}, DEFAULT_SETTINGS);
    try {
      writeAtomic(current);
    } catch (writeErr) {
      console.warn("[configStore] recovery write failed, using in-memory defaults:", writeErr);
    }
    return current;
  }
}

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(partial: DeepPartial<AppSettings>): AppSettings {
  current = mergeSettings(partial, current);
  writeAtomic(current);
  for (const listener of listeners) listener(current);
  return current;
}

export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
