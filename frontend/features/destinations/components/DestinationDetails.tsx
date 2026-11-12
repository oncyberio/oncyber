import { useState } from "react";
import styled from "styled-components";
import type { Destination } from "@uitypes/destinations";
import { CoverImage } from "@features/landing-carousel/components/ExperienceCard";
import { useRooms } from "@features/spaces/create/components/DestinationSelector/useRooms";
import { useUploader } from "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider";
import { ActionMenu } from "@features/spaces/create/components/DestinationSelector/Uploader/Actions";
import { destinationCard, destinationLabel, destinationStatus } from "../model";
import DestinationModal from "./DestinationModal";

export default function DestinationDetails({
    room,
    onClose,
}: {
    room: Destination;
    onClose: () => void;
}) {
    const { updateRoom } = useRooms();
    const { submitForReview, mint } = useUploader();
    const [busy, setBusy] = useState(false);
    const card = destinationCard(room);
    return (
        <DestinationModal title={card.title} onClose={onClose}>
            <Details>
                <div className="cover">
                    <CoverImage card={card} />
                </div>
                {room.description && <p>{room.description}</p>}
                <dl>
                    <div>
                        <dt>Status</dt>
                        <dd>
                            {destinationStatus(room)}
                            {room.status === "active" ? " / deployed" : ""}
                        </dd>
                    </div>
                    <div>
                        <dt>Type</dt>
                        <dd>
                            {room.params?.isFuture
                                ? "Kitbash"
                                : "Gallery destination"}
                        </dd>
                    </div>
                    {room.contractName && (
                        <div>
                            <dt>Contract</dt>
                            <dd>
                                {destinationLabel(
                                    "contractName",
                                    room.contractName
                                )}
                            </dd>
                        </div>
                    )}
                    {room.distributionType && (
                        <div>
                            <dt>Distribution</dt>
                            <dd>
                                {destinationLabel(
                                    "distributionType",
                                    room.distributionType
                                )}
                            </dd>
                        </div>
                    )}
                    {(room.blockchain || room.chain) && (
                        <div>
                            <dt>Blockchain</dt>
                            <dd>{room.blockchain || room.chain}</dd>
                        </div>
                    )}
                    {room.author?.name && (
                        <div>
                            <dt>Creator</dt>
                            <dd>{room.author.name}</dd>
                        </div>
                    )}
                    {room.numberOfEditions && (
                        <div>
                            <dt>Editions</dt>
                            <dd>{room.numberOfEditions}</dd>
                        </div>
                    )}
                    {room.capacity != null && (
                        <div>
                            <dt>Capacity</dt>
                            <dd>{room.capacity}</dd>
                        </div>
                    )}
                </dl>
                <div className="destination-actions">
                    {room.status === "tested" && !room.params?.isFuture && (
                        <button
                            className="primary"
                            disabled={busy}
                            onClick={() => {
                                submitForReview(room, () =>
                                    updateRoom(room.slug)
                                );
                                onClose();
                            }}
                        >
                            Submit for review
                        </button>
                    )}
                    {room.status === "verified" && (
                        <button
                            className="primary"
                            disabled={busy}
                            onClick={() => {
                                mint(room, () => updateRoom(room.slug));
                                onClose();
                            }}
                        >
                            Continue to minting
                        </button>
                    )}
                    <div
                        className="existing-actions"
                        onClick={(event) => {
                            // The existing action owns its confirmation/upload dialog.
                            if (
                                (event.target as HTMLElement).closest(
                                    ".items button"
                                )
                            )
                                onClose();
                        }}
                    >
                        <ActionMenu
                            triggerLabel="Actions"
                            destination={room}
                            onStateChange={(state) =>
                                setBusy(state === "Submitting")
                            }
                        />
                    </div>
                </div>
            </Details>
        </DestinationModal>
    );
}
const Details = styled.div`
    .cover {
        position: relative;
        height: 230px;
        border-radius: 16px;
        overflow: hidden;
        background: #101010;
    }
    .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    p {
        margin: 20px 0;
        color: var(--oc-paper-muted);
        white-space: pre-line;
    }
    dl {
        margin: 24px 0;
        display: grid;
        gap: 12px;
    }
    dl > div {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 20px;
    }
    dt {
        color: var(--oc-paper-muted);
    }
    dd {
        margin: 0;
        overflow-wrap: anywhere;
    }
    .destination-actions {
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }
    .primary {
        padding: 12px 18px;
        border: 0;
        border-radius: 12px;
        background: #20201e;
        color: #fff;
        cursor: pointer;
    }
    .existing-actions {
        margin-left: auto;
    }
    .existing-actions .menu {
        width: auto;
        height: 42px;
        padding: 0 14px;
        gap: 8px;
        border-radius: 12px;
        color: #20201e;
    }
    .existing-actions .items {
        position: static;
        width: 190px;
        border: 1px solid #20201e18;
        border-radius: 12px;
        box-shadow: none;
        margin-top: 8px;
    }
    @media (max-width: 700px) {
        .cover {
            height: 180px;
        }
        dl > div {
            grid-template-columns: 88px 1fr;
            gap: 12px;
        }
        .destination-actions {
            flex-wrap: wrap;
        }
    }
`;
