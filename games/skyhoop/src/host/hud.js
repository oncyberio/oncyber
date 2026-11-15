// The HUD: drawn from the state the game publishes (no game objects reach
// it). Scoreboard, banners, crosshair with the throw charge, stamina,
// toasts, a radar of the oval, the arrival panel, pause and result cards,
// and touch controls on phones and tablets.

const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function createHUD({ root, onAction, onDelta, touch, requestFly, isLocked }) {
    root.innerHTML = "";
    if (touch) root.classList.add("touch-mode");
    const press = (name) => {
        onAction(name, 1);
        setTimeout(() => onAction(name, 0), 60);
    };

    // Loading.
    const loading = el("div", "loading", `<div><div class="logo">Sky<span style="color:#ffb15c">hoop</span></div><div class="bar"><i style="width:5%"></i></div></div>`);

    // Match HUD.
    const board = el("div", "board hide");
    board.innerHTML = `<div class="team t0"><span>EMBER</span><b class="s0">0</b></div><div class="clock"><span class="c">6:00</span><small class="cl">TIME</small></div><div class="team t1"><span>TIDE</span><b class="s1">0</b></div>`;
    const cross = el("div", "cross hide", `<svg viewBox="0 0 46 46"><circle class="ring" cx="23" cy="23" r="15"/><circle class="charge" cx="23" cy="23" r="19" stroke-dasharray="119.4" stroke-dashoffset="119.4"/><circle class="dot" cx="23" cy="23" r="2.2"/></svg>`);
    const rider = el("div", "rider hide", `<div class="role"></div><div class="bar"><i></i></div><div class="holding hide">◉ COMET <span class="pn"></span></div><div class="hint"></div>`);
    const radar = el("canvas", "radar hide");
    radar.width = 380;
    radar.height = 200;
    const toasts = el("div", "toasts");
    const bannerBox = el("div", "");
    const countdown = el("div", "countdown hide");

    // Arrival.
    const brand = el("div", "brand hide", `<div class="logo">Sky<em>hoop</em></div><div class="tag">Broom ball in the Oncyber bowl</div>`);
    const mountbar = el("div", "mountbar hide");
    const mountBtn = el("button", "btn primary", `Mount your broom <small>${touch ? "" : "E"}</small>`);
    mountBtn.onclick = () => press("interact");
    const diffBtn = el("button", "btn ghost", "");
    diffBtn.onclick = () => press("difficulty");
    const lobbyBtn = el("button", "btn ghost", "Lobby");
    lobbyBtn.onclick = () => press("exit");
    mountbar.append(mountBtn, diffBtn, lobbyBtn);
    const howto = el(
        "div",
        "howto hide",
        `<h3>How to play</h3>
<p><span class="ball" style="background:#e0552a"></span><b>Comet</b>: grab it, aim at one of the three hoops and hold <span class="key">LMB</span> to charge a throw. 10 points.</p>
<p><span class="ball" style="background:#3a3c44"></span><b>Bolts</b> hunt riders and knock the Comet loose. Roll out of the way with <span class="key">Q</span>.</p>
<p><span class="ball" style="background:#ffd36b"></span><b>The Wisp</b> appears after a while. Catch it for 30 and the match. <span class="key">Tab</span> flies your Finder.</p>
<p style="opacity:.8"><span class="key">W</span> fly · <span class="key">Mouse</span> steer · <span class="key">Shift</span> boost · <span class="key">Space</span>/<span class="key">C</span> up/down · <span class="key">RMB</span> pass · <span class="key">LMB</span> tackle</p>`
    );

    // Cards.
    const veil = el("div", "veil hide");
    const card = el("div", "card");
    veil.append(card);
    const fly = el("div", "veil clickfly hide", `<div class="card"><h2>Click to fly</h2><div class="sub">Your mouse steers the broom. Esc pauses.</div></div>`);
    fly.classList.add("on");
    fly.onclick = () => requestFly();

    // Touch controls.
    const touchBox = el("div", "touch hide");
    if (touch) buildTouch(touchBox, onAction, onDelta, press);

    root.append(loading, brand, howto, board, rider, radar, cross, toasts, bannerBox, countdown, mountbar, touchBox, veil, fly);

    let last = {};
    let bannerId = 0;
    const seenToasts = new Set();
    const show = (node, on) => node.classList.toggle("hide", !on);

    let cardKey = "";
    function cardFor(s) {
        const key = s.screen === "end" && s.result ? `end:${s.result.title}:${s.result.score}` : s.screen === "match" && s.paused ? `pause:${s.score}:${s.clock}` : "";
        if (!key) {
            cardKey = "";
            return false;
        }
        if (key === cardKey) return true;
        cardKey = key;
        if (s.screen === "end" && s.result) {
            const r = s.result;
            card.className = `card ${r.won ? "won" : ""}`;
            card.innerHTML = `<h2>${esc(r.title)}</h2><div class="sub">${esc(r.sub)}</div>
<div class="final"><span class="a">${r.score[0]}</span> – <span class="b">${r.score[1]}</span></div>
<div class="stats"><div><b>${r.stats.goals}</b>goals</div><div><b>${r.stats.shots}</b>shots</div><div><b>${r.stats.saves}</b>saves</div><div><b>${r.stats.steals}</b>steals</div></div>
<div class="row"><button class="btn primary" data-a="again">Play again <small>R</small></button><button class="btn" data-a="leave">Walk the pitch</button><button class="btn ghost" data-a="exit">Lobby</button></div>`;
            return true;
        }
        if (s.screen === "match" && s.paused) {
            card.className = "card";
            card.innerHTML = `<h2>Paused</h2><div class="sub">${esc(s.teams[0])} ${s.score[0]} – ${s.score[1]} ${esc(s.teams[1])} · ${esc(s.clock)}</div>
<div class="row"><button class="btn primary" data-a="resume">Resume</button><button class="btn" data-a="leave">Leave match</button><button class="btn ghost" data-a="exit">Lobby</button></div>`;
            return true;
        }
        return false;
    }
    card.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (!a) return;
        press(a);
        if (a === "resume" || a === "again") requestFly();
    });

    function drawRadar(s) {
        const c = radar.getContext("2d");
        const w = radar.width;
        const h = radar.height;
        c.clearRect(0, 0, w, h);
        c.strokeStyle = "rgba(255,248,236,0.25)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(w / 2, 10);
        c.lineTo(w / 2, h - 10);
        c.stroke();
        const X = (x) => w / 2 + x * (w / 2 - 14);
        const Y = (z) => h / 2 + z * (h / 2 - 10);
        for (const side of [-1, 1]) {
            c.fillStyle = side < 0 ? "#ff5a1f" : "#13b8c4";
            for (const z of [-0.24, 0, 0.24]) c.fillRect(X(side * 0.805) - 2, Y(z) - 5, 4, 10);
        }
        for (const [x, z, team, me] of s.radar) {
            c.fillStyle = team === 0 ? "#ff7a3d" : "#2fd6e0";
            c.beginPath();
            c.arc(X(x), Y(z), me ? 8 : 5.5, 0, Math.PI * 2);
            c.fill();
            if (me) {
                c.strokeStyle = "#fff";
                c.lineWidth = 3;
                c.stroke();
            }
        }
        if (s.comet) {
            c.fillStyle = "#fff1c9";
            c.beginPath();
            c.arc(X(s.comet[0]), Y(s.comet[1]), 4.5, 0, Math.PI * 2);
            c.fill();
        }
    }

    return {
        render(s) {
            const scr = s.screen;
            show(loading, scr === "loading");
            loading.querySelector("i").style.width = `${Math.round((s.boot || 0) * 100)}%`;
            const inMatch = scr === "match" || scr === "end";
            show(board, inMatch);
            show(rider, scr === "match");
            show(radar, scr === "match");
            show(cross, scr === "match" && !s.paused);
            show(brand, scr === "arrive");
            show(howto, scr === "arrive" && !touch);
            show(mountbar, scr === "arrive");
            show(touchBox, touch && (scr === "match" || scr === "arrive") && !s.paused);
            mountBtn.disabled = !s.canMount;
            diffBtn.textContent = `${s.difficulty[0].toUpperCase()}${s.difficulty.slice(1)} bots${touch ? "" : " · V"}`;
            if (inMatch) {
                const [a, b] = s.score;
                const s0 = board.querySelector(".s0");
                const s1 = board.querySelector(".s1");
                if (last.score && last.score[0] !== a) s0.classList.remove("bump"), void s0.offsetWidth, s0.classList.add("bump");
                if (last.score && last.score[1] !== b) s1.classList.remove("bump"), void s1.offsetWidth, s1.classList.add("bump");
                s0.textContent = a;
                s1.textContent = b;
                board.querySelector(".c").textContent = s.clock;
                const cl = board.querySelector(".cl");
                cl.textContent = s.wisp ? "WISP OUT" : "TIME";
                cl.classList.toggle("wisp", s.wisp);
            }
            if (scr === "match") {
                rider.querySelector(".role").innerHTML = `${esc(s.role)}<span>${esc(s.name)}</span>`;
                const bar = rider.querySelector(".bar");
                bar.querySelector("i").style.width = `${Math.round(s.stamina * 100)}%`;
                bar.classList.toggle("low", s.stamina < 0.25);
                show(rider.querySelector(".holding"), s.holding);
                rider.querySelector(".pn").textContent = s.passName ? `· pass → ${s.passName}` : "";
                const hint = touch
                    ? ""
                    : s.holding
                      ? `Hold <span class="key">LMB</span> throw · <span class="key">RMB</span> pass`
                      : s.role === "Finder"
                        ? `Chase the Wisp · <span class="key">LMB</span> lunge · <span class="key">Tab</span> back to Runner`
                        : `<span class="key">LMB</span> tackle the carrier · <span class="key">Q</span> roll · <span class="key">Tab</span> Finder`;
                rider.querySelector(".hint").innerHTML = hint;
                cross.querySelector(".charge").style.strokeDashoffset = String(119.4 * (1 - (s.holding ? s.charge : 0)));
                cross.classList.toggle("lock", !!s.aimHoop);
                drawRadar(s);
            }
            show(countdown, s.kickoff > 0 && s.kickoff <= 3);
            if (s.kickoff > 0) countdown.textContent = String(s.kickoff);
            // Banner, once per id.
            if (s.banner && s.banner.id !== bannerId) {
                bannerId = s.banner.id;
                bannerBox.innerHTML = "";
                const b = el("div", `banner ${s.banner.kind}`, `<h1>${esc(s.banner.text)}</h1>${s.banner.sub ? `<p>${esc(s.banner.sub)}</p>` : ""}`);
                bannerBox.append(b);
            }
            for (const t of s.toasts) {
                if (seenToasts.has(t.id)) continue;
                seenToasts.add(t.id);
                const n = el("div", `toast ${t.kind}`, esc(t.text));
                toasts.append(n);
                setTimeout(() => n.remove(), 3000);
            }
            const cardOn = cardFor(s);
            show(veil, cardOn);
            show(fly, scr === "match" && !s.paused && !touch && !isLocked());
            last = { score: s.score, cardOn, screen: s.screen, paused: s.paused };
        },
        refreshLock(s) {
            if (s) show(fly, s.screen === "match" && !s.paused && !touch && !isLocked());
        },
    };
}

