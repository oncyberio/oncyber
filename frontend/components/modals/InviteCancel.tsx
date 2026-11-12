import { useContext, useState } from "react";
import styled from "styled-components";
import { generateInviteLink, kickInvitedUser } from "../../utils/saveToDb";
import { UPDATE_EXHIBIT, UserContext } from "../context/UserContext";
import { ActionButton } from "@styles/brand";
import { dialogCopy, dialogTitle } from "@components/Dialogs/styles";
import AnimatedModal from "./AnimatedModal";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";

export default function InviteCancel({ isShowing, toggle, walletId }) {
    const { token, exhibit, dispatch, user } = useContext(UserContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function removeEditor() {
        setLoading(true);

        setError("");

        const data = await kickInvitedUser(walletId, exhibit.id);

        if (data.success) {
            await generateInviteLink(exhibit.id);

            // const artworksToDelete = [];

            amplitude_logAnalyticsEvent("remove_collaborator", {
                exhibitId: exhibit.id,
                ownerId: exhibit.owner,
                collab: exhibit.editors?.length > 1,
                destination: exhibit.info?.room,
                user_id: user.id,
                exhibitName: exhibit.info?.headline,
                number_of_artworks: Object.keys(exhibit.artworks || {}).length,
            });

            // Object.keys(exhibit.artworks).forEach((artworkId) => {
            //     const artwork = exhibit.artworks[artworkId];
            //     if (artwork.addedBy === walletId.toLowerCase()) {
            //         artworksToDelete.push(artworkId);
            //     }
            // });

            // database.ref("/exhibits/" + exhibit.id).push({
            //     type: "USER_KICKED",
            //     editorId: walletId,
            //     walletId: user.id,
            //     timestamp: new Date().getTime() + 1000 * 10,
            //     artworksToDelete,
            // });

            // toggle();
            location.reload();
        } else {
            setError(data.message);
            setLoading(false);
        }
    }

    return (
        <AnimatedModal
            hasBackground
            isBackdrop={true}
            toggle={toggle}
            isShowing={isShowing}
            className="dialog-window"
            noShowClose={true}
            // Not while the invite is being cancelled.
            closeOnEscape={!loading}
            wide={true}
        >
            <Container>
                {error ? <p className="danger">{error}</p> : null}
                <h2>Are you sure you want to cancel the invite?</h2>
                <p className="danger" style={{ margin: 0, marginTop: 12 }}>
                    A new link will be generated! Make sure to share it again.
                </p>
                <p>
                    All assets placed by
                    <div>{walletId}</div>
                    will be taken off.
                </p>
                <br />
                <ActionButton
                    $variant="white"
                    disabled={loading}
                    onClick={removeEditor}
                >
                    {loading ? "Proceeding…" : "Proceed"}
                </ActionButton>
            </Container>
        </AnimatedModal>
    );
}

// The surface comes from the "dialog-window" class on the modal.
const Container = styled.div`
    padding: 24px;
    display: flex;
    flex-direction: column;
    color: var(--title-color);

    h2 {
        ${dialogTitle}
    }

    p {
        ${dialogCopy}
        word-break: break-word;
        text-align: center;
        margin: 1em 0;

        & > div {
            margin: 1em 0;
            text-align: center;
            color: var(--title-color);
        }
    }

    p.danger {
        color: var(--danger-color);
    }

    /* The confirming action: solid white, as in the shared dialog. */
    button {
        width: 100%;
    }
`;
