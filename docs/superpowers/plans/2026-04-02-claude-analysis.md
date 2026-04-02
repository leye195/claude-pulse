# Claude Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that reads `~/.claude/stats-cache.json` and displays a GitHub-style contribution heatmap, daily token usage bar chart (with model-stacked view), model breakdown pie chart, and light/dark theme toggle.

**Architecture:** Single-window Electron app. Main process reads the JSON file and exposes it via IPC. React renderer displays a dashboard with 4 summary cards, a contribution heatmap (custom SVG), a Recharts bar chart (with model-stacked toggle), and a model breakdown pie chart. Tailwind CSS handles styling with dark mode support.

**Tech Stack:** Electron, React 18, TypeScript, Vite (via electron-vite), Recharts, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-02-claude-analysis-design.md`

---

## File Map

```
claude-analysis/
├── electron/
│   ├── main.ts              # Electron main process: window, IPC handlers, file watcher
│   └── preload.ts           # contextBridge: exposes getStatsData + onStatsUpdated
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root layout, theme provider, data provider
│   ├── index.css             # Tailwind directives + CSS custom properties for theme
│   ├── types/
│   │   └── stats.ts          # TypeScript interfaces for stats-cache.json + electron API
│   ├── utils/
│   │   └── statsParser.ts    # Pure functions: aggregate tokens, compute levels, filter by date range, model name formatting
│   ├── hooks/
│   │   ├── useStatsData.ts   # Fetches data via IPC, re-fetches on window focus
│   │   └── useTheme.ts       # Dark/light toggle, persists to localStorage, syncs to <html>
│   └── components/
│       ├── TopBar.tsx         # App title + summary badges + theme toggle
│       ├── ThemeToggle.tsx    # Moon/sun icon button
│       ├── SummaryCards.tsx   # 4 stat cards in a grid
│       ├── ContributionGraph.tsx  # GitHub-style SVG heatmap
│       ├── DailyChart.tsx     # Recharts BarChart with period filter + model-stacked toggle
│       ├── ModelBreakdown.tsx # Recharts PieChart for model usage breakdown
│       └── EmptyState.tsx     # Shown when no data / file missing
├── src/__tests__/
│   └── statsParser.test.ts   # Unit tests for statsParser utilities
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron-builder.yml
├── vite.config.ts            # electron-vite config (main + preload + renderer)
├── tailwind.config.js
├── postcss.config.js
└── index.html                # Electron renderer entry HTML
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `electron-builder.yml`

- [ ] **Step 1: Initialize the project**

```bash
cd /Users/commy/projects/claude-analysis
git init
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react react-dom recharts
npm install -D typescript @types/react @types/react-dom \
  electron electron-builder \
  vite @vitejs/plugin-react \
  tailwindcss @tailwindcss/postcss postcss \
  vitest @testing-library/react @testing-library/jest-dom jsdom \
  concurrently wait-on
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "electron/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "dist-electron"
  },
  "include": ["electron/**/*", "vite.config.ts"]
}
```

