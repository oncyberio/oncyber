import { useCallback, useState } from "react";
import styled from "styled-components";

// Local copy of Oncyber's standard Summer portrait (finalsun_ipz0ru.png).
// The fallback must not depend on the profile's image host or IPFS gateway.
export const DEFAULT_PROFILE_PORTRAIT = "/images/summer-profile.png";

/** Decorative portrait; the surrounding account control owns its accessible name. */
export default function ProfilePortrait({
    src,
    className,
}: {
    src?: string;
    className?: string;
}) {
    const source = typeof src === "string" ? src.trim() : "";
    return (
        <Frame className={className} aria-hidden="true">
            {source && source !== DEFAULT_PROFILE_PORTRAIT && (
                <PortraitImage key={source} src={source} />
            )}
        </Frame>
    );
}

function PortraitImage({ src }: { src: string }) {
    const [loaded, setLoaded] = useState(false);
    const checkImage = useCallback((image: HTMLImageElement | null) => {
        if (image) setLoaded(image.complete && image.naturalWidth > 0);
    }, []);
    return (
        <img
            ref={checkImage}
            src={src}
            alt=""
            width={40}
            height={40}
            decoding="async"
            style={{ visibility: loaded ? "visible" : "hidden" }}
            onLoad={(event) => checkImage(event.currentTarget)}
            onError={() => setLoaded(false)}
        />
    );
}

const Frame = styled.span`
    position: relative;
    display: inline-block;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 50%;
    background: #648694 url(${DEFAULT_PROFILE_PORTRAIT}) center / cover
        no-repeat;
    img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: var(--oc-surface, #14161b);
    }
`;
