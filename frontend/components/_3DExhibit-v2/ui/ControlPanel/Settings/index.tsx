import React from "react";
import Section from "./Section";
import styled, { css } from "styled-components";
import Spinner from "@components/Spinner";
import { usePanel } from "../context/PanelProvider";
import IconImg from "@ui/components/IconImg";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import {
    amplitude_logAnalyticsEvent,
    amplitude_setIndetity,
} from "@utils/analytics";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { isLanguage, Language, LANGUAGE_NAMES } from "locales/language";

const LANGUAGE_FLAGS: { value: Language; icon: string }[] = [
    { value: "en", icon: "UK" },
    { value: "es", icon: "Spain" },
    { value: "ko", icon: "Korea" },
    { value: "ja", icon: "Japan" },
    { value: "zh", icon: "China" },
];

export default function Settings() {
    const { settings, handleSettings, settingsLoading } = usePanel();

    const { mode, room } = useMultiplayer();

    const world = useWorld();

    const { t, i18n, switchI18n } = useCyberTranslation();
    // Match the translation provider's English fallback for unset/unknown locales.
    const language = isLanguage(i18n) ? i18n : "en";

    const fireEvent = (label, key, value) => {
        const currentExhibit = room?.currentExhibit;

        const payload = {
            label,
            value,
            exhibitId: currentExhibit?.id,
            destination: currentExhibit?.info?.room,
            ownerId: currentExhibit?.owner,
            collab: currentExhibit?.editors?.length > 1,
        };

        amplitude_logAnalyticsEvent("change_in_world_setting", payload);

        const _settings = {
            p_quality: settings?.quality,
            p_camera: settings?.camera,
            p_avatar: settings?.avatar,
            p_language: i18n,
        };

        amplitude_setIndetity("settings", {
            ..._settings,
            [key]: value,
        });
    };

    async function handleAdjustCamera(value) {
        try {
            //
            world.current.enableAdjustCamera(value === "auto");

            handleSettings("adjustCamera", value);
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <Container className="scrollbar-hidden">
            <Section title={t`SELECT_LANGUAGE`}>
                <FlagWrapper>
                    {LANGUAGE_FLAGS.map(({ value, icon }) => (
                        <Flag
                            key={value}
                            type="button"
                            aria-label={LANGUAGE_NAMES[value]}
                            aria-pressed={language === value}
                            active={language === value}
                            onClick={() => {
                                fireEvent("Language", "p_language", value);
                                switchI18n(value);
                            }}
                        >
                            <IconImg size={22} name={icon} />
                        </Flag>
                    ))}
                </FlagWrapper>
            </Section>
            <Section title={t`GRAPHICS_QUALITY`}>
                <QualityOptions role="group" aria-label={t`GRAPHICS_QUALITY`}>
                    {[
                        {
                            value: "low",
                            title: t`LOW_QUALITY_TITLE`,
                            description: t`LOW_QUALITY_DESCRIPTION`,
                        },
                        {
                            value: "medium",
                            title: t`OPTIMAL_QUALITY_TITLE`,
                            description: t`OPTIMAL_QUALITY_DESCRIPTION`,
                        },
                        {
                            value: "high",
                            title: t`HIGH_QUALITY_TITLE`,
                            description: t`HIGH_QUALITY_DESCRIPTION`,
                        },
                    ].map(({ value, title, description }) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={settings.quality === value}
                            onClick={() => {
                                fireEvent("Quality", "p_quality", value);
                                handleSettings("quality", value);
                            }}
                        >
                            <span>
                                <strong>{title}</strong>
                                <small>{description}</small>
                            </span>
                            <span className="quality-check" aria-hidden="true">
                                {settings.quality === value ? "✓" : ""}
                            </span>
                        </button>
                    ))}
                </QualityOptions>
            </Section>
            {mode === "multiplayer" && (
                <Section title={t`CAMERA_CONTROLS`}>
                    {settingsLoading === "camera" ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                width: "100%",
                            }}
                        >
                            <Spinner width={32} height={32} borderWidth={4} />
                        </div>
                    ) : (
                        <SettingsChoice
                            items={[
                                {
                                    key: "first_person",
                                    title: t`FIRST_PERSON`,
                                },
                                {
                                    key: "third_person",
                                    title: t`THIRD_PERSON`,
                                },
                            ]}
                            defaultSelected={settings.camera}
                            onSelect={async (value) => {
                                fireEvent("Camera", "p_camera", value);
                                handleSettings("camera", value);
                            }}
                        />
                    )}
                </Section>
            )}

            {IS_MOBILE && (
                <MobileSettings>
                    <Section title={t`CAMERA`}>
                        <SettingsChoice
                            items={[
                                {
                                    key: "manual",
                                    title: t`MANUAL`,
                                },
                                {
                                    key: "auto",
                                    title: t`AUTO`,
                                },
                            ]}
                            defaultSelected={settings.adjustCamera}
                            onSelect={handleAdjustCamera}
                        />
                    </Section>
                    <Section title={t`JOYSTICK`}>
                        <SettingsChoice
                            items={[
                                {
                                    key: "left",
                                    title: t`LEFT`,
                                },
                                {
                                    key: "right",
                                    title: t`RIGHT`,
                                },
                            ]}
                            defaultSelected={settings.joystick}
                            onSelect={async (value) => {
                                //fireEvent("Camera", "p_camera", value);
                                handleSettings("joystick", value);
                            }}
                        />
                    </Section>
                </MobileSettings>
            )}
        </Container>
    );
}

function SettingsChoice({ items, defaultSelected, onSelect }) {
    return (
        <ChoiceGroup>
            {items.map(({ key, title }) => (
                <button
                    key={key}
                    type="button"
                    aria-pressed={defaultSelected === key}
                    onClick={() => onSelect(key)}
                >
                    {title}
                </button>
            ))}
        </ChoiceGroup>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
`;

const FlagWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const Flag = styled.button<{ active: boolean }>`
    display: grid;
    place-items: center;
    width: 44px;
    height: 40px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    ${({ active }) =>
        active &&
        css`
            background: var(--oc-surface, #242424);
            border-color: #ffffff24;
        `}
    &:hover {
        background: var(--oc-hover, #2c2c2c);
    }
`;

const ChoiceGroup = styled.div`
    display: flex;
    padding: 4px;
    gap: 4px;
    border-radius: 12px;
    background: var(--oc-canvas, #101010);
    button {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        padding: 8px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--oc-muted, #93938e);
        font-size: 12px;
        cursor: pointer;
    }
    button[aria-pressed="true"] {
        background: var(--oc-surface, #242424);
        color: var(--oc-ink, #f3f3f1);
    }
    button:hover {
        color: var(--oc-ink, #f3f3f1);
    }
`;

const QualityOptions = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--oc-line, #ffffff12);
        border-radius: 12px;
        background: transparent;
        color: var(--oc-ink, #f3f3f1);
        text-align: left;
        cursor: pointer;
    }
    button:hover,
    button[aria-pressed="true"] {
        background: var(--oc-surface, #242424);
    }
    strong {
        display: block;
        font-size: 13px;
        line-height: 20px;
        font-weight: 500;
    }
    small {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        line-height: 16px;
        color: var(--oc-muted, #93938e);
    }
    .quality-check {
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 1px solid #ffffff24;
        font-size: 11px;
    }
    button[aria-pressed="true"] .quality-check {
        color: #191919;
        background: #f3f3f1;
    }
`;

const MobileSettings = styled.div`
    min-width: 0;
`;
