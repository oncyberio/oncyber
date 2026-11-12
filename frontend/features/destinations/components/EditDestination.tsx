import styled from "styled-components";

import NotFound from "@ui/components/Errors/404";
import Forbidden from "@ui/components/Errors/403";
import ServerError from "@ui/components/Errors/500";

import SignupProvider from "@components/modals/SignupProvider";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { noop, selectFile } from "@utils/js";
import { Destination } from "@uitypes/destinations";
import { Spline } from "@uitypes/roomParameters";
import DefaultLayout from "@components/layouts/default";
import {
    SceneState,
    UploaderProvider,
} from "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider";
import { useRouter } from "next/router";
import { UploadNewRoom } from "@features/spaces/create/components/DestinationSelector/Uploader/UploadNewRoom";
import { DropGlb } from "@features/spaces/create/components/DestinationSelector/Uploader/DropGlb";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { showError } from "@components/Dialogs";
import { Stylekit } from "@uitypes/experience";

interface UploaderEditProps {
    destination: Destination;
    spline: Spline;
    stylekit?: Stylekit;
    upload?: string;
    error?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

//
export default function EditDestination({
    children,
    destination: _destination,
    spline,
    stylekit,
    upload,
    style = {},
    error: _error,
}: UploaderEditProps) {
    //

    const router = useRouter();

    const [destination, setDestination] = useState(_destination);

    const isNew = !destination?._id;

    const { user, authenticated, token } = useContext(UserContext);

    const [error, setError] = useState(_error);

    const [newUpload, setNewUpload] = useState(
        upload
            ? {
                  fileURL: upload,
              }
            : null
    );

    const handleSelectFile = useEventCallback(
        (file: File, isFuture: boolean) => {
            //
            const fileURL = URL.createObjectURL(file);

            if (isFuture) {
                //
                setDestination({
                    ...destination,
                    params: {
                        ...destination.params,
                        isFuture,
                    },
                });
            }

            setNewUpload({ fileURL });
            //
        },
        []
    );

    useEffect(() => {
        if (!upload || error) return;

        let url: URL;

        try {
            url = new URL(upload);
            if (url.protocol !== "blob:") {
                throw new Error("Invalid file URL");
            }
        } catch (err) {
            console.error(err);
            setError("Invalid file URL");
            return;
        }

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed");
                }
            })
            .catch(async (err) => {
                console.error(err);
                URL.revokeObjectURL(upload);
                if (isNew) {
                    showError("Failed to locate GLB file");
                    setNewUpload(null);
                    router.replace({
                        pathname: window.location.pathname,
                        query: null,
                    });
                } else {
                    setError("Failed to locate GLB file");
                }
            });
    }, [upload, error]);

    // const newUpload: GlbUpload = !upload
    //     ? null
    //     : useMemo(() => {
    //           //
    //           if (upload) {
    //               //
    //               const fileURL = sessionStorage.getItem(upload);
    //               if (fileURL != null) {
    //                   return { fileURL };
    //               }
    //               return null;
    //           }
    //       }, [upload]);

    let errorElement = null;

    if (!authenticated || !user?.id || !token) {
        return <SignupProvider step={"connect"} setStep={noop} />;
    }

    if (error) {
        errorElement = <ServerError message={error} />;
    } else if (destination == null) {
        errorElement = <NotFound />;
    } else if (
        !isNew &&
        user.id.toLowerCase() !== destination.author.id.toLowerCase()
    ) {
        errorElement = (
            <Forbidden
                message={"Login with a proper account to access this page"}
            />
        );
    }

    if (errorElement) {
        return (
            <DefaultLayout>
                <ErrorContainer>{errorElement}</ErrorContainer>
            </DefaultLayout>
        );
    }

    if (isNew && !newUpload) {
        let futureMessage = (
            <p>
                Drop your <b>Kitbash .glb</b> file here
            </p>
        );

        return (
            <DefaultLayout>
                {children}

                <Upload style={style || {}}>
                    <DropGlb
                        onFileSelect={(file) => handleSelectFile(file, false)}
                    />

                    <h2 style={{ margin: 0, textAlign: "center" }}>or</h2>
                    <DropGlb
                        isKitbash={isNew && !newUpload}
                        onFileSelect={(file) => handleSelectFile(file, true)}
                        message={futureMessage}
                    />
                </Upload>
            </DefaultLayout>
        );
    }

    const initSceneState: SceneState = {
        type: "SceneEdit",
        destination,
        newUpload,
        spline,
        stylekit,
    };

    // return (
    //     <>
    //         <p>{newSlug}</p>
    //         <pre>{JSON.stringify(destination, null, 2)}</pre>
    //     </>
    // );

    return (
        <UploaderProvider
            initSceneState={initSceneState}
            fallbackRoute="/destinations"
        >
            {null}
        </UploaderProvider>
    );
}

const ErrorContainer = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    margin-top: 120px;
`;

const Upload = styled.div<{ isHidden?: boolean }>`
    display: flex;
    gap: 12px;
    padding: 17px;
    max-width: 600px;
    margin: auto;

    border-radius: 8px;
    position: relative;
    background: #eeeeee;
    flex-direction: column;
    justify-content: space-between;

    & > div {
        height: 300px;
        border-radius: 6px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px dashed #c2c2c2;
        padding: 12px;
    }
`;
