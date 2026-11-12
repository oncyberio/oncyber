import React, { useEffect } from "react";
import styled from "styled-components";
import { usePanel } from "../context/PanelProvider";
import RadioInputGroup from "@ui/components/RadioInputGroup";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

const InputDevice = ({ name, devices, defaultDevice, onChange }) => {
    if (!devices.length)
        return (
            <RadioInputGroup
                style={{ marginBottom: "10px", maxWidth: 300 }}
                selected={true}
                item={{
                    description: "Default",
                }}
                onClick={() => {}}
            />
        );

    return devices.map((device) => (
        <RadioInputGroup
            key={device.deviceId}
            style={{ marginBottom: "10px", maxWidth: 300 }}
            selected={device.deviceId === defaultDevice}
            item={{
                description: device.label,
            }}
            clickableLabel={true}
            onClick={() => onChange(device.deviceId)}
        />
    ));
};

const AudioSettings = React.forwardRef<HTMLDivElement>((props, ref) => {
    const { voice, room } = useMultiplayer();

    const { t } = useCyberTranslation();

    const { toggleMicSettings } = usePanel();

    const { sessionId, isMod } = room;

    const {
        audioInputId,
        audioOutputId,
        audioMediaDevices,
        //
        leaveAsSpeaker,
        setPlaybackDevice,
        setMicrophoneDevice,
    } = voice;

    const handleInputDeviceChange = async (deviceId) => {
        setMicrophoneDevice(deviceId);
    };

    const handleOutputDeviceChange = async (deviceId) => {
        setPlaybackDevice(deviceId);
    };

    return (
        <Container ref={ref} className="scrollbar-hidden">
            <Section>
                <h2>{t`INPUT_DEVICE`}</h2>
                <InputDevice
                    name="input"
                    defaultDevice={audioInputId}
                    devices={audioMediaDevices?.input}
                    onChange={handleInputDeviceChange}
                />
            </Section>
            <Section>
                <h2>{t`OUTPUT_DEVICE`}</h2>
                <InputDevice
                    name="output"
                    defaultDevice={audioOutputId}
                    onChange={handleOutputDeviceChange}
                    devices={audioMediaDevices?.output}
                />
            </Section>

            {!isMod && (
                <Section>
                    <span
                        className="settings-action"
                        onClick={() => {
                            toggleMicSettings(false);
                            leaveAsSpeaker(sessionId);
                        }}
                    >
                        {t`LEAVE_AS_SPEAKER`}
                    </span>
                </Section>
            )}
        </Container>
    );
});

export default AudioSettings;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 320px;
    width: 280px;
    position: absolute;
    bottom: 60px;
    left: 10px;
    overflow-x: auto;
    overflow-y: auto;
    border-radius: 4px;
    padding: 6px 10px 6px 10px;
    background: rgb(17, 18, 20);
    max-height: calc(var(--100-vh) - 50vh);
    box-shadow: rgba(0, 0, 0, 0, 24) 0px 8px 16px 0px;
`;

const Section = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    margin-bottom: 4px;
    border-bottom: 1px solid rgba(78, 80, 88, 0.48);

    & > .loading-spinner {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    & > .device-not-found {
        font-size: 12px;
        text-align: left;
        line-height: 100%;
        margin-bottom: 20px;
    }

    &:last-child {
        border-bottom: none;
    }

    & > h2 {
        font-weight: 700;
        font-size: 12px;
        line-height: 100%;
        text-transform: uppercase;
    }

    .radio-circle-wrapper {
        margin-top: 2px;
    }

    .settings-action {
        cursor: pointer;
        margin-top: 4px;
    }

    .radio-wrapper-span,
    .settings-action {
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 12px;
        line-height: 18px;
        opacity: 1;
        color: rgb(184, 185, 191);
    }
`;
