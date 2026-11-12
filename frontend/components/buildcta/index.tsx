import IconImg from "@ui/components/IconImg";
import { GradientButton } from "@ui/components/NButton/GradientButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Link from "next/link";

import styled from "styled-components";

export default function BuildCTA() {
    return (
        <BuildCTAWrapper>
            <IconImg size={42} name="cyber" />
            <p>BUILD YOUR OWN WORLD, EXPERIENCE With OTHERS</p>
            <Link href="/templates">
                <GradientButton
                    onClick={() => {
                        amplitude_logAnalyticsEvent("clicked_create_world_cta");
                    }}
                    spanStyle={{ background: "#f5f5f5" }}
                >
                    Start Your World
                </GradientButton>
            </Link>
        </BuildCTAWrapper>
    );
}

const BuildCTAWrapper = styled.div`
    background: #f5f5f5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px;

    p {
        align-items: center;
        text-align: center;
        letter-spacing: -0.02em;
        text-transform: uppercase;
        color: #000000;
        font-weight: 600;
        font-size: 28px;
        min-width: 10em;
        width: 10em;
        line-height: 0.92;
    }

    @media (max-width: 980px) {
        p {
            font-size: 21px;
        }
    }
`;
