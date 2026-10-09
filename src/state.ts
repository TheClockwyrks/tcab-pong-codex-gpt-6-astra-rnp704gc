import * as C from "./constants";
import type {
  BallState,
  CaromDebugApi,
  CaromState,
  PaddleState,
  Side,
  StateView,
} from "./game";
import { menuItemRect } from "./menus";

export const serveSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export const parkBall = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: serveSign(),
  trail: [],
});
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
export function initialState(muted = false): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkBall(),
    obstacles: C.OBSTACLE_CENTERS.map((c, index) => ({
      index,
      cx: c.x,
      cy: c.y,
    })),
    simTime: 0,
    muted,
    menuPresses: {},
  };
}
function ballPatch(s: StateView, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("Carom: no ball is present");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePatch(
  s: StateView,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug(): CaromDebugApi {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parkBall() }),
    spawnObstacle(s, index) {
      const c = C.OBSTACLE_CENTERS[index];
      if (!Number.isInteger(index) || !c)
        throw new Error(`Carom: invalid obstacle ${index}`);
      return {
        ...s,
        obstacles: [
          ...s.obstacles.filter((o) => o.index !== index),
          { index, cx: c.x, cy: c.y },
        ].sort((a, b) => a.index - b.index),
      };
    },
    reset: (s) => initialState(s.muted),
    reconcile: (s) => ({ ...s }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => paddlePatch(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => paddlePatch(s, side, { driven }),
    setBallPosition: (s, x, y) => ballPatch(s, { x, y }),
    setBallVelocity: (s, vx, vy) => ballPatch(s, { vx, vy }),
    setBallSpin: (s, spin) => ballPatch(s, { spin }),
    setBallHeld: (s, held) => ballPatch(s, { held }),
    setBallHoldTimer: (s, holdTimer) => ballPatch(s, { holdTimer }),
    setBallServeSign: (s, sign) => ballPatch(s, { serveSign: sign }),
    drawBallServeSign: (s) => ballPatch(s, { serveSign: serveSign() }),
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => ({ ...s, muted }),
    snapshot: (s) => ({
      screen: s.screen,
      mode: s.mode,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      resumeScreen: s.resumeScreen,
      winner: s.winner,
      receiver: s.receiver,
      simTime: s.simTime,
      muted: s.muted,
      score: { ...s.score },
      paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
      ai: { ...s.ai },
      obstacles: s.obstacles.map((o) => ({ ...o })),
      version: C.CAROM_DEBUG_VERSION,
      ball: s.ball
        ? {
            ...s.ball,
            trail: s.ball.trail.map((t) => ({ ...t })),
            speed: Math.hypot(s.ball.vx, s.ball.vy),
          }
        : null,
    }),
    menuItemRect,
  };
}
