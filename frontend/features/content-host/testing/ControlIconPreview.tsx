import React from "react";
import styled from "styled-components";
import ExperienceControlIcon, {
    experienceControlIcons,
} from "@ui/components/ExperienceControlIcon";
import { experienceControl } from "../experienceChrome";

/** Development-only visual reference for the same artwork and material used by live docks. */
export default function ControlIconPreview() {
    return (
        <Strip aria-label="Shared control icon preview">
            {experienceControlIcons.map((name) => (
                <figure key={name}>
                    <button type="button" aria-label={name}>
                        <ExperienceControlIcon name={name} />
                    </button>
                    <figcaption>{name}</figcaption>
                </figure>
            ))}
        </Strip>
    );
}
const Strip = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: #e8e9ec;
    figure {
        margin: 0;
        display: grid;
        justify-items: center;
        gap: 8px;
    }
    button {
        ${experienceControl}
    }
    figcaption {
        font: 11px monospace;
        color: #a7aab2;
    }
`;
