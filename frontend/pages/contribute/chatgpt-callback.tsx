import { useEffect, useState } from "react";
import { CALLBACK_CHANNEL } from "@features/contribute/chatgpt";

/**
 * Where Sign in with ChatGPT returns. Hands the code to the Oncyber tab that
 * started the sign-in (a same-origin channel) and closes.
 */
export default function ChatGPTCallback() {
    const [message, setMessage] = useState("Finishing sign-in…");
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const channel = new BroadcastChannel(CALLBACK_CHANNEL);
        channel.postMessage({
            code: params.get("code"),
            state: params.get("state"),
            error: params.get("error"),
            error_description: params.get("error_description"),
        });
        channel.close();
        setMessage("Signed in. You can close this window.");
        window.close();
    }, []);
    return (
        <p style={{ padding: 24, fontFamily: "sans-serif", color: "#999" }}>
            {message}
        </p>
    );
}
