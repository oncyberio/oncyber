/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AgoraChannel } from "./AgoraChannel";
import { AUDIO_LOW_BAR } from "./levels";
import { Events, TypedEmitter, VolumeStats } from "./types";
import VoiceLevelDebug from "./VoiceLevelDebug";

jest.mock("./WebRTCClient", () => ({
    WebRTCClient: { instance: { uid: "me" } },
}));

/** The part of the voice service the readout uses, with a real mic channel. */
function voiceService() {
    const service: any = new TypedEmitter();
    const mic = new AgoraChannel(service, {
        type: "mic",
        isPrimary: true,
        enableVolumeStats: true,
    });
    (mic as any).client = { uid: "me" };
    service.channels = { mic };
    jest.spyOn(service, "on");
    jest.spyOn(service, "off");
    return service;
}
const stats = (level: number, isActive: boolean): VolumeStats => ({
    level,
    isActive,
    inactiveTime: 0,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let service: any;
const render = (voice = service) =>
    act(() => root.render(<VoiceLevelDebug voiceService={voice} />));
const sample = (volumes: Record<string, VolumeStats>, channel = "mic") =>
    act(() => {
        service.emit(Events.VOLUME_INDICATOR, {
            channel,
            volumes,
            threshold: service.channels.mic.audioLowBar,
        });
    });
const readout = () => container.querySelector("[data-voice-debug]");
const row = (id: string) =>
    Array.from(
        container.querySelectorAll(`tr[data-session="${id}"] td`),
        (cell) => cell.textContent
    );
const threshold = () =>
    container.querySelector("[data-voice-debug-threshold]").textContent;
const visit = (url: string) => window.history.replaceState({}, "", url);

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    service = voiceService();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    visit("/");
    jest.restoreAllMocks();
});

test("without voiceDebug in the URL it shows nothing and listens to nothing", () => {
    visit("/my-space?voice=1");
    render();
    sample({ me: stats(0.8, true) });

    expect(container.innerHTML).toBe("");
    expect(service.on).not.toHaveBeenCalled();
    expect(service.channels.mic.audioLowBar).toBe(AUDIO_LOW_BAR);
});

test("with voiceDebug it lists each person's level, decibels and whether they count as speaking", () => {
    visit("/my-space?voiceDebug");
    render();
    expect(readout().textContent).toContain("No microphone measured yet.");
    expect(threshold()).toBe("Speaking above 0.50 (-50.0 dB)");

    sample({
        zoe: stats(0.31, false),
        me: stats(0.62, true),
        ann: stats(0, false),
    });

    // one row per session, in a stable order
    expect(
        Array.from(
            container.querySelectorAll("tr[data-session]"),
            (el) => (el as HTMLElement).dataset.session
        )
    ).toEqual(["ann", "me", "zoe"]);
    expect(row("me").slice(0, 4)).toEqual([
        "me (you)",
        "0.62",
        "-38.0 dB",
        "speaking",
    ]);
    expect(row("zoe").slice(0, 4)).toEqual([
        "zoe",
        "0.31",
        "-69.0 dB",
        "quiet",
    ]);
    expect(row("ann").slice(0, 4)).toEqual([
        "ann",
        "0.00",
        "-100 dB or less",
        "quiet",
    ]);
    expect(
        container
            .querySelector('tr[data-session="me"]')
            .getAttribute("data-speaking")
    ).toBe("true");
    expect(service.channels.mic.audioLowBar).toBe(AUDIO_LOW_BAR);
});

test("it follows every sample, and people who leave drop out", () => {
    visit("/my-space?voiceDebug");
    render();
    const volumes = { me: stats(0.62, true), zoe: stats(0.31, false) };
    sample(volumes);

    // the channel updates the same objects in place
    volumes.me.level = 0.2;
    volumes.me.isActive = false;
    delete volumes.zoe;
    sample(volumes);

    expect(row("me").slice(1, 4)).toEqual(["0.20", "-80.0 dB", "quiet"]);
    expect(row("zoe")).toEqual([]);
});

test("it is hidden from screen readers and lets clicks through", () => {
    visit("/my-space?voiceDebug");
    render();
    sample({ me: stats(0.62, true) });

    const panel = readout() as HTMLElement;
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.querySelector("[aria-live], [role]")).toBeNull();
    expect(panel.querySelector("button, a, input, [tabindex]")).toBeNull();
    expect(getComputedStyle(panel).pointerEvents).toBe("none");
});

test("voiceDebug=<level> tries that threshold while the readout is up", () => {
    visit("/my-space?voiceDebug=0.42");
    render();

    expect(service.channels.mic.audioLowBar).toBe(0.42);
    expect(threshold()).toBe(
        "Speaking above 0.42 (-58.0 dB), trying it: the code has 0.50"
    );

    act(() => root.unmount());
    expect(service.channels.mic.audioLowBar).toBe(AUDIO_LOW_BAR);
    expect(service.off).toHaveBeenCalledTimes(1);
    expect(service.off.mock.calls[0]).toEqual(service.on.mock.calls[0]);
    root = createRoot(container);
});

test("voiceDebug=<decibels> tries the same threshold given in decibels", () => {
    visit("/my-space?voiceDebug=-58");
    render();

    expect(service.channels.mic.audioLowBar).toBeCloseTo(0.42);
    expect(threshold()).toContain("Speaking above 0.42 (-58.0 dB)");
});

test("a value that is not a threshold only shows the readout", () => {
    visit("/my-space?voiceDebug=loud");
    render();

    expect(readout()).not.toBeNull();
    expect(service.channels.mic.audioLowBar).toBe(AUDIO_LOW_BAR);
    expect(threshold()).toBe("Speaking above 0.50 (-50.0 dB)");
});

test("the threshold shown is the one the channel reports with its samples", () => {
    visit("/my-space?voiceDebug");
    render();

    service.channels.mic.setAudioLowBar(0.6);
    sample({ me: stats(0.62, true) });

    expect(threshold()).toContain("Speaking above 0.60 (-40.0 dB)");
});

test("screen share audio is not listed", () => {
    visit("/my-space?voiceDebug");
    render();

    sample({ me: stats(0.9, true) }, "stream");

    expect(row("me")).toEqual([]);
});

test("a place without a voice service shows nothing", () => {
    visit("/my-space?voiceDebug");
    render(null);

    expect(container.innerHTML).toBe("");
});
