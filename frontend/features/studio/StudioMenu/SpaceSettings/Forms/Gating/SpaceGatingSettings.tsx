import styled from "styled-components";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";

import {
    Form,
    FormInfo,
    FormLabel,
    FormLabelAction,
    FormLabelWrapper,
    FormSep,
} from "../styles/Form";
import { isGatingRuleEnabled, isSpaceGatingEnabled } from "./utils";
import { CurrentForm } from "./types";
import { Toggle } from "@features/studio/components/Toggle";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useState } from "react";

export interface SpaceGatingSettingsProps {
    goto: (form: CurrentForm) => () => unknown;
}

interface FormItemProps {
    label: string;
    action: string;
    disabled?: boolean;
    info: string;
    title?: string;
    onAction?: () => unknown;
}

const labelStyle = {
    fontWeight: 400,
    fontSize: "12px",
    lineHeight: "20px",
    color: "#7A7A7A",
};

function FormItem({
    label,
    action,
    disabled = false,
    info,
    title = "",
    onAction = () => {},
}: FormItemProps) {
    return (
        <Form>
            <FormInfo>{label}</FormInfo>
            <FormLabelWrapper>
                <FormLabel style={labelStyle}>{info}</FormLabel>
                <FormLabelAction
                    disabled={disabled}
                    onClick={onAction}
                    title={title}
                >
                    {action}
                </FormLabelAction>
            </FormLabelWrapper>
        </Form>
    );
}

export function SpaceGatingSettings({ goto }: SpaceGatingSettingsProps) {
    //
    const { gating, editGating, disableGating } = useSpaceGatingEditor();

    const [isGatingEnabled, setGatingEnabled] = useState(
        isSpaceGatingEnabled(gating)
    );

    const handleToggleGating = useEventCallback((enabled: boolean) => {
        //
        if (!enabled) {
            setGatingEnabled(false);
            disableGating();
        } else {
            setGatingEnabled(true);
        }
    }, []);

    const requiresLogin =
        gating.whitelist?.length > 0 || gating.nftOwnership?.length > 0;

    const handleToggleNoAnonymous = () => {
        editGating(
            {
                noAnonymous: !gating.noAnonymous,
            },
            "save"
        );
    };

    return (
        <Container>
            <Form>
                <FormInfo>Make your space private</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Set-up rules to exclusive events, private gatherings or
                        collection-specific galleries.
                    </FormLabel>
                    <Toggle
                        value={isGatingEnabled}
                        onChange={handleToggleGating}
                    />
                </FormLabelWrapper>
            </Form>

            <FormSep />

            <div className={`rules ${isGatingEnabled ? "" : "disabled"}`}>
                <FormItem
                    label="Allow access to owners of specific NFTs"
                    action={
                        isGatingRuleEnabled("nftOwnership", gating)
                            ? "Edit"
                            : "Enable"
                    }
                    info="Enable this rule to make your space a private gathering spot for owners of one or more collections"
                    onAction={goto("GatingNfts")}
                />

                <FormItem
                    label="Allow access on specific dates"
                    action={
                        isGatingRuleEnabled("date", gating) ? "Edit" : "Enable"
                    }
                    info="Enable this rule if you’re organizing a time-specific events (concert, party, talk-show..) to limit users from entering before the event."
                    onAction={goto("GatingDate")}
                />

                <FormItem
                    label="Allow access to a list of wallet addresses"
                    action={
                        isGatingRuleEnabled("whitelist", gating)
                            ? "Edit"
                            : "Enable"
                    }
                    info="Enable this rule to create private events with a few friends or add your whitelist for a massive private party."
                    onAction={goto("GatingWhitelist")}
                />

                <FormItem
                    label="Password protection"
                    action={
                        isGatingRuleEnabled("password", gating)
                            ? "Edit"
                            : "Enable"
                    }
                    info="Restrict access to visitors with a password"
                    onAction={goto("GatingPassword")}
                />

                {/* <FormItem
                label="Limit number of simultaneous visitors "
                action={gating.roomCapacity == null ? "Enable" : "Edit"}
                info="Enable this rule to keep control over the number of visitors that can enter your space at the same time."
                onAction={goto("GatingRoomCapacity")}
            /> */}

                <FormItem
                    label="Allow anonymous visitors"
                    action={gating.noAnonymous ? "Enable" : "Disable"}
                    disabled={requiresLogin}
                    info={
                        gating.noAnonymous
                            ? "Enabling this feature allows non-logged oncyber users to visit your space."
                            : "Disabling this feature requires oncyber users to login in order to visit your space."
                    }
                    title={
                        requiresLogin
                            ? "Anonymous users are not allowed when you enable whitelist or nft ownership rules"
                            : ""
                    }
                    onAction={handleToggleNoAnonymous}
                />
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;

    & > .rules {
        display: flex;
        flex-direction: column;
        gap: 24px;

        &.disabled {
            opacity: 0.3;
            pointer-events: none;
        }
    }
`;
