import * as THREE from "three";
import "./style.css";
import { build, createBall, createEffects } from "./world.js";
import { createPadelAvatar } from "./avatars.js";
import {
  createMatch,
  getShotPreview,
  getShotTrajectory,
  predictCourtLanding,
} from "./simulation.js";
import { createFrameLoop } from "./lib/frame-loop.js";
import { createFrameStats } from "./lib/frame-stats.js";
import { createAudio } from "./audio.js";
import { readPadelInput } from "./input.js";
import { createCourtRenderer } from "./rendering.js";
import { createPadelCamera } from "./camera.js";
import { createPadelVisit } from "./visit.js";
import { createPadelPeers } from "./visit-peers.js";
import { createPadelTravel } from "./travel.js";
import { createPadelTravelWorld } from "./travel-world.js";

const $ = (id) => document.getElementById(id);
const canvas = $("court");
const embedded = window.parent !== window;
const origin = window.location.origin;
const post = (type, data = {}) => {
  if (embedded)
    window.parent.postMessage({ type: `padel:${type}`, ...data }, origin);
};
const on = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
  cleanups.push(() => target.removeEventListener(type, callback, options));
};
const cleanups = [];
const show = (id, value) => {
  if ($(id).hidden === value) $(id).hidden = !value;
};
const text = (id, value) => {
  if ($(id).textContent !== String(value)) $(id).textContent = String(value);
};
const keys = new Set();
const pulse = { hit: false, lob: false, powerReleased: false, jump: false };
const aim = { aimX: 0, aimZ: -0.25 };
const match = createMatch({ difficulty: "practice", seed: 3107 });
const sound = createAudio();
const projected = new THREE.Vector3();
const cameraViews = [
  { id: "broadcast", label: "Broadcast" },
  { id: "courtside", label: "Low third person" },
  { id: "first-person", label: "First person" },
];
let cameraMode = "broadcast",
  cameraNeedsSnap = true;
try {
  const savedView = localStorage.getItem("padel:camera");
  if (cameraViews.some((view) => view.id === savedView)) cameraMode = savedView;
} catch {}
let renderer,
  scene,
  camera,
  cameraRig,
  court,
  ballView,
  effects,
  frameLoop,
  stats,
  rendering;
let clubVisit, clubPeers;
const looseBallViews = [];
let travel,
  travelWorld,
  travelRequest = null,
  arrivedWithTravel = false;
let visitInput = true,
  visitEmote = null,
  visitEmoteTime = 0,
  avatarVersion = 0;
let graphicsMode = "high";
try {
  if (localStorage.getItem("padel:graphics") === "balanced")
    graphicsMode = "balanced";
} catch {}
let avatars = [],
  ready = false,
  entered = !embedded,
  disposed = false;
let playing = false,
  paused = false,
  tapPower = false,
  difficulty = "practice";
let clock = 0,
  finishSettledAt = null,
  announceUntil = 0,
  feedbackUntil = 0,
  statusTime = 0,
  seed = 3107;
let identity, resolveIdentity;
const identityPromise = new Promise((resolve) => {
  resolveIdentity = resolve;
});

