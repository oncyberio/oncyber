import React, { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import VrmApi from "@api/vrm/_api";
import { classes } from "@utils/js";
import { uploadFile } from "@utils/media/mediaUploader";
import { showSuccess } from "@components/Dialogs";
import InlineError from "@ui/components/InlineError";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { UserContext } from "@components/context/UserContext";
import { useCyberTranslation } from "@components/context/I18nContext";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { scoreMap } from "../constants";
import { BASE_URL } from "@utils/gcloud/uploader";
import { useVrm, SLIDER_STEP } from "@components/context/VrmContext";
import Slider from "@ui/components/Slider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

/** A failure that running the same action again cannot fix. */
function final(message: string) {
    return Object.assign(new Error(message), { final: true });
}

export default function Upload() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Record<string, any>>({});
    // Why the last upload or save failed, under the confirm button, with
    // Retry unless retrying cannot help (docs/feedback.md).
    const [failure, setFailure] = useState<{
        message: string;
        canRetry: boolean;
    }>(null);
    const [form, setForm] = useState({
        name: "",
        description: "",
        scale: null,
    });

    const world = useWorld();

    const {
        activeVrm,
        onSubmitUpload,
        onCancel,
        onSubmitEdit,
        onDelete,
        setDisableCancel,
    } = useVrm();

    const { currentModal } = useVrm();

    const { t } = useCyberTranslation();

    const { token } = useContext(UserContext);

    const data = currentModal?.metadata;

    const isNewVrm = currentModal.type === "upload";

    useEffect(() => {
        //
        if (!isNewVrm) {
            setForm({
                name: data?.name,
                scale: data?.scale,
                description: data?.description,
            });
        } else {
            setForm({
                name: "",
                description: "",
                scale: data?.scale,
            });
        }
    }, [data]);

    const handleEdit = useEventCallback(async () => {
        setFailure(null);
        try {
            if (form.name.length > 30) {
                setError((prevState) => ({
                    ...prevState,
                    name: "UPLOAD_NAME_ERROR",
                }));
                return;
            }

            if (form.description.length > 140) {
                setError((prevState) => ({
                    ...prevState,
                    description: "UPLOAD_DESCRIPTION_ERROR",
                }));
                return;
            }

            setLoading(true);

            setDisableCancel(true);

            await VrmApi.updateVrm({
                id: data?.id,
                ...form,
            });

            await onSubmitEdit({ ...data, ...form });

            showSuccess("VRM updated successfully!");
        } catch (err) {
            console.error(err);
            setFailure({
                message: "Couldn't save your changes.",
                canRetry: true,
            });
        } finally {
            setLoading(false);
            setDisableCancel(false);
        }
    }, []);

    const handleChangeScale = useEventCallback(async (e) => {
        const scale = parseFloat(e.target.value);

        setForm((prevState) => ({
            ...prevState,
            scale,
        }));

        if (!isNewVrm && data?.id !== activeVrm?.id) {
            return;
        }

        await world.current.scaleVRM(scale);
    }, []);

    const handleSubmit = useEventCallback(async () => {
        setFailure(null);
        try {
            if (!form?.name) {
                setError((prevState) => ({
                    ...prevState,
                    name: "FILL_OUT_FIELD",
                }));
                return;
            }

            if (!form?.description) {
                setError((prevState) => ({
                    ...prevState,
                    description: "FILL_OUT_FIELD",
                }));
                return;
            }

            if (form.name.length > 30) {
                setError((prevState) => ({
                    ...prevState,
                    name: "UPLOAD_NAME_ERROR",
                }));
                return;
            }

            if (form.description.length > 140) {
                setError((prevState) => ({
                    ...prevState,
                    description: "UPLOAD_DESCRIPTION_ERROR",
                }));
                return;
            }

            setLoading(true);

            setDisableCancel(true);

            const { image, optimised, ...fileInfo } = data;

            const fileURL = optimised?.url;

            if (!fileURL) {
                throw "Failed to upload your VRM. Please try again later";
            }

            const file = await fetch(fileURL).then((r) => r.blob());

            const fileDataUrl = await new Promise<string>((resolve, reject) => {
                //
                const reader = new FileReader();

                reader.readAsDataURL(file);

                reader.addEventListener(
                    "load",
                    () => {
                        resolve(reader.result as string);
                    },
                    false
                );
            });

            const buffer = new TextEncoder().encode(fileDataUrl);

            const hash = await crypto.subtle.digest("SHA-256", buffer);

            const fileHash = Array.from(new Uint8Array(hash))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

            const isUploadedVrms = await VrmApi.checkUploadedVrms({
                fileHash,
            });

            if (isUploadedVrms) {
                throw final(
                    "This VRM is already uploaded. Choose a different one."
                );
            }

            // extension important!
            const id = "v" + Date.now() / 1000;

            let cloudinaryVrm = await VrmApi.getCloudinaryVrm({ fileHash });

            let thumbnail, url, urlCompressed;

            if (cloudinaryVrm == false) {
                const cloudinary = await uploadFile({
                    id,
                    file,
                    token,
                    mimeType: "model/vrml",
                });

                url = cloudinary?.secure_url;

                if (!url) {
                    console.error({ url });
                    throw new Error(
                        "Oops! Something went wrong with the VRM upload. Please refresh the page and try again."
                    );
                }

                if (image) {
                    const cloudinary = await uploadFile({
                        id,
                        file: image,
                        mimeType: "image/jpg",
                        token,
                    });

                    thumbnail = cloudinary?.secure_url;
                }

                if (!image) {
                    throw new Error(
                        "Oops! Something went wrong with the preview image upload. Please refresh the page and try again."
                    );
                }
            } else {
                //
                url = cloudinaryVrm.url;
                thumbnail = cloudinaryVrm.thumbnail;
                urlCompressed = cloudinaryVrm?.urlCompressed;
            }

            if (!urlCompressed) {
                const formData = new FormData();

                formData.append("vrm", file, "compressed-" + id);

                const resp = await fetch(`${BASE_URL}/vrmoptization_ipfs`, {
                    method: "POST",
                    body: formData,
                    headers: {
                        "x-token": token,
                    },
                });

                const fdata = await resp.json();

                if (!fdata?.success) {
                    throw new Error(
                        "Oops! Something went wrong with the VRM upload. Please refresh the page and try again."
                    );
                }

                urlCompressed = fdata?.result;

                if (!urlCompressed) {
                    console.error({ urlCompressed });
                    throw new Error(
                        "Oops! Something went wrong with the VRM upload. Please refresh the page and try again."
                    );
                }
            }

            fileInfo.isHighQuality ??= false;

            const response = await VrmApi.opts({
                checksum: true,
                token,
            }).addUploadedVrm({
                ...fileInfo,
                ...form,
                url,
                fileHash,
                urlCompressed,
                image: thumbnail,
            });

            await onSubmitUpload(response);

            showSuccess("VRM uploaded successfully!");
        } catch (err) {
            console.error(err);
            setFailure(
                err?.final
                    ? { message: err.message, canRetry: false }
                    : { message: "Couldn't upload your VRM.", canRetry: true }
            );
        } finally {
            setLoading(false);
            setDisableCancel(false);
        }
    }, []);

    const handleInput = (e) => {
        const name = e.target.name;

        setError((prevState) => ({
            ...prevState,
            [name]: null,
        }));

        setForm((prevState) => ({
            ...prevState,
            [name]: e.target.value,
        }));
    };

    const handleRemove = useEventCallback(async () => {
        //
        if (data?.id) {
            onDelete(data.id);
        }
    }, []);

    return (
        <Container>
            <FileInfo>
                <div className="col-40">
                    <LegacyCloudinaryNextImage
                        width={60}
                        height={60}
                        style={{
                            borderRadius: 8,
                            cursor: "pointer",
                        }}
                        alt={data?.name}
                        src={data?.image || "/images/opensea-black.png"}
                        onError={(e: any) => {
                            e.target.srcset = "/images/opensea-black.png";
                            e.onerror = null;
                        }}
                    />
                </div>
                <div className="col-60">
                    <div className="file-info">
                        <div>
                            <h4>{t`DRAW_CALLS`}</h4>
                            <span>{data?.score?.drawCalls}</span>
                        </div>
                        <div>
                            <h4>{t`TEXTURES`}</h4>
                            <span>{data?.score?.nbTextures}</span>
                        </div>
                        <div>
                            <h4>{t`VERTICES`}</h4>
                            <span>{data?.score?.nbVertices}</span>
                        </div>
                        <div>
                            <h4>{t`PERFORMANCE`}</h4>
                            <span className="capitalize">
                                {t(scoreMap[data?.score?.perfScore])}
                            </span>
                        </div>
                    </div>
                </div>
            </FileInfo>

            <span className="description">{t`AVATAR_NEW_UPLOAD_DESC`}</span>

            <FormGroup>
                <label>Scale</label>
                <div className="slider">
                    <Slider
                        min={0}
                        max={1.0}
                        mode="dark"
                        step={SLIDER_STEP}
                        isLimitless={false}
                        onChange={handleChangeScale}
                        value={data?.scale}
                    />
                </div>
            </FormGroup>

            <FormGroup>
                <label>{t`NAME`}</label>
                <input
                    type="text"
                    name="name"
                    autoComplete={"off"}
                    className={classes({
                        "custom-input": true,
                        "has-error": error?.name,
                    })}
                    placeholder={t`ENTER_NAME`}
                    onChange={handleInput}
                    defaultValue={form?.name}
                />
                {error?.name && <span className="error">{t(error.name)}</span>}
            </FormGroup>

            <FormGroup>
                <label>{t`DESCRIPTION`}</label>
                <textarea
                    name="description"
                    onChange={handleInput}
                    className={classes({
                        "custom-input textarea scrollbar-hidden": true,
                        "has-error": error?.description,
                    })}
                    placeholder={t`BRIEF_DESCRIPTION`}
                    defaultValue={form?.description}
                />
                {error?.description && (
                    <span className="error">{t(error.description)}</span>
                )}
            </FormGroup>

            <RoundButton
                isLight={false}
                disabled={loading}
                className="confirm-btn"
                onClick={isNewVrm ? handleSubmit : handleEdit}
            >
                {loading
                    ? t`SUBMITTING`
                    : isNewVrm
                    ? t`CONFIRM_NEW_VRM`
                    : t`CONFIRM_UPDATE_VRM`}
            </RoundButton>
            <InlineError
                message={!loading && failure?.message}
                onRetry={
                    failure?.canRetry
                        ? isNewVrm
                            ? handleSubmit
                            : handleEdit
                        : undefined
                }
                style={{ marginTop: 8 }}
            />
            <RoundButton
                className="remove-btn"
                isLight={true}
                disabled={loading}
                onClick={isNewVrm ? onCancel : handleRemove}
            >
                {t`REMOVE_VRM`}
            </RoundButton>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    width: 100%;
    flex-direction: column;

    & > .img-preview {
        width: 100%;
        height: 120px;
        border-radius: 8px;
        object-fit: fill;
        object-position: center;
    }

    & > .confirm-btn,
    .remove-btn {
        font-weight: 500;
        font-size: 13px;
        line-height: 24px;
    }

    & > .confirm-btn {
        margin-top: 18px;
        color: #070707;
    }

    & > .remove-btn {
        margin-top: 8px;
        background: transparent;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    & > .description {
        margin-top: 24px;
        font-weight: 400;
        font-size: 14px;
        line-height: 18px;
        margin-bottom: 24px;
        color: rgba(255, 255, 255, 0.5);
    }

    .cover-avatar {
        width: 100%;
        height: 120px;
        position: relative;
    }
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;

    & > label {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: rgb(241, 241, 247, 0.5);
        text-transform: capitalize;
    }

    & > .error {
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        display: flex;
        align-items: center;
        color: #bc0410;
    }

    .slider {
        position: relative;

        .input {
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            color: #fff;
            text-align: center;
            height: 40px;
        }
    }

    .has-error {
        border: 1px solid #bc0410 !important;
    }

    .custom-input {
        box-sizing: border-box;
        margin-top: 6px;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 7px 12px;
        gap: 8px;

        width: 264px;
        height: 40px;
        background: transparent;

        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;

        color: #ffffff;

        outline: none;

        ::placeholder,
        :-ms-input-placeholder,
        ::-ms-input-placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
    }

    .textarea {
        height: 90px;
    }
`;

const FileInfo = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: flex-start;

    .col-40 {
        flex: 0 0 35%;
    }

    .col-60 {
        flex: 0 0 65%;

        & > .file-info {
            display: flex;
            flex-direction: column;

            & > div {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;

                & > h4 {
                    margin: 0;
                    font-weight: 400;
                    font-size: 14px;
                    line-height: 24px;
                    color: rgba(255, 255, 255, 0.5);
                }

                & > span {
                    font-weight: 500;
                    font-size: 14px;
                    line-height: 24px;
                    color: #ffffff;
                    max-width: 100px;
                    text-align: right;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }
            }
        }
    }
`;
