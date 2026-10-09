import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { initialState, createDebug } from "./state";
import { update } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;

  /** Input-derived press origins, cleared when a menu changes screens. */
  readonly menuPresses: Readonly<Record<number, number>>;
}

export type StateView = DeepReadonly<CaromState>;
export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Snapshot = Omit<CaromState, "menuPresses" | "ball"> & {
  version: number;
  ball: (BallState & { speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(s: StateView): CaromState;
  spawnBall(s: StateView): CaromState;
  spawnObstacle(s: StateView, index: number): CaromState;
  reset(s: StateView): CaromState;
  reconcile(s: StateView): CaromState;
  setScreen(s: StateView, screen: Screen): CaromState;
  setMode(s: StateView, mode: Mode): CaromState;
  setMenuIndex(s: StateView, index: number): CaromState;
  setTitleIndex(s: StateView, index: number): CaromState;
  setResumeScreen(s: StateView, screen: "countdown" | "playing"): CaromState;
  setScore(s: StateView, p1: number, p2: number): CaromState;
  setWinner(s: StateView, side: Side | null): CaromState;
  setReceiver(s: StateView, side: Side): CaromState;
  setPaddleCy(s: StateView, side: Side, cy: number): CaromState;
  setPaddleVy(s: StateView, side: Side, vy: number): CaromState;
  setPaddleDriven(s: StateView, side: Side, driven: boolean): CaromState;
  setBallPosition(s: StateView, x: number, y: number): CaromState;
  setBallVelocity(s: StateView, vx: number, vy: number): CaromState;
  setBallSpin(s: StateView, spin: number): CaromState;
  setBallHeld(s: StateView, held: boolean): CaromState;
  setBallHoldTimer(s: StateView, seconds: number): CaromState;
  setBallServeSign(s: StateView, sign: 1 | -1): CaromState;
  drawBallServeSign(s: StateView): CaromState;
  setAiTracking(s: StateView, enabled: boolean): CaromState;
  setAiMovement(s: StateView, enabled: boolean): CaromState;
  setMuted(s: StateView, muted: boolean): CaromState;
  snapshot(s: StateView): Snapshot;
  menuItemRect(s: StateView, index: number): MenuRect | null;
}

export const BACKGROUND = "#0b141b";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 640,
      freqTo: 320,
      durationMs: 65,
      gain: 0.18,
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 280,
      freqTo: 200,
      durationMs: 45,
      gain: 0.12,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "triangle",
      freq: 880,
      freqTo: 520,
      durationMs: 85,
      gain: 0.15,
    });
    api.audio.define(C.CUES.score, {
      freq: 440,
      freqTo: 880,
      durationMs: 220,
      gain: 0.18,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "absent");
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
    return [initialState(), createDebug()];
  },
  update,
  render,
};