function livePlay() {
  return playing && (match.phase === "serve" || match.phase === "rally");
}
function clearInput() {
  keys.clear();
  tapPower = false;
  pulse.hit = pulse.lob = pulse.powerReleased = false;
  pulse.jump = false;
  match.cancelInput?.();
}
function visitDialogOpen() {
  return !$("setup").hidden || !$("visit-settings").hidden;
}
function syncVisitInput() {
  clubVisit?.setEnabled(
    entered &&
      visitInput &&
      !playing &&
      !visitDialogOpen() &&
      !travel?.state.locked
  );
}
function openVisitDialog(id) {
  if (!ready || !entered || playing || travel?.state.locked) return;
  clearInput();
  show("setup", id === "setup");
  show("visit-settings", id === "visit-settings");
  syncVisitInput();
  post("setup", { open: true });
  $(id).querySelector("button")?.focus();
}
function closeVisitDialog() {
  show("setup", false);
  show("visit-settings", false);
  clearInput();
  syncVisitInput();
  post("setup", { open: false });
  canvas.focus();
}
function openVisit({ preserveArrival = false } = {}) {
  if (!ready || !entered || disposed) return;
  playing = paused = false;
  finishSettledAt = null;
  clearInput();
  match.reset({ difficulty, seed });
  document.body.classList.add("is-visiting");
  for (const id of [
    "setup",
    "visit-settings",
    "results",
    "pause-screen",
    "score",
    "hud",
    "pause",
    "camera-view",
    "player-label",
    "feedback",
    "announcement",
  ])
    show(id, false);
  show("visit-hud", true);
  announceUntil = feedbackUntil = 0;
  visitEmote = null;
  visitEmoteTime = 0;
  if (!preserveArrival) {
    travel?.cancel();
    travelWorld?.finish();
    clubVisit.reset();
  }
  clubVisit.setActive(true);
  syncVisitInput();
  avatars.forEach((avatar, index) => {
    avatar.setFirstPerson(false);
    avatar.root.visible = index === 0;
    if (index === 0 && !preserveArrival) avatar.reset(clubVisit.state);
  });
  post("setup", { open: false });
  post("mode", { mode: "visit" });
  canvas.setAttribute(
    "aria-label",
    "Padel club. Click the ground or use WASD to walk. Drag to look around. Shift to run, Space to jump, Enter to chat. Choose Play padel when ready."
  );
  statusTime = 1;
  frameLoop?.setRunning(true);
  canvas.focus();
}
function announce(title, detail, label = "GLASSHOUSE", seconds = 2) {
  text("announcement-label", label);
  text("announcement-title", title);
  text("announcement-detail", detail);
  announceUntil = clock + seconds;
  show("announcement", true);
}
function fatal(error) {
  console.error("[Padel]", error);
  show("loading", false);
  show("fatal", true);
  text(
    "fatal-message",
    "The court could not finish loading. Try again or return to the lobby."
  );
  post("error");
}
function leave() {
  if (embedded) post("exit");
  else location.href = "/?lobby=1";
}
function setPaused(value) {
  if (!playing || match.phase === "finished") return;
  paused = value;
  clearInput();
  show("pause-screen", value);
  frameLoop?.setRunning(!value);
  stats?.reset();
  canvas.dataset.renderState = document.hidden
    ? "hidden"
    : value
    ? "paused"
    : "active";
  canvas.dataset.phase = value ? "paused" : match.phase;
  if (value) {
    sound.suspend?.();
    $("resume").focus();
  } else {
    sound.unlock();
    canvas.focus();
  }
}
function startMatch() {
  if (!ready || !entered || travel?.state.locked) return;
  match.reset({ difficulty, seed: seed++ });
  match.start();
  clearInput();
  Object.assign(aim, { aimX: 0, aimZ: -0.25 });
  playing = true;
  paused = false;
  finishSettledAt = null;
  clubVisit?.setActive(false);
  visitEmote = null;
  document.body.classList.remove("is-visiting");
  show("visit-hud", false);
  show("visit-settings", false);
  post("setup", { open: false });
  cameraNeedsSnap = true;
  avatars.forEach((avatar, index) => {
    avatar.root.visible = true;
    avatar.reset(match.players[index]);
  });
  show("setup", false);
  show("results", false);
  show("pause-screen", false);
  show("score", true);
  show("hud", true);
  show("pause", true);
  show("camera-view", true);
  show("player-label", true);
  show("feedback", false);
  feedbackUntil = 0;
  announce(
    "YOUR SERVE",
    "Bounce, then serve underhand. J to place it. K lifts a lob.",
    "COURT 01",
    2.8
  );
  frameLoop.setRunning(true);
  canvas.focus();
  sound.unlock();
  post("mode", { mode: "match" });
  canvas.setAttribute(
    "aria-label",
    "Padel court. WASD moves, including while charging. J for a control return, or hold Enter, aim with the arrow keys and release for power. The flight path previews your shot. V changes camera view."
  );
}
function receiveIdentity(data) {
  if (identity) return;
  identity = {
    name: typeof data.name === "string" ? data.name.slice(0, 64) : "You",
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
    pfp: typeof data.pfp === "string" ? data.pfp : null,
  };
  resolveIdentity(identity);
}
function cancelTravel(requestId) {
  if (requestId && travelRequest?.requestId !== requestId) return;
  travelRequest = null;
  travel?.cancel();
  travelWorld?.finish();
  document.body.classList.remove("is-travelling");
  syncVisitInput();
}
function receiveTravel(data) {
  if (!ready || disposed || typeof data.requestId !== "string") return;
  const phase = data.phase;
  if (!["enter", "stage", "reveal", "depart"].includes(phase)) return;
  if (travelRequest) {
    post("travel-result", {
      ...travelRequest,
      ok: false,
      error: "Travel replaced",
    });
    cancelTravel();
  }
  try {
    const departingFirstPerson = playing && cameraMode === "first-person";
    clearInput();
    visitEmote = null;
    if (phase === "depart" && playing) clubVisit.place(match.players[0]);
    playing = paused = false;
    document.body.classList.add("is-travelling");
    clubVisit.setActive(true);
    avatars.forEach((avatar, index) => {
      avatar.setFirstPerson(false);
      avatar.root.visible = index === 0;
    });
    if (phase === "enter" || phase === "stage") {
      arrivedWithTravel = true;
      travel.prepare({
        ...data.options,
        avatarHeight: avatars[0].height,
        travelYawOffset: avatars[0].travelYawOffset,
      });
      travelWorld.prepare(travel.state);
    } else if (phase === "reveal") {
      travel.startReveal();
    } else {
      travel.startDepart({
        reducedMotion: !!data.options?.reducedMotion,
        travelYawOffset: avatars[0].travelYawOffset,
        avatarHeight: avatars[0].height,
        cameraMode: departingFirstPerson ? "first-person" : "third-person",
      });
      travelWorld.prepare(travel.state, true);
    }
    travelRequest = { requestId: data.requestId, phase };
    frameLoop.setRunning(true);
    frameLoop.invalidate();
    syncVisitInput();
  } catch (error) {
    cancelTravel();
    post("travel-result", {
      requestId: data.requestId,
      phase,
      ok: false,
      error: error instanceof Error ? error.message : "Travel unavailable",
    });
  }
}
// Native admission must acknowledge a rendered held frame, never just a state
// change. Reveal/departure additionally wait for their complete animation.
function acknowledgeTravelFrame() {
  if (!travelRequest) return;
  const { phase } = travelRequest;
  if ((phase === "reveal" || phase === "depart") && !travel.state.done) return;
  const request = travelRequest;
  travelRequest = null;
  const travelView =
    phase === "depart"
      ? travel.capture({ avatarHeight: avatars[0].height })
      : undefined;
  if (phase === "reveal") {
    travelWorld.finish();
    document.body.classList.remove("is-travelling");
  }
  post("travel-result", {
    ...request,
    ok: true,
    ...(travelView ? { travelView } : {}),
  });
}
on(window, "message", (event) => {
  if (event.source !== window.parent || event.origin !== origin) return;
  if (event.data?.type === "padel:identity") receiveIdentity(event.data);
  if (event.data?.type === "padel:entered") {
    entered = true;
    if (ready) openVisit({ preserveArrival: arrivedWithTravel });
  }
  if (event.data?.type === "padel:dispose") dispose();
  if (disposed) return;
  const data = event.data;
  if (data?.type === "padel:travel") receiveTravel(data);
  else if (data?.type === "padel:travel-cancel") cancelTravel(data.requestId);
  else if (data?.type === "padel:exit" && entered && !travel?.state.locked)
    leave();
  else if (data?.type === "padel:social-ready")
    document.body.classList.toggle("has-social", data.enabled === true);
  else if (data?.type === "padel:peers") clubPeers?.receive(data.players);
  else if (data?.type === "padel:input") {
    visitInput = data.enabled !== false;
    clearInput();
    syncVisitInput();
    if (visitInput && !playing && !visitDialogOpen()) canvas.focus();
  } else if (data?.type === "padel:play") openVisitDialog("setup");
  else if (data?.type === "padel:settings") openVisitDialog("visit-settings");
  else if (data?.type === "padel:visit") openVisit();
  else if (data?.type === "padel:emote" && !playing && ready) {
    travel?.releaseReadyIdle();
    visitEmote =
      data.index === -1
        ? null
        : typeof data.name === "string"
        ? data.name
        : null;
    visitEmoteTime = 0;
    canvas.focus();
  } else if (
    data?.type === "padel:avatar" &&
    typeof data.avatarUrl === "string"
  )
    void changeAvatar(data);
});
let attempts = 0;
const greeting = setInterval(() => {
  if (identity || disposed || ++attempts > 40) {
    clearInterval(greeting);
    return;
  }
  post("hello");
}, 250);
cleanups.push(() => clearInterval(greeting));
post("hello");
if (!embedded)
  receiveIdentity({
    name: "You",
  });
