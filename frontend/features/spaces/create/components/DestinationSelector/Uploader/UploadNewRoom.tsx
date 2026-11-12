import { showConfirm } from "@components/Dialogs";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { deepClone } from "@utils/js";
import { useRouter } from "next/router";
import { isMod } from "pages/api/social/isMod";
import styled from "styled-components";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";
import { DropGlb } from "./DropGlb";
import { Destination, useUploader } from "./UploaderProvider";

export function UploadNewRoom({
    onUploadSuccess,
    isFuture = false,
    style = {},
}) {
    //

    const router = useRouter();

    const { editPhysics, isModal } = useUploader();

    const handleSelectFile = useEventCallback(async (file: File) => {
        //
        const fileURL = URL.createObjectURL(file);

        const uPath = {
            fileURL,
            // file,
        };

        const newDestination: Destination = {
            params: { ...deepClone(DefaultRoomParameters), isFuture },
        } as any;

        editPhysics(newDestination, uPath, (destination) => {
            onUploadSuccess?.(destination);
        });

        //
    }, []);

    let message = null;

    if (isFuture) {
        message = (
            <p>
                Drop your <b>Kitbash .glb</b> file here
            </p>
        );
    }

    return (
        <Upload style={style}>
            <DropGlb
                onFileSelect={handleSelectFile}
                isKitbash={isFuture}
                message={message}
            />
        </Upload>
    );
}

const Upload = styled.div<{ isHidden?: boolean }>`
    display: flex;
    padding: 17px;

    border-radius: 8px;
    position: relative;
    background: #eeeeee;
    flex-direction: column;
    justify-content: space-between;

    ${({ isHidden }) => isHidden && "display: none"};

    & > div {
        height: 100%;
        border-radius: 6px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px dashed #c2c2c2;
        padding: 12px;
    }
`;
