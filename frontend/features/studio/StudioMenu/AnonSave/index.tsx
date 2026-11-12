import { NButton } from "@features/studio/components/StudioButton";

import { useContext, useEffect, useState } from "react";

import styled from "styled-components";
import { blueAction, compactActionSizing } from "@styles/brand";
import { actionTokens } from "@styles/tokens/action";

import { useStudioMenu } from "../context/StudioContext";

import useModal from "@components/modals/useModal";

import { UserContext } from "@components/context/UserContext";

import { HIT_ANON_LIMIT, isAnonDataValid } from "@utils/anon";

export default function AnonSave({}) {
    const { getModeStatus, worldMode, setWorldMode, exhibit, toggleAuth } =
        useStudioMenu();

    const { user } = useContext(UserContext);

    const [saving, setSaving] = useState(false);

    const status = getModeStatus("display");

    async function handleClick(hitLimit: boolean) {
        //
        if (!(await isAnonDataValid())) {
            console.log("DATA IS INVALIDDDDD!!!");
            console.log("DATA IS INVALIDDDDD!!!");
            console.log("DATA IS INVALIDDDDD!!!");
            console.log("DATA IS INVALIDDDDD!!!");
            return;
        }

        setSaving(true);

        toggleAuth(true, hitLimit);

        setSaving(false);
    }

    useEffect(() => {
        //
        function handleMessage(e: MessageEvent) {
            //
            if (e.origin !== window.location.origin) return;

            if (e.data?.type == HIT_ANON_LIMIT) {
                //
                handleClick(true);
            }
        }

        window.addEventListener("message", handleMessage, false);

        return () => {
            //
            window.removeEventListener("message", handleMessage, false);
        };
    }, []);

    return (
        <Container
            onClick={() => handleClick(false)}
            isActive={status === "active"}
            status={status}
        >
            <NButton size="small" className="action">
                <span>
                    {saving ? "Opening…" : "Sign in"}{" "}
                    <span aria-hidden="true">→</span>
                </span>
            </NButton>
        </Container>
    );
}

const Container = styled.div<{ isActive: boolean; status: string }>`
    position: relative;
    display: flex;

    /* The same button as the landing header's Sign in: same size, and the
       Oncyber Sans face rather than Studio's own font, so the arrow matches. */
    & > .action {
        cursor: pointer;
        height: 40px;
        ${compactActionSizing}
        font-family: ${actionTokens.type.family};
        text-align: center;
        ${blueAction}
        border: 0;
    }
`;
