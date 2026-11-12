import { useCyberTranslation } from "@components/context/I18nContext";
import React, { useState } from "react";
import styled, { css } from "styled-components";
import { ShareType, shareTwitter } from "../../../shared/shareSocial";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import SharePortrait from "./Portrait";
import ShareLandscape from "./Landscape";

const FAILURE_SHOWN_MS = 4000;

const SHARE_ITEMS = [
    {
        name: "TWITTER",
        type: ShareType.Twitter,
    },
    {
        name: "EMBED",
        type: ShareType.Embed,
    },
    {
        name: "COPY_LINK",
        type: ShareType.Link,
    },
];

export default function Share({ exhibit, visible, toggle }) {
    const [copied, setCopied] = useState({ type: null, msg: null });

    const { t } = useCyberTranslation();

    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => {
            //
            toggle(false);
        },
    });

    // The button that was pressed says what happened, in place of its label:
    // "Copied", or what failed. Pressing it again is the retry, so a failure
    // stays a little longer (docs/feedback.md).
    const handleShareClick = async (type: ShareType) => {
        const url = new URL(window.location.href).toString();
        let failed = false;
        if (type === ShareType.Twitter) {
            try {
                shareTwitter(url);
                setCopied({
                    type: ShareType.Twitter,
                    msg: t`SHARED`,
                });
            } catch (err) {
                console.log(err);
                failed = true;
                setCopied({
                    type: ShareType.Twitter,
                    msg: t`FAILED_TO_SHARE_TWITTER_LINK`,
                });
            }
        } else if (type === ShareType.Link) {
            try {
                await navigator.clipboard.writeText(url);
                setCopied({ type: ShareType.Link, msg: t`COPIED` });
            } catch (err) {
                console.log(err);
                failed = true;
                setCopied({
                    type: ShareType.Link,
                    msg: t`FAILED_TO_COPY_LINK`,
                });
            }
        } else if (type === ShareType.Embed) {
            try {
                const embedCode = `<iframe width="100%" height="100%" src="${url}"></iframe>`;
                await navigator.clipboard.writeText(embedCode);
                setCopied({ type: ShareType.Embed, msg: t`COPIED` });
            } catch (err) {
                console.log(err);
                failed = true;
                setCopied({
                    type: ShareType.Embed,
                    msg: t`FAILED_TO_COPY_EMBED_CODE`,
                });
            }
        }
        setTimeout(
            () => {
                setCopied(null);
            },
            failed ? FAILURE_SHOWN_MS : 1000
        );
    };

    const sharedProps = {
        copied,
        toggle,
        visible,
        SHARE_ITEMS,
        addTogglerRef,
        handleShareClick,
    };

    return (
        <Container ref={clickRef} isVisible={visible}>
            <ShareLandscape {...sharedProps} />
            <SharePortrait {...sharedProps} />
        </Container>
    );
}

const Container = styled.div<{ isVisible: boolean }>`
    @media (orientation: landscape) {
        ${(props) =>
            props.isVisible &&
            css`
                min-width: 100%;
            `}
    }
`;