const identityTimeout = setTimeout(
  () => receiveIdentity({ name: "You" }),
  10000
);
cleanups.push(() => clearTimeout(identityTimeout));
for (const id of ["exit", "pause-exit", "result-exit", "fatal-exit"])
  on($(id), "click", leave);
for (const id of ["play", "restart", "rematch"]) on($(id), "click", startMatch);
for (const id of ["pause-club", "result-club"]) on($(id), "click", openVisit);
on($("visit-play"), "click", () => openVisitDialog("setup"));
on($("visit-options"), "click", () => openVisitDialog("visit-settings"));
for (const id of ["setup-close", "settings-close"])
  on($(id), "click", closeVisitDialog);
on($("pause"), "click", () => setPaused(true));
on($("resume"), "click", () => setPaused(false));
on($("reload"), "click", () => location.reload());
on($("sound"), "click", () => {
  const enabled = sound.toggle();
  text("sound", enabled ? "Sound on" : "Sound off");
  $("sound").setAttribute(
    "aria-label",
    enabled ? "Mute game sound" : "Enable game sound"
  );
  $("sound").setAttribute("aria-pressed", String(enabled));
  text("visit-sound", enabled ? "Game sound · On" : "Game sound · Off");
  $("visit-sound").setAttribute("aria-pressed", String(enabled));
});
on($("visit-sound"), "click", () => $("sound").click());
on($("visit-graphics"), "click", () => $("graphics").click());
function updateGraphics() {
  const high = graphicsMode === "high";
  text("graphics-value", high ? "High" : "Balanced");
  text("visit-graphics", `Graphics · ${high ? "High" : "Balanced"}`);
  $("graphics").setAttribute(
    "aria-label",
    `Graphics quality: ${high ? "High" : "Balanced"}. Switch to ${
      high ? "Balanced" : "High"
    }`
  );
  if (!rendering) return;
  const profile = rendering.resize(
    innerWidth,
    innerHeight,
    graphicsMode,
    devicePixelRatio || 1
  );
  court?.setQuality({
    shadowMapSize: profile.shadowMapSize,
    anisotropy: Math.min(
      profile.anisotropy,
      renderer.capabilities.getMaxAnisotropy()
    ),
  });
  stats?.reset();
  frameLoop?.invalidate();
}
on($("graphics"), "click", () => {
  graphicsMode = graphicsMode === "high" ? "balanced" : "high";
  try {
    localStorage.setItem("padel:graphics", graphicsMode);
  } catch {}
  updateGraphics();
  if (playing && !paused) canvas.focus();
});
updateGraphics();
function updateCameraControl() {
  const index = cameraViews.findIndex((view) => view.id === cameraMode);
  const current = cameraViews[index];
  const next = cameraViews[(index + 1) % cameraViews.length];
  text("camera-value", current.label);
  const description = `Camera: ${current.label}. Switch to ${next.label}. Press V to change view.`;
  $("camera-view").setAttribute("aria-label", description);
  $("camera-view").title = description;
  canvas.dataset.cameraMode = cameraMode;
}
function cycleCamera() {
  const index = cameraViews.findIndex((view) => view.id === cameraMode);
  cameraMode = cameraViews[(index + 1) % cameraViews.length].id;
  try {
    localStorage.setItem("padel:camera", cameraMode);
  } catch {}
  cameraNeedsSnap = paused || match.phase === "finished";
  statusTime = 1;
  updateCameraControl();
  frameLoop?.invalidate();
  if (playing && !paused && match.phase !== "finished") canvas.focus();
}
on($("camera-view"), "click", cycleCamera);
updateCameraControl();
document.querySelectorAll("[data-difficulty]").forEach((button) =>
  on(button, "click", () => {
    difficulty =
      button.dataset.difficulty === "club" ? "competitive" : "practice";
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button))
      );
  })
);
on($("power-toggle"), "click", () => {
  if (!livePlay() || paused || match.players[0].swingPending) return;
  tapPower = !tapPower;
  if (!tapPower) pulse.powerReleased = true;
  sound.unlock();
  canvas.focus();
});
const gameKeys = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyJ",
  "KeyK",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "NumpadEnter",
  "Space",
  "ShiftLeft",
  "ShiftRight",
];
on(window, "keydown", (event) => {
  if (travel?.state.locked) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest("input,select,textarea,[contenteditable=true]")
  )
    return;
  if (event.code === "Escape") {
    event.preventDefault();
    if (!playing) closeVisitDialog();
    else setPaused(!paused);
    return;
  }
  if (!playing) {
    if (!ready || !entered || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if (visitDialogOpen()) {
      if (event.code === "Tab") {
        const dialog = $("setup").hidden ? $("visit-settings") : $("setup");
        const buttons = [...dialog.querySelectorAll("button:not([disabled])")];
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (
      !visitInput ||
      (event.target instanceof HTMLElement && event.target.closest("button"))
    )
      return;
    if (event.code === "Enter") {
      event.preventDefault();
      if (!event.repeat && embedded) post("chat");
      return;
    }
    if (/^Digit[1-9]$/.test(event.code) && !event.repeat && embedded) {
      event.preventDefault();
      post("shortcut", { slot: Number(event.code.slice(-1)) - 1 });
      return;
    }
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "ShiftLeft",
        "ShiftRight",
      ].includes(event.code)
    ) {
      event.preventDefault();
      keys.add(event.code);
      if (event.code === "Space" && !event.repeat) pulse.jump = true;
    }
    return;
  }
  if (
    event.code === "KeyV" &&
    playing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !(
      event.target instanceof HTMLElement &&
      event.target.closest("input,select,textarea")
    )
  ) {
    event.preventDefault();
    if (!event.repeat) cycleCamera();
    return;
  }
  if (
    event.target instanceof HTMLElement &&
    event.target.closest("button,input,select,textarea")
  )
    return;
  if (!livePlay() || paused || event.ctrlKey || event.metaKey || event.altKey)
    return;
  if (!gameKeys.includes(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  if (
    match.players[0].swingPending &&
    ["KeyJ", "KeyK", "Space", "Enter", "NumpadEnter"].includes(event.code)
  )
    return;
  keys.add(event.code);
  if (event.code === "KeyJ" || event.code === "Space") pulse.hit = true;
  if (event.code === "KeyK") pulse.lob = true;
  sound.unlock();
});
on(window, "keyup", (event) => {
  const wasHeld = keys.delete(event.code);
  if (
    wasHeld &&
    ["Enter", "NumpadEnter"].includes(event.code) &&
    livePlay() &&
    !paused &&
    !match.players[0].swingPending
  )
    pulse.powerReleased = true;
});
on(window, "blur", () => {
  clearInput();
  if (playing) setPaused(true);
});
on(document, "visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    if (playing) setPaused(true);
    sound.suspend?.();
  }
  frameLoop?.setVisible(!document.hidden);
  stats?.reset();
  canvas.dataset.renderState = document.hidden
    ? "hidden"
    : paused
    ? "paused"
    : "active";
});
on(canvas, "pointerdown", (event) => {
  canvas.focus();
  sound.unlock();
  if (
    livePlay() &&
    !paused &&
    !match.players[0].swingPending &&
    event.button === 0
  ) {
    pulse.hit = true;
    sound.unlock();
  }
});
on(canvas, "contextmenu", (event) => event.preventDefault());

