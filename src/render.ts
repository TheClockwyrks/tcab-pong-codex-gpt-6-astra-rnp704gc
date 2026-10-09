import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { StateView } from "./game";
import { menuItemRect, menuItems } from "./menus";

const INK = "#eef5e9",
  MUTED = "#82959e",
  MINT = "#a1f4ce",
  CORAL = "#ff857b",
  AMBER = "#eac47b",
  LINE = "#26383f";
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  weight = 400,
  align: CanvasTextAlign = "left",
) {
  ctx.font = `${weight} ${size}px ${size < 18 ? '"Courier New", monospace' : "Arial, sans-serif"}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color = LINE,
  width = 1,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  glow = 0,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 8));
  ctx.fill();
  ctx.restore();
}
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = INK,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
function grid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#1c2b32";
  for (let x = 32; x < C.FIELD_W; x += 32)
    for (let y = 32; y < C.FIELD_H; y += 32) ctx.fillRect(x, y, 1, 1);
}
function chrome(ctx: CanvasRenderingContext2D, s: StateView) {
  text(ctx, "C /", 40, 34, 20, MINT, 700);
  text(ctx, "CAROM  /  PADDLE DUEL", 84, 34, 12, MUTED);
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 40,
    34,
    12,
    MUTED,
    400,
    "right",
  );
  line(ctx, 40, 58, C.FIELD_W - 40, 58);
  line(ctx, 40, 662, C.FIELD_W - 40, 662);
  text(ctx, "MOVE WITH INTENT.", 40, 689, 12, MUTED);
  text(
    ctx,
    "SPIN  /  BANK  /  SCORE",
    C.FIELD_W - 40,
    689,
    12,
    MUTED,
    400,
    "right",
  );
}
function menus(ctx: CanvasRenderingContext2D, s: StateView) {
  menuItems(s).forEach((item, i) => {
    const r = menuItemRect(s, i)!;
    const selected = s.menuIndex === i;
    ctx.fillStyle = selected ? MINT : "#111f27";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? MINT : LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      selected ? "#345a4d" : MUTED,
    );
    text(
      ctx,
      item,
      r.x + 58,
      r.y + r.h / 2,
      18,
      selected ? "#10271f" : INK,
      700,
    );
    if (selected)
      text(
        ctx,
        "↗",
        r.x + r.w - 28,
        r.y + r.h / 2,
        24,
        "#10271f",
        400,
        "center",
      );
  });
}
function titleArt(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const x = 610,
    y = 133,
    w = 558,
    h = 442;
  ctx.fillStyle = "#0e1b23";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = LINE;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.setLineDash([4, 10]);
  line(ctx, 889, y + 20, 889, y + h - 20, LINE);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#31463f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(889, 354, 106, 0, Math.PI * 2);
  ctx.stroke();
  bar(ctx, 636, 322, 12, 87, MINT, 16);
  bar(ctx, 1130, 211, 12, 87, CORAL, 16);
  bar(ctx, 803, 206, 14, 102, AMBER, 10);
  bar(ctx, 965, 400, 14, 102, AMBER, 10);
  // The printed trajectory introduces the game's curved bank shots.
  ctx.beginPath();
  ctx.moveTo(655, 356);
  ctx.bezierCurveTo(745, 341, 767, 382, 825, 405);
  ctx.bezierCurveTo(878, 426, 912, 386, 947, 332);
  ctx.bezierCurveTo(985, 270, 1035, 251, 1082, 264);
  ctx.strokeStyle = "#345a51";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(949, 331);
  ctx.bezierCurveTo(985, 270, 1035, 251, 1082, 264);
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.shadowColor = INK;
  ctx.shadowBlur = 20;
  dot(ctx, 1082, 264, C.BALL_R);
  ctx.shadowBlur = 0;
  text(ctx, "01", 660, 430, 11, MINT);
  text(ctx, "02", 1104, 322, 11, CORAL);
  text(ctx, "A", 810, 184, 11, AMBER, 400, "center");
  text(ctx, "B", 972, 524, 11, AMBER, 400, "center");
  text(
    ctx,
    "A LITTLE SPIN. A DIFFERENT GAME.",
    889,
    611,
    12,
    MUTED,
    400,
    "center",
  );
  ctx.restore();
}
function field(ctx: CanvasRenderingContext2D, s: StateView) {
  ctx.setLineDash([7, 13]);
  line(ctx, C.NET_X, 0, C.NET_X, C.FIELD_H, "#2a3a42");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#203039";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 78, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 0, 1, C.FIELD_W, 1, "#47616a", 2);
  line(ctx, 0, C.FIELD_H - 1, C.FIELD_W, C.FIELD_H - 1, "#47616a", 2);
  for (const o of s.obstacles) {
    bar(
      ctx,
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      AMBER,
      12,
    );
    text(
      ctx,
      o.index === 0 ? "A" : "B",
      o.cx,
      o.cy - C.OBSTACLE_HH - 20,
      11,
      AMBER,
      400,
      "center",
    );
  }
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    MINT,
    18,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CORAL,
    18,
  );
  if (s.ball) {
    const b = s.ball;
    b.trail.forEach((t, i) => {
      const next = b.trail[i + 1];
      if (!next) return;
      const alpha = Math.max(0, 1 - (s.simTime - t.t) / C.TRAIL_TIME);
      ctx.globalAlpha = alpha * 0.65;
      line(ctx, t.x, t.y, next.x, next.y, INK, 3 + alpha * 10);
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = INK;
    dot(ctx, b.x, b.y, C.BALL_R);
    ctx.restore();
  }
  text(ctx, "PLAYER 01", C.FIELD_CX - 126, 34, 11, MINT, 400, "center");
  text(
    ctx,
    s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
    C.FIELD_CX + 126,
    34,
    11,
    CORAL,
    400,
    "center",
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 126,
    87,
    68,
    MINT,
    700,
    "center",
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 126,
    87,
    68,
    CORAL,
    700,
    "center",
  );
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL",
    30,
    30,
    12,
    MUTED,
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    147,
    11,
    MUTED,
    400,
    "center",
  );
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 30,
    30,
    11,
    MUTED,
    400,
    "right",
  );
  text(
    ctx,
    s.mode === "solo" ? "W / S  OR  ↑ / ↓" : "W / S",
    30,
    C.FIELD_H - 24,
    12,
    MINT,
  );
  text(
    ctx,
    "P / ESC  PAUSE",
    C.FIELD_CX,
    C.FIELD_H - 24,
    11,
    MUTED,
    400,
    "center",
  );
  text(
    ctx,
    s.mode === "solo" ? "AI OPPONENT" : "↑ / ↓",
    C.FIELD_W - 30,
    C.FIELD_H - 24,
    12,
    CORAL,
    400,
    "right",
  );
  if (s.screen === "countdown") {
    text(
      ctx,
      "READY TO SERVE",
      C.FIELD_CX,
      C.FIELD_CY + 64,
      14,
      MINT,
      700,
      "center",
    );
    const progress = s.ball ? 1 - s.ball.holdTimer / C.HOLD_TIME : 0;
    bar(ctx, C.FIELD_CX - 56, C.FIELD_CY + 88, 112, 3, LINE);
    bar(
      ctx,
      C.FIELD_CX - 56,
      C.FIELD_CY + 88,
      Math.max(1, 112 * progress),
      3,
      MINT,
    );
  }
}
export function render(s: StateView, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  grid(ctx);
  if (s.screen === "title") {
    chrome(ctx, s);
    text(ctx, "THE ANGLE IS EVERYTHING", 112, 152, 13, MINT);
    text(ctx, C.TITLE_TEXT, 102, 239, 112, INK, 900);
    text(ctx, "A paddle duel with a twist.", 112, 311, 22, MUTED);
    titleArt(ctx);
    menus(ctx, s);
    text(ctx, "↑ ↓  SELECT     ENTER  PLAY", 112, 595, 12, MUTED);
  } else if (s.screen === "howto") {
    chrome(ctx, s);
    text(ctx, "MAKE YOUR MOVE.", C.FIELD_CX, 133, 48, INK, 800, "center");
    text(
      ctx,
      `First to ${C.WIN_SCORE}. Lead by ${C.WIN_LEAD}. Every angle counts.`,
      C.FIELD_CX,
      188,
      18,
      MUTED,
      400,
      "center",
    );
    const cards = [
      {
        x: 100,
        n: "01 / MOVE",
        title: "Hold your line",
        body: [
          "SOLO   W / S or ↑ / ↓",
          "VERSUS   P1 W / S · P2 ↑ / ↓",
          "Touch: use the side sliders.",
        ],
        color: MINT,
      },
      {
        x: 476,
        n: "02 / SPIN",
        title: "Strike in motion",
        body: [
          "Move your paddle as you hit.",
          "Up bends the flight one way;",
          "down bends it the other.",
        ],
        color: INK,
      },
      {
        x: 852,
        n: "03 / BANK",
        title: "Find the angle",
        body: [
          "Use the amber obstacles.",
          "Bank off walls. Slip a shot",
          "past the opposing paddle.",
        ],
        color: AMBER,
      },
    ];
    for (const card of cards) {
      line(ctx, card.x, 245, card.x + 328, 245, card.color, 2);
      text(ctx, card.n, card.x, 278, 12, card.color);
      text(ctx, card.title, card.x, 326, 27, INK, 700);
      card.body.forEach((t, i) =>
        text(ctx, t, card.x, 382 + i * 29, 15, MUTED),
      );
    }
    text(
      ctx,
      "P / ESC  PAUSE & RESUME     M  TOGGLE SOUND",
      C.FIELD_CX,
      520,
      13,
      MUTED,
      400,
      "center",
    );
    menus(ctx, s);
  } else {
    field(ctx, s);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#081218d9";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      ctx.fillStyle = "#101f27";
      ctx.fillRect(400, 164, 480, s.screen === "paused" ? 434 : 370);
      line(ctx, 400, 164, 880, 164, MINT, 2);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        211,
        12,
        MINT,
        400,
        "center",
      );
      const winner =
        s.winner === "left"
          ? "PLAYER 01 WINS"
          : s.mode === "solo"
            ? "COMPUTER WINS"
            : "PLAYER 02 WINS";
      text(
        ctx,
        s.screen === "paused" ? "PAUSED" : winner,
        C.FIELD_CX,
        270,
        s.screen === "paused" ? 56 : 34,
        INK,
        800,
        "center",
      );
      text(
        ctx,
        `${s.score.p1}  —  ${s.score.p2}`,
        C.FIELD_CX,
        322,
        26,
        MUTED,
        400,
        "center",
      );
      menus(ctx, s);
    }
  }
  ctx.restore();
}
