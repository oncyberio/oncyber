import {
    UtilityStack,
    UtilityButton,
} from "@features/content-host/NativeVisitorPanel";
import { useCyberTranslation } from "@components/context/I18nContext";
import IconImg from "@ui/components/IconImg";

import styled from "styled-components";

export default function Submitted({ setCurrentTab, title, subtitle }) {
    const { t } = useCyberTranslation();

    return (
        <SubmittedContainer>
            <CheckWrapper>
                <IconImg name="check" mode="light" />
            </CheckWrapper>
            <p className="title">{title}</p>
            <p className="subtitle">{subtitle}</p>
            <UtilityButton $primary onClick={() => setCurrentTab("")}>
                {t`GOTIT`}
            </UtilityButton>
        </SubmittedContainer>
    );
}

const SubmittedContainer = styled(UtilityStack)`
    align-items: flex-start;
    .title {
        font-size: 16px;
        font-weight: 500;
        color: var(--oc-ink);
    }
    .subtitle {
        font-size: 13px;
    }
    > button {
        align-self: stretch;
    }
`;

const CheckWrapper = styled.div`
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: #ffffff0a;
`;
