import React from "react";
import styled from "styled-components";

export function CyberOrbit({ className = "" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 128 128" aria-hidden="true">
            <image
                href="/brand/cyberloop-still.webp"
                width="128"
                height="128"
            />
        </svg>
    );
}

export function OncyberLockup() {
    return (
        <Lockup role="img" aria-label="Oncyber">
            <CyberOrbit className="logomark" />
            <img
                src="/brand/oncyber-wordmark-white.png"
                width="100"
                height="13"
                alt=""
            />
        </Lockup>
    );
}

const Lockup = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 34px;

    img {
        display: block;
        width: 100px;
        height: auto;
    }

    .logomark {
        display: block;
        flex-shrink: 0;
        width: 34px;
        height: 34px;
    }

    @media (min-width: 601px) and (max-width: 900px) {
        img {
            display: none;
        }
    }
`;
