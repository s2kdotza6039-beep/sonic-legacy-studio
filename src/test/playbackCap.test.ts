import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enforceCap,
  clampSeekTarget,
  resolveResumePosition,
  tierPercentage,
  type Track,
} from "@/lib/musicTier";

/* ------------------------------------------------------------------ *
 * End-to-end-style tests for preview-cap enforcement on every input
 * surface: mouse scrub, keyboard seek, mobile scrub (watchdog), and
 * MediaSession resume (incl. resume-after-upgrade).
 *
 * We don't render <Listen /> here — the helpers tested are the exact
 * same ones the component now delegates to. A fake HTMLMediaElement
 * lets us drive `seeking`, `seeked`, `ratechange`, `timeupdate`, and
 * the 250 ms watchdog the way a real browser would.
 * ------------------------------------------------------------------ */

const DURATION = 200; // seconds
const track = (overrides: Partial<Track> = {}): Track => ({
  id: "t1", slug: "t1", title: "T", artist_name: "A", artist_slug: "a",
  r2_object_key: "t.mp3", cover_url: null, duration_seconds: DURATION,
  price_standard_cents: 350, price_gold_cents: 500, price_download_cents: 1000,
  pct_free: 0.25, pct_standard: 0.55, pct_gold: 1, is_active: true, sort_order: 0,
  ...overrides,
});

// Minimal stand-in for HTMLMediaElement that mirrors the relevant fields
// and dispatches the events Listen.tsx subscribes to.
class FakeAudio {
  currentTime = 0;
  duration = DURATION;
  paused = true;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(ev: string, fn: () => void) {
    (this.listeners[ev] ||= []).push(fn);
  }
  removeEventListener(ev: string, fn: () => void) {
    this.listeners[ev] = (this.listeners[ev] ?? []).filter((f) => f !== fn);
  }
  emit(ev: string) {
    for (const fn of this.listeners[ev] ?? []) fn();
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }

  /**
   * Wire the same listeners the real component wires so we can assert
   * that any seek surface triggers the cap.
   */
  attachMonitor(opts: { allowedSec: number; capped: boolean; onClamp?: () => void }) {
    const enforce = () => {
      const r = enforceCap({
        currentTime: this.currentTime,
        allowedSec: opts.allowedSec,
        capped: opts.capped,
        wasPlaying: !this.paused,
      });
      if (r.clamped) {
        this.currentTime = r.currentTime;
        if (r.paused) this.pause();
        opts.onClamp?.();
      }
    };
    this.addEventListener("timeupdate", enforce);
    this.addEventListener("seeking", enforce);
    this.addEventListener("seeked", enforce);
    this.addEventListener("ratechange", enforce);
    const watchdog = setInterval(enforce, 250);
    return () => clearInterval(watchdog);
  }
}

describe("enforceCap — pure logic", () => {
  it("no-op below the cap", () => {
    const r = enforceCap({ currentTime: 30, allowedSec: 50, capped: true, wasPlaying: true });
    expect(r.clamped).toBe(false);
    expect(r.currentTime).toBe(30);
    expect(r.promptUpgrade).toBe(false);
  });

  it("clamps when past the cap and pauses playback", () => {
    const r = enforceCap({ currentTime: 80, allowedSec: 50, capped: true, wasPlaying: true });
    expect(r.clamped).toBe(true);
    expect(r.currentTime).toBeCloseTo(49.75, 2);
    expect(r.paused).toBe(true);
    expect(r.promptUpgrade).toBe(true);
  });

  it("does not clamp uncapped tiers (gold, cristal)", () => {
    const r = enforceCap({ currentTime: 195, allowedSec: 200, capped: false, wasPlaying: true });
    expect(r.clamped).toBe(false);
  });

  it("treats currentTime exactly at the cap as still allowed", () => {
    const r = enforceCap({ currentTime: 50, allowedSec: 50, capped: true, wasPlaying: true });
    expect(r.clamped).toBe(false);
  });
});

