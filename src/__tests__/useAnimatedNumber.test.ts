import { useAnimatedNumber } from "@/shared/hooks/useAnimatedNumber";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FrameCallback = (now: number) => void;

let pending: Map<number, FrameCallback>;
let nextId: number;
let currentTime: number;
let originalRaf: typeof globalThis.requestAnimationFrame;
let originalCaf: typeof globalThis.cancelAnimationFrame;
let cancelSpy: ReturnType<typeof vi.fn>;

function setupRaf() {
  pending = new Map();
  nextId = 1;
  currentTime = 0;

  originalRaf = globalThis.requestAnimationFrame;
  originalCaf = globalThis.cancelAnimationFrame;

  const raf = (cb: FrameCallback): number => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  };
  cancelSpy = vi.fn((id: number) => {
    pending.delete(id);
  });

  globalThis.requestAnimationFrame = raf as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = cancelSpy as unknown as typeof globalThis.cancelAnimationFrame;
  if (typeof window !== "undefined") {
    window.requestAnimationFrame = raf as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = cancelSpy as unknown as typeof window.cancelAnimationFrame;
  }
}

function teardownRaf() {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCaf;
  if (typeof window !== "undefined") {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
  }
}

function flushFrames(ms: number) {
  const step = 16;
  const target = currentTime + ms;
  while (currentTime < target) {
    currentTime = Math.min(currentTime + step, target);
    const entries = Array.from(pending.entries());
    pending.clear();
    for (const [, cb] of entries) {
      cb(currentTime);
    }
  }
}

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    setupRaf();
  });
  afterEach(() => {
    teardownRaf();
  });

  it("초기 렌더에서 0으로 시작", () => {
    const { result } = renderHook(() => useAnimatedNumber(1000));
    expect(result.current).toBe(0);
  });

  it("duration이 지나면 목표값 도달", () => {
    const { result } = renderHook(() => useAnimatedNumber(1000, 700));
    act(() => {
      flushFrames(800);
    });
    expect(result.current).toBe(1000);
  });

  it("진행 중에는 시작값과 목표값 사이", () => {
    const { result } = renderHook(() => useAnimatedNumber(1000, 700));
    act(() => {
      flushFrames(300);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1000);
  });

  it("두 값이 모두 정수면 정수로 반환", () => {
    const { result } = renderHook(() => useAnimatedNumber(500, 700));
    act(() => {
      flushFrames(300);
    });
    expect(Number.isInteger(result.current)).toBe(true);
  });

  it("소수 값은 소수로 보간", () => {
    const { result } = renderHook(() => useAnimatedNumber(12.5, 700));
    act(() => {
      flushFrames(300);
    });
    expect(result.current).not.toBe(Math.round(result.current));
  });

  it("값 변경 시 현재값에서 새 목표까지 보간", () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatedNumber(v, 700), {
      initialProps: { v: 1000 },
    });
    act(() => {
      flushFrames(800);
    });
    expect(result.current).toBe(1000);

    rerender({ v: 2000 });
    act(() => {
      flushFrames(300);
    });
    expect(result.current).toBeGreaterThan(1000);
    expect(result.current).toBeLessThan(2000);

    act(() => {
      flushFrames(500);
    });
    expect(result.current).toBe(2000);
  });

  it("같은 값으로 재설정되면 display 유지", () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatedNumber(v, 700), {
      initialProps: { v: 1000 },
    });
    act(() => {
      flushFrames(800);
    });
    expect(result.current).toBe(1000);

    rerender({ v: 1000 });
    act(() => {
      flushFrames(800);
    });
    expect(result.current).toBe(1000);
  });

  it("언마운트 시 cancelAnimationFrame 호출", () => {
    const { unmount } = renderHook(() => useAnimatedNumber(1000, 700));
    const callsBefore = cancelSpy.mock.calls.length;
    unmount();
    expect(cancelSpy.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