function buildTouch(box, onAction, onDelta, press) {
    // Left stick: fly / walk.
    const stick = el("div", "stick", "<i></i>");
    const knob = stick.querySelector("i");
    let sid = null;
    const move = (e) => {
        const r = stick.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const m = Math.hypot(x, y);
        if (m > 1) (x /= m), (y /= m);
        knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
        onAction("moveX", x);
        onAction("moveY", -y);
    };
    stick.addEventListener("pointerdown", (e) => {
        sid = e.pointerId;
        stick.setPointerCapture(sid);
        move(e);
    });
    stick.addEventListener("pointermove", (e) => e.pointerId === sid && move(e));
    const end = (e) => {
        if (e.pointerId !== sid) return;
        sid = null;
        knob.style.transform = "";
        onAction("moveX", 0);
        onAction("moveY", 0);
    };
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
    // Right side: drag to steer.
    const look = el("div", "look");
    let lid = null;
    let lx = 0;
    let ly = 0;
    look.addEventListener("pointerdown", (e) => {
        lid = e.pointerId;
        look.setPointerCapture(lid);
        lx = e.clientX;
        ly = e.clientY;
    });
    look.addEventListener("pointermove", (e) => {
        if (e.pointerId !== lid) return;
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        lx = e.clientX;
        ly = e.clientY;
        onDelta("lookX", dx * 1.6);
        onDelta("lookY", dy * 1.6);
    });
    look.addEventListener("pointerup", () => (lid = null));
    // Buttons.
    const pad = el("div", "pad");
    const hold = (label, action, cls = "") => {
        const b = el("button", cls, label);
        b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            onAction(action, 1);
            if (action === "interact") onAction("interact", 1);
        });
        const up = () => onAction(action, 0);
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("pointerleave", up);
        return b;
    };
    pad.append(hold("ROLL", "roll"), hold("RISE", "up"), hold("SWAP", "swap"), hold("PASS", "pass"), hold("DIVE", "down"), hold("BOOST", "boost"), hold("FLY", "forward"), hold("THROW", "shoot", "big"), hold("MOUNT", "interact"));
    box.append(look, stick, pad);
    void press;
}
