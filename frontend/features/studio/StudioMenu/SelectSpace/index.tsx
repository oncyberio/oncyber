import { useContext } from "react";
import styled from "styled-components";
import Link from "next/link";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { TextMenuCaption } from "@features/studio/components/TextMenuCaption";
import { UserContext } from "@components/context/UserContext";
import { useStudioMenu } from "../context/StudioContext";
import { SpaceList } from "./SpaceList";

export function SelectSpace({ onChangeSpace, onCreateSpace, className = "" }) {
    const { exhibit, toggleAuth } = useStudioMenu();
    const { isAnonymous } = useContext(UserContext);
    const name = exhibit?.info?.headline || "Untitled";
    return (
        <CustomDropdown
            caption={
                <TextMenuCaption style={{ maxWidth: 160 }}>
                    {name}
                </TextMenuCaption>
            }
            padding={30}
            className={className}
        >
            {({ toggle }) =>
                isAnonymous ? (
                    <GuestWorlds aria-label="Current world">
                        <span className="label">Current world</span>
                        <strong>{name}</strong>
                        <span className="draft">Local draft</span>
                        <button
                            type="button"
                            onClick={() => {
                                toggle(false);
                                toggleAuth(true);
                            }}
                        >
                            Sign in to access your worlds
                        </button>
                        <Link href="/?create=gallery">
                            Browse gallery templates
                        </Link>
                    </GuestWorlds>
                ) : (
                    <SpaceList
                        onCreateSpace={(isEmpty) => {
                            toggle(false);
                            onCreateSpace(isEmpty);
                        }}
                        onChangeSpace={(nextExhibit) => {
                            toggle(false);
                            onChangeSpace(nextExhibit);
                        }}
                    />
                )
            }
        </CustomDropdown>
    );
}
const GuestWorlds = styled.div`
    width: min(300px, calc(100vw - 32px));
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--panel-bg, #202024);
    color: var(--studio-ink, #f2f2f3);
    border: var(--panel-border, 1px solid #ffffff20);
    border-radius: var(--radius-panel, 12px);
    box-shadow: var(--panel-shadow);
    strong {
        overflow-wrap: anywhere;
    }
    .label,
    .draft {
        color: var(--panel-text-muted, #a0a0a8);
        font-size: 12px;
    }
    button,
    a {
        padding: 10px;
        border: 0;
        border-radius: 8px;
        background: var(--studio-surface, #303036);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 2px;
    }
`;
