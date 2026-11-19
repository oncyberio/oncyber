import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Toggle } from "@features/studio/components/Toggle";
import {
    Form,
    FormInfo,
    FormLabel,
    FormSep,
    FormLabelWrapper,
} from "../styles/Form";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Dropdown from "@ui/components/Dropdown";
import Input from "@ui/components/Input";
import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { tx } from "@components/context/I18nContext";
import {
    MAXIMUM_VRM_BOX,
    MINIMUM_VRM_BOX,
    avatarHeightToSize,
    avatarSizeToHeight,
} from "@components/_3DExhibit-v2/three/utils/avatarHeight";

const labelStyle = {
    fontWeight: 400,
    fontSize: "12px",
    lineHeight: "20px",
    color: "#7A7A7A",
};

export function Permissions() {
    //
    const { exhibit, exhibitStore, userRole, baseAnalyticsEvent, destination } =
        useCurrentExhibit();

    const params = exhibit.params || {};

    const canEdit = userRole === "owner" || userRole === "admin-curator";

    const tag = {
        soloExperience: "solo-experience",
        voiceAllowed: "voice-allowed",
        editionAllowed: "edition-allowed",
        cameraPersonView: "camera-person-view",
        avatarSize: "avatar-size",
    };

    // Shown in metres and saved as a size from 0 to 1. It starts from the
    // space's own size, or else the one its destination was saved with.
    const [avatarHeight, setAvatarHeight] = useState<number>(() =>
        avatarSizeToHeight(params?.avatarSize || destination?.avatarSize || 0.5)
    );
    const debouncedAvatarHeight = useDebouncedValue(avatarHeight, 500);

    const handleChangeOption = useEventCallback(
        async (setting: string, value: any) => {
            //
            if (!canEdit) return;

            exhibitStore.updateExhibitParams({
                [setting]: value,
            });

            const tagOfSetting = tag[setting];

            amplitude_logAnalyticsEvent(
                `set-${tagOfSetting}-to-${value}`,
                baseAnalyticsEvent
            );
        },
        []
    );

    // Only a height the owner typed is saved. Opening this tab used to save
    // the size on show, which replaced the destination's with 0.5.
    const savedAvatarHeight = useRef(avatarHeight);

    useEffect(() => {
        if (
            debouncedAvatarHeight === savedAvatarHeight.current ||
            !Number.isFinite(debouncedAvatarHeight)
        ) {
            return;
        }

        savedAvatarHeight.current = debouncedAvatarHeight;

        handleChangeOption(
            "avatarSize",
            avatarHeightToSize(debouncedAvatarHeight)
        );
    }, [debouncedAvatarHeight]);

    return (
        <Container submitting={false}>
            <Form>
                <FormInfo>{tx("Disable Multiplayer")}</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        {tx("Make this World a solo experience.")}
                    </FormLabel>
                    <Toggle
                        disabled={!canEdit}
                        value={params?.soloExperience}
                        onChange={(enabled) =>
                            handleChangeOption("soloExperience", enabled)
                        }
                    />
                </FormLabelWrapper>
                <FormSep />
                <FormInfo>{tx("Public Voice Chat")}</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        {tx("Allow anyone to speak, no permissions needed.")}
                    </FormLabel>
                    <Toggle
                        disabled={!canEdit}
                        value={params?.voiceAllowed}
                        onChange={(enabled) =>
                            handleChangeOption("voiceAllowed", enabled)
                        }
                    />
                </FormLabelWrapper>
                <FormSep />
                <FormInfo>{tx("Public Editing")}</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        {tx("Allow anyone to edit your World.")}
                    </FormLabel>
                    <Toggle
                        disabled={!canEdit}
                        value={params?.editionAllowed}
                        onChange={(enabled) =>
                            handleChangeOption("editionAllowed", enabled)
                        }
                    />
                </FormLabelWrapper>
                <FormSep />
                <FormInfo>{tx("Camera Mode")}</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        {tx("Default point of view for visitors")}
                    </FormLabel>
                    <Dropdown
                        background="#27282c"
                        overrideTheme="dark"
                        disabled={!canEdit}
                        value={params?.cameraView || "third"}
                        onChange={(value) =>
                            handleChangeOption("cameraView", value)
                        }
                        items={[
                            { value: "third", title: "Third Person" },
                            { value: "first", title: "First Person" },
                        ]}
                    />
                </FormLabelWrapper>
                <FormSep />
                <FormInfo>{tx("Avatar height")}</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        {tx("How tall visitors stand, in metres")}
                    </FormLabel>
                    <Input
                        type="number"
                        min={MINIMUM_VRM_BOX}
                        step="0.05"
                        max={MAXIMUM_VRM_BOX}
                        width="70px"
                        background="#27282c"
                        color="#fff"
                        style={{
                            border: "none",
                            color: "#fff",
                        }}
                        disabled={!canEdit}
                        value={
                            Number.isFinite(avatarHeight) ? avatarHeight : ""
                        }
                        onChange={(e) => {
                            setAvatarHeight(parseFloat(e.target.value));
                        }}
                    />
                </FormLabelWrapper>
            </Form>
        </Container>
    );
}

const Container = styled.div<{ submitting: boolean }>`
    display: flex;
    flex-direction: column;
    max-width: 100%;
`;
