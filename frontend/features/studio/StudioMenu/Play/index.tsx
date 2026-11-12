import { StudioPlayIcon } from "../../components/StudioPlayIcon";
import styled from "styled-components";
import { useStudioMenu } from "../context/StudioContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { studioAction } from "../../styles/primitives";
import { blueAction } from "@styles/brand";

export function Play() {
    const { exhibit, baseAnalyticsEvent } = useStudioMenu();
    const slug = exhibit.info.customLink;
    const href = slug ? `/${slug}` : `/spaces/${exhibit.id}`;

    return (
        <PreviewLink
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
                amplitude_logAnalyticsEvent("click_preview", baseAnalyticsEvent)
            }
        >
            Preview
            <StudioPlayIcon size={16} />
        </PreviewLink>
    );
}

const PreviewLink = styled.a`
    ${studioAction}
    min-width: 108px;
    min-height: 40px;
    padding: 8px 16px;
    margin-left: 8px;
    font-weight: 500;
    white-space: nowrap;
    border-radius: 999px;
    ${blueAction}
    svg {
        flex-shrink: 0;
    }
    @media (max-width: 600px) {
        min-width: 0;
        min-height: 44px;
        margin-left: 0;
        padding: 8px 12px;
        gap: 6px;
    }
`;
