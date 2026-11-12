import { useState, useEffect } from "react";
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

const labelStyle = {
    fontWeight: 400,
    fontSize: "12px",
    lineHeight: "20px",
    color: "#7A7A7A",
};

export function Permissions() {
    //
    const { exhibit, exhibitStore, userRole, baseAnalyticsEvent } =
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

    const [avatarSize, setAvatarSize] = useState<number>(
        params?.avatarSize || 0.5
    );
    const debouncedAvatarSize = useDebouncedValue(avatarSize, 500);

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

    useEffect(() => {
        handleChangeOption("avatarSize", debouncedAvatarSize);
    }, [debouncedAvatarSize]);

    return (
        <Container submitting={false}>
            <Form>
                <FormInfo>Disable Multiplayer</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Make this World a solo experience.
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
                <FormInfo>Public Voice Chat</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Allow anyone to speak, no permissions needed.
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
                <FormInfo>Public Editing</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Allow anyone to edit your World.
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
                <FormInfo>Camera Mode</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Default point of view for visitors
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
                <FormInfo>Avatar Size</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        Default avatar size for visitors
                    </FormLabel>
                    <Input
                        type="number"
                        min="0.01"
                        step="0.05"
                        max="1"
                        width="70px"
                        background="#27282c"
                        color="#fff"
                        style={{
                            border: "none",
                            color: "#fff",
                        }}
                        disabled={!canEdit}
                        value={avatarSize}
                        onChange={(e) => {
                            setAvatarSize(parseFloat(e.target.value));
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
