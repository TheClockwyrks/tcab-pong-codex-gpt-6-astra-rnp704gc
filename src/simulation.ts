import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { BallState, CaromState, PaddleState, StateView } from "./game";
import { readInput } from "./menus";
import { parkBall } from "./state";

export const clamp = (n: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, n));
function integrate(p: PaddleState, velocity: number, dt: number): PaddleState {
  const raw = p.cy + velocity * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : velocity };
}
function movePaddles(
  s: StateView,
  api: UpdateApi,
  dt: number,
): CaromState["paddles"] {
  const held = (a: C.ActionName) => api.input.value(a) > 0;
  const leftUp = held("p1-up") || (s.mode === "solo" && held("p2-up"));
  const leftDown = held("p1-down") || (s.mode === "solo" && held("p2-down"));
  const leftVy = (Number(leftDown) - Number(leftUp)) * C.PADDLE_SPEED;
  let rightVy =
    (Number(held("p2-down")) - Number(held("p2-up"))) * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    const defending =
      s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0;
    const target =
      defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - s.paddles.right.cy;
    const deadzone = defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  return {
    left: integrate(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
      dt,
    ),
    right: integrate(
      s.paddles.right,
      s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
      dt,
    ),
  };
}

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
/** Resolve the specified expanded rectangle; face order also defines ties. */
function rectangle(
  b: MovingBall,
  r: C.Rect,
): { face: number; reflected: boolean } | null {
  const depths = [
    b.x - (r.x0 - C.BALL_R),
    r.x1 + C.BALL_R - b.x,
    b.y - (r.y0 - C.BALL_R),
    r.y1 + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return null;
  const face = depths.indexOf(Math.min(...depths));
  let reflected = false;
  switch (face) {
    case 0:
      b.x = r.x0 - C.BALL_R;
      if (b.vx > 0) {
        b.vx = -b.vx;
        reflected = true;
      }
      break;
    case 1:
      b.x = r.x1 + C.BALL_R;
      if (b.vx < 0) {
        b.vx = -b.vx;
        reflected = true;
      }
      break;
    case 2:
      b.y = r.y0 - C.BALL_R;
      if (b.vy > 0) {
        b.vy = -b.vy;
        reflected = true;
      }
      break;
    case 3:
      b.y = r.y1 + C.BALL_R;
      if (b.vy < 0) {
        b.vy = -b.vy;
        reflected = true;
      }
      break;
  }
  return { face, reflected };
}
function fly(
  ball: BallState,
  s: StateView,
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b = { ...ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx * cos - b.vy * sin;
      b.vy = b.vx * sin + b.vy * cos;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side];
      const contact = rectangle(b, {
        x0: side === "left" ? C.P1_X0 : C.P2_X0,
        x1: side === "left" ? C.P1_X1 : C.P2_X1,
        y0: p.cy - C.PADDLE_HALF,
        y1: p.cy + C.PADDLE_HALF,
      });
      if (!contact) continue;
      if (contact.face < 2) {
        const theta =
          clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
        const nextSpeed = Math.min(
          Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
          C.SPEED_CAP,
        );
        b.vx = (side === "left" ? 1 : -1) * nextSpeed * Math.cos(theta);
        b.vy = nextSpeed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else if (contact.reflected) cues.add(C.CUES.wallBounce);
    }
    for (const o of s.obstacles) {
      const contact = rectangle(b, C.OBSTACLES[o.index]);
      if (contact?.reflected) cues.add(C.CUES.obstacleBounce);
    }
  }
  return b;
}
export function update(
  state: StateView,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s: CaromState = { ...readInput(state, api), simTime: state.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = { ...s, paddles: movePaddles(s, api, dt) };
  if (!s.ball) return s;
  const cues = new Set<C.CueName>();
  let b: BallState = s.ball;
  if (s.screen === "countdown") {
    const timer = b.holdTimer - dt;
    if (timer <= 0) {
      b = {
        ...b,
        held: false,
        holdTimer: 0,
        trail: [],
        vx:
          (s.receiver === "left" ? -1 : 1) *
          C.SERVE_SPEED *
          Math.cos(C.SERVE_ANGLE),
        vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
      };
      s = { ...s, screen: "playing" };
    } else b = { ...b, holdTimer: timer };
  } else if (!b.held) b = fly(b, s, dt, cues);
  b = {
    ...b,
    trail: [
      ...b.trail.filter((t) => s.simTime - t.t <= C.TRAIL_TIME),
      { x: b.x, y: b.y, t: s.simTime },
    ],
  };
  s = { ...s, ball: b };
  if (
    s.screen === "playing" &&
    !b.held &&
    (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
  ) {
    const left = b.x > C.FIELD_W;
    const score = {
      p1: s.score.p1 + Number(left),
      p2: s.score.p2 + Number(!left),
    };
    const won =
      (left ? score.p1 : score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    cues.add(C.CUES.score);
    s = won
      ? {
          ...s,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
        }
      : {
          ...s,
          score,
          receiver: left ? "right" : "left",
          screen: "countdown",
          ball: parkBall(),
        };
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
