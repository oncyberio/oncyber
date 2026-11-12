import { UserContext } from "@components/context/UserContext";

import { nodeEnv } from "@env";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { generateInviteLink, getInviteLink } from "@utils/saveToDb";

import { useContext, useEffect, useState } from "react";

import styled from "styled-components";

import IconImg from "@ui/components/IconImg";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { useStudioMenu } from "../../context/StudioContext";
import { Input } from "../../SpaceSettings/Forms/shared/Input";
import {
    LinkState,
    LinkStatus,
} from "../../SpaceSettings/Forms/shared/LinkStatus";
import { isSupportedRuntime } from "@utils/runtimeKind";

export default function Invite() {
    //
    const [link, setLink] = useState("");

    const [error, setError] = useState(null);

    const [walletId, setWalletId] = useState("");

    const [loading, setLoading] = useState(false);

    const [validatedAccounts, setValidatedAccounts] = useState([]);

    const [selectedValidatedAccounts, setSelectedValidatedAccounts] = useState(
        {}
    );

    const { user, token, accounts } = useContext(UserContext);

    const { exhibit, baseAnalyticsEvent } = useStudioMenu();

    const [linkState, setLinkState] = useState<LinkState>("copy");

    useEffect(() => {
        (async () => {
            try {
                const data = await getInviteLink(exhibit.id);

                console.log("DATA", data);

                if (data.success) {
                    setLink(
                        `${nodeEnv.PUBLIC_API}/studio?inviteId=${data.inviteId}`
                    );
                } else {
                    createInvite();
                }
            } catch (err) {
                console.log("error", err);
                console.log("AN ERROR HERE");
            } finally {
                console.log("FINALLY");
            }
        })();
    }, [exhibit.id]);

    function fallbackCopyTextToClipboard(text) {
        var textArea = document.createElement("textarea");
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (err) {
            console.error("Failed to copy", err);
        }

        document.body.removeChild(textArea);
    }

    async function checkENS() {
        try {
            const { ethers } = await import("ethers");
            const provider = new ethers.providers.JsonRpcProvider(
                nodeEnv.ETH_RPC
            );

            const address = await provider.resolveName(walletId);

            if (address) return address;
        } catch (e) {
            return walletId;
        }

        return walletId;
    }

    async function handleCurateClicked() {
        // Remove the current user from the list of accounts
        const { [user.id]: currentUser, ...rest } = accounts;

        console.log(accounts);

        const response = await fetch(`/api/user/validateAll`, {
            credentials: "include",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                accounts: rest,
            }),
        });

        const data = await response.json();

        if (data.success) {
            setValidatedAccounts(data.validatedAccounts);

            console.log("validate accounts", data.validatedAccounts);
        }
    }

    async function createInvite() {
        // const doc = db.collection("invites").add({
        //     expires: this.getTime() + (60*60*1000),
        //     invited: walletId,
        //     exhibit
        // });
        setLoading(true);

        const { artworks, ...rest } = exhibit;

        // const wallet = walletId[0] != "t" ? await checkENS() : walletId;

        // if (!wallet) {
        //     setError("Please enter a wallet id");
        //     setLoading(false);
        //     return;
        // }

        // if (wallet.toLocaleLowerCase() === user.id.toLocaleLowerCase()) {
        //     setError("You can't invite yourself");
        //     setLoading(false);
        //     return;
        // }

        amplitude_logAnalyticsEvent("generate_new_link", {
            invitedByCurator: user?.id !== exhibit.owner,
            ownerId: user?.id, // represents who invited, owner of the invite we should change it to something more meaningful
            exhibitOwnerId: exhibit?.owner,
            exhibitName: exhibit?.info?.headline,
            collabs: exhibit?.editors?.length > 1,
            number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
            otherOwners: Object.keys(selectedValidatedAccounts),
            exhibitId: exhibit.id,
            destination: exhibit?.info?.room,
            collab: exhibit?.editors?.length > 1,
        });

        try {
            const data = await generateInviteLink(exhibit.id);

            if (!data.success) {
                setError(data.message);
                return;
            }

            setLink(`${nodeEnv.PUBLIC_API}/studio?inviteId=${data.inviteId}`);

            // if (accounts?.[wallet.toLowerCase()]) {
            //     window.location =
            //         `${nodeEnv.PUBLIC_API}/studio?inviteId=${data.inviteId}` as any as Location;
            // }
        } catch (err) {
            console.error(err);

            setError("Failed to generate invite link. Please contact support!");
        } finally {
            setLoading(false);
        }
    }

    // The server refuses collaborators for runtimes this build does not serve
    // (pages/api/invite/access.ts); do not offer an invite flow it would reject.
    if (exhibit && !isSupportedRuntime(exhibit.runtime)) {
        return (
            <Container className="scrollbar light">
                <label>Invite link</label>
                <p style={{ color: "#777980", fontSize: 13 }}>
                    This space can't have additional editors yet.
                </p>
            </Container>
        );
    }

    return (
        <Container className="scrollbar light">
            <label>Invite link</label>

            <InputWrapper>
                <Input
                    color="#C0C0C6"
                    value={link}
                    onChange={(e) => setWalletId(e.target.value)}
                    placeholder={
                        linkState === "loading" || loading
                            ? "Loading..."
                            : "No link generated yet..."
                    }
                    data-cy="invite-input"
                    icon
                    iconPosition="right"
                    disabled
                >
                    {link ? (
                        <LinkStatus
                            link={link}
                            status={linkState}
                            onCopy={() => {
                                setLinkState("success");

                                amplitude_logAnalyticsEvent(
                                    "copy_invite_link",
                                    baseAnalyticsEvent
                                );

                                setTimeout(() => {
                                    setLinkState("copy");
                                }, 1000);
                            }}
                        />
                    ) : null}
                    {/* <button onClick={copyToClipboard}>
                        {copied ? <p> Let's go!</p> : <p>COPY LINK</p>}
                    </button> */}
                </Input>

                {exhibit.owner.toLowerCase() === user.id.toLowerCase() ? (
                    <CustomDropdown
                        caption={
                            <div className="invite-icon">
                                <IconImg
                                    name="more-vertical"
                                    size={24}
                                    style={{ filter: "invert(0.5)" }}
                                />
                            </div>
                        }
                        align="left"
                        onOpen={() => {
                            amplitude_logAnalyticsEvent(
                                "open_collaborators",
                                baseAnalyticsEvent
                            );
                        }}
                    >
                        {({ toggle }) => {
                            return (
                                <DropdownWrapper
                                    style={{
                                        cursor: loading
                                            ? "progress"
                                            : "pointer",
                                    }}
                                    onClick={() => {
                                        if (loading) return;
                                        createInvite().finally(() => {
                                            toggle(false);
                                        });
                                    }}
                                >
                                    <p>
                                        {loading
                                            ? "Loading..."
                                            : link
                                            ? "Regenerate link"
                                            : "Generate link"}
                                    </p>
                                </DropdownWrapper>
                            );
                        }}
                    </CustomDropdown>
                ) : null}

                {/* {exhibit.owner.toLowerCase() === user.id.toLowerCase() ? (

                ) : null} */}
            </InputWrapper>

            {error && !loading ? (
                <>
                    <ErrorMsg>{error}</ErrorMsg>
                </>
            ) : null}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;

    & > label {
        margin: 0;
        font-weight: 500;
        font-size: 13px;
        line-height: 24px;
        color: #f1f1f7;
    }
`;

const InputWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;

    & .invite-icon {
        background: var(--studio-surface);
        border-radius: 8px;
        padding: 6px;
        cursor: pointer;
    }

    & input:disabled {
        background: var(--studio-surface);
    }
`;

const ErrorMsg = styled.p`
    color: #ed8585;
`;

const DropdownWrapper = styled.div`
    display: flex;
    color: #f1f1f7;
    padding: 12px;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);
    border-radius: 8px;
    background: var(--studio-surface);

    p {
        margin: 0;
        font-size: 13px;

        &:hover {
            opacity: 0.5;
            transition: 0.3s all ease;
        }
    }
`;
