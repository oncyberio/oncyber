import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

type Person = { uid: string; name: string; online?: boolean };
type Snapshot = {
    code: string;
    friends: Person[];
    incoming: Person[];
    outgoing: Person[];
    blocked: Person[];
    privacy: { presence: "friends" | "nobody"; activity: "friends" | "nobody"; friendRequests: "everyone" | "nobody" };
};

export default function FriendsPanel({ onClose }: { onClose(): void }) {
    const [data, setData] = useState<Snapshot>(null);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const dialog = useRef<HTMLDivElement>(null);
    const controller = useRef<AbortController>(null);
    const revision = useRef(0);
    const working = useRef(false);
    const call = useCallback(async (operation: string, input = {}) => {
        const response = await fetch("/api/social", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...input, operation }), signal: controller.current?.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error === "UNKNOWN_CODE" ? "That friend code was not found." : response.status === 401 ? "Please sign in again." : "Could not update friends. Please try again.");
        return result;
    }, []);
    const load = useCallback(async () => {
        const current = ++revision.current;
        try {
            const next = await call("snapshot");
            if (current === revision.current && !controller.current?.signal.aborted) { setData(next); setError(""); }
        } catch (reason) {
            if (current === revision.current && !controller.current?.signal.aborted) setError(reason.message);
        }
    }, [call]);
    useEffect(() => {
        controller.current = new AbortController();
        const previous = document.activeElement as HTMLElement;
        document.exitPointerLock?.();
        dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
        void load();
        const timer = setInterval(() => { if (!working.current && document.visibilityState !== "hidden") void load(); }, 5000);
        return () => { controller.current.abort(); revision.current++; clearInterval(timer); previous?.focus?.(); };
    }, [load]);
    const mutate = async (operation: string, input = {}) => {
        if (working.current) return;
        working.current = true; revision.current++;
        setBusy(true); setError(""); setNotice("");
        try {
            const result = await call(operation, input);
            if (controller.current.signal.aborted) return;
            if (operation === "request") { setCode(""); setNotice(result.status === "friends" ? "You are already friends." : "Friend request sent."); }
            await load();
        } catch (reason) { if (!controller.current.signal.aborted) setError(reason.message); }
        finally { working.current = false; if (!controller.current.signal.aborted) setBusy(false); }
    };
    const action = (label: string, operation: string, person: Person) => <button type="button" disabled={busy} onClick={() => void mutate(operation, { uid: person.uid })}>{label}</button>;
    return <Backdrop><Panel ref={dialog} role="dialog" aria-modal="true" aria-label="Friends" onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Tab") {
            const controls = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }}>
        <header><h2>Friends</h2><button type="button" onClick={onClose} aria-label="Close friends">Close</button></header>
        <p>Keep your friends with you across Oncyber worlds.</p>
        {error && <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
        {!data && !error && <p role="status">Loading friends…</p>}
        {data && <>
            <label>Your friend code<input aria-label="Your friend code" readOnly value={data.code} onFocus={(event) => event.target.select()} /></label>
            <form onSubmit={(event) => { event.preventDefault(); if (code.trim()) void mutate("request", { code: code.trim() }); }}>
                <label>Add a friend<input aria-label="Friend code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} placeholder="Enter their friend code" /></label>
                <button disabled={busy || !code.trim()}>Send request</button>
            </form>
            {notice && <p role="status">{notice}</p>}
            <h3>Requests</h3>
            {!data.incoming.length && !data.outgoing.length && <p>No pending requests.</p>}
            {data.incoming.map(person => <div className="person" key={person.uid}><span>{person.name}</span>{action("Accept", "accept", person)}{action("Decline", "decline", person)}{action("Block", "block", person)}</div>)}
            {data.outgoing.map(person => <div className="person" key={person.uid}><span>{person.name}<small>Request sent</small></span>{action("Cancel", "cancel", person)}</div>)}
            <h3>Your friends</h3>
            {!data.friends.length && <p>Share your code to add your first friend.</p>}
            {data.friends.map(person => <div className="person" key={person.uid}><span>{person.name}<small>{person.online ? "Online" : "Offline"}</small></span>{action("Remove", "remove", person)}{action("Block", "block", person)}</div>)}
            <h3>Privacy</h3>
            <label className="check"><input type="checkbox" checked={data.privacy.presence === "friends"} disabled={busy} onChange={(event) => void mutate("privacy", { presence: event.target.checked ? "friends" : "nobody" })} />Show friends when I’m online</label>
            <label className="check"><input type="checkbox" checked={data.privacy.activity === "friends"} disabled={busy} onChange={(event) => void mutate("privacy", { activity: event.target.checked ? "friends" : "nobody" })} />Share my activity with friends</label>
            <label className="check"><input type="checkbox" checked={data.privacy.friendRequests === "everyone"} disabled={busy} onChange={(event) => void mutate("privacy", { friendRequests: event.target.checked ? "everyone" : "nobody" })} />Accept new friend requests</label>
            {!!data.blocked.length && <><h3>Blocked accounts</h3>{data.blocked.map(person => <div className="person" key={person.uid}><span>{person.name}</span>{action("Unblock", "unblock", person)}</div>)}</>}
        </>}
    </Panel></Backdrop>;
}

const Backdrop = styled.div`position:fixed;inset:0;z-index:16000;background:#0009;display:grid;place-items:center;padding:24px;pointer-events:auto;`;
const Panel = styled.div`width:min(480px,100%);max-height:85svh;overflow:auto;background:#191919;border:1px solid #ffffff18;border-radius:24px;padding:24px;color:#e8e9ec;font:14px Aeonik,system-ui,sans-serif;box-sizing:border-box;header{display:flex;justify-content:space-between;align-items:center;gap:16px;}h2{margin:0;font-size:24px;font-weight:500;}h3{font-size:15px;margin:24px 0 12px;}p,small{color:#a6a6ad;line-height:1.5;}label{display:block;margin:12px 0;}input:not([type=checkbox]){display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:12px;color:inherit;background:#242424;border:1px solid #ffffff24;border-radius:10px;font:inherit;}button{padding:8px 12px;border:1px solid #ffffff24;background:#2c2c2c;border-radius:10px;color:inherit;font:inherit;cursor:pointer;}button:disabled{opacity:.45;cursor:default;}button:focus-visible,input:focus-visible{outline:2px solid #d3ec42;outline-offset:2px;}.person{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #ffffff0a;}.person>span{flex:1;min-width:0;overflow-wrap:anywhere;}.person small{display:block;font-size:11px;}.check{display:flex;gap:10px;align-items:center;}[role=alert]{color:#ffb1a5;}@media(max-width:480px){padding:18px;.person{flex-wrap:wrap;}.person>span{flex-basis:100%;}}`;