- [ ] **Step 5: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 6: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        grass: {
          0: "var(--grass-0)",
          1: "var(--grass-1)",
          2: "var(--grass-2)",
          3: "var(--grass-3)",
          4: "var(--grass-4)",
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 7: Create postcss.config.js**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 8: Create index.html**

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <title>Claude Analysis</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Create electron-builder.yml**

```yaml
appId: com.claude-analysis.app
productName: Claude Analysis
directories:
  buildResources: build
  output: release
files:
  - dist/**/*
  - dist-electron/**/*
mac:
  target:
    - dmg
  category: public.app-category.developer-tools
win:
  target:
    - nsis
nsis:
  oneClick: true
  allowToChangeInstallationDirectory: false
```

- [ ] **Step 10: Update package.json scripts**

Edit `package.json` to set these fields:

```json
{
  "name": "claude-analysis",
  "version": "1.0.0",
  "description": "Claude Code usage analytics dashboard",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && tsc -p tsconfig.node.json && electron .\"",
    "build": "tsc -p tsconfig.node.json && vite build",
    "package": "npm run build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "type": "module"
}
```

- [ ] **Step 11: Create .gitignore**

```
node_modules/
dist/
dist-electron/
release/
.superpowers/
*.log
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Electron + React + Vite + Tailwind project"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/stats.ts`

- [ ] **Step 1: Define stats-cache.json types and Electron API interface**

Create `src/types/stats.ts`:

```typescript
export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface LongestSession {
  sessionId: string;
  duration: number;
  messageCount: number;
  timestamp: string;
}

export interface StatsData {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession: LongestSession;
  firstSessionDate: string;
  hourCounts: Record<string, number>;
  totalSpeculationTimeSavedMs: number;
}

export interface ElectronAPI {
  getStatsData: () => Promise<StatsData | null>;
  onStatsUpdated: (callback: (data: StatsData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/stats.ts
git commit -m "feat: add TypeScript types for stats-cache.json"
```

---

### Task 3: Stats Parser Utilities (TDD)

**Files:**
- Create: `src/utils/statsParser.ts`
- Create: `src/__tests__/statsParser.test.ts`

- [ ] **Step 1: Create vitest config**

Add to `vite.config.ts` at the top level of the config object:

```typescript
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
```

(Add `/// <reference types="vitest" />` at the top of the file.)

- [ ] **Step 2: Write failing tests for getTotalTokensForDate**

Create `src/__tests__/statsParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getTotalTokensForDate,
  getContributionLevel,
  getDailyTokensArray,
  filterByDateRange,
  formatModelName,
  getModelBreakdown,
} from "../utils/statsParser";
import type { DailyModelTokens, ModelUsage } from "../types/stats";

const sampleDailyTokens: DailyModelTokens[] = [
  {
    date: "2026-02-03",
    tokensByModel: { "claude-sonnet-4-5-20250929": 270, "claude-opus-4-5-20251101": 709 },
  },
  {
    date: "2026-02-04",
    tokensByModel: { "claude-opus-4-5-20251101": 9205 },
  },
  {
    date: "2026-02-05",
    tokensByModel: { "claude-opus-4-5-20251101": 32404 },
  },
  {
    date: "2026-02-11",
    tokensByModel: {
      "claude-opus-4-1-20250805": 669,
      "claude-haiku-4-5-20251001": 4,
      "claude-opus-4-6": 26629,
    },
  },
];

describe("getTotalTokensForDate", () => {
  it("sums all model tokens for a given date", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-02-03")).toBe(979);
  });

  it("returns 0 for a date with no data", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-01-01")).toBe(0);
  });

  it("handles multiple models correctly", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-02-11")).toBe(27302);
  });
});

describe("getContributionLevel", () => {
  it("returns 0 for zero tokens", () => {
    expect(getContributionLevel(0, 40000)).toBe(0);
  });

  it("returns 1 for low usage", () => {
    expect(getContributionLevel(5000, 40000)).toBe(1);
  });

  it("returns 2 for moderate usage", () => {
    expect(getContributionLevel(15000, 40000)).toBe(2);
  });

  it("returns 3 for high usage", () => {
    expect(getContributionLevel(25000, 40000)).toBe(3);
  });

  it("returns 4 for very high usage", () => {
    expect(getContributionLevel(35000, 40000)).toBe(4);
  });

  it("returns 0 when maxTokens is 0", () => {
    expect(getContributionLevel(100, 0)).toBe(0);
  });
});

describe("getDailyTokensArray", () => {
  it("converts DailyModelTokens[] to flat date-total pairs", () => {
    const result = getDailyTokensArray(sampleDailyTokens);
    expect(result).toEqual([
      { date: "2026-02-03", tokens: 979 },
      { date: "2026-02-04", tokens: 9205 },
      { date: "2026-02-05", tokens: 32404 },
      { date: "2026-02-11", tokens: 27302 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getDailyTokensArray([])).toEqual([]);
  });
});

describe("filterByDateRange", () => {
  const data = [
    { date: "2026-02-01", tokens: 100 },
    { date: "2026-02-05", tokens: 200 },
    { date: "2026-02-10", tokens: 300 },
    { date: "2026-02-15", tokens: 400 },
    { date: "2026-02-20", tokens: 500 },
  ];

  it("filters to last 7 days from reference date", () => {
    const result = filterByDateRange(data, 7, "2026-02-20");
    expect(result).toEqual([
      { date: "2026-02-15", tokens: 400 },
      { date: "2026-02-20", tokens: 500 },
    ]);
  });

  it("returns all data when days is 0 (meaning 'all')", () => {
    const result = filterByDateRange(data, 0, "2026-02-20");
    expect(result).toEqual(data);
  });
});

describe("formatModelName", () => {
  it("formats opus model name", () => {
    expect(formatModelName("claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("formats sonnet model name with date suffix", () => {
    expect(formatModelName("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
  });

  it("formats haiku model name with date suffix", () => {
    expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("formats opus with date suffix", () => {
    expect(formatModelName("claude-opus-4-5-20251101")).toBe("Opus 4.5");
  });

  it("formats opus 4-1 with date suffix", () => {
    expect(formatModelName("claude-opus-4-1-20250805")).toBe("Opus 4.1");
  });

  it("returns raw name for unknown format", () => {
    expect(formatModelName("some-unknown-model")).toBe("some-unknown-model");
  });
});

describe("getModelBreakdown", () => {
  const modelUsage: Record<string, ModelUsage> = {
    "claude-opus-4-6": {
      inputTokens: 20000,
      outputTokens: 80000,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0,
      contextWindow: 0,
      maxOutputTokens: 0,
    },
    "claude-sonnet-4-5-20250929": {
      inputTokens: 100,
      outputTokens: 100,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0,
      contextWindow: 0,
      maxOutputTokens: 0,
    },
  };

  it("returns model breakdown with formatted names and totals", () => {
    const result = getModelBreakdown(modelUsage);
    expect(result).toEqual([
      { name: "Opus 4.6", tokens: 100000, percentage: 99.8 },
      { name: "Sonnet 4.5", tokens: 200, percentage: 0.2 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getModelBreakdown({})).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run
```

Expected: FAIL — module `../utils/statsParser` not found.

- [ ] **Step 4: Implement statsParser.ts**

Create `src/utils/statsParser.ts`:

```typescript
import type { DailyModelTokens, ModelUsage } from "../types/stats";

export interface ModelBreakdownEntry {
  name: string;
  tokens: number;
  percentage: number;
}

export interface DailyTokenEntry {
  date: string;
  tokens: number;
}

export function getTotalTokensForDate(
  dailyModelTokens: DailyModelTokens[],
  date: string
): number {
  const entry = dailyModelTokens.find((d) => d.date === date);
  if (!entry) return 0;
  return Object.values(entry.tokensByModel).reduce((sum, t) => sum + t, 0);
}

export function getContributionLevel(tokens: number, maxTokens: number): number {
  if (maxTokens === 0 || tokens === 0) return 0;
  const ratio = tokens / maxTokens;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function getDailyTokensArray(
  dailyModelTokens: DailyModelTokens[]
): DailyTokenEntry[] {
  return dailyModelTokens.map((entry) => ({
    date: entry.date,
    tokens: Object.values(entry.tokensByModel).reduce((sum, t) => sum + t, 0),
  }));
}

export function filterByDateRange(
  data: DailyTokenEntry[],
  days: number,
  referenceDate: string
): DailyTokenEntry[] {
  if (days === 0) return data;
  const ref = new Date(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function formatModelName(modelId: string): string {
  const match = modelId.match(/^claude-(\w+)-(\d+)-(\d+)(?:-\d{8})?$/);
  if (!match) return modelId;
  const [, family, major, minor] = match;
  return `${family.charAt(0).toUpperCase() + family.slice(1)} ${major}.${minor}`;
}

export function getModelBreakdown(
  modelUsage: Record<string, ModelUsage>
): ModelBreakdownEntry[] {
  const entries = Object.entries(modelUsage).map(([modelId, usage]) => ({
    name: formatModelName(modelId),
    tokens: usage.inputTokens + usage.outputTokens,
  }));

  const total = entries.reduce((sum, e) => sum + e.tokens, 0);
  if (total === 0) return [];

  return entries
    .map((e) => ({
      ...e,
      percentage: Math.round((e.tokens / total) * 1000) / 10,
    }))
    .sort((a, b) => b.tokens - a.tokens);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/statsParser.ts src/__tests__/statsParser.test.ts vite.config.ts
git commit -m "feat: add statsParser utilities with tests"
```

---

### Task 4: Electron Main Process

**Files:**
- Create: `electron/main.ts`

- [ ] **Step 1: Create electron/main.ts**

```typescript
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function getStatsPath(): string {
  const home = app.getPath("home");
  return path.join(home, ".claude", "stats-cache.json");
}

function readStatsFile(): unknown | null {
  const statsPath = getStatsPath();
  try {
    const raw = fs.readFileSync(statsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("focus", () => {
    const data = readStatsFile();
    if (data && mainWindow) {
      mainWindow.webContents.send("stats-updated", data);
    }
  });
}

ipcMain.handle("get-stats-data", () => {
  return readStatsFile();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add Electron main process with IPC + file reading"
```

---

### Task 5: Preload Script

**Files:**
- Create: `electron/preload.ts`

- [ ] **Step 1: Create electron/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getStatsData: () => ipcRenderer.invoke("get-stats-data"),
  onStatsUpdated: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("stats-updated", handler);
    return () => {
      ipcRenderer.removeListener("stats-updated", handler);
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.ts
git commit -m "feat: add preload script with contextBridge IPC"
```

---

### Task 6: Theme System

**Files:**
- Create: `src/index.css`
- Create: `src/hooks/useTheme.ts`
- Create: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create src/index.css with Tailwind directives and theme variables**

```css
@import "tailwindcss";

:root {
  --grass-0: #ebedf0;
  --grass-1: #9be9a8;
  --grass-2: #40c463;
  --grass-3: #30a14e;
  --grass-4: #216e39;

  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-card: #ffffff;
  --border: #d0d7de;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --badge-bg: #f0f3f6;
}

.dark {
  --grass-0: #161b22;
  --grass-1: #0e4429;
  --grass-2: #006d32;
  --grass-3: #26a641;
  --grass-4: #39d353;

  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #161b22;
  --border: #30363d;
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  --badge-bg: #21262d;
}

body {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  transition:
    background 0.2s,
    color 0.2s;
}
```

- [ ] **Step 2: Create src/hooks/useTheme.ts**

```typescript
import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
```

- [ ] **Step 3: Create src/components/ThemeToggle.tsx**

```tsx
interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="w-8 h-8 rounded-full flex items-center justify-center
        bg-[var(--badge-bg)] hover:opacity-80 transition-opacity cursor-pointer"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/hooks/useTheme.ts src/components/ThemeToggle.tsx
git commit -m "feat: add theme system with dark/light toggle"
```

---

### Task 7: useStatsData Hook

**Files:**
- Create: `src/hooks/useStatsData.ts`

- [ ] **Step 1: Create src/hooks/useStatsData.ts**

```typescript
import { useState, useEffect } from "react";
import type { StatsData } from "../types/stats";

interface UseStatsDataResult {
  data: StatsData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useStatsData(): UseStatsDataResult {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getStatsData();
      if (result === null) {
        setError("Claude Code 사용 데이터가 없습니다. ~/.claude/stats-cache.json 파일을 찾을 수 없습니다.");
      } else {
        setData(result);
      }
    } catch {
      setError("데이터를 읽는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = window.electronAPI.onStatsUpdated((newData) => {
      setData(newData);
      setError(null);
    });

    return unsubscribe;
  }, []);

  return { data, loading, error, retry: fetchData };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useStatsData.ts
git commit -m "feat: add useStatsData hook with IPC + auto-refresh"
```

---

### Task 8: TopBar Component

**Files:**
- Create: `src/components/TopBar.tsx`

- [ ] **Step 1: Create src/components/TopBar.tsx**

```tsx
import { ThemeToggle } from "./ThemeToggle";

interface TopBarProps {
  totalMessages: number;
  totalSessions: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function TopBar({ totalMessages, totalSessions, theme, onToggleTheme }: TopBarProps) {
  return (
    <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--border)]">
      <span className="text-xl font-semibold text-[var(--text-primary)]">
        Claude Analysis
      </span>
      <div className="flex items-center gap-3">
        <span className="bg-[var(--badge-bg)] px-3 py-1 rounded-md text-sm text-[var(--text-secondary)]">
          Total: {totalMessages.toLocaleString()} messages
        </span>
        <span className="bg-[var(--badge-bg)] px-3 py-1 rounded-md text-sm text-[var(--text-secondary)]">
          {totalSessions} sessions
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat: add TopBar component"
```

---

### Task 9: SummaryCards Component

**Files:**
- Create: `src/components/SummaryCards.tsx`

- [ ] **Step 1: Create src/components/SummaryCards.tsx**

```tsx
import type { StatsData } from "../types/stats";
import { getTotalTokensForDate } from "../utils/statsParser";

interface SummaryCardsProps {
  data: StatsData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const todayTokens = getTotalTokensForDate(data.dailyModelTokens, today);
  const todayActivity = data.dailyActivity.find((d) => d.date === today);
  const todayMessages = todayActivity?.messageCount ?? 0;

  const firstDate = new Date(data.firstSessionDate);
  const daysSinceFirst = Math.floor(
    (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const cards = [
    { label: "오늘 토큰", value: todayTokens.toLocaleString(), color: "text-blue-400" },
    { label: "오늘 메시지", value: todayMessages.toLocaleString(), color: "text-green-400" },
    { label: "총 세션", value: data.totalSessions.toLocaleString(), color: "text-purple-400" },
    { label: "사용 기간", value: `${daysSinceFirst}일`, color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4"
        >
          <div className="text-xs text-[var(--text-secondary)] mb-1">{card.label}</div>
          <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SummaryCards.tsx
git commit -m "feat: add SummaryCards component"
```

---

### Task 10: ContributionGraph Component

**Files:**
- Create: `src/components/ContributionGraph.tsx`

- [ ] **Step 1: Create src/components/ContributionGraph.tsx**

This is the GitHub-style heatmap rendered as SVG. Each cell is 12x12px with 2px gap. Rows = 7 days (Sun-Sat), columns = weeks.

```tsx
import { useMemo, useState } from "react";
import type { DailyModelTokens } from "../types/stats";
import { getDailyTokensArray, getContributionLevel } from "../utils/statsParser";

interface ContributionGraphProps {
  dailyModelTokens: DailyModelTokens[];
  firstSessionDate: string;
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const STEP = CELL_SIZE + CELL_GAP;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getWeeksData(dailyTokens: { date: string; tokens: number }[]) {
  const tokenMap = new Map(dailyTokens.map((d) => [d.date, d.tokens]));
  const today = new Date();
  const todayDay = today.getDay();

  // End of this week (Saturday)
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - todayDay));

  // Go back ~52 weeks
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 52 * 7 + 1);
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: { date: string; tokens: number; dayOfWeek: number }[][] = [];
  let currentWeek: { date: string; tokens: number; dayOfWeek: number }[] = [];

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getDay();

    currentWeek.push({
      date: dateStr,
      tokens: tokenMap.get(dateStr) ?? 0,
      dayOfWeek,
    });

    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return weeks;
}

function getMonthLabels(weeks: { date: string; tokens: number; dayOfWeek: number }[][]) {
  const labels: { text: string; x: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, i) => {
    const firstDay = week[0];
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      labels.push({ text: MONTH_NAMES[month], x: i * STEP });
      lastMonth = month;
    }
  });

  return labels;
}

export function ContributionGraph({ dailyModelTokens }: ContributionGraphProps) {
  const [tooltip, setTooltip] = useState<{ date: string; tokens: number; x: number; y: number } | null>(null);

  const dailyTokens = useMemo(() => getDailyTokensArray(dailyModelTokens), [dailyModelTokens]);
  const weeks = useMemo(() => getWeeksData(dailyTokens), [dailyTokens]);
  const maxTokens = useMemo(
    () => Math.max(...dailyTokens.map((d) => d.tokens), 0),
    [dailyTokens]
  );
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);

  const COLORS = [
    "var(--grass-0)",
    "var(--grass-1)",
    "var(--grass-2)",
    "var(--grass-3)",
    "var(--grass-4)",
  ];

  const LEFT_PADDING = 36;
  const TOP_PADDING = 20;
  const svgWidth = LEFT_PADDING + weeks.length * STEP;
  const svgHeight = TOP_PADDING + 7 * STEP;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 mb-6 relative">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[var(--text-primary)]">토큰 사용량 잔디</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {new Date().getFullYear()}년
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight + 10} className="block">
          {/* Month labels */}
          {monthLabels.map((label, i) => (
            <text
              key={i}
              x={LEFT_PADDING + label.x}
              y={12}
              fill="var(--text-secondary)"
              fontSize={10}
            >
              {label.text}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={TOP_PADDING + i * STEP + 10}
              fill="var(--text-secondary)"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day) => {
              const level = getContributionLevel(day.tokens, maxTokens);
              const x = LEFT_PADDING + wi * STEP;
              const y = TOP_PADDING + day.dayOfWeek * STEP;
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={COLORS[level]}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({ date: day.date, tokens: day.tokens, x: rect.x, y: rect.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className="cursor-pointer"
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3 text-xs text-[var(--text-secondary)]">
        <span>Less</span>
        {COLORS.map((color, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ background: color }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs px-2 py-1 rounded pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 30,
          }}
        >
          {tooltip.date}: {tooltip.tokens.toLocaleString()} tokens
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContributionGraph.tsx
git commit -m "feat: add GitHub-style contribution graph component"
```

---

### Task 11: DailyChart Component

**Files:**
- Create: `src/components/DailyChart.tsx`

- [ ] **Step 1: Create src/components/DailyChart.tsx**

```tsx
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyModelTokens } from "../types/stats";
import {
  getDailyTokensArray,
  filterByDateRange,
  formatModelName,
} from "../utils/statsParser";

interface DailyChartProps {
  dailyModelTokens: DailyModelTokens[];
}

const PERIODS = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "전체", days: 0 },
] as const;

const MODEL_COLORS: Record<string, string> = {
  Opus: "#a855f7",
  Sonnet: "#3b82f6",
  Haiku: "#22c55e",
};

function getModelColor(name: string): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (name.startsWith(key)) return color;
  }
  return "#8b949e";
}

export function DailyChart({ dailyModelTokens }: DailyChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [stacked, setStacked] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // Collect all unique model names across all days
  const modelNames = useMemo(() => {
    const names = new Set<string>();
    dailyModelTokens.forEach((entry) => {
      Object.keys(entry.tokensByModel).forEach((m) => names.add(formatModelName(m)));
    });
    return Array.from(names).sort();
  }, [dailyModelTokens]);

  // Aggregated (non-stacked) data
  const allTokens = useMemo(
    () => getDailyTokensArray(dailyModelTokens),
    [dailyModelTokens]
  );

  // Stacked data: each entry has { date, "Opus 4.6": N, "Sonnet 4.5": N, ... }
  const stackedData = useMemo(() => {
    return dailyModelTokens.map((entry) => {
      const row: Record<string, string | number> = { date: entry.date };
      Object.entries(entry.tokensByModel).forEach(([modelId, tokens]) => {
        const name = formatModelName(modelId);
        row[name] = ((row[name] as number) || 0) + tokens;
      });
      return row;
    });
  }, [dailyModelTokens]);

  const chartData = useMemo(() => {
    if (stacked) {
      if (selectedPeriod === 0) return stackedData;
      const ref = new Date(today);
      const cutoff = new Date(ref);
      cutoff.setDate(cutoff.getDate() - selectedPeriod + 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      return stackedData.filter((d) => (d.date as string) >= cutoffStr);
    }
    return filterByDateRange(allTokens, selectedPeriod, today);
  }, [stacked, stackedData, allTokens, selectedPeriod, today]);

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return String(value);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          일별 토큰 사용량
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStacked((s) => !s)}
            className={`px-3 py-1 rounded text-xs cursor-pointer transition-colors ${
              stacked
                ? "bg-[var(--badge-bg)] text-purple-400 border border-purple-400"
                : "bg-[var(--badge-bg)] text-[var(--text-secondary)] border border-transparent"
            }`}
          >
            모델별
          </button>
          <div className="flex gap-2">
            {PERIODS.map((period) => (
              <button
                key={period.days}
                onClick={() => setSelectedPeriod(period.days)}
                className={`px-3 py-1 rounded text-xs cursor-pointer transition-colors ${
                  selectedPeriod === period.days
                    ? "bg-[var(--badge-bg)] text-blue-400 border border-blue-400"
                    : "bg-[var(--badge-bg)] text-[var(--text-secondary)] border border-transparent"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              value.toLocaleString() + " tokens",
              name === "tokens" ? "토큰" : name,
            ]}
            labelFormatter={(label: string) => label}
          />
          {stacked ? (
            <>
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
              />
              {modelNames.map((name) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="models"
                  fill={getModelColor(name)}
                />
              ))}
            </>
          ) : (
            <Bar dataKey="tokens" fill="var(--grass-3)" radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DailyChart.tsx
git commit -m "feat: add DailyChart with period filter and model-stacked view"
```

---

### Task 12: ModelBreakdown Component

**Files:**
- Create: `src/components/ModelBreakdown.tsx`

- [ ] **Step 1: Create src/components/ModelBreakdown.tsx**

```tsx
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { ModelUsage } from "../types/stats";
import { getModelBreakdown } from "../utils/statsParser";

interface ModelBreakdownProps {
  modelUsage: Record<string, ModelUsage>;
}

const MODEL_COLORS: Record<string, string> = {
  Opus: "#a855f7",
  Sonnet: "#3b82f6",
  Haiku: "#22c55e",
};

function getColor(name: string, index: number): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (name.startsWith(key)) return color;
  }
  const fallback = ["#f59e0b", "#ef4444", "#8b949e"];
  return fallback[index % fallback.length];
}

export function ModelBreakdown({ modelUsage }: ModelBreakdownProps) {
  const breakdown = useMemo(() => getModelBreakdown(modelUsage), [modelUsage]);

  if (breakdown.length === 0) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 mb-6">
      <span className="text-sm font-semibold text-[var(--text-primary)] block mb-4">
        모델별 사용 비율
      </span>

      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="tokens"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {breakdown.map((entry, i) => (
                <Cell key={entry.name} fill={getColor(entry.name, i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              formatter={(value: number) => [value.toLocaleString() + " tokens"]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {breakdown.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: getColor(entry.name, i) }}
              />
              <span className="text-sm text-[var(--text-primary)]">{entry.name}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {entry.percentage}% ({entry.tokens.toLocaleString()})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ModelBreakdown.tsx
git commit -m "feat: add ModelBreakdown pie chart component"
```

---

### Task 13: EmptyState Component

**Files:**
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: Create src/components/EmptyState.tsx**

```tsx
interface EmptyStateProps {
  message: string;
  onRetry?: () => void;
}

export function EmptyState({ message, onRetry }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-[var(--text-secondary)]">
      <div className="text-4xl mb-4">📊</div>
      <p className="text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[var(--badge-bg)] border border-[var(--border)]
            rounded-md text-sm text-[var(--text-primary)] hover:opacity-80
            transition-opacity cursor-pointer"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EmptyState.tsx
git commit -m "feat: add EmptyState component for error/empty states"
```

---

### Task 14: App Assembly + Entry Point

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Create src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: Create src/App.tsx**

```tsx
import { useStatsData } from "./hooks/useStatsData";
import { useTheme } from "./hooks/useTheme";
import { TopBar } from "./components/TopBar";
import { SummaryCards } from "./components/SummaryCards";
import { ContributionGraph } from "./components/ContributionGraph";
import { DailyChart } from "./components/DailyChart";
import { ModelBreakdown } from "./components/ModelBreakdown";
import { EmptyState } from "./components/EmptyState";

export function App() {
  const { data, loading, error, retry } = useStatsData();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <TopBar totalMessages={0} totalSessions={0} theme={theme} onToggleTheme={toggleTheme} />
        <EmptyState message={error} onRetry={retry} />
      </div>
    );
  }

  if (!data || data.dailyActivity.length === 0) {
    return (
      <div className="p-6">
        <TopBar totalMessages={0} totalSessions={0} theme={theme} onToggleTheme={toggleTheme} />
        <EmptyState message="아직 사용 기록이 없습니다." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <TopBar
        totalMessages={data.totalMessages}
        totalSessions={data.totalSessions}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <SummaryCards data={data} />
      <ContributionGraph
        dailyModelTokens={data.dailyModelTokens}
        firstSessionDate={data.firstSessionDate}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyChart dailyModelTokens={data.dailyModelTokens} />
        <ModelBreakdown modelUsage={data.modelUsage} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: assemble App with all dashboard components"
```

---

### Task 15: Verify Dev Mode

- [ ] **Step 1: Run the tests**

```bash
npm test
```

Expected: All statsParser tests pass (including formatModelName and getModelBreakdown).

- [ ] **Step 2: Compile Electron code**

```bash
npx tsc -p tsconfig.node.json
```

Expected: No errors. `dist-electron/main.js` and `dist-electron/preload.js` created.

- [ ] **Step 3: Start dev mode**

```bash
npm run dev
```

Expected: Vite dev server starts on port 5173, Electron window opens showing the dashboard with:
- TopBar with total message/session counts
- 4 summary cards
- Contribution heatmap with green cells on dates that have token usage
- Bar chart showing daily token usage

- [ ] **Step 4: Verify theme toggle**

Click the moon/sun button in the top bar. The entire dashboard should switch between dark and light themes.

- [ ] **Step 5: Verify chart period filter**

Click "7일", "30일", "전체" buttons above the bar chart. The chart data should filter accordingly.

- [ ] **Step 6: Verify model-stacked bar chart**

Click "모델별" button in the daily chart. Bars should switch to stacked view with different colors per model (purple=Opus, blue=Sonnet, green=Haiku).

- [ ] **Step 7: Verify model breakdown pie chart**

Check the pie chart shows model usage percentages with correct labels and colors. Hover to see exact token counts.

- [ ] **Step 8: Verify heatmap tooltip**

Hover over a green cell in the contribution graph. A tooltip should appear showing the date and token count.

- [ ] **Step 9: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve any issues found during dev verification"
```

---

### Task 16: Production Build

- [ ] **Step 1: Test production build**

```bash
npm run build
```

Expected: `dist/` directory contains the Vite build output. `dist-electron/` contains compiled Electron files.

- [ ] **Step 2: Package the app**

```bash
npm run package
```

Expected: `release/` directory contains the packaged app (.dmg on Mac, .exe on Windows).

- [ ] **Step 3: Launch the packaged app and verify it works the same as dev mode**

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml
git commit -m "chore: verify production build and packaging"
```
