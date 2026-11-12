import { useCyberTranslation } from "@components/context/I18nContext";
import useLocalStorage from "@components/hooks/useLocalStorage";
import { IconButton } from "@ui/components/IconButton";
import { promptGlass } from "@ui/components/PromptGlass";

import styled, { css } from "styled-components";

export default function Interactive({
    pause,
    close,
    isChatDisplayed,
    isChatActive,
    sharedChrome = false,
}) {
    const { value: isHelperHidden, setValue: setHelperHidden } =
        useLocalStorage({
            key: "chat_helper",
            defaultValue: false,
        });

    const { t } = useCyberTranslation();

    return (
        <Container
            data-shared-chrome={sharedChrome || undefined}
            isChatDisplayed={isChatDisplayed}
            isChatActive={isChatActive}
        >
            <BackIcon tabIndex={-1} id="close-chat" onClick={close}>
                <IconButton
                    immersed={true}
                    size="medium"
                    name="x"
                    mode="light"
                />
            </BackIcon>

            <BackIcon tabIndex={-1} id="pause" onClick={pause}>
                <IconButton
                    immersed={true}
                    size="medium"
                    name="arrow-left"
                    mode="light"
                />
            </BackIcon>

            {!isHelperHidden ? (
                <HelperBar className="interaction-helper">
                    <img
                        src="/v2/icons/pointer.svg"
                        alt=""
                        aria-hidden="true"
                    />
                    <p>{t`CLICK_ANYWHERE_ON_THE_SCREEN_TO_MOVE`}.</p>
                    <button
                        type="button"
                        aria-label="Dismiss movement hint"
                        onClick={() => setHelperHidden(true)}
                    >
                        <img src="/v2/icons/close.svg" alt="" />
                    </button>
                </HelperBar>
            ) : null}
        </Container>
    );
}

const Container = styled.div<{
    isChatDisplayed: boolean;
    isChatActive: boolean;
}>`
    &[data-shared-chrome] #pause,
    &[data-shared-chrome] #close-chat {
        display: none;
    }
    #close-chat {
        display: none;
    }

    #pause {
        display: flex;
    }

    @media (max-width: 760px) {
        ${(props) =>
            props.isChatDisplayed &&
            props.isChatActive &&
            css`
                #close-chat {
                    display: flex;
                }

                #pause {
                    display: none;
                }
                //
            `}
    }
`;

const BackIcon = styled.div`
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border-radius: 40px;
    outline: none;
    border: 0;

    color: white;

    cursor: pointer;

    position: absolute;

    top: 25px;
    left: 25px;

    img {
        width: 100%;
    }

    button {
        background: linear-gradient(
            201.23deg,
            rgba(7, 7, 7, 0.3) 4.03%,
            rgba(23, 24, 26, 0.24) 94%
        ) !important;
    }

    box-shadow: 0px 27px 30px rgb(0 0 0 / 25%), 0px 4px 4px rgb(0 0 0 / 11%);
`;

const HelperBar = styled.div`
    ${promptGlass}
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: fixed;
    top: max(80px, calc(env(safe-area-inset-top) + 76px));
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100vw - 32px);
    min-height: 36px;
    box-sizing: border-box;
    padding: 6px 10px 6px 14px;
    border-radius: 999px;

    p {
        min-width: 0;
        margin: 0;
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
        text-align: center;
        overflow-wrap: anywhere;
    }

    > img {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }

    button {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        color: inherit;
        cursor: pointer;
        img {
            width: 12px;
            height: 12px;
        }
        &:hover {
            background: #ffffff12;
        }
        &:focus-visible {
            outline: 2px solid currentColor;
            outline-offset: 2px;
        }
    }
`;
