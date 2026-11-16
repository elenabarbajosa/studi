import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createEngine,
  currentPhaseElapsedMs,
  pause,
  remainingMs,
  resume,
  start,
  tick,
} from "@/lib/focus/timer-engine";
import {
  isActiveSessionStale,
  parseEngineState,
  restoreEngineFromAuthoritative,
  shouldPreferRemoteRevision,
  shouldPreferServerOverLocal,
  snapshotFromActiveRow,
} from "@/lib/focus/session-sync";

describe("focus session sync — revision preference", () => {
  it("prefers strictly newer remote revisions", () => {
    assert.equal(shouldPreferRemoteRevision(1, 2), true);
    assert.equal(shouldPreferRemoteRevision(3, 3), false);
    assert.equal(shouldPreferRemoteRevision(5, 4), false);
  });

  it("lets server win over empty or different local sessions", () => {
    const server = {
      clientSessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      revision: 2,
    } as const;

    assert.equal(
      shouldPreferServerOverLocal({
        server: server as never,
        localClientSessionId: null,
        localRevision: 0,
      }),
      true,
    );
    assert.equal(
      shouldPreferServerOverLocal({
        server: server as never,
        localClientSessionId: "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee",
        localRevision: 99,
      }),
      true,
    );
    assert.equal(
      shouldPreferServerOverLocal({
        server: server as never,
        localClientSessionId: server.clientSessionId,
        localRevision: 3,
      }),
      false,
    );
    assert.equal(
      shouldPreferServerOverLocal({
        server: server as never,
        localClientSessionId: server.clientSessionId,
        localRevision: 1,
      }),
      true,
    );
  });
});

describe("focus session sync — refresh restore after 25 of 45 minutes", () => {
  it("restores approximately 20 minutes remaining", () => {
    const config = {
      focusMinutes: 45,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      intervalsBeforeLong: 4,
      autoStartBreaks: false,
      soundEnabled: true,
    };
    const t0 = 1_700_000_000_000;
    const after25m = t0 + 25 * 60_000;
    const engine = start(createEngine("pomodoro", config), t0);

    const restored = restoreEngineFromAuthoritative({
      engine,
      nowMs: after25m,
      lastHeartbeatAtMs: after25m - 15_000,
    });

    const remaining = remainingMs(restored, after25m);
    assert.ok(remaining != null);
    // Allow 1s tolerance for integer math.
    assert.ok(
      Math.abs(remaining! - 20 * 60_000) < 1000,
      `expected ~20m remaining, got ${remaining}`,
    );
    assert.equal(restored.runState, "running");
  });

  it("pauses abandoned sessions at last heartbeat instead of crediting hours", () => {
    const config = {
      focusMinutes: 45,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      intervalsBeforeLong: 4,
      autoStartBreaks: false,
      soundEnabled: true,
    };
    const t0 = 1_700_000_000_000;
    const engine = start(createEngine("pomodoro", config), t0);
    const lastBeat = t0 + 10 * 60_000;
    const muchLater = lastBeat + 3 * 60 * 60_000;

    const restored = restoreEngineFromAuthoritative({
      engine,
      nowMs: muchLater,
      lastHeartbeatAtMs: lastBeat,
    });

    assert.equal(restored.runState, "paused");
    const remaining = remainingMs(restored, muchLater);
    assert.ok(remaining != null);
    assert.ok(Math.abs(remaining! - 35 * 60_000) < 1000);
  });
});

describe("focus session sync — parsing", () => {
  it("parses valid engine state and rejects garbage", () => {
    const engine = createEngine("pomodoro", {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      intervalsBeforeLong: 4,
      autoStartBreaks: false,
      soundEnabled: true,
    });
    assert.ok(parseEngineState(engine));
    assert.equal(parseEngineState({ foo: 1 }), null);
    assert.equal(parseEngineState(null), null);
  });

  it("builds snapshots from DB rows including revision", () => {
    const engine = createEngine("stopwatch", {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      intervalsBeforeLong: 4,
      autoStartBreaks: false,
      soundEnabled: true,
    });
    const snap = snapshotFromActiveRow({
      client_session_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      revision: 7,
      timer_mode: "stopwatch",
      subject_id: null,
      topic_id: null,
      task_id: null,
      goal: "Read ch. 3",
      started_at: "2026-11-16T10:00:00.000Z",
      engine_state: engine,
      focus_seconds: 120,
      break_seconds: 0,
      last_heartbeat_at: "2026-11-16T10:02:00.000Z",
      updated_at: "2026-11-16T10:02:00.000Z",
    });
    assert.ok(snap);
    assert.equal(snap!.revision, 7);
    assert.equal(snap!.goal, "Read ch. 3");
    assert.equal(snap!.timerMode, "stopwatch");
  });

  it("detects stale heartbeats", () => {
    const now = Date.parse("2026-11-16T12:00:00.000Z");
    assert.equal(
      isActiveSessionStale("2026-11-16T11:59:00.000Z", now),
      false,
    );
    assert.equal(
      isActiveSessionStale("2026-11-16T11:00:00.000Z", now),
      true,
    );
  });
});

