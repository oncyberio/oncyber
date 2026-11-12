import { UserContext } from "@components/context/UserContext";
import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import CollectionApi from "@api/collections/_api";
import Input from "@ui/components/Input";
import Textarea from "@ui/components/Textarea";
import { NButton } from "@ui/components/NButton";
import { CloudinaryNextImage } from "@components/CloudinaryNextImage";
import CollectionImageUploader from "./CollectionImageUploader";
import ImageUploader from "@components/ImageUploader";
import { baseTokens as base } from "@styles/tokens";
import { StyledWrapper } from "@ui/components/Input/styles";
import InlineError from "@ui/components/InlineError";

/** The dialog field: the canvas inset with a visible edge. */
const field = {
    overrideTheme: "dark",
    color: "var(--title-color)",
    background: "var(--field-bg-color)",
    borderColor: "var(--field-border-color)",
} as const;

export default function CollectionUpdateModal({
    collection: _collection,
    syncCollection,
    ...props
}) {
    const [collection, setCollection] = useState(_collection);

    const [updates, setUpdates] = useState({});

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    // A banner or picture that could not be used, shown under the pictures.
    const [imageFailure, setImageFailure] = useState<{
        message: string;
        retry?: () => void;
    }>(null);

    const { user } = useContext(UserContext);

    async function update() {
        try {
            setLoading(true);
            setError("");

            if (
                collection.editors
                    .map((wallet) => wallet.toLowerCase())
                    .includes(user.id)
            ) {
                const update = await CollectionApi.update({
                    id: collection.id,
                    ...updates,
                });

                if (!update.success) {
                    setError("Failed to apply changes.");
                    return;
                }
                syncCollection(collection);
            } else {
                setError("You aren't allowed to update this space.");
            }
        } catch (err) {
            setError("Failed to apply changes.");
            console.log("err", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdate(key, value) {
        setError("");

        const [key1, key2] = key.split(".");

        let newCollection = { ...collection };

        if (key2) {
            newCollection[key1][key2] = value;
        } else {
            newCollection[key] = value;
        }

        const _updates = {
            ...updates,
            [key]: value,
        };

        setUpdates(_updates);

        setCollection(newCollection);
    }

    return (
        <Container>
            <BannerWrapper>
                <CollectionImageUploader
                    originalSrc={
                        collection?.images?.banner_image_url ||
                        collection?.images?.large_image_url
                    }
                    path={`collections/${collection.slug}/banner`}
                    sizeLimit={5}
                    onUploadStarted={() => setImageFailure(null)}
                    onUploadFail={(message, retry) =>
                        setImageFailure({ message, retry })
                    }
                    onUploadFinish={(url) => {
                        handleUpdate("images.banner_image_url", url);
                    }}
                />
            </BannerWrapper>

            <AvatarWrapper>
                <CollectionImageUploader
                    originalSrc={
                        collection?.images?.image_url ||
                        collection?.images?.large_image_url
                    }
                    path={`collections/${collection.slug}/avatar`}
                    sizeLimit={5}
                    onUploadStarted={() => setImageFailure(null)}
                    onUploadFail={(message, retry) =>
                        setImageFailure({ message, retry })
                    }
                    onUploadFinish={(url) => {
                        handleUpdate("images.image_url", url);
                    }}
                />
            </AvatarWrapper>

            <InlineError
                message={imageFailure?.message}
                onRetry={imageFailure?.retry}
                style={{ margin: "0 16px" }}
            />

            {error ? (
                <p
                    style={{
                        color: "var(--danger-color)",
                        textAlign: "center",
                    }}
                >
                    {error}
                </p>
            ) : null}
            <InputWrapper>
                <Input
                    {...field}
                    value={collection.name}
                    placeholder="Name"
                    onChange={(e) => handleUpdate("name", e.target.value)}
                />

                {/* <Input
                    value={collection.slug}
                    placeholder="Slug"
                    onChange={(e) => handleUpdate("slug", e.target.value)}
                /> */}

                <Textarea
                    {...field}
                    value={collection.description}
                    placeholder="Description"
                    onChange={(e) =>
                        handleUpdate("description", e.target.value)
                    }
                />

                <div>
                    <h3>Socials</h3>
                    <Input
                        {...field}
                        value={collection.socials.discord}
                        placeholder="Discord"
                        onChange={(e) =>
                            handleUpdate("socials.discord_url", e.target.value)
                        }
                    />
                    <Input
                        {...field}
                        value={collection.socials.external_url}
                        placeholder="External link"
                        onChange={(e) =>
                            handleUpdate("socials.external_url", e.target.value)
                        }
                    />
                    <Input
                        {...field}
                        value={collection.socials.twitter_username}
                        placeholder="Twitter username"
                        onChange={(e) =>
                            handleUpdate(
                                "socials.twitter_username",
                                e.target.value
                            )
                        }
                    />
                    <Input
                        {...field}
                        value={collection.socials.instagram_username}
                        placeholder="Instagram username"
                        onChange={(e) =>
                            handleUpdate(
                                "socials.instagram_username",
                                e.target.value
                            )
                        }
                    />
                </div>

                <ButtonsWrapper>
                    <NButton overrideTheme="dark" onClick={update}>
                        {loading ? "Saving…" : "Save"}
                    </NButton>
                    <NButton overrideTheme="dark" outline onClick={props.close}>
                        Cancel
                    </NButton>
                </ButtonsWrapper>
            </InputWrapper>
        </Container>
    );
}

// The dialog is dark (theme "dark" in ../Header.tsx); the fields read its
// colour variables.
const Container = styled.div`
    color: var(--title-color);

    h3 {
        color: var(--title-color);
    }
    input::placeholder,
    textarea::placeholder {
        color: ${base.color.muted};
    }
    ${StyledWrapper}:focus-within, textarea:focus {
        border-color: var(--field-border-color);
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: 1px;
    }
`;

const BannerWrapper = styled.div`
    height: 200px;
    width: 100%;
    position: relative;
    // z-index: -1;
`;

const AvatarWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin: 0 auto;
    margin-top: -48px;
    margin-bottom: 18px;
    width: 120px;
    height: 120px;
`;

const InputWrapper = styled.div`
    padding: 16px;

    div {
        margin-bottom: 16px;
    }
`;

const ButtonsWrapper = styled.div`
    display: flex;
    gap: 12px;
`;
