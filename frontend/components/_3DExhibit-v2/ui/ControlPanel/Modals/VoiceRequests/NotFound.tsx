import React from "react";
import {
    UtilityStack,
    UtilityButton,
} from "@features/content-host/NativeVisitorPanel";
import { usePanel } from "../../context/PanelProvider";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function NotFound() {
    const { setCurrentTab, clickRef } = usePanel();
    const { t } = useCyberTranslation();
    return (
        <UtilityStack ref={clickRef}>
            <h3>{t`NO_VOICE_REQUEST_TITLE`}</h3>
            <p>{t`NO_VOICE_REQUEST_DESCRIPTION`}</p>
            <UtilityButton
                type="button"
                onClick={() => setCurrentTab("")}
            >{t`CLOSE`}</UtilityButton>
        </UtilityStack>
    );
}
