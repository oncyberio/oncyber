import {
    ALIGNMENTS,
    CRITTERS,
    FRUITS,
    GROW_AT,
    HATCH_AFTER,
    STATS,
    STAT_LABEL,
    alignmentOf,
    typeOf,
} from "./sim.js";
import { bodyColor } from "./creature.js";
import { TIERS } from "./minigames.js";

// DOM overlay: roster, details, prompts, toasts, mini game menus and HUD.

const $ = (s) => document.querySelector(s);
const MOOD_ICON = {
    heart: "💗",
    swirl: "💧",
    zzz: "💤",
    alert: "❗",
    question: "❓",
    ball: "",
    none: "",
};
const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;

export function createUI(app) {
    const ui = {
        app,
        detailId: null,
        menu: null,
        offers: new Map(),
        rosterKey: "",
    };

    // Toasts.
    ui.toast = (text, kind = "") => {
        const box = $("#toasts");
        const el = document.createElement("div");
        el.className = `toast ${kind}`;
        el.textContent = text;
        box.appendChild(el);
        while (box.children.length > 4) box.firstChild.remove();
        setTimeout(() => el.classList.add("out"), kind === "big" ? 4200 : 3200);
        setTimeout(() => el.remove(), kind === "big" ? 4700 : 3700);
    };

    // Prompt chips: [[key, label], ...]
    let promptKey = "";
    ui.prompt = (list) => {
        const key = JSON.stringify(list);
        if (key === promptKey) return;
        promptKey = key;
        $("#prompt").innerHTML = list
            .map(
                ([k, label]) =>
                    `<span class="p"><span class="key">${k}</span>${label}</span>`
            )
            .join("");
    };

    // Roster.
    ui.roster = (garden) => {
        const box = $("#roster");
        const key = garden.bloomlings.map((b) => b.data.id).join(",");
        if (key !== ui.rosterKey) {
            ui.rosterKey = key;
            box.innerHTML = "";
            garden.bloomlings.forEach((b, i) => {
                const el = document.createElement("button");
                el.className = "mini";
                el.dataset.id = b.data.id;
                el.innerHTML = `<span class="face"></span><b></b><span class="bars"><i class="full" title="Tummy"></i><i class="happy" title="Happiness"></i></span>`;
                el.title = `${b.data.name} (${i + 1})`;
                el.addEventListener("click", () => ui.openDetails(b.data.id));
                box.appendChild(el);
            });
        }
        for (const b of garden.bloomlings) {
            const el = box.querySelector(`[data-id="${b.data.id}"]`);
            if (!el) continue;
            const c = b.data;
            el.querySelector("b").textContent =
                c.stage === "egg" ? "Egg" : c.name;
            const face = el.querySelector(".face");
            face.style.background =
                c.stage === "egg"
                    ? `radial-gradient(circle at 35% 30%, #fff, ${hex(
                          c.look.color
                      )})`
                    : hex(
                          bodyColor({
                              ...c.look,
                              stage: c.stage,
                              align: c.evolution?.align,
                          })
                      );
            face.dataset.mood = b.away ? "🏁" : MOOD_ICON[b.orb] || "";
            const full = el.querySelector(".full");
            full.style.setProperty(
                "--v",
                `${c.stage === "egg" ? (c.hatch / HATCH_AFTER) * 100 : c.full}%`
            );
            full.style.setProperty(
                "--c",
                c.stage === "egg"
                    ? "#a07bff"
                    : c.full < 25
                    ? "#ff5f7e"
                    : "#ffc23d"
            );
            const happy = el.querySelector(".happy");
            happy.style.setProperty("--v", `${(c.happy + 100) / 2}%`);
            happy.style.setProperty("--c", "#ff5f9e");
            el.classList.toggle("on", ui.detailId === c.id);
        }
        if (ui.detailId) ui.refreshDetails(garden);
    };

    // Details.
    const details = $("#details");
    ui.openDetails = (id) => {
        ui.detailId = ui.detailId === id ? null : id;
        details.hidden = !ui.detailId;
        if (ui.detailId) ui.refreshDetails(app.garden, true);
    };
    details
        .querySelector("[data-close]")
        .addEventListener("click", () => ui.openDetails(null));
    const nameInput = $("#d-name");
    nameInput.addEventListener("change", () => {
        const b = app.garden.bloomlings.find((x) => x.data.id === ui.detailId);
        const name = nameInput.value.trim().slice(0, 14);
        if (b && name) {
            b.data.name = name;
            app.lookChanged();
        }
    });
    // Enter commits a text field, which fires `change`.
    nameInput.addEventListener("change", () => nameInput.blur());
    $("#d-call").addEventListener("click", () => app.callOne(ui.detailId));
    ui.refreshDetails = (garden, force) => {
        const b = garden.bloomlings.find((x) => x.data.id === ui.detailId);
        if (!b) {
            ui.openDetails(null);
            return;
        }
        const c = b.data;
        if (force || document.activeElement !== nameInput)
            nameInput.value = c.name;
        $("#d-portrait").style.background =
            c.stage === "egg"
                ? hex(c.look.color)
                : hex(
                      bodyColor({
                          ...c.look,
                          stage: c.stage,
                          align: c.evolution?.align,
                      })
                  );
        const align = c.stage === "adult" ? c.evolution.align : alignmentOf(c);
        const stage =
            c.stage === "egg"
                ? "An egg. Warm it up: hold it or pet it."
                : c.stage === "adult"
                ? `Adult · ${ALIGNMENTS[align].label}${
                      c.evolution.type !== "all"
                          ? ` ${STAT_LABEL[c.evolution.type]}`
                          : ""
                  } type`
                : `Child · leaning ${ALIGNMENTS[align].label}`;
        $("#d-stage").textContent = stage;
        const growth =
            c.stage === "child"
                ? Math.min(1, c.growth / app.growAt)
                : c.stage === "adult"
                ? 1
                : c.hatch / HATCH_AFTER;
        const meters = [
            [
                c.stage === "egg" ? "Hatching" : "Growing up",
                growth * 100,
                "#7fe3ff",
            ],
            ["Tummy", c.full, c.full < 25 ? "#ff5f7e" : "#ffc23d"],
            ["Happiness", (c.happy + 100) / 2, "#ff5f9e"],
            ["Energy", c.energy, "#3fbf5a"],
        ];
        $("#d-meters").innerHTML = meters
            .map(
                ([label, v, col]) =>
                    `<span>${label}</span><div class="meter"><i style="width:${Math.max(
                        0,
                        Math.min(100, v)
                    ).toFixed(0)}%;background:${col}"></i></div>`
            )
            .join("");
        $("#d-align").style.left = `${((c.align + 1) / 2) * 100}%`;
        $("#d-stats").innerHTML = STATS.map(
            (s) =>
                `<div class="stat"><span>${
                    STAT_LABEL[s]
                }</span><div class="meter"><i style="width:${c.stats[
                    s
                ].xp.toFixed(0)}%;background:${
                    STAT_COLOR[s]
                }"></i></div><span class="lv">Lv ${c.stats[s].lv}</span></div>`
        ).join("");
        $("#d-hint").textContent = hintFor(c);
    };

    // Mini game menu.
    ui.openMenu = (kind) => {
        const eligible = app.garden.bloomlings.filter(
            (b) => b.data.stage === "child" || b.data.stage === "adult"
        );
        ui.menu = { kind, who: eligible[0]?.data.id || null, tier: 0 };
        $("#menu-title").textContent =
            kind === "race" ? "Bloom Dash" : "Bump Dojo";
        $("#menu-blurb").textContent =
            kind === "race"
                ? "Run, swim, climb and glide around the course. Cheer to give your bloomling a burst when it flags. Run, Swim, Power, Fly and Stamina all count."
                : "Bump your rival out of the ring! Cheer when the needle's in the gold for a super bump. Power hits hard, Stamina takes hits, Run is quick, Fly dodges.";
        $("#menu-tier-label").textContent = kind === "race" ? "Cup" : "Rival";
        const who = $("#menu-who");
        who.innerHTML = eligible.length
            ? ""
            : `<p class="blurb">Hatch an egg first: only bloomlings can compete.</p>`;
        for (const b of eligible) {
            const btn = document.createElement("button");
            btn.innerHTML = `<span class="dot" style="background:${hex(
                bodyColor({
                    ...b.data.look,
                    stage: b.data.stage,
                    align: b.data.evolution?.align,
                })
            )}"></span>${b.data.name}`;
            btn.addEventListener("click", () => {
                ui.menu.who = b.data.id;
                paint();
            });
            btn.dataset.id = b.data.id;
            who.appendChild(btn);
        }
        const tiers = $("#menu-tier");
        tiers.innerHTML = "";
        TIERS[kind].forEach((t, i) => {
            const btn = document.createElement("button");
            btn.textContent = t.label;
            btn.dataset.i = i;
            btn.addEventListener("click", () => {
                ui.menu.tier = i;
                paint();
            });
            tiers.appendChild(btn);
        });
        const paint = () => {
            who.querySelectorAll("button").forEach((b) =>
                b.classList.toggle("on", b.dataset.id === ui.menu.who)
            );
            tiers
                .querySelectorAll("button")
                .forEach((b) =>
                    b.classList.toggle(
                        "on",
                        Number(b.dataset.i) === ui.menu.tier
                    )
                );
            document.querySelector('[data-action="menu-go"]').disabled =
                !ui.menu.who;
        };
        paint();
        $("#menu").classList.add("show");
        app.audioUI();
    };
    ui.closeMenu = () => {
        $("#menu").classList.remove("show");
        ui.menu = null;
        app.focus();
    };

    // Offers from other players.
    ui.offer = (id, from, kind) => {
        if (ui.offers.has(id)) return;
        const name = app.peerName(from);
        const el = document.createElement("div");
        el.className = "offer";
        const eligible = app.garden.bloomlings.filter(
            (b) =>
                (b.data.stage === "child" || b.data.stage === "adult") &&
                !b.away
        );
        el.innerHTML = `<b>${escapeHtml(name)}</b> opened a ${
            kind === "race" ? "Bloom Dash race" : "Bump Dojo bout"
        }!<div class="row"></div>`;
        const row = el.querySelector(".row");
        for (const b of eligible.slice(0, 3)) {
            const btn = document.createElement("button");
            btn.className = "pill go";
            btn.textContent = `Join with ${b.data.name}`;
            btn.addEventListener("click", () => app.joinOffer(id, b));
            row.appendChild(btn);
        }
        const watch = document.createElement("button");
        watch.className = "pill";
        watch.textContent = "Watch";
        watch.addEventListener("click", () => app.joinOffer(id, null));
        row.appendChild(watch);
        $("#offers").appendChild(el);
        ui.offers.set(id, el);
        app.audioUI();
    };
    ui.offerGone = (id) => {
        ui.offers.get(id)?.remove();
        ui.offers.delete(id);
    };

    // Match HUD.
    ui.countdown = (text) => {
        const el = $("#m-count");
        el.textContent = text;
        el.classList.remove("go");
        void el.offsetWidth;
        el.classList.add("go");
        el.onanimationend = () => el.classList.remove("go");
    };
    ui.matchChanged = () => {
        const hud = app.matchHud();
        $("#match").hidden = !hud;
        $("#hud").hidden = !!hud || !app.booted;
        if (!hud) return;
        for (const id of ui.offers.keys()) ui.offerGone(id);
        $("#m-title").textContent = `${
            hud.kind === "race" ? "Bloom Dash" : "Bump Dojo"
        } · ${hud.tier}`;
        $("#m-standings").hidden = hud.kind !== "race";
        $("#m-bout").hidden = hud.kind !== "bout";
        $("#m-gauge").hidden =
            hud.kind !== "bout" ||
            hud.mine < 0 ||
            hud.phase === "results" ||
            hud.phase === "lobby";
        $("#m-lobby").hidden = hud.phase !== "lobby";
        $("#m-now").hidden = !hud.host;
        $("#m-results").hidden = hud.phase !== "results";
        $("#m-cheer").hidden = hud.phase === "results" || hud.phase === "lobby";
        if (hud.kind === "bout") {
            $("#m-n0").textContent = hud.entrants[0]?.n || "";
            $("#m-n1").textContent = hud.entrants[1]?.n || "";
        }
        if (hud.phase === "results") paintResults(hud);
    };
    const paintResults = (hud) => {
        const r = hud.result;
        const list = $("#m-res-list");
        if (hud.kind === "race") {
            const order = hud.entrants
                .map((e, i) => ({
                    e,
                    i,
                    place: r.places[i],
                    time: r.times?.[i],
                }))
                .sort((a, b) => a.place - b.place);
            list.innerHTML = order
                .map(
                    (o) =>
                        `<li class="${
                            o.i === hud.mine ? "me" : ""
                        }">${escapeHtml(o.e.n)}${o.e.cpu ? "" : " ★"} <small>${
                            o.time ? `${o.time.toFixed(1)}s` : ""
                        }</small></li>`
                )
                .join("");
            const place = hud.mine >= 0 ? r.places[hud.mine] : 0;
            $("#m-res-title").textContent =
                place === 1
                    ? "You won! 🏆"
                    : place
                    ? `${["", "1st", "2nd", "3rd", "4th"][place]} place!`
                    : "Race over!";
            $("#m-res-reward").textContent =
                hud.mine >= 0
                    ? place === 1
                        ? "A big boost to every stat, and a happy bloomling."
                        : "Every stat got a little practice. Try again!"
                    : "";
        } else {
            const w = hud.entrants[r.winner];
            list.innerHTML = `<li class="${
                r.winner === hud.mine ? "me" : ""
            }">${escapeHtml(w?.n || "")} wins by ${
                r.reason === "ring-out"
                    ? "ring-out"
                    : r.reason === "knockout"
                    ? "knockout"
                    : "decision"
            }!</li>`;
            $("#m-res-title").textContent =
                hud.mine < 0
                    ? "Bout over!"
                    : r.winner === hud.mine
                    ? "Victory! 🏆"
                    : "So close!";
            $("#m-res-reward").textContent =
                hud.mine >= 0
                    ? r.winner === hud.mine
                        ? "Power and Stamina up!"
                        : "Power and Stamina got a workout."
                    : "";
        }
    };
    ui.updateMatch = (hud) => {
        if (!hud) return;
        if (hud.phase === "lobby") {
            $("#m-lobby-text").textContent = `${
                hud.entrants.length
            } in · starting in ${Math.max(
                0,
                Math.ceil(hud.lobbyT)
            )}s. Empty spots get CPU rivals.`;
            if (!hud.host)
                $("#m-lobby-text").textContent =
                    "Joined! Waiting for the host to start…";
        }
        if (hud.t !== undefined)
            $("#m-timer").textContent =
                hud.kind === "race"
                    ? `${hud.t.toFixed(1)}s`
                    : `${Math.ceil(hud.t)}s`;
        if (hud.kind === "race" && hud.standings) {
            $("#m-standings").innerHTML = hud.standings
                .map((s, k) => {
                    const e = hud.entrants[s.lane];
                    const prog = hud.progress[s.lane] * 100;
                    return `<div class="standing ${
                        s.lane === hud.mine ? "me" : ""
                    }"><span class="place">${
                        ["1st", "2nd", "3rd", "4th"][
                            (s.done ? s.place : k + 1) - 1
                        ]
                    }</span><span><i class="dot" style="background:${hex(
                        bodyColor(e.L)
                    )}"></i>${escapeHtml(e.n)}${
                        s.act === "tired"
                            ? " 💧"
                            : s.act === "look"
                            ? " ❓"
                            : s.act === "trip"
                            ? " 💫"
                            : ""
                    }</span><div class="track"><i style="width:${prog.toFixed(
                        0
                    )}%"></i></div></div>`;
                })
                .join("");
        }
        if (hud.kind === "bout" && hud.hp) {
            $("#m-hp0").style.width = `${hud.hp[0]}%`;
            $("#m-hp1").style.width = `${hud.hp[1]}%`;
            $("#m-needle").style.left = `${hud.gauge * 100}%`;
        }
        const cd = hud.kind === "race" ? 2.2 : 1.2;
        $("#m-cheer-cd").style.height = `${(hud.cheerCd / cd) * 100}%`;
    };
    $("#m-cheer").addEventListener("click", () => app.cheer());

    // Buttons.
    document.addEventListener("click", (e) => {
        const a = e.target.closest?.("[data-action]")?.dataset.action;
        if (!a) return;
        app.audioUI();
        if (a === "menu-close") ui.closeMenu();
        else if (a === "menu-go" && ui.menu?.who) {
            const m = ui.menu;
            ui.closeMenu();
            app.startMatch(m.kind, m.tier, m.who);
        } else if (a === "match-leave") app.leaveMatch();
        else if (a === "match-now") app.startNow();
        else if (a === "help-close") ui.help(false);
    });
    ui.help = (show) => {
        $("#help").classList.toggle("show", show);
        if (!show) app.focus();
    };
    $("#btn-help").addEventListener("click", () => ui.help(true));
    $("#btn-sound").addEventListener("click", () => app.toggleSound());
    return ui;
}

