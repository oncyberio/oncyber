import React from "react";
import styled, { css } from "styled-components";
import { NButton } from "@ui/components/NButton";
import { IconButton } from "@ui/components/IconButton";
import { useCyberTranslation } from "@components/context/I18nContext";
import { AnimatePresence, motion } from "framer-motion";

export default function SharePortrait({
    SHARE_ITEMS,
    handleShareClick,
    copied,
    addTogglerRef,
    visible,
    toggle,
}) {
    const { t } = useCyberTranslation();

    return (
        <Container>
            <Wrapper>
                {visible ? (
                    <IconButton
                        outline
                        mode="light"
                        size="small"
                        name="x"
                        ref={(el) => {
                            addTogglerRef("share", el);
                        }}
                        style={{ border: "1px solid #a9a9a9" }}
                        onClick={() => toggle((prevState) => !prevState)}
                    />
                ) : (
                    <NButton
                        overrideTheme={"dark"}
                        size="small"
                        outline={true}
                        className="btn-guest"
                        style={{ outline: "none" }}
                        onClick={() => toggle((prevState) => !prevState)}
                    >
                        {t`SHARE`}
                    </NButton>
                )}

                {visible && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.08 }}
                        >
                            <Wrapper>
                                {SHARE_ITEMS.map(({ name, type }, index) => {
                                    return (
                                        <NButton
                                            key={index}
                                            overrideTheme={"dark"}
                                            size="small"
                                            outline={true}
                                            className="btn-guest"
                                            style={{ outline: "none" }}
                                            onClick={() =>
                                                handleShareClick(type)
                                            }
                                        >
                                            {copied?.type === type
                                                ? copied?.msg
                                                : t(name)}
                                        </NButton>
                                    );
                                })}
                            </Wrapper>
                        </motion.div>
                    </AnimatePresence>
                )}
            </Wrapper>
        </Container>
    );
}

const Container = styled.div`
    position: relative;
    width: 100%;

    @media (orientation: portrait) {
        display: none;
    }

    @media (orientation: landscape) {
        display: block;
    }
`;

const Wrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 12px;
    min-width: 100%;
`;
