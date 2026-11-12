import { useEventCallback } from "@components/hooks/useEventCallback";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { ToolbarButton } from "../components/ToolbarButton";
import { OncyberLockup } from "../../components/OncyberLockup";

import { Action, Dropdown } from "./Dropdown";
import dynamic from "next/dynamic";
import { showModal } from "@components/Dialogs";
import { noop } from "@utils/js";
import { useState } from "react";
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";
import { useRouter } from "next/router";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

const ConnectWallet = dynamic(() => import("@ui/components/ConnectWallet"));

const Profile = dynamic(() => import("@components/modals/Profile"));

const AccountDashboard = dynamic(
    () => import("@components/modals/AccountDashboard")
);

export function Menu({ onCreateSpace }) {
    //
    const [currentModal, setCurrentModal] = useState<"auth" | "profile">(null);

    const router = useRouter();

    const [isProfile, set] = useState(false);

    const handleOnBack = useEventCallback(() => router.back(), []);

    const handleAction = useEventCallback((action: Action) => {
        //
        if (action.type === "create-space") {
            //
            onCreateSpace();
            //
        } else if (action.type === "open-profile") {
            //
            // setCurrentModal("profile");
            handleOpenAccountSettings();
            //
        } else if (action.type === "connect") {
            //
            setCurrentModal("auth");
        }
    }, []);

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard />);
    }

    const caption = ({ toggled }) => (
        <ToolbarButton
            hasLabel
            toggled={toggled}
            aria-label="Oncyber menu"
            aria-expanded={toggled}
        >
            <OncyberLockup />
            <IconImg
                name={toggled ? "chevron-up" : "chevron-down"}
                size={14}
                mode="light"
                style={{ opacity: 0.5 }}
            />
        </ToolbarButton>
    );

    return (
        <Container>
            {currentModal === "auth" && (
                <ConnectWallet
                    toggle={() => setCurrentModal(null)}
                    open={true}
                    callbackAfterAuth={noop}
                    onlyEthereum={false}
                    skipRedirectToAccount={true}
                />
            )}
            {/* {currentModal === "profile" && (
                <Profile
                    toggle={() => setCurrentModal(null)}
                    isShowing={true}
                />
            )} */}
            <CustomDropdown caption={caption} className="menu-dropdown">
                {({ toggle }) => (
                    <Dropdown
                        onAction={(action) => {
                            //
                            toggle(false);
                            handleAction(action);
                        }}
                    />
                )}
            </CustomDropdown>

            <div className="menu-arrow-left">
                <button
                    type="button"
                    aria-label="Go back"
                    className="arrow-wrapper"
                    onClick={handleOnBack}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m10 5-7 7 7 7M3 12h18" />
                    </svg>
                </button>
            </div>
        </Container>
    );
}

const Container = styled.div`
    & > .menu-dropdown {
        display: block;
    }

    & > .menu-arrow-left {
        display: none;

        & > .arrow-wrapper {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: var(--studio-ink);
            cursor: pointer;
            &:hover {
                background: var(--studio-surface);
            }
            &:focus-visible {
                outline: 2px solid var(--studio-ink);
            }
        }
    }

    @media (max-width: 600px) {
        & > .menu-dropdown {
            display: none;
        }

        & > .menu-arrow-left {
            display: block;
        }
    }
`;
