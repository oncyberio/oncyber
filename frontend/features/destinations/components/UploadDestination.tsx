import styled from "styled-components";
import { deepClone } from "@utils/js";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";
import { DropGlb } from "@features/spaces/create/components/DestinationSelector/Uploader/DropGlb";
import { useUploader } from "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider";
import { useRooms } from "@features/spaces/create/components/DestinationSelector/useRooms";
import type { Destination } from "@uitypes/destinations";
import DestinationModal from "./DestinationModal";

export default function UploadDestination({
    onClose,
}: {
    onClose: () => void;
}) {
    const { editPhysics } = useUploader();
    const { updateRoom } = useRooms();
    function select(file: File, isFuture: boolean) {
        const destination = {
            params: { ...deepClone(DefaultRoomParameters), isFuture },
        } as Destination;
        editPhysics(
            destination,
            { fileURL: URL.createObjectURL(file) },
            (room) => {
                if (room) updateRoom(room);
            }
        );
        onClose();
    }
    return (
        <DestinationModal title="Upload a destination" onClose={onClose}>
            <Uploads>
                <section aria-label="Upload gallery GLB">
                    <h3>Gallery destination</h3>
                    <DropGlb onFileSelect={(file) => select(file, false)} />
                </section>
                <section aria-label="Upload Kitbash GLB">
                    <h3>Kitbash</h3>
                    <DropGlb
                        isKitbash
                        onFileSelect={(file) => select(file, true)}
                        message={
                            <p>
                                Drop your Kitbash <b>.glb</b> file here
                            </p>
                        }
                    />
                </section>
            </Uploads>
        </DestinationModal>
    );
}
const Uploads = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    section {
        border: 1px dashed #20201e44;
        border-radius: 16px;
        padding: 20px 12px;
        text-align: center;
    }
    h3 {
        margin: 0 0 24px;
        font-size: 14px;
        font-weight: 500;
    }
    p {
        line-height: 1.4 !important;
    }
    button {
        border-radius: 12px !important;
    }
    @media (max-width: 560px) {
        grid-template-columns: 1fr;
    }
`;
