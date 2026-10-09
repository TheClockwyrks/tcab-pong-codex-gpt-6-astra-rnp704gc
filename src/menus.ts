import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, MenuRect, Mode, StateView } from "./game";
import { initialState, parkBall } from "./state";

export function menuItems(s: StateView): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: StateView, index: number): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  return s.screen === "title"
    ? { x: 112, y: 358 + index * 66, w: 384, h: 54 }
    : {
        x: 448,
        y: (s.screen === "howto" ? 586 : 368) + index * 66,
        w: 384,
        h: 54,
      };
}
export function startMatch(s: StateView, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
function title(s: StateView): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function confirm(s: StateView): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : title(s);
    default:
      return s;
  }
}
export function readInput(state: StateView, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  api.audio.setMuted(edges.mute ? !state.muted : state.muted);
  let s: CaromState = { ...state, muted: api.audio.muted() };
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  if (s.screen === "playing" || s.screen === "countdown")
    return edges.pause
      ? {
          ...s,
          resumeScreen: s.screen,
          screen: "paused",
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(s);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  const moving = up || down;
  if (moving)
    s = { ...s, menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count };
  const keyboardConfirm = !moving && edges.confirm;
  const keyboardItem = s.menuIndex;
  const hit = (x: number, y: number) =>
    menuItems(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  const presses = { ...state.menuPresses };
  let pointerConfirm = false;
  for (const p of samples) {
    const i = hit(p.x, p.y);
    if (i >= 0) s = { ...s, menuIndex: i };
    if (p.type === "down" && p.button === "primary") presses[p.id] = i;
    if (p.type === "up") {
      if (i >= 0 && presses[p.id] === i) pointerConfirm = true;
      delete presses[p.id];
    }
  }
  for (const p of contacts) {
    const i = hit(p.x, p.y);
    if (i >= 0) s = { ...s, menuIndex: i };
  }
  if (keyboardConfirm || pointerConfirm)
    return {
      ...confirm({
        ...s,
        menuIndex: keyboardConfirm ? keyboardItem : s.menuIndex,
      }),
      menuPresses: {},
    };
  return { ...s, menuPresses: presses };
}
