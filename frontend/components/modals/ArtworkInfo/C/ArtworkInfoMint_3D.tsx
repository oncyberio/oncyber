import React, { useRef } from "react";
import styled from "styled-components";
import Confetti from "react-confetti";
import { ArtworkInfoProps } from "../types";
import { ArtworkInfoMint_Data } from "./ArtworkInfoMint_Data";
import { useMint } from "@components/_3DExhibit-v2/ui/ControlPanel/Mint/MintProvider";
import { ArtworkDialog } from "./ArtworkDialog";

export const ArtworkInfoMint_3D: React.FC<ArtworkInfoProps> = ({ toggle }) => {
    const { currentMint, mintProviders, toggleAuth } = useMint();
    const assetInfoRef = useRef<HTMLDivElement>(null);
    const metadata = mintProviders?.[currentMint?.id]?.metadata;
    return (
        <>
            <ArtworkDialog
                onClose={() => toggle(false)}
                tokenLink={metadata?.token}
                preview={
                    <img
                        src={metadata?.image}
                        alt={metadata?.name || "Mint preview"}
                    />
                }
            >
                {!currentMint?.name && (
                    <MintInfo>
                        You need to{" "}
                        <button type="button" onClick={toggleAuth}>
                            sign in
                        </button>{" "}
                        to see mint info.
                    </MintInfo>
                )}
                <ArtworkInfoMint_Data themeDark assetInfoRef={assetInfoRef} />
            </ArtworkDialog>
            {currentMint?.state === "minted" && (
                <Confetti gravity={0.15} numberOfPieces={400} run />
            )}
        </>
    );
};
const MintInfo = styled.p`
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--oc-secondary);
    button {
        border: 0;
        padding: 0;
        background: none;
        color: var(--oc-ink);
        text-decoration: underline;
        cursor: pointer;
    }
`;