function getInput(dt) {
  const controls = readPadelInput(keys, aim, dt, {
    powerHeld: tapPower,
    ...pulse,
    committed: !!match.players[0].swingPending || (playing && !livePlay()),
  });
  aim.aimX = controls.aimX;
  aim.aimZ = controls.aimZ;
  return controls;
}
function handleEvents() {
  for (const event of match.consumeEvents()) {
    if (event.dead && (event.opacity ?? 1) <= 0) continue;
    if (event.type === "shot") {
      announceUntil = 0;
      show("announcement", false);
      effects.contact(event);
      if (event.stroke === "serve") sound.serve();
      else if (event.shotType === "smash") sound.smash(event.power);
      else sound.hit(event.power || 0.5);
      if (event.playerIndex === 0) {
        tapPower = false;
        keys.delete("Enter");
        keys.delete("NumpadEnter");
        const label =
          event.qualityLabel ||
          (typeof event.quality === "string"
            ? event.quality
            : event.quality > 0.85
            ? "Perfect"
            : "Good");
        const contactLabel =
          event.contactKind === "stretch"
            ? "Stretch return"
            : event.contactKind === "reach"
            ? "Reach return"
            : "Clean contact";
        text(
          "feedback-quality",
          event.shotType === "smash"
            ? `${label.toUpperCase()} SMASH`
            : event.powered
            ? `${label.toUpperCase()} POWER`
            : event.shotType === "lob"
            ? "LIFT OVER THE NET"
            : contactLabel.toUpperCase()
        );
        text(
          "feedback-detail",
          `${Math.round((event.speed || 15) * 3.6)} km/h · ${
            event.contactKind && event.contactKind !== "normal"
              ? contactLabel.toLowerCase()
              : event.stroke || "shot"
          }`
        );
        $("feedback").dataset.quality = label.toLowerCase();
        feedbackUntil = clock + 1.4;
        show("feedback", true);
      }
    } else if (event.type === "miss") {
      tapPower = false;
      keys.delete("Enter");
      keys.delete("NumpadEnter");
      text("feedback-quality", "JUST OUT OF REACH");
      text("feedback-detail", "Move closer before setting up your shot");
      $("feedback").dataset.quality = "early";
      feedbackUntil = clock + 1.4;
      show("feedback", true);
    } else if (event.type === "wall") {
      sound.wall(
        event.surface,
        Math.min(1, (event.impactSpeed ?? event.speed ?? 10) / 24) *
          (event.dead ? event.opacity ?? 1 : 1)
      );
      court.wallImpact(event);
    } else if (event.type === "net") sound.net();
    else if (event.type === "serve-let") {
      clearInput();
      announce("LET · SERVE AGAIN", "Net cord. Same serve.", "SERVICE", 1.2);
    } else if (event.type === "bounce") {
      sound.bounce(
        event.dead
          ? Math.min(0.65, (event.impactSpeed || 0) / 10) * (event.opacity ?? 1)
          : 0.5
      );
    } else if (event.type === "serve-fault") {
      clearInput();
      announce(
        event.attempt === 1 ? "SECOND SERVE" : "DOUBLE FAULT",
        event.reason || "Aim inside the diagonal service box.",
        "SERVICE",
        1.5
      );
      sound.fault();
    } else if (event.type === "point") {
      clearInput();
      show("feedback", false);
      feedbackUntil = 0;
      announce(
        event.outOfCourt && event.winner === 0
          ? "OUT OF THE PARK"
          : event.winner === 0 || event.playerIndex === 0
          ? "YOUR POINT"
          : "THEIR POINT",
        event.reason || "",
        "GLASSHOUSE",
        1.7
      );
      sound.point(event.winner === 0);
    } else if (event.type === "match-end") {
      clearInput();
      show("hud", false);
      show("pause", false);
    } else if (event.type === "serve-ready") clearInput();
  }
}
function showSettledResults() {
  if (
    !playing ||
    match.phase !== "finished" ||
    !match.settled ||
    !$("results").hidden
  )
    return;
  // Let the last returning avatar finish turning back toward the net before
  // putting the renderer to sleep behind results.
  if (finishSettledAt === null) finishSettledAt = clock;
  if (clock - finishSettledAt < 0.85) return;
  text(
    "result-title",
    match.winner === 0 ? "YOU OWN THIS COURT." : "ONE MORE MATCH?"
  );
  text("result-score", match.score.join(" — "));
  text(
    "result-detail",
    match.winner === 0
      ? "Clean placement. Good timing. Well played."
      : "Use J to stay in the rally. Charge Enter when you have time to plant your feet."
  );
  show("results", true);
  show("player-label", false);
  $("rematch").focus();
  frameLoop?.setRunning(false);
}

