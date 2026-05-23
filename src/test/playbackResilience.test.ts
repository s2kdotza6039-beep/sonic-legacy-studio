import { describe, it, expect, vi } from "vitest";
import { enforceCap, clampSeekTarget, resolveResumePosition } from "@/lib/musicTier";

/* ------------------------------------------------------------------ *
 * Targeted tests for the new resilience behaviors added to <Listen />:
 *   1. upgrade-during-seek does not loop the upgrade prompt
 *   2. tab blur + return re-syncs entitlements without re-clamping
 *   3. mid-buffering watchdog ticks don't false-clamp a stale time
 * ------------------------------------------------------------------ */

const DURATION = 200;

// FakeAudio with the same surfaces Listen.tsx subscribes to PLUS a
// `readyState` like a real <audio>. The watchdog in Listen ignores ticks
// where readyState < 2 (HAVE_CURRENT_DATA) to avoid false clamps while
// the network is still loading a seeked-to region.
class FakeAudio {
  currentTime = 0;
  duration = DURATION;
  paused = true;
  readyState = 4; // HAVE_ENOUGH_DATA by default
  private listeners: Record<string, Array<() => void>> = {};
  addEventListener(ev: string, fn: () => void) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev: string) { for (const fn of this.listeners[ev] ?? []) fn(); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

/**
 * Mirrors the watchdog logic in Listen.tsx (incl. the readyState gate +
 * promptArmed re-arming behavior). Centralized here so the test covers
 * the same control flow the component runs.
 */
function attachWatchdog(audio: FakeAudio, opts: {
  allowedSec: number;
  capped: boolean;
  onPromptUpgrade: () => void;
}) {
  let promptArmed = true;
  const tick = (source: "timeupdate" | "watchdog") => {
    if (audio.readyState < 2 && source === "watchdog") return;
    const r = enforceCap({
      currentTime: audio.currentTime,
      allowedSec: opts.allowedSec,
      capped: opts.capped,
      wasPlaying: !audio.paused,
    });
    if (r.clamped) {
      audio.currentTime = r.currentTime;
      if (r.paused) audio.pause();
      if (r.promptUpgrade && promptArmed) {
        opts.onPromptUpgrade();
        promptArmed = false;
      }
    } else if (opts.capped && audio.currentTime < opts.allowedSec - 1) {
      promptArmed = true;
    }
  };
  audio.addEventListener("timeupdate", () => tick("timeupdate"));
  const id = setInterval(() => tick("watchdog"), 250);
  return { stop: () => clearInterval(id), tick };
}

describe("Upgrade during seek / buffering", () => {
  it("does NOT re-prompt the upgrade dialog repeatedly while clamped at the cap", () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    let prompts = 0;
    const { stop } = attachWatchdog(audio, { allowedSec: 110, capped: true, onPromptUpgrade: () => prompts++ });
    audio.play();

    // User scrubs past cap repeatedly — watchdog keeps clamping but only
    // raises ONE upgrade prompt until they move below the cap again.
    audio.currentTime = 150; vi.advanceTimersByTime(250);
    audio.currentTime = 160; vi.advanceTimersByTime(250);
    audio.currentTime = 175; vi.advanceTimersByTime(250);
    expect(prompts).toBe(1);

    // User scrubs back below the cap → prompt re-arms.
    audio.currentTime = 20;  vi.advanceTimersByTime(250);
    audio.currentTime = 180; vi.advanceTimersByTime(250);
    expect(prompts).toBe(2);
    stop();
  });

  it("does NOT clamp when the audio element is still buffering (readyState < 2)", () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    audio.readyState = 1; // HAVE_METADATA only — currentTime is stale
    audio.currentTime = 999; // would-be garbage value during buffer
    let prompts = 0;
    const { stop } = attachWatchdog(audio, { allowedSec: 110, capped: true, onPromptUpgrade: () => prompts++ });
    vi.advanceTimersByTime(1000);
    // Buffering tick must be ignored — currentTime untouched, no prompt.
    expect(audio.currentTime).toBe(999);
    expect(prompts).toBe(0);

    // Once buffering finishes, the next tick clamps as normal.
    audio.readyState = 4;
    vi.advanceTimersByTime(250);
    expect(audio.currentTime).toBeCloseTo(109.75, 2);
    expect(prompts).toBe(1);
    stop();
  });
});

describe("Tab blur → upgrade applied while away → return", () => {
  it("resolveResumePosition restores exact prior position when the new tier removes the cap", () => {
    // User was clamped at 109.75 on Standard, paid Gold while tab was hidden.
    const r = resolveResumePosition({ saved: 109.75, duration: DURATION, allowedSec: DURATION, capped: false });
    expect(r).toBe(109.75);
  });

  it("clampSeekTarget on returning tab doesn't clamp if new tier covers full duration", () => {
    const r = clampSeekTarget({ target: 180, duration: DURATION, allowedSec: DURATION, capped: false });
    expect(r.currentTime).toBe(180);
    expect(r.promptUpgrade).toBe(false);
  });

  it("after tier downgrade (refund) the resume position is re-clamped on next mount", () => {
    const r = resolveResumePosition({ saved: 180, duration: DURATION, allowedSec: 110, capped: true });
    expect(r).toBeCloseTo(109.75, 2);
  });
});