describe("focus session sync — pause / resume / break / stopwatch", () => {
  const config = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    intervalsBeforeLong: 4,
    autoStartBreaks: false,
    soundEnabled: true,
  };

  it("keeps paused remaining stable across restore (laptop pause → phone)", () => {
    const t0 = 1_700_000_000_000;
    let engine = start(createEngine("pomodoro", config), t0);
    engine = tick(engine, t0 + 10 * 60_000).state;
    engine = pause(engine, t0 + 10 * 60_000);

    const restored = restoreEngineFromAuthoritative({
      engine,
      nowMs: t0 + 30 * 60_000,
      lastHeartbeatAtMs: t0 + 10 * 60_000,
    });

    assert.equal(restored.runState, "paused");
    const remaining = remainingMs(restored, t0 + 30 * 60_000);
    assert.ok(remaining != null);
    assert.ok(Math.abs(remaining! - 15 * 60_000) < 1000);
  });

  it("resumes from authoritative paused state without resetting duration", () => {
    const t0 = 1_700_000_000_000;
    let engine = start(createEngine("pomodoro", config), t0);
    engine = tick(engine, t0 + 8 * 60_000).state;
    engine = pause(engine, t0 + 8 * 60_000);
    const resumeAt = t0 + 12 * 60_000;
    engine = resume(engine, resumeAt);

    const later = resumeAt + 2 * 60_000;
    const restored = restoreEngineFromAuthoritative({
      engine,
      nowMs: later,
      lastHeartbeatAtMs: later - 5_000,
    });

    assert.equal(restored.runState, "running");
    const remaining = remainingMs(restored, later);
    assert.ok(remaining != null);
    // 25 - 8 - 2 = 15 minutes left
    assert.ok(Math.abs(remaining! - 15 * 60_000) < 1000);
  });

  it("restores stopwatch elapsed from timestamps", () => {
    const t0 = 1_700_000_000_000;
    const engine = start(createEngine("stopwatch", config), t0);
    const after12m = t0 + 12 * 60_000;
    const restored = restoreEngineFromAuthoritative({
      engine,
      nowMs: after12m,
      lastHeartbeatAtMs: after12m - 10_000,
    });
    assert.equal(restored.runState, "running");
    assert.equal(restored.phase, "stopwatch");
    assert.ok(
      Math.abs(currentPhaseElapsedMs(restored, after12m) - 12 * 60_000) < 1000,
    );
  });
});

describe("focus session sync — conflicts and ordering", () => {
  it("rejects out-of-order realtime (older revision must not win)", () => {
    assert.equal(shouldPreferRemoteRevision(5, 4), false);
    assert.equal(shouldPreferRemoteRevision(5, 5), false);
    assert.equal(shouldPreferRemoteRevision(5, 6), true);
  });

  it("never lets a lower-revision local cache overwrite the server", () => {
    const server = {
      clientSessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      revision: 10,
    };
    assert.equal(
      shouldPreferServerOverLocal({
        server: server as never,
        localClientSessionId: server.clientSessionId,
        localRevision: 3,
      }),
      true,
    );
  });

  it("treats simultaneous conflicting writes as revision-gated (only newer applies)", () => {
    // Simulate device A at rev 4 and device B receiving realtime rev 5.
    const localRevision = 4;
    const remoteFromB = 5;
    const lateEchoFromA = 4;
    assert.equal(shouldPreferRemoteRevision(localRevision, remoteFromB), true);
    // After adopting 5, a delayed echo of A's rev-4 write must be ignored.
    assert.equal(shouldPreferRemoteRevision(remoteFromB, lateEchoFromA), false);
  });
});
