import { useState } from "react";
import { AssetIcon } from "./AssetIcon";

/** Always paint a globe, including before the small color asset has decoded. */
export function WorldToolArtwork() {
    const [ready, setReady] = useState(false);
    return (
        <span className="world-globe" aria-hidden="true">
            {!ready && <AssetIcon name="iframe" size={32} />}
            <img
                src="/studio-assets/world-globe.webp"
                width={44}
                height={44}
                alt=""
                draggable={false}
                loading="eager"
                decoding="sync"
                style={{ visibility: ready ? "visible" : "hidden" }}
                onLoad={() => setReady(true)}
                onError={() => setReady(false)}
            />
        </span>
    );
}