const STAT_COLOR = {
    swim: "#2fb8ff",
    fly: "#a07bff",
    run: "#ff8a4a",
    power: "#ff5f7e",
    stamina: "#3fbf5a",
};

function hintFor(c) {
    if (c.stage === "egg")
        return "Eggs hatch on their own, quicker in your arms. Press E to pick it up.";
    if (c.full < 25)
        return `${c.name} is hungry! Shake a fruit tree (E) and hand over the fruit.`;
    if (c.energy < 20) return `${c.name} is sleepy. Let it nap.`;
    if (c.happy < -20)
        return `${c.name} is sad. Pet it (hold F) and keep its tummy full.`;
    if (c.stage === "child") {
        const top = typeOf(c);
        return `Gifts shape how ${c.name} grows up. ${
            top === "all"
                ? "Its stats are balanced."
                : `It's leaning toward ${STAT_LABEL[top]}.`
        } Wins: ${c.wins.race} races, ${c.wins.bout} bouts.`;
    }
    return `Wins: ${c.wins.race} races, ${
        c.wins.bout
    } bouts. Keep training with critters: ${Object.values(CRITTERS)
        .map((k) => k.label)
        .join(", ")}.`;
}

export function escapeHtml(s) {
    return String(s).replace(
        /[&<>"']/g,
        (ch) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[ch])
    );
}

export { FRUITS, GROW_AT };
