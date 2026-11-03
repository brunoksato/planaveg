import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn<typeof window.matchMedia>((query: string) => ({
    addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
    addListener: vi.fn<MediaQueryList["addListener"]>(),
    dispatchEvent: vi.fn<EventTarget["dispatchEvent"]>(() => false),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
    removeListener: vi.fn<MediaQueryList["removeListener"]>(),
  })),
});
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: vi.fn<Clipboard["writeText"]>().mockResolvedValue(undefined) },
});
Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn<typeof window.scrollTo>(),
});

class ResizeObserverStub implements ResizeObserver {
  disconnect = vi.fn<ResizeObserver["disconnect"]>();
  observe = vi.fn<ResizeObserver["observe"]>();
  unobserve = vi.fn<ResizeObserver["unobserve"]>();
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
});

afterEach(cleanup);
