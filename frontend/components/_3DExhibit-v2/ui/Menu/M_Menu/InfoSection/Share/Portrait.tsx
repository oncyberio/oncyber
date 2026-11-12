import React from "react";
import styled from "styled-components";
import { NButton } from "@ui/components/NButton";
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
            <NButton
                overrideTheme={"dark"}
                size="small"
                outline={true}
                className="btn-guest"
                style={{ outline: "none" }}
                ref={(el) => {
                    addTogglerRef("share", el);
                }}
                onClick={() => toggle((prevState) => !prevState)}
            >
                {t`SHARE`}
            </NButton>

            <AnimatePresence>
                {visible && (
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
                                        onClick={() => handleShareClick(type)}
                                    >
                                        {copied?.type === type
                                            ? copied?.msg
                                            : t(name)}
                                    </NButton>
                                );
                            })}
                        </Wrapper>
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
}

const Container = styled.div`
    position: relative;

    @media (orientation: landscape) {
        display: none;
    }

    @media (orientation: portrait) {
        display: block;
    }
`;

const Wrapper = styled.div`
    width: 100%;
    display: flex;
    position: absolute;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    bottom: 50px;
    gap: 12px;
`;
