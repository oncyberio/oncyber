import { connectUI } from "@oncyber/game-runtime/browser";
import { bindPageKeys } from "@oncyber/game-runtime/keys-browser";
import manifest from "../../game.json";
import { answerHudRequests, hudRects, watchSafeArea } from "@oncyber/game-runtime/safe-area";
import "./style.css";

// Bloom Garden's UI: an HTML page in its own sandbox (or a native WebView).
// It draws what the game publishes and sends named actions back. It never
// touches the 3D scene, storage, the network or the host's own chrome.

const $ = (s) => document.querySelector(s);
const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MOOD = { heart: "💗", swirl: "💧", zzz: "💤", alert: "❗", question: "❓", away: "🏁", ball: "", none: "" };
const ORD = ["1st", "2nd", "3rd", "4th"];

// The host relays the Oncyber page's safe-area insets; style.css keeps the
// HUD inside them (--oncyber-safe-*). The check asks where the HUD is: the
// `hud-measure` class lays the hidden panels out for that one reading.
const safeArea = watchSafeArea();
answerHudRequests(
    () => {
        document.body.classList.add("hud-measure");
        try {
            return { hud: hudRects() };
        } finally {
            document.body.classList.remove("hud-measure");
        }
    },
    { insets: () => safeArea.insets }
);

let state = null;
const ui = connectUI((value) => {
    state = value;
    render(value);
});

// --------------------------------------------------------------- actions

const pulse = (name, value = 1) => {
    ui.action(name, value);
    // Hold a moment so the game sees both the edge and the value.
    setTimeout(() => ui.action(name, 0), 120);
};
const indexValue = (i) => (i + 1) / 16;
let unlocked = false;
const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    pulse("audioUnlock");
};

// Keys arrive as the actions game.json declares, through the page keys
// binder; this frame adds no key listeners (docs/games/keys-focus.md). Held
// actions follow the key; the rest pulse on press. Escape, Enter and M are
// the page's: the host frame relays them up.
const HOLD = new Set(["forward", "backward", "left", "right", "walk", "pet"]);
bindPageKeys({
    game: "garden",
    input: manifest.runtime.input,
    action(name, value) {
        if (value) unlock();
        if (HOLD.has(name)) ui.action(name, value);
        else if (!value) return;
        else if (/^pick[1-4]$/.test(name)) pulse("details", indexValue(Number(name.slice(4)) - 1));
        else pulse(name);
    },
});

// Look: drag the world (mouse or a finger on the right), wheel to zoom,
// tap to pick a bloomling.
const look = $("#look");
let drag = null;
look.addEventListener("pointerdown", (e) => {
    unlock();
    if (e.pointerType === "touch" && e.clientX < innerWidth * 0.45) return startStick(e);
    if (e.button === 2) return pulse("throw");
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, t: performance.now() };
    look.setPointerCapture(e.pointerId);
    ui.action("looking", 1);
});
look.addEventListener("pointermove", (e) => {
    if (stick && e.pointerId === stick.id) return moveStick(e);
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const k = e.pointerType === "touch" ? 1.2 : 1;
    if (dx) ui.delta("lookX", (dx * k) / 1000);
    if (dy) ui.delta("lookY", (dy * k) / 1000);
});
const endDrag = (e) => {
    if (stick && e.pointerId === stick.id) return endStick();
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved < 8 && performance.now() - drag.t < 400) {
        ui.action("tapX", (e.clientX / innerWidth) * 2 - 1);
        ui.action("tapY", -((e.clientY / innerHeight) * 2 - 1));
        pulse("tap");
    }
    drag = null;
    ui.action("looking", 0);
};
look.addEventListener("pointerup", endDrag);
look.addEventListener("pointercancel", endDrag);
look.addEventListener("contextmenu", (e) => e.preventDefault());
look.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        ui.delta("zoom", Math.sign(e.deltaY) * 0.1);
    },
    { passive: false }
);

