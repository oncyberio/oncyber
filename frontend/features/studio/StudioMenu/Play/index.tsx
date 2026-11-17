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
            aria-label="Preview"
            onClick={() =>
                amplitude_logAnalyticsEvent("click_preview", baseAnalyticsEvent)
            }
        >
            <span className="label">Preview</span>
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
        min-height: 36px;
        margin-left: 0;
        padding: 6px 12px;
        gap: 6px;
        font-size: 13px;
    }
    /* Small phones: the play mark alone keeps the header on one row. */
    @media (max-width: 380px) {
        width: 36px;
        padding: 0;
        justify-content: center;
        .label {
            display: none;
        }
    }
`;