describe("Standard tier (55%) cap on every seek surface", () => {
  const t = track();
  const allowedSec = DURATION * tierPercentage(t, "standard"); // 110s

  let audio: FakeAudio;
  let clamps: number;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    audio = new FakeAudio();
    clamps = 0;
    detach = audio.attachMonitor({ allowedSec, capped: true, onClamp: () => clamps++ });
  });

  it("MOUSE SCRUB — clampSeekTarget pins forward jump to allowedSec", () => {
    const r = clampSeekTarget({ target: 180, duration: DURATION, allowedSec, capped: true });
    expect(r.currentTime).toBeCloseTo(109.75, 2);
    expect(r.promptUpgrade).toBe(true);
    detach();
  });

  it("MOUSE SCRUB backwards — leaves target untouched", () => {
    const r = clampSeekTarget({ target: 40, duration: DURATION, allowedSec, capped: true });
    expect(r.currentTime).toBe(40);
    expect(r.promptUpgrade).toBe(false);
    detach();
  });

  it("KEYBOARD SEEK — `seeking` event fires after currentTime jump and clamps", () => {
    // Right-arrow simulation: native control mutates currentTime then fires 'seeking'.
    audio.play();
    audio.currentTime = 175;
    audio.emit("seeking");
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    expect(audio.paused).toBe(true);
    expect(clamps).toBe(1);
    detach();
  });

  it("MOBILE SCRUB — 250ms watchdog catches a silent jump (no 'seeking' event)", () => {
    audio.play();
    // Some mobile scrub gestures change currentTime without firing 'seeking'.
    audio.currentTime = 140;
    expect(audio.currentTime).toBe(140); // not yet clamped
    vi.advanceTimersByTime(250);
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    expect(audio.paused).toBe(true);
    expect(clamps).toBe(1);
    detach();
  });

  it("RATECHANGE — abuse via fast-forward rate is caught on next tick", () => {
    audio.play();
    audio.currentTime = 130; // simulate cumulative drift past cap
    audio.emit("ratechange");
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    detach();
  });

  it("TIMEUPDATE — normal forward playback is clamped when crossing the cap", () => {
    audio.play();
    audio.currentTime = 109;
    audio.emit("timeupdate");
    expect(audio.currentTime).toBe(109); // still under
    audio.currentTime = 111;
    audio.emit("timeupdate");
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    expect(audio.paused).toBe(true);
    detach();
  });
});

describe("Gold tier (100%) — no cap", () => {
  const t = track();
  const allowedSec = DURATION * tierPercentage(t, "gold"); // 200s

  it("does NOT clamp a seek to 99% of duration", () => {
    const r = clampSeekTarget({ target: 198, duration: DURATION, allowedSec, capped: false });
    expect(r.currentTime).toBe(198);
    expect(r.promptUpgrade).toBe(false);
  });

  it("watchdog never clamps on uncapped playback", () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    let clamps = 0;
    const detach = audio.attachMonitor({ allowedSec, capped: false, onClamp: () => clamps++ });
    audio.play();
    audio.currentTime = 195;
    vi.advanceTimersByTime(1000);
    expect(clamps).toBe(0);
    expect(audio.currentTime).toBe(195);
    detach();
  });
});

describe("MediaSession resume — resolveResumePosition", () => {
  const t = track();
  const standardCap = DURATION * tierPercentage(t, "standard"); // 110s
  const goldCap = DURATION * tierPercentage(t, "gold");         // 200s

  it("ignores empty / missing resume", () => {
    expect(resolveResumePosition({ saved: undefined, duration: DURATION, allowedSec: standardCap, capped: true })).toBe(0);
    expect(resolveResumePosition({ saved: 0,         duration: DURATION, allowedSec: standardCap, capped: true })).toBe(0);
  });

  it("clamps a previously-saved past-cap position back to the cap", () => {
    const r = resolveResumePosition({ saved: 150, duration: DURATION, allowedSec: standardCap, capped: true });
    expect(r).toBeCloseTo(109.75, 2);
  });

  it("RESUME AFTER UPGRADE — Gold restores the exact previous position past the old free cap", () => {
    // User was clamped at ~49.75s on Free, paid Gold, page remounts with capped=false.
    const r = resolveResumePosition({ saved: 49.75, duration: DURATION, allowedSec: goldCap, capped: false });
    expect(r).toBe(49.75);
  });

  it("RESUME AFTER UPGRADE — Standard restores below new (higher) cap", () => {
    const r = resolveResumePosition({ saved: 49.75, duration: DURATION, allowedSec: standardCap, capped: true });
    expect(r).toBe(49.75);
  });

  it("ignores a resume at/past full duration", () => {
    expect(resolveResumePosition({ saved: DURATION, duration: DURATION, allowedSec: goldCap, capped: false })).toBe(0);
    expect(resolveResumePosition({ saved: DURATION + 10, duration: DURATION, allowedSec: goldCap, capped: false })).toBe(0);
  });
});

describe("Integration — same FakeAudio survives all four input surfaces in one session", () => {
  it("clamps mouse → keyboard → mobile scrub → ratechange consecutively", () => {
    vi.useFakeTimers();
    const t = track();
    const allowedSec = DURATION * tierPercentage(t, "standard");
    const audio = new FakeAudio();
    let clamps = 0;
    const detach = audio.attachMonitor({ allowedSec, capped: true, onClamp: () => clamps++ });
    audio.play();

    // 1. Mouse scrub
    const m = clampSeekTarget({ target: 190, duration: DURATION, allowedSec, capped: true });
    audio.currentTime = m.currentTime;
    expect(audio.currentTime).toBeCloseTo(109.75, 2);

    // 2. User presses play again; tries keyboard right-arrow to 160s
    audio.play();
    audio.currentTime = 160;
    audio.emit("seeking");
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    expect(audio.paused).toBe(true);

    // 3. Mobile silent scrub
    audio.play();
    audio.currentTime = 170;
    vi.advanceTimersByTime(250);
    expect(audio.currentTime).toBeCloseTo(109.75, 2);

    // 4. ratechange exploit
    audio.play();
    audio.currentTime = 145;
    audio.emit("ratechange");
    expect(audio.currentTime).toBeCloseTo(109.75, 2);

    expect(clamps).toBeGreaterThanOrEqual(3);
    detach();
  });
});
