import styled from "styled-components";

/** Complete generated artwork: both the paper and the raised T are in the image. */
export function TextToolArtwork() {
    return (
        <Artwork
            className="text-notepad"
            src="/studio-assets/text-notepad-v2.png"
            width={40}
            height={40}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    );
}

const Artwork = styled.img`
    display: block;
    width: 90%;
    height: 90%;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(0 2px 2px #00000030);
`;
