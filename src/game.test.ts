import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
async function setup(step = 10) {
  const events = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(320, 180) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => 320,
      cssHeight: () => 180,
      dpr: () => 1,
      events: () => events,
    },
  });
  cleanups.push(() => engine.destroy());
  await engine.initialize();
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    device = "mouse",
    id = 1,
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x / 4,
        clientY: y / 4,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const d = engine.debug;
  const pose = (x: number, y: number, vx: number, vy: number, spin = 0) => {
    engine.apply((s) => d.clearWorld(s));
    engine.apply((s) => d.spawnBall(s));
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, x, y));
    engine.apply((s) => d.setBallVelocity(s, vx, vy));
    engine.apply((s) => d.setBallSpin(s, spin));
    engine.apply((s) => d.setAiMovement(s, false));
  };
  return { engine, d, key, tap, pointer, pose };
}

describe("screens and input through the engine", () => {
  it("initializes the complete state and live diagnostics", async () => {
    const { engine, d } = await setup();
    const s = d.snapshot(engine.state);
    expect(s).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      score: { p1: 0, p2: 0 },
      receiver: "left",
      simTime: 0,
      ai: { tracking: true, movement: true },
    });
    expect(s.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: true,
      holdTimer: C.HOLD_TIME,
      speed: 0,
      trail: [],
    });
    expect(s.obstacles).toHaveLength(2);
    expect(engine.diagnostics().every((x) => !x.error)).toBe(true);
    await engine.advance(2);
    expect(engine.state.simTime).toBeCloseTo(0.02);
    expect(d.snapshot(engine.state).ball).toEqual(s.ball);
  });
  it("navigates with priority, remembers title choice, and restores the title", async () => {
    const { engine, key, tap } = await setup();
    key("ArrowUp");
    key("ArrowDown");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    for (const code of ["ArrowUp", "ArrowDown", "Enter"]) key(code, false);
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    expect(engine.state.titleIndex).toBe(2);
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    await tap("ArrowUp");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
  });
  it("serves on timer expiry without advancing the ball that frame", async () => {
    const { engine, d, tap } = await setup();
    await tap("Enter");
    engine.apply((s) => d.setBallHoldTimer(s, 0.01));
    engine.apply((s) => d.setBallServeSign(s, -1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: false,
      holdTimer: 0,
      serveSign: -1,
    });
    expect(engine.state.ball!.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(engine.state.ball!.vy).toBeLessThan(0);
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("pauses once on Escape, freezes the world, and resumes once", async () => {
    const { engine, tap, key } = await setup();
    await tap("Enter");
    await tap("Escape");
    expect(engine.state.screen).toBe("paused");
    const ball = engine.state.ball;
    const paddles = engine.state.paddles;
    key("KeyW");
    await engine.advance(5);
    expect(engine.state.ball).toEqual(ball);
    expect(engine.state.paddles).toEqual(paddles);
    key("KeyW", false);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.ball!.holdTimer).toBeLessThan(ball!.holdTimer);
  });
  it("restarts and quits from pause, preserving remembered title selection", async () => {
    const { engine, d, tap } = await setup();
    await tap("ArrowDown");
    await tap("Enter");
    engine.apply((s) => d.setScore(s, 5, 4));
    await tap("KeyP");
    await tap("ArrowDown");
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    expect(engine.state.mode).toBe("versus");
    await tap("KeyP");
    await tap("ArrowUp");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.mode).toBe("solo");
  });
  it.each(["mouse", "touch"])(
    "requires matching press and release regions for %s",
    async (device) => {
      const { engine, d, pointer } = await setup();
      await engine.advance(1);
      const a = d.menuItemRect(engine.state, 0)!;
      const b = d.menuItemRect(engine.state, 1)!;
      pointer("down", a.x + 20, a.y + 20, device);
      await engine.advance(1);
      pointer("up", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      expect(engine.state.screen).toBe("title");
      expect(engine.state.menuIndex).toBe(1);
      pointer("down", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      pointer("up", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      expect(engine.state.screen).toBe("countdown");
      expect(engine.state.mode).toBe("versus");
    },
  );
  it("accepts same-frame clicks and gives keyboard confirmation priority", async () => {
    const { engine, d, pointer, key } = await setup();
    await engine.advance(1);
    const b = d.menuItemRect(engine.state, 1)!;
    key("Enter");
    pointer("down", b.x + 4, b.y + 4);
    pointer("up", b.x + 4, b.y + 4);
    await engine.advance(1);
    expect(engine.state.mode).toBe("solo");
  });
  it("toggles audio on menus and reflects debug mute on the cue bus", async () => {
    const { engine, d, tap, pose } = await setup();
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    engine.apply((s) => d.setMuted(s, false));
    await engine.advance(1);
    expect(engine.state.muted).toBe(false);
    const gains: number[] = [];
    engine.events.on("cue:played", (e) => gains.push(e.gain));
    engine.apply((s) => d.setMuted(s, true));
    pose(600, C.BALL_R, 0, -300);
    await engine.advance(1);
    expect(gains).toEqual([0]);
  });
});

describe("paddles, AI, and physics", () => {
  it("moves human paddles during countdown and clamps actual velocity", async () => {
    const { engine, d, key, tap } = await setup();
    await tap("Enter");
    key("ArrowDown");
    await engine.advance(2);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.02,
    );
    engine.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    key("ArrowDown", false);
    engine.apply((s) => d.setMode(s, "versus"));
    key("ArrowUp");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(engine.state.paddles.right.vy).toBe(-C.PADDLE_SPEED);
  });
  it("keeps driver intent separate from integrated velocity", async () => {
    const { engine, d, tap } = await setup();
    await tap("Enter");
    engine.apply((s) => d.setPaddleVy(s, "left", 500));
    expect(engine.state.paddles.left.vy).toBe(0);
    engine.apply((s) => d.setPaddleDriven(s, "left", true));
    engine.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBeCloseTo(200);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(500);
  });
  it("gates AI tracking and movement independently", async () => {
    const { engine, d, pose } = await setup();
    pose(900, 120, 500, 0);
    engine.apply((s) => d.setAiMovement(s, true));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    engine.apply((s) => d.setAiTracking(s, false));
    engine.apply((s) => d.setPaddleCy(s, "right", 200));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    engine.apply((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
  });
  it("rotates velocity at constant speed and decays spin", async () => {
    const { engine, pose } = await setup();
    pose(640, 360, 400, 0, 300);
    await engine.advance(20);
    const b = engine.state.ball!;
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(400, 6);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.spin).toBeCloseTo(300 * Math.pow(0.5, 0.2 / C.SPIN_HALFLIFE), 6);
    expect(b.trail.length).toBeGreaterThan(8);
    expect(
      b.trail.every((t) => engine.state.simTime - t.t <= C.TRAIL_TIME),
    ).toBe(true);
  });
  it.each([0, 1])(
    "reflects wall %i without changing speed or spin beyond decay",
    async (wall) => {
      const { engine, pose } = await setup();
      pose(
        600,
        wall ? C.FIELD_H - C.BALL_R : C.BALL_R,
        100,
        wall ? 300 : -300,
        50,
      );
      await engine.advance(1);
      const b = engine.state.ball!;
      expect(Math.sign(b.vy)).toBe(wall ? -1 : 1);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(Math.hypot(100, 300));
      expect(b.y).toBeGreaterThanOrEqual(C.BALL_R);
      expect(b.y).toBeLessThanOrEqual(C.FIELD_H - C.BALL_R);
    },
  );
  it.each(["left", "right"] as const)(
    "bounces off the %s paddle, adds motion spin, and caps speed",
    async (side) => {
      const { engine, d, pose } = await setup();
      pose(
        side === "left" ? C.P1_X1 + C.BALL_R + 1 : C.P2_X0 - C.BALL_R - 1,
        C.FIELD_CY,
        side === "left" ? -970 : 970,
        0,
      );
      engine.apply((s) => d.setPaddleDriven(s, side, true));
      engine.apply((s) => d.setPaddleVy(s, side, 100));
      await engine.advance(1);
      const b = engine.state.ball!;
      expect(Math.sign(b.vx)).toBe(side === "left" ? 1 : -1);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(C.SPEED_CAP);
      expect(b.spin).toBeGreaterThan(80);
      expect(b.spin).toBeLessThanOrEqual(85);
    },
  );
  it("resolves end caps as walls with no speed multiplier", async () => {
    const { engine, pose } = await setup();
    pose(
      (C.P1_X0 + C.P1_X1) / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      400,
    );
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-400);
    expect(engine.state.ball!.spin).toBe(0);
  });
  it.each([0, 1, 2, 3])(
    "resolves obstacle face %i and emits one cue per frame",
    async (face) => {
      const { engine, d, pose } = await setup();
      const o = C.OBSTACLES[0];
      const cx = (o.x0 + o.x1) / 2,
        cy = (o.y0 + o.y1) / 2;
      const positions = [
        [o.x0 - C.BALL_R - 1, cy, 500, 0],
        [o.x1 + C.BALL_R + 1, cy, -500, 0],
        [cx, o.y0 - C.BALL_R - 1, 0, 500],
        [cx, o.y1 + C.BALL_R + 1, 0, -500],
      ];
      const [x, y, vx, vy] = positions[face];
      pose(x, y, vx, vy);
      engine.apply((s) => d.spawnObstacle(s, 0));
      const cues: string[] = [];
      engine.events.on("cue:played", (e) => cues.push(e.cue));
      await engine.advance(1);
      expect(engine.state.ball!.vx).toBeCloseTo(-vx);
      expect(engine.state.ball!.vy).toBeCloseTo(-vy);
      expect(cues).toEqual([C.CUES.obstacleBounce]);
    },
  );
  it("agrees across 2 ms and 16 ms steps over a spinning wall-bank scenario", async () => {
    const results = [];
    for (const step of [2, 16]) {
      const { engine, pose } = await setup(step);
      pose(640, 80, 300, -280, 180);
      await engine.advance(400 / step);
      results.push(engine.debug.snapshot(engine.state).ball!);
    }
    expect(Math.abs(results[0].speed - results[1].speed)).toBeLessThan(10);
    expect(Math.sign(results[0].vx)).toBe(Math.sign(results[1].vx));
    expect(Math.sign(results[0].vy)).toBe(Math.sign(results[1].vy));
  });
});

describe("scoring and automation", () => {
  it.each(["left", "right"] as const)(
    "scores beyond the %s goal and serves toward the receiver",
    async (side) => {
      const { engine, pose } = await setup();
      pose(
        side === "left" ? -C.BALL_R - 1 : C.FIELD_W + C.BALL_R + 1,
        50,
        0,
        0,
      );
      await engine.advance(1);
      expect(engine.state.score).toEqual(
        side === "left" ? { p1: 0, p2: 1 } : { p1: 1, p2: 0 },
      );
      expect(engine.state.receiver).toBe(side);
      expect(engine.state.screen).toBe("countdown");
      expect(engine.state.ball!.trail).toEqual([]);
    },
  );
  it("requires a two-point lead, then ends with the correct winner and supports replay", async () => {
    const { engine, d, pose, tap } = await setup();
    pose(C.FIELD_W + C.BALL_R + 1, 50, 0, 0);
    engine.apply((s) => d.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    pose(C.FIELD_W + C.BALL_R + 1, 50, 0, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    expect(engine.state.score).toEqual({ p1: 12, p2: 10 });
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
  it("handles a right winner and match-over menu/back routes", async () => {
    const { engine, d, pose, tap } = await setup();
    pose(-C.BALL_R - 1, 50, 0, 0);
    engine.apply((s) => d.setScore(s, 0, 10));
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
    await tap("ArrowDown");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    engine.apply((s) => d.setScreen(s, "matchover"));
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
  });
  it("clears entities, rejects missing targets, and reconciles without advancing", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.clearWorld(s));
    engine.apply((s) => d.setScreen(s, "playing"));
    await engine.advance(1);
    expect(d.snapshot(engine.state).ball).toBeNull();
    expect(() => d.setBallSpin(engine.state, 1)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 2)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 0.5)).toThrow();
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
    engine.apply((s) => d.spawnObstacle(s, 1));
    engine.apply((s) => d.spawnObstacle(s, 0));
    engine.apply((s) => d.spawnObstacle(s, 1));
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    engine.apply((s) => d.spawnBall(s));
    engine.apply((s) => d.setBallVelocity(s, 300, 400));
    engine.apply((s) => d.setBallPosition(s, 50, 360));
    const before = engine.state;
    engine.apply((s) => d.reconcile(s));
    expect(engine.state).toEqual(before);
    expect(d.snapshot(engine.state).ball!.speed).toBe(500);
  });
  it("poses every independent field without hidden transitions, then resets", async () => {
    const { engine, d } = await setup();
    const original = engine.state;
    engine.apply((s) => d.setTitleIndex(s, 2));
    engine.apply((s) => d.setMenuIndex(s, 8));
    engine.apply((s) => d.setResumeScreen(s, "countdown"));
    engine.apply((s) => d.setWinner(s, "right"));
    engine.apply((s) => d.setReceiver(s, "right"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setMuted(s, true));
    engine.apply((s) => d.drawBallServeSign(s));
    expect(engine.state).toMatchObject({
      titleIndex: 2,
      menuIndex: 8,
      resumeScreen: "countdown",
      winner: "right",
      receiver: "right",
      muted: true,
    });
    expect(d.menuItemRect(engine.state, -1)).toBeNull();
    expect(original.menuIndex).toBe(0);
    const posed = engine.state;
    engine.apply((s) => d.reset(s));
    expect(engine.state).toMatchObject({
      screen: "title",
      simTime: 0,
      muted: true,
      menuIndex: 0,
      titleIndex: 0,
      winner: null,
    });
    expect(posed.menuIndex).toBe(8);
  });
});