function updateLooseBalls(dt) {
  const balls = playing ? match.looseBalls || [] : [];
  while (looseBallViews.length < Math.min(3, balls.length))
    looseBallViews.push({ view: createBall(scene), source: null });
  looseBallViews.forEach((slot, index) => {
    const ball = balls[index] || null;
    if (slot.source !== ball) {
      slot.view.update(null, 0);
      slot.source = ball;
    }
    slot.view.update(ball, dt);
  });
}
function updateHud(preview) {
  const committed = !!preview.committed;
  const smash = match.phase === "rally" && !!preview.smashOpportunity;
  text("human-score", match.score[0]);
  text("npc-score", match.score[1]);
  $("human-server").classList.toggle("serving", match.server % 2 === 0);
  $("npc-server").classList.toggle("serving", match.server % 2 === 1);
  text(
    "rally-count",
    match.phase === "rally" ? `${match.rallyHits} SHOTS` : "FIRST TO 7"
  );
  text(
    "tip",
    committed
      ? preview.stroke === "smash"
        ? "Smash ready · your player will meet the high ball"
        : "Shot ready · your player will meet the ball"
      : smash
      ? "High ball · hold Enter, aim, release in blue to smash"
      : preview.charging
      ? "Keep moving · arrow keys aim along the flight path"
      : match.players[0].assistActive
      ? "Adjusting into position · WASD to take over"
      : preview.reachable && match.phase === "rally"
      ? "Ball in reach · tap J, or hold Enter for power"
      : match.message || "Move into position. Aim before you swing."
  );
  const charge = Math.max(0, preview.charge || 0),
    charging = !!preview.charging;
  text("movement-hint", committed ? "Shot locked" : "Move");
  const percent = Math.min(100, (charge / 1.4) * 100);
  $("charge-fill").style.width = `${percent}%`;
  $("charge-needle").style.left = `${percent}%`;
  text("power-value", `${Math.round((preview.power || 0) * 100)}%`);
  text(
    "shot-status",
    committed
      ? preview.stroke === "smash"
        ? "SMASH READY"
        : "SHOT READY"
      : charging
      ? charge > 0.98
        ? "OVERCHARGED"
        : preview.qualityLabel === "Perfect"
        ? smash
          ? "RELEASE · POWER SMASH"
          : "RELEASE · SWEET SPOT"
        : "BUILDING POWER"
      : smash
      ? "SMASH OPPORTUNITY"
      : "POWER SHOT"
  );
  text(
    "power-hint",
    committed
      ? "Tracking the ball · aim locked"
      : charging
      ? preview.qualityLabel === "Perfect"
        ? smash
          ? "Drive it down · send it over the glass"
          : "Arrows aim · sweet spot"
        : preview.safe === false
        ? "Arrows aim · bring target in"
        : "Arrows aim · release in blue"
      : smash
      ? "Hold Enter · release in blue"
      : "Hold to charge · release to hit"
  );
  $("power-toggle").setAttribute(
    "aria-label",
    committed
      ? "Shot ready"
      : charging
      ? "Release power shot"
      : "Charge power shot"
  );
  $("power-toggle").disabled = committed;
  $("power-toggle").setAttribute("aria-pressed", String(charging));
  document.querySelector(".shot-panel").dataset.risk = String(
    charge > 0.98 || preview.safe === false
  );
  $("contact-ready").classList.toggle("ready", !!preview.ready);
  document.querySelector(".shot-panel").dataset.committed = String(committed);
  document.querySelector(".shot-panel").dataset.smash = String(smash);
}
function updateCamera(dt) {
  if (!playing) {
    avatars[0]?.setFirstPerson(false);
    if (avatars[0]) {
      const player = travel?.state.locked
        ? travel.state.player
        : clubVisit.state;
      const insideBody =
        travel?.state.locked &&
        Math.hypot(camera.position.x - player.x, camera.position.z - player.z) <
          0.65 &&
        camera.position.y < player.y + avatars[0].height + 0.2;
      avatars[0].root.visible = !insideBody;
    }
    show("player-label", false);
    return;
  }
  const state = cameraRig.update(
    dt,
    {
      mode: cameraMode,
      playing,
      player: match.players[0],
      ball: match.ball,
      aspect: camera.aspect,
      avatarHeight: avatars[0]?.height,
    },
    cameraNeedsSnap
  );
  cameraNeedsSnap = false;
  const player = match.players[0];
  const cameraInsideAvatar =
    playing &&
    Math.hypot(camera.position.x - player.x, camera.position.z - player.z) <
      0.65 &&
    camera.position.y < player.y + (avatars[0]?.height || 1.78) + 0.2;
  const hideLocalBody = state.firstPerson || cameraInsideAvatar;
  avatars[0]?.setFirstPerson(hideLocalBody);
  show("player-label", playing && $("results").hidden && !hideLocalBody);
}
function render(dt) {
  if (disposed) return;
  const began = performance.now();
  clock += dt;
  const controls = getInput(dt);
  if (!playing && clubVisit) {
    clubVisit.update(dt, keys, pulse.jump);
    pulse.jump = false;
    if (clubVisit.state.speed > 0.15 || !clubVisit.state.grounded)
      visitEmote = null;
    visitEmoteTime += dt;
    const wasTravelling = travel?.state.locked;
    travel?.update(dt);
    if (wasTravelling || travel?.state.locked)
      travelWorld?.update(travel.state, dt);
  }
  if (playing && !paused) {
    match.update(dt, controls);
    pulse.hit = pulse.lob = pulse.powerReleased = false;
    if (match.players[0].swingPending) {
      tapPower = false;
      keys.delete("Enter");
      keys.delete("NumpadEnter");
      feedbackUntil = 0;
      show("feedback", false);
    }
    handleEvents();
    if (Math.hypot(match.players[0].vx || 0, match.players[0].vz || 0) > 0.3)
      sound.step(
        Math.min(
          1,
          Math.hypot(match.players[0].vx || 0, match.players[0].vz || 0) / 6.8
        )
      );
  }
  const preview = getShotPreview(match, controls);
  avatars.forEach((avatar, i) => {
    if (!playing && i !== 0) return;
    avatar.update(
      paused ? 0 : dt,
      playing
        ? match.players[i]
        : travel?.state.locked
        ? travel.state.player
        : { ...clubVisit.state, emote: visitEmote, emoteTime: visitEmoteTime },
      playing ? match.ball : undefined
    );
  });
  updateCamera(dt);
  court.setView(
    {
      mode: cameraMode,
      playing,
      camera,
      player: match.players[0],
      travelLocked: !!travel?.state.locked,
    },
    dt
  );
  clubPeers?.update(dt, !playing && entered && !travel?.state.locked);
  court.tick(dt);
  ballView.update(playing ? match.ball : null, dt);
  updateLooseBalls(dt);
  const incoming =
    livePlay() && match.ball.active && match.ball.lastHit % 2 === 1
      ? predictCourtLanding(match.ball)
      : null;
  const previewActive =
    livePlay() && !paused && (match.phase !== "serve" || match.server === 0);
  const trajectory =
    previewActive && (preview.charging || preview.committed)
      ? getShotTrajectory(match, preview)
      : null;
  effects.update(dt, match, {
    ...preview,
    incoming,
    trajectory,
    active: previewActive,
  });
  if (playing) {
    show("hud", livePlay());
    updateHud(preview);
    const p = match.players[0];
    projected.set(p.x, p.y + avatars[0].height + 0.35, p.z).project(camera);
    if (
      projected.z < -1 ||
      projected.z > 1 ||
      Math.abs(projected.x) > 1 ||
      Math.abs(projected.y) > 1
    )
      show("player-label", false);
    $("player-label").style.transform = `translate(${
      (projected.x * 0.5 + 0.5) * innerWidth
    }px,${(-projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
  }
  show("team-labels", playing && match.phase !== "finished");
  if (playing) {
    ["rival-noa", "partner-leo", "rival-mika"].forEach((id, offset) => {
      const i = offset + 1,
        player = match.players[i];
      projected
        .set(player.x, player.y + avatars[i].height + 0.35, player.z)
        .project(camera);
      show(
        id,
        Math.abs(projected.z) <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1
      );
      $(id).style.transform = `translate(${
        (projected.x * 0.5 + 0.5) * innerWidth
      }px,${(-projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
    });
  }
  if (clock > announceUntil) show("announcement", false);
  if (clock > feedbackUntil) show("feedback", false);
  renderer.info.reset();
  rendering.render(scene, camera);
  acknowledgeTravelFrame();
  stats.sample(performance.now() - began);
  showSettledResults();
  statusTime += dt;
  if (statusTime > 0.2) {
    statusTime = 0;
    canvas.dataset.phase = paused
      ? "paused"
      : playing
      ? match.phase
      : visitDialogOpen()
      ? "setup"
      : "visit";
    canvas.dataset.mode = playing ? "match" : "visit";
    canvas.dataset.visitors = String(clubPeers?.count || 0);
    canvas.dataset.score = match.score.join("-");
    canvas.dataset.players = JSON.stringify(
      match.players.map((p, i) => ({
        id: i,
        team: i % 2,
        x: p.x,
        z: p.z,
        action: p.action,
        recovering: !!p.recovering,
        vx: p.vx,
        vz: p.vz,
      }))
    );
    canvas.dataset.sound = JSON.stringify({
      enabled: sound.enabled,
      unlocked: sound.unlocked,
    });
    canvas.dataset.enclosure = JSON.stringify(court.viewState);
    canvas.dataset.recovery = JSON.stringify({
      active: !!match.recovering,
      kind: match.recoveryKind,
      settled: !!match.settled,
      ball: {
        dead: !!match.ball.dead,
        resting: !!match.ball.resting,
        opacity: match.ball.opacity,
        vx: match.ball.vx,
        vy: match.ball.vy,
        vz: match.ball.vz,
      },
      looseBalls: (match.looseBalls || []).map(
        ({ x, y, z, opacity, resting }) => ({ x, y, z, opacity, resting })
      ),
    });
    const local = playing ? match.players[0] : clubVisit.state;
    canvas.dataset.player = `${local.x.toFixed(2)},${local.z.toFixed(2)}`;
    canvas.dataset.visit = JSON.stringify({
      enabled:
        entered &&
        visitInput &&
        !playing &&
        !visitDialogOpen() &&
        !travel?.state.locked,
      y: local.y,
      action: local.action,
      emote: visitEmote,
      motion: avatars[0].root.userData.motion,
    });
    canvas.dataset.travelPhase = travel?.state.phase || "idle";
    canvas.dataset.travel = JSON.stringify({
      phase: travel?.state.phase,
      locked: !!travel?.state.locked,
      world: travel?.state.worldProgress,
      handoff: travel?.state.handoffProgress,
      anchor: travel?.state.anchor,
      view: travel?.state.view,
      geometry: travelWorld?.stats,
    });
    canvas.dataset.assist = JSON.stringify({
      active: !!match.players[0].assistActive,
      manualPreparation: !!match.players[0].manualPreparation,
      target: match.players[0].assistTarget || null,
      motion: avatars[0].root.userData.motion,
      locomotion: avatars[0].root.userData.locomotion || null,
    });
    canvas.dataset.ball = [match.ball.x, match.ball.y, match.ball.z]
      .map((n) => n.toFixed(2))
      .join(",");
    canvas.dataset.shot = JSON.stringify({
      stroke: preview.stroke,
      smashOpportunity: !!preview.smashOpportunity,
      smashPower: preview.smashPower || 0,
      charging: !!preview.charging,
      charge: preview.charge,
      power: preview.power,
      quality: preview.qualityLabel,
      ready: preview.ready,
      safe: preview.safe,
      committed: !!preview.committed,
      reachable: !!preview.reachable,
      contactKind: preview.contactKind || null,
      aimX: controls.aimX,
      aimZ: controls.aimZ,
      x: preview.x,
      z: preview.z,
    });
    canvas.dataset.trajectory = JSON.stringify({
      visible: effects.trajectoryState.visible,
      bounceVisible: effects.trajectoryState.bounceVisible,
      estimated: !!trajectory?.estimated,
      points: trajectory?.points.length || 0,
      source: trajectory?.points[0] || null,
      end: trajectory?.points.at(-1) || null,
      bounce: trajectory?.bounce || null,
      blocked: !!trajectory?.blocked,
      safe: trajectory?.safe ?? null,
      apex:
        trajectory?.points.reduce(
          (height, point) => Math.max(height, point.y),
          0
        ) || 0,
    });
    canvas.dataset.rally = String(match.rallyHits);
    canvas.dataset.feedback = JSON.stringify(match.lastFeedback || null);
    canvas.dataset.camera = JSON.stringify({
      mode: playing ? cameraMode : "visit",
      position: camera.position
        .toArray()
        .map((value) => Number(value.toFixed(3))),
      fov: Number(camera.fov.toFixed(2)),
      firstPerson: playing && cameraMode === "first-person",
      bodyHidden: !!avatars[0].root.userData.firstPerson,
    });
  }
}
async function boot() {
  const me = await identityPromise;
  if (disposed) return;
  await document.fonts.ready;
  if (disposed) return;
  text("human-name", `${me.name === "You" ? "YOU" : me.name} + LEO`);
  canvas.dataset.avatarUrl = me.avatarUrl || "local";
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  rendering = createCourtRenderer(renderer);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 240);
  cameraRig = createPadelCamera(camera);
  const resize = () => {
    updateGraphics();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    cameraNeedsSnap = true;
    statusTime = 1;
    frameLoop?.invalidate();
  };
  resize();
  on(window, "resize", resize);
  court = build(scene);
  updateGraphics();
  ballView = createBall(scene);
  effects = createEffects(scene);
  clubVisit = createPadelVisit({
    camera,
    canvas,
    onPose: (pose) => {
      if (ready && entered && !playing)
        post("pose", {
          pose: { ...pose, emote: visitEmote, emoteTime: visitEmoteTime },
        });
    },
  });
  clubVisit.setActive(false);
  travel = createPadelTravel({ camera, visit: clubVisit });
  travelWorld = createPadelTravelWorld({ scene, court, camera });
  clubPeers = createPadelPeers({
    scene,
    renderer,
    camera,
    canvas,
    labels: $("visit-labels"),
    fallbackUrl: new URL("./avatars/square-catalogue.vrm", document.baseURI)
      .href,
  });
  stats = createFrameStats(canvas, renderer);
  text("load-status", "Getting your racket ready");
  const npcUrl = new URL("./avatars/square-catalogue.vrm", document.baseURI)
    .href;
  avatars = await Promise.all(
    match.players.map((p, i) =>
      createPadelAvatar({
        renderer,
        url: i === 0 ? me.avatarUrl || npcUrl : npcUrl,
        fallbackUrl: new URL("./avatars/square.vrm", document.baseURI).href,
        pfp: i === 0 ? me.pfp : null,
        index: i,
      })
    )
  );
  if (disposed) {
    avatars.forEach((a) => a.dispose());
    return;
  }
  avatars.forEach((a, i) => {
    scene.add(a.root);
    a.root.visible = i === 0;
    a.reset(i === 0 ? clubVisit.state : match.players[i]);
  });
  void avatars[0].preloadEmotes?.();
  await avatars[0].prepareTravel();
  text("load-status", "Opening court 01");
  await renderer.compileAsync(scene, camera);
  if (disposed) return;
  ready = true;
  show("loading", false);
  show("player-label", false);
  frameLoop = createFrameLoop(render);
  frameLoop.setVisible(!document.hidden);
  frameLoop.setRunning(true);
  if (entered) openVisit();
  post("ready");
}
async function changeAvatar(data) {
  if (!ready || disposed || !/^https?:|^\//.test(data.avatarUrl)) return;
  const version = ++avatarVersion;
  try {
    const next = await createPadelAvatar({
      renderer,
      url: data.avatarUrl,
      fallbackUrl: new URL("./avatars/square-catalogue.vrm", document.baseURI)
        .href,
      pfp: data.pfp,
      index: 0,
    });
    if (disposed || version !== avatarVersion) {
      next.dispose();
      return;
    }
    const old = avatars[0];
    await next.prepareTravel();
    if (disposed || version !== avatarVersion) {
      next.dispose();
      return;
    }
    next.reset(playing ? match.players[0] : clubVisit.state);
    scene.add(next.root);
    avatars[0] = next;
    old.root.removeFromParent();
    old.dispose();
    canvas.dataset.avatarUrl = data.avatarUrl;
    void next.preloadEmotes?.();
    frameLoop?.invalidate();
  } catch (error) {
    console.warn("[Padel] Avatar unavailable", error);
  }
}
function dispose() {
  if (disposed) return;
  disposed = true;
  frameLoop?.dispose();
  cleanups.forEach((fn) => fn());
  clearInput();
  sound.dispose();
  travelRequest = null;
  travel?.cancel();
  travelWorld?.dispose();
  clubVisit?.dispose();
  clubPeers?.dispose();
  avatars.forEach((a) => a.dispose());
  effects?.dispose();
  ballView?.dispose();
  looseBallViews.forEach(({ view }) => view.dispose());
  looseBallViews.length = 0;
  court?.dispose();
  rendering?.dispose();
  renderer?.dispose();
}
on(window, "pagehide", dispose);
on(window, "error", (e) => {
  if (!ready) fatal(e.error || e.message);
});
on(window, "unhandledrejection", (e) => {
  if (!ready) fatal(e.reason);
});
boot().catch(fatal);