// Touch stick.
const stickEl = $(".touch-stick");
const knob = $(".touch-knob");
let stick = null;
function startStick(e) {
    document.body.classList.add("is-touch");
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    look.setPointerCapture(e.pointerId);
    stickEl.style.left = `${e.clientX}px`;
    stickEl.style.top = `${e.clientY}px`;
    stickEl.classList.add("on");
}
function moveStick(e) {
    const dx = e.clientX - stick.ox;
    const dy = e.clientY - stick.oy;
    const r = 50;
    const d = Math.hypot(dx, dy);
    const k = d > r ? r / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    ui.action("moveX", (dx * k) / r);
    ui.action("moveY", (-dy * k) / r);
}
function endStick() {
    stick = null;
    knob.style.transform = "";
    stickEl.classList.remove("on");
    ui.action("moveX", 0);
    ui.action("moveY", 0);
}
window.addEventListener("touchstart", () => document.body.classList.add("is-touch"), { passive: true });

// Touch buttons: pet is held, the rest pulse.
for (const btn of document.querySelectorAll("[data-act]")) {
    const act = btn.dataset.act;
    btn.addEventListener("pointerdown", (e) => {
        unlock();
        e.preventDefault();
        btn.classList.add("down");
        if (act === "pet") ui.action("pet", 1);
        else pulse(act === "interact" && state?.match ? "cheer" : act);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"])
        btn.addEventListener(ev, () => {
            btn.classList.remove("down");
            if (act === "pet") ui.action("pet", 0);
        });
}

// Buttons rendered from state.
document.addEventListener("click", (e) => {
    unlock();
    const el = e.target.closest?.("[data-action], [data-pick]");
    if (!el) return;
    if (el.dataset.pick) {
        const [name, i] = el.dataset.pick.split(":");
        pulse(name, indexValue(Number(i)));
    } else pulse(el.dataset.action);
});
$("#btn-help").addEventListener("click", () => pulse("help"));
$("#btn-sound").addEventListener("click", () => pulse("mute"));
$("#m-cheer").addEventListener("click", () => pulse("cheer"));
$("#d-call").addEventListener("click", () => pulse("callOne"));
$("#details [data-close]").addEventListener("click", () => pulse("back"));

// --------------------------------------------------------------- render

const memo = {};
const changed = (key, value) => {
    const s = JSON.stringify(value);
    if (memo[key] === s) return false;
    memo[key] = s;
    return true;
};
const seenToasts = new Set();

function render(s) {
    // Boot.
    const booted = !!s.booted;
    $("#boot").classList.toggle("show", !booted || !!s.error);
    if (s.boot) {
        $("#boot-fill").style.width = `${Math.round((s.boot.p || 0) * 100)}%`;
        $("#boot-text").textContent = s.error || s.boot.text || "";
    }
    $("#hud").hidden = !booted || !!s.match;
    document.documentElement.dataset.renderer = s.renderer || "";

    $("#clock").textContent = s.clock ? `${s.clock.startsWith("night") ? "🌙" : "☀️"} ${s.clock.split(" ")[1]}` : "";
    $("#btn-sound").textContent = s.muted ? "✕" : "♪";

    // Roster.
    if (changed("roster", [s.roster, s.details?.id])) {
        $("#roster").innerHTML = s.roster
            .map(
                (b, i) => `<button class="mini ${s.details?.id === b.id ? "on" : ""}" data-pick="details:${i}" title="${esc(b.name)} (${i + 1})">
<span class="face" data-mood="${MOOD[b.mood] || ""}" style="background:${b.egg ? `radial-gradient(circle at 35% 30%, #fff, ${b.color})` : b.color}"></span>
<b>${esc(b.name)}</b><span class="bars"><i style="--v:${b.full}%;--c:${b.egg ? "#a07bff" : b.hungry ? "#ff5f7e" : "#ffc23d"}"></i><i style="--v:${b.happy}%;--c:#ff5f9e"></i></span></button>`
            )
            .join("");
    }

    // Details.
    const d = s.details;
    $("#details").hidden = !d;
    if (d && changed("details", d)) {
        $("#d-name").textContent = d.name;
        $("#d-portrait").style.background = d.color;
        $("#d-stage").textContent = d.stage;
        $("#d-meters").innerHTML = d.meters
            .map(([label, v, col]) => `<span>${esc(label)}</span><div class="meter"><i style="width:${v}%;background:${col}"></i></div>`)
            .join("");
        $("#d-align").style.left = `${d.align}%`;
        $("#d-stats").innerHTML = d.stats
            .map(
                ([label, lv, xp, col]) =>
                    `<div class="stat"><span>${esc(label)}</span><div class="meter"><i style="width:${xp}%;background:${col}"></i></div><span class="lv">Lv ${lv}</span></div>`
            )
            .join("");
        $("#d-hint").textContent = d.hint;
    }

    // Prompt.
    if (changed("prompt", s.prompt))
        $("#prompt").innerHTML = s.prompt.map(([k, label]) => `<span class="p"><span class="key">${esc(k)}</span>${esc(label)}</span>`).join("");

    // Toasts.
    for (const t of s.toasts || []) {
        if (seenToasts.has(t.id)) continue;
        seenToasts.add(t.id);
        const box = $("#toasts");
        const el = document.createElement("div");
        el.className = `toast ${t.kind || ""}`;
        el.textContent = t.text;
        box.appendChild(el);
        while (box.children.length > 4) box.firstChild.remove();
        const life = t.kind === "big" ? 4200 : 3200;
        setTimeout(() => el.classList.add("out"), life);
        setTimeout(() => el.remove(), life + 500);
    }

    // Help.
    $("#help").classList.toggle("show", !!s.help);

    // Mini game menu.
    const m = s.menu;
    $("#menu").classList.toggle("show", !!m);
    if (m && changed("menu", m)) {
        $("#menu-title").textContent = m.kind === "race" ? "Bloom Dash" : "Bump Dojo";
        $("#menu-blurb").textContent =
            m.kind === "race"
                ? "Run, swim, climb and glide around the course. Cheer to give your bloomling a burst when it flags. Run, Swim, Power, Fly and Stamina all count."
                : "Bump your rival out of the ring! Cheer when the needle's in the gold for a super bump. Power hits hard, Stamina takes hits, Run is quick, Fly dodges.";
        $("#menu-tier-label").textContent = m.kind === "race" ? "Cup" : "Rival";
        $("#menu-who").innerHTML = m.who.length
            ? m.who
                  .map(
                      (w, i) =>
                          `<button class="${m.sel.who === i ? "on" : ""}" data-pick="menuWho:${i}"><span class="dot" style="background:${w.color}"></span>${esc(w.name)}</button>`
                  )
                  .join("")
            : `<p class="blurb">Hatch an egg first: only bloomlings can compete.</p>`;
        $("#menu-tier").innerHTML = m.tiers
            .map((t, i) => `<button class="${m.sel.tier === i ? "on" : ""}" data-pick="menuTier:${i}">${esc(t)}</button>`)
            .join("");
        document.querySelector('[data-action="menuGo"]').disabled = !m.who.length;
    }

    // Offers.
    if (changed("offers", s.offers)) {
        $("#offers").innerHTML = (s.offers || [])
            .map(
                (o, k) => `<div class="offer"><b>${esc(o.name)}</b> opened a ${o.kind === "race" ? "Bloom Dash race" : "Bump Dojo bout"}!<div class="row">${o.join
                    .map((n, j) => `<button class="pill go" data-pick="join:${k * 4 + j}">Join with ${esc(n)}</button>`)
                    .join("")}<button class="pill" data-pick="watch:${k}">Watch</button></div></div>`
            )
            .join("");
    }

    renderMatch(s.match);
    if (s.countdown && changed("countdown", s.countdown)) {
        const el = $("#m-count");
        el.textContent = s.countdown.text;
        el.classList.remove("go");
        void el.offsetWidth;
        el.classList.add("go");
        el.onanimationend = () => el.classList.remove("go");
    }
    if (s.wipe !== null && s.wipe !== undefined && changed("wipe", s.wipe)) {
        const el = $("#wipe");
        el.classList.remove("on");
        void el.offsetWidth;
        el.classList.add("on");
    }
}

function renderMatch(h) {
    $("#match").hidden = !h;
    if (!h) return;
    $("#m-title").textContent = `${h.kind === "race" ? "Bloom Dash" : "Bump Dojo"} · ${h.tier}`;
    $("#m-standings").hidden = h.kind !== "race";
    $("#m-bout").hidden = h.kind !== "bout";
    $("#m-gauge").hidden = h.kind !== "bout" || h.mine < 0 || h.phase === "results" || h.phase === "lobby";
    $("#m-lobby").hidden = h.phase !== "lobby";
    $("#m-now").hidden = !h.host;
    $("#m-results").hidden = h.phase !== "results";
    $("#m-cheer").hidden = h.phase === "results" || h.phase === "lobby";
    if (h.phase === "lobby")
        $("#m-lobby-text").textContent = h.host
            ? `${h.entrants.length} in · starting in ${Math.max(0, Math.ceil(h.lobbyT))}s. Empty spots get CPU rivals.`
            : "Joined! Waiting for the host to start…";
    if (h.t !== null) $("#m-timer").textContent = h.kind === "race" ? `${h.t.toFixed(1)}s` : `${Math.ceil(h.t)}s`;
    if (h.kind === "race" && h.standings)
        $("#m-standings").innerHTML = h.standings
            .map((s, k) => {
                const e = h.entrants[s.lane];
                const mark = s.act === "tired" ? " 💧" : s.act === "look" ? " ❓" : s.act === "trip" ? " 💫" : "";
                return `<div class="standing ${s.lane === h.mine ? "me" : ""}"><span class="place">${ORD[(s.done ? s.place : k + 1) - 1]}</span><span><i class="dot" style="background:${e.color}"></i>${esc(e.n)}${mark}</span><div class="track"><i style="width:${Math.round(h.progress[s.lane] * 100)}%"></i></div></div>`;
            })
            .join("");
    if (h.kind === "bout" && h.hp) {
        $("#m-n0").textContent = h.entrants[0]?.n || "";
        $("#m-n1").textContent = h.entrants[1]?.n || "";
        $("#m-hp0").style.width = `${h.hp[0]}%`;
        $("#m-hp1").style.width = `${h.hp[1]}%`;
        $("#m-needle").style.left = `${(h.gauge || 0) * 100}%`;
    }
    const cd = h.kind === "race" ? 2.2 : 1.2;
    $("#m-cheer-cd").style.height = `${(h.cheerCd / cd) * 100}%`;
    if (h.phase === "results" && h.result && changed("results", h.result)) {
        const r = h.result;
        if (h.kind === "race") {
            const order = h.entrants.map((e, i) => ({ e, i, place: r.places[i], time: r.times?.[i] })).sort((a, b) => a.place - b.place);
            $("#m-res-list").innerHTML = order
                .map((o) => `<li class="${o.i === h.mine ? "me" : ""}">${esc(o.e.n)}${o.e.cpu ? "" : " ★"} <small>${o.time ? `${o.time.toFixed(1)}s` : ""}</small></li>`)
                .join("");
            const place = h.mine >= 0 ? r.places[h.mine] : 0;
            $("#m-res-title").textContent = place === 1 ? "You won! 🏆" : place ? `${ORD[place - 1]} place!` : "Race over!";
            $("#m-res-reward").textContent =
                h.mine >= 0 ? (place === 1 ? "A big boost to every stat, and a happy bloomling." : "Every stat got a little practice. Try again!") : "";
        } else {
            const w = h.entrants[r.winner];
            $("#m-res-list").innerHTML = `<li class="${r.winner === h.mine ? "me" : ""}">${esc(w?.n || "")} wins by ${r.reason === "ring-out" ? "ring-out" : r.reason === "knockout" ? "knockout" : "decision"}!</li>`;
            $("#m-res-title").textContent = h.mine < 0 ? "Bout over!" : r.winner === h.mine ? "Victory! 🏆" : "So close!";
            $("#m-res-reward").textContent = h.mine >= 0 ? (r.winner === h.mine ? "Power and Stamina up!" : "Power and Stamina got a workout.") : "";
        }
    }
}
