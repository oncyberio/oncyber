import { useCallback, useContext, useEffect, useRef } from "react";
import { useAI } from "@features/ai/context/AIContext";
import { UserContext, USER_LOGIN } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { updatePreview } from "@components/_3DExhibit-v2/ui/AssetsMenu/AddAsset/AddWebsite";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import {
    createExhibit,
    getDestination,
    getExhibit,
    getExhibitByCustomLink,
    updateUser,
    getUserDestinations,
} from "@utils/saveToDb";
import { useRouter } from "next/router";
import {
    EDITION_ACTIONS,
    UPLOADER_TYPES,
} from "@components/_3DExhibit-v2/three/constants";
import { BACKGROUNDMAPS } from "@components/_3DExhibit-v2/utils/backgroundmaps";
import { TYPES } from "@components/_3DExhibit-v2/three/factory/sky";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { getTargets, setPrevContext, getFilter } from "./helpers";
import EnterBg from "@ui/components/Icons/EnterBg";
import {
    formatYoutubeAsset,
    searchYoutubeBykeyword,
} from "@features/studio/EditWorldMenu/AddAsset/Youtube/utils";

import AIStore from "@features/ai/utils/AIStore"; //! [REVIEW] not sure if okay to be here
import {
    searchExhibits,
    fetchExhibits,
} from "@features/studio/EditWorldMenu/AddAsset/Portal/utils";
import {
    getArtworksFeedback,
    getPlaceholdersSuggestions,
    getPortalsSuggestions,
    getRoomSuggestions,
} from "./Suggestions";
import { canChangeFrame } from "@features/studio/EditWorldMenu/utils";
import {
    getOwnedRooms,
    fetchMarketplaceRooms,
    preprocessDestination,
} from "@dapp/cyberRooms";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";
import { shouldDisplayNFTs } from "@features/studio/utils";

export default function useAIEditController() {
    const world = useWorld();
    const router = useRouter();
    const { exhibitStore } = useCurrentExhibit();
    const { user, token, dispatch, userData } = useContext(UserContext);
    const {
        undo,
        redo,
        selectedMesh,
        assetsData,
        setStartLoadingAssets,
        handleAddNftBulk,
        handleAddNft,
        handleAddPortal,
        handleAddText,
        handleAddWebsiteEmbed,
        handleAddYoutubeEmbed,
        handleDeleteItems,
        handleChangeFrame,
        handleChangeTransform,
        handleChangeVideo,
        handleUpdateArtworkData,
        handleChangeAudio,
    } = useEditWorld();

    // mmm... should prev context be handled in ai side or just here?
    // doing it here for the moment
    const prevContext = useRef(null);

    useAI({
        create_gallery: handleCreateNewSpace,
        hang_artwork: handleHangNFT,
        hang_text: handleHangText,
        hang_portal: handleHangPortal,
        hang_youtube: handleHangYoutube,
        hang_website: handleHangWebsite,
        remove: handleRemove,
        change_sky: handleChangeSky,
        change_gallery_data: handleChangeGalleryData,
        change_spawn_point: handleChangeSpawnPoint,
        change_asset_options: handleChangeAssetOptions,
        undo: async () => {
            undo();
            return { success: true };
        },
        redo: async () => {
            redo();
            return { success: true };
        },
        unselect: async () => {
            world.current.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: null,
            });
        },
    });

    useEffect(() => {
        if (shouldDisplayNFTs(userData)) {
            setStartLoadingAssets(true);
        }
    }, []);

    //* Change the content of the selection indication over the input
    useEffect(() => {
        if (selectedMesh) {
            if (selectedMesh.isPlaceholder) {
                AIStore.setContext({
                    label: "Placeholder",
                    placeholder: "Empty - ⌫ to deselect",
                });
            } else {
                //@ts-ignore
                const name = selectedMesh?.item?.data?.name?.slice?.(0, 10);
                AIStore.setContext({
                    label: "Asset",
                    placeholder:
                        (name?.length > 20
                            ? name.slice(0, 21) + "..."
                            : name || "Selected Asset") + " - ⌫ to deselect",
                });
            }
        } else {
            AIStore.setContext({
                label: "",
                placeholder: "Type for Magic Composer (beta)",
            });
        }
    }, [selectedMesh]);

    //* this is not part of context and undo stack not sure how handle the disable of "Ctrl-Z to UNDO" in SUggestionDisplay
    async function handleChangeGalleryData(opts) {
        try {
            await exhibitStore.updateExhibitInfo({
                ...(opts?.title && { headline: opts.title }),
                ...(opts?.description && { description: opts.description }),
            });

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: {
                    title: `Changed gallery info,  ${
                        opts?.title ? `Title: ${opts?.title}` : ""
                    } ${
                        opts?.description
                            ? `Description: ${opts?.description}`
                            : ""
                    }`,
                    suggestions: [],
                    undoable: true,
                },
            };
        } catch (err) {
            console.error(err);
            return {
                success: false,
            };
        }
    }

    //* has no undo
    async function handleChangeSpawnPoint(opts) {
        try {
            const { position, rotation } = world.current.getCurrentCoords();

            if (opts?.current_position) {
                await exhibitStore.updateExhibitParams({
                    initialPlayerPosition: position,
                    initialPlayerRotation: rotation,
                });
                return {
                    success: true,
                    prevContext: prevContext.current,
                    feedbacks: {
                        title: `Changed spawn point to your current position`,
                        suggestions: [],
                        undoable: true,
                    },
                };
            } else {
                await exhibitStore.updateExhibitParams({
                    initialPlayerPosition: opts?.position,
                });
                return {
                    success: true,
                    prevContext: prevContext.current,
                    feedbacks: {
                        title: `Changed spawn point to ${opts?.position.x}, ${opts?.position.y}, ${opts?.position.z}`,
                        suggestions: [],
                        undoable: true,
                    },
                };
            }
        } catch (err) {
            console.error(err);
            return {
                success: false,
            };
        }
    }

    async function handleHangNFT(opts) {
        try {
            const placeholders = getTargets({
                idRange: opts?.id_range,
                scope: opts?.scope || "all",
                fetchType: "placeholder",
                prevContext: prevContext,
                world: world,
                selectedMesh,
                filter: opts?.replaceFilter,
                adding: true,
            });

            // TODO: we should wait here for all assets to load or give a warning to the user that assets are still loading
            let assetsToAdd = getFilter({
                assets: assetsData.assetsData.data.assets,
                opts,
                maxLength: opts?.arrangement?.count || placeholders.length,
            });

            let placeholderIds = placeholders.map((p) => p.userData.id);

            if (opts?.arrangement) {
                const arrangementType = opts.arrangement.type ?? "circle";
                if (arrangementType === "circle") {
                    if (typeof opts?.arrangement?.radius === "string")
                        opts.arrangement.radius = 5;
                    const radius = opts.arrangement.radius ?? 5;
                    if (typeof opts?.arrangement?.count === "string")
                        opts.arrangement.count = 10;
                    const count =
                        opts.arrangement.count ?? assetsToAdd?.length ?? 10;
                    while (
                        assetsToAdd?.length < count &&
                        assetsToAdd?.length > 0
                    )
                        assetsToAdd.push(...assetsToAdd);
                    const angleStep = (2 * Math.PI) / count;
                    const { position, rotation } =
                        world.current.getCurrentCoords();
                    const playerRotY = rotation.y;
                    for (let i = 0; i < count; i++) {
                        if (!assetsToAdd[i]) continue;
                        const angle = angleStep * i;
                        const offsetX = radius * Math.sin(angle + playerRotY);
                        const offsetZ = radius * Math.cos(angle + playerRotY);
                        let spawnPos = {
                            x: position.x + offsetX,
                            y: position.y,
                            z: position.z + offsetZ,
                        };
                        const lookAtDirection = {
                            x: position.x - spawnPos.x,
                            y: 0,
                            z: position.z - spawnPos.z,
                        };
                        const placeholderRotY = Math.atan2(
                            lookAtDirection.x,
                            lookAtDirection.z
                        );
                        handleAddNft({
                            asset: assetsToAdd[i],
                            keepPlaceholder: false,
                            source: "ai",
                            //@ts-ignore
                            artworkDataProps: {
                                position: { ...spawnPos },
                                rotation: { x: 0, y: placeholderRotY, z: 0 },
                            },
                        });
                        console.log(spawnPos);
                    }
                    assetsToAdd = assetsToAdd.slice(0, count);
                }
            } else {
                const call = () =>
                    handleAddNftBulk({
                        assets: assetsToAdd,
                        placeholderIds,
                        keepPlaceholder: false,
                        source: "ai",
                    });

                if (opts?.executeAsync) {
                    call();
                } else {
                    await call();
                }
            }

            setPrevContext({
                placeholderIds,
                type: "artworks",
                opts,
                prevContext: prevContext,
                world: world,
            });

            if (placeholders.length === 0 && assetsToAdd.length === 0) {
                return {
                    success: false,
                    type: "notfound",
                    message: "No placeholder found.",
                };
            }

            if (assetsToAdd.length === 0) {
                return {
                    success: false,
                    type: "notfound",
                    message: "No artworks found.",
                };
            }

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: getArtworksFeedback({
                    title: `${assetsToAdd.length} artworks added.`,
                    modifiedArtworks: assetsToAdd,
                    placeholders,
                    world,
                }),
            };
        } catch (err) {
            console.log("[ AI COMMAND FAILED ]", err);
            return {
                success: false,
            };
        }
    }

    async function handleHangYoutube(opts) {
        try {
            const placeholders = getTargets({
                idRange: opts?.id_range,
                scope: opts?.scope || "all",
                fetchType: "placeholder",
                prevContext: prevContext,
                world: world,
                selectedMesh,
                adding: true,
            });

            const foundVideos = await searchYoutubeBykeyword(
                opts?.search ||
                    opts?.url ||
                    opts?.filter?.name ||
                    opts?.filter?.search
            );

            const assetsToAdd = foundVideos.items
                .slice(0, opts?.count || placeholders?.length || 1)
                .map((video) => formatYoutubeAsset(video));

            const call = () =>
                Promise.all(
                    assetsToAdd.map(async (asset, i) => {
                        await handleAddYoutubeEmbed({
                            asset,
                            targetMesh: placeholders[i],
                        });

                        return placeholders[i].userData.id;
                    })
                ).then((ids) => {
                    setPrevContext({
                        placeholderIds: ids,
                        type: "artworks",
                        opts,
                        prevContext: prevContext,
                        world: world,
                    });
                });

            if (opts?.executeAsync) {
                call();
            } else {
                await call();
            }

            if (assetsToAdd.length === 0) {
                return {
                    success: false,
                    type: "notfound",
                    message: "No video found.",
                };
            }

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: getArtworksFeedback({
                    title: `${assetsToAdd.length} videos added.`,
                    modifiedArtworks: assetsToAdd,
                    placeholders,
                    world,
                }),
            };
        } catch (err) {
            console.log("[ AI COMMAND FAILED ]", err);
            return {
                success: false,
            };
        }
    }

    async function handleHangPortal(opts) {
        try {
            //!need fix to also get static portals
            const targetMesh = getTargets({
                idRange: opts?.id_range,
                scope: opts.scope,
                fetchType: "portals",
                prevContext: prevContext,
                world: world,
                selectedMesh,
                adding: true,
            });

            let exhibitsResult;
            if (opts?.url) opts.search = opts.url;
            if (opts?.search) {
                // if( opts?.search.includes('oncyber') && opts?.search.includes('/') ) opts.search = opts.search.split('/').pop();
                exhibitsResult = await searchExhibits(opts.search);
            } else {
                exhibitsResult = { data: await fetchExhibits(user?.id) };
            }

            if (!exhibitsResult.data.length) {
                return {
                    success: false,
                    type: "notfound",
                    message: "Exhibit not found",
                };
            }

            const onSelect = async ({ destination, opts }) => {
                await handleAddPortal({
                    targetExhibit: destination,
                    ...(targetMesh?.[0] ? { targetMesh: targetMesh[0] } : {}),
                });
                setPrevContext({
                    placeholderIds: [targetMesh?.[0]?.userData?.id],
                    type: "portals",
                    opts,
                    prevContext: prevContext,
                    world: world,
                });
                return {
                    success: true,
                    feedbacks: {
                        title: `Portal to ${
                            destination.info?.headline || destination.info.room
                        } added successfully.`,
                        suggestions: [],
                    },
                    prevContext: prevContext.current,
                };
            };

            // if (targetMesh.length === 0) {
            //     return {
            //         success: false,
            //         type: "notfound",
            //         message: "No placeholders found.",
            //     };
            // }

            return {
                success: true,
                suggestions: getPortalsSuggestions({
                    onSelect,
                    opts,
                    targetDestinations: exhibitsResult.data,
                    prevContext: prevContext,
                }),
            };
        } catch (err) {
            console.log("[ AI COMMAND FAILED ]", err);
            return {
                success: false,
            };
        }
    }

    async function handleCreateNewSpace(opts) {
        try {
            let fetchedRooms = await fetchMarketplaceRooms(user?.id, token);
            fetchedRooms = fetchedRooms.filter(
                (room) => !room.tag.includes("uploaded")
            );
            const result = await getOwnedRooms(user.id, fetchedRooms);
            fetchedRooms = fetchedRooms.filter(
                (room) => result[room.slug] || room.tag.includes("free")
            );
            if (opts?.filter?.name) {
                fetchedRooms = fetchedRooms.filter(
                    (room) =>
                        room.slug
                            ?.toLowerCase()
                            ?.includes(opts?.filter?.name?.toLowerCase()) ||
                        room.name
                            ?.toLowerCase()
                            ?.includes(opts?.filter?.name?.toLowerCase())
                );
            }
            const uploaded = await getUserDestinations(token, user?.id);
            uploaded.data?.forEach?.((it) => {
                if (it.chain === "rinkeby") return;
                let destination = preprocessDestination(it, user?.id);
                fetchedRooms.push(destination);
            });
            if (!(fetchedRooms?.length > 0)) {
                return {
                    success: false,
                    type: "notfound",
                    message: "No destination found.",
                };
            }

            const onSelect = async ({ destination, opts }) => {
                const data = await createExhibit(
                    user.id,
                    token,
                    destination.slug
                );

                if (!data?.success) {
                    return {
                        success: false,
                        message: "Failed to create gallery",
                    };
                }

                const result = await updateUser(
                    token,
                    {
                        currentExhibitId: data.exhibit?.id,
                        walletId: user.id.toLowerCase(),
                    },
                    user.id
                );

                if (!result.success) {
                    return {
                        error: true,
                        message: result.message || "Failed to update user data",
                    };
                }

                dispatch({
                    type: USER_LOGIN,
                    payload: {
                        exhibit: data.exhibit,
                    },
                });

                router.reload();

                return {
                    success: true,
                    feedbacks: {
                        title: `Gallery created successfully.`,
                        suggestions: [],
                    },
                    undoable: true,
                };
            };

            return {
                success: true,
                suggestions: getRoomSuggestions({
                    onSelect,
                    opts,
                    targetRooms: fetchedRooms,
                    prevContext: prevContext,
                }),
            };
        } catch (err) {
            console.log("[ AI COMMAND FAILED ]", err);
            return {
                success: false,
            };
        }
    }

    async function handleHangText(opts) {
        const targetMesh = getTargets({
            idRange: opts?.id_range,
            scope: opts.scope,
            fetchType: "placeholder",
            prevContext: prevContext,
            world: world,
            selectedMesh,
            adding: true,
        });
        // opts

        const onSelect = async ({ mesh, opts }) => {
            await handleAddText({
                text: opts.text,
                keepPlaceholder: false,
                targetMesh: mesh,
            });

            setPrevContext({
                placeholderIds: [mesh?.userData?.id],
                type: "artworks",
                opts,
                prevContext: prevContext,
                world: world,
            });

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: {
                    title: `Added text successfully.`,
                    suggestions: [],
                },
            };
        };

        return await onSelect({ mesh: targetMesh[0], opts });
    }

    async function handleHangWebsite(opts) {
        const targetMesh = getTargets({
            idRange: opts?.id_range,
            scope: opts.scope,
            fetchType: "placeholder",
            prevContext: prevContext,
            world: world,
            selectedMesh,
            adding: true,
        });

        const onSelect = async ({ mesh, opts }) => {
            const website = await updatePreview(opts.url);

            await handleAddWebsiteEmbed({
                asset: website,
                keepPlaceholder: false,
                targetMesh: mesh,
            });

            setPrevContext({
                placeholderIds: [mesh.userData.id],
                type: "artworks",
                opts,
                prevContext: prevContext,
                world: world,
            });

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: {
                    title: `Added website ${opts.url} successfully.`,
                    suggestions: [],
                },
            };
        };

        return await onSelect({ mesh: targetMesh[0], opts });
    }

    async function handleRemove(opts) {
        try {
            let artworks = getTargets({
                idRange: opts?.id_range,
                scope: opts.scope || "in_front",
                fetchType: opts?.type || "artworks",
                filter: opts.filter,
                type: opts.type,
                prevContext: prevContext,
                world: world,
                selectedMesh,
            });

            // @ts-ignore
            artworks = artworks.filter((artwork, index) => {
                return !artwork.isPlaceholder;
            });

            artworks = artworks.slice(
                0,
                opts.count ? opts.count : artworks.length
            );

            if (artworks.length === 0) {
                return {
                    success: false,
                    type: "notfound",
                    message: "No artworks found.",
                };
            }

            //! [REVIEW] not sure why this doesn't work for portals ids
            await handleDeleteItems(
                artworks.map((artwork) => artwork.userData.id)
            );

            return {
                success: true,
                prevContext: prevContext.current,
                feedbacks: {
                    title: `${artworks.length} artworks removed.`,
                    suggestions: [],
                },
            };
        } catch (err) {
            console.log("[ ACTION error ] ", err);
            return {
                success: false,
            };
        }
    }

    async function handleChangeAssetOptions(opts) {
        let targetMeshes = getTargets({
            ...opts,
            idRange: opts?.id_range,
            selectedMesh,
            world,
            prevContext,
        });

        let changedTargets = targetMeshes;

        //* Change Asset Frame/Border as one action
        //? this causes issue if changing the frame border and other options at the same time
        if (opts.frameBorder) {
            let color = opts.frameBorder.color;
            if (opts.frameBorder.reset) color = "none";
            if (color === "none") color = "black-borderless";
            if (color === "transparent") {
                color = "transparent-borderless";
            }
            changedTargets = changedTargets?.filter(canChangeFrame);
            if (changedTargets?.length > 0) {
                await handleChangeFrame({
                    targetMeshes: changedTargets,
                    color,
                    isRemove: color === "black-borderless",
                });
            }
            //* handle rest as individual actions
        } else {
            changedTargets = await Promise.all(
                targetMeshes.map(async (mesh) => {
                    if (mesh.isPlaceholder) return;
                    let didChange = false;

                    //* Change Audio Type
                    if (
                        ["VIDEO", "YOUTUBE_EMBED"].includes(mesh.mediaType) &&
                        opts.audioType
                    ) {
                        if (opts.audioType.reset)
                            opts.audioType.value = "lookat";
                        mesh.userData.audioType = opts.audioType.value;
                        handleChangeAudio({
                            volume: opts.audioType.volume || 20,
                            audioType: opts.audioType.value,
                        });
                        didChange = true;
                    }

                    //* Change Video Play Type
                    if (
                        ["VIDEO", "YOUTUBE_EMBED"].includes(mesh.mediaType) &&
                        opts.videoPlayback
                    ) {
                        if (opts.videoPlayback.reset)
                            opts.videoPlayback.value = "auto";
                        const lowerCase =
                            opts.videoPlayback.value.toLowerCase();
                        if (lowerCase.includes("click"))
                            opts.videoPlayback.value = "manual";
                        if (["lookat"].includes(lowerCase))
                            opts.videoPlayback.value = "auto";
                        mesh.userData.videoPlayback = opts.videoPlayback.value;
                        handleChangeVideo({
                            videoPlayback: opts.videoPlayback.value,
                            targetMesh: mesh,
                        });
                        didChange = true;
                    }

                    //* Change HD Setting
                    if (mesh.mediaType == "IMAGE" && opts.imageHd) {
                        if (opts.imageHd.reset) opts.imageHd.value = false;
                        mesh.userData.hdImage = opts.imageHd.value;
                        handleUpdateArtworkData({
                            data: { hdImage: opts.imageHd.value },
                            targetMesh: mesh,
                        });
                        didChange = true;
                    }

                    //* Change Rotation, support delta
                    if (opts.assetRotation) {
                        let newRotation;
                        if (opts?.assetRotation?.isDelta) {
                            newRotation = {
                                x:
                                    mesh.rotation.x +
                                    (opts.assetRotation.value.x || 0),
                                y:
                                    mesh.rotation.y +
                                    (opts.assetRotation.value.y || 0),
                                z:
                                    mesh.rotation.z +
                                    (opts.assetRotation.value.z || 0),
                            };
                        } else if (opts.assetRotation.reset) {
                            let defaultTransformString = mesh.userData.id; //hopping it won't change 🙌
                            let defaultTransform = defaultTransformString
                                .split("X")
                                .map((x) => parseFloat(x));
                            newRotation = {
                                x: defaultTransform[3],
                                y: defaultTransform[4],
                                z: defaultTransform[5],
                            };
                        } else {
                            newRotation = {
                                x:
                                    opts.assetRotation.value.x ??
                                    mesh.rotation.x,
                                y:
                                    opts.assetRotation.value.y ??
                                    mesh.rotation.y,
                                z:
                                    opts.assetRotation.value.z ??
                                    mesh.rotation.z,
                            };
                        }
                        // const result = await world.current.edit({
                        //     type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
                        //     updates: [
                        //         {
                        //             id: mesh.userData.id,
                        //             rotation: newRotation,
                        //         },
                        //     ],
                        // });
                        await handleChangeTransform({
                            targetMesh: mesh,
                            rotation: newRotation,
                            analytics: {
                                edited: ["position", "rotation", "scale"],
                                source: "ai",
                            },
                        });
                        didChange = true;
                    }

                    //* Change Position, support delta and relative position
                    //? gpt have super hard time with relative position, seems to be putting random numbers there may disapear once changing the context
                    if (opts.assetPosition) {
                        let newPosition;
                        if (opts.assetPosition?.relativeTo) {
                            let position = opts.assetPosition.relativeTo;
                            if (position === "player") {
                                position =
                                    world.current.getCurrentCoords().position;
                            }
                            //! [REVIEW] idk id we're free to use three js here so doing this for now it's probably v bad to redfine those in the loop
                            const normalize = (vector) => {
                                const magnitude = Math.sqrt(
                                    vector.x * vector.x +
                                        vector.y * vector.y +
                                        vector.z * vector.z
                                );
                                return {
                                    x: vector.x / magnitude,
                                    y: vector.y / magnitude,
                                    z: vector.z / magnitude,
                                };
                            };
                            const crossProduct = (vectorA, vectorB) => {
                                return {
                                    x:
                                        vectorA.y * vectorB.z -
                                        vectorA.z * vectorB.y,
                                    y:
                                        vectorA.z * vectorB.x -
                                        vectorA.x * vectorB.z,
                                    z:
                                        vectorA.x * vectorB.y -
                                        vectorA.y * vectorB.x,
                                };
                            };
                            const vectorFromPlayerToMesh = {
                                x: mesh.position.x - position.x,
                                y: mesh.position.y - position.y,
                                z: mesh.position.z - position.z,
                            };
                            const vec = normalize(vectorFromPlayerToMesh);
                            const orthoVec1 = {
                                x: -vec.y,
                                y: vec.x,
                                z: 0,
                            };
                            const orthoVec2 = crossProduct(vec, orthoVec1);
                            const { x, y, z } = opts.assetPosition.value;
                            opts.assetPosition.value = {
                                x:
                                    position.x +
                                    (x || 0) * vec.x +
                                    (y || 0) * orthoVec1.x +
                                    (z || 0) * orthoVec2.x,
                                y:
                                    position.y +
                                    (x || 0) * vec.y +
                                    (y || 0) * orthoVec1.y +
                                    (z || 0) * orthoVec2.y,
                                z:
                                    position.z +
                                    (x || 0) * vec.z +
                                    (y || 0) * orthoVec1.z +
                                    (z || 0) * orthoVec2.z,
                            };
                        }
                        if (opts?.assetPosition?.isDelta) {
                            newPosition = {
                                x:
                                    mesh.position.x +
                                    (opts.assetPosition.value.x || 0),
                                y:
                                    mesh.position.y +
                                    (opts.assetPosition.value.y || 0),
                                z:
                                    mesh.position.z +
                                    (opts.assetPosition.value.z || 0),
                            };
                        } else if (opts.assetPosition.reset) {
                            let defaultTransformString = mesh.userData.id; //hopping it won't change 🙌
                            let defaultTransform = defaultTransformString
                                .split("X")
                                .map((x) => parseFloat(x));
                            newPosition = {
                                x: defaultTransform[0],
                                y: defaultTransform[1],
                                z: defaultTransform[2],
                            };
                        } else {
                            newPosition = {
                                x:
                                    opts.assetPosition.value.x ??
                                    mesh.position.x,
                                y:
                                    opts.assetPosition.value.y ??
                                    mesh.position.y,
                                z:
                                    opts.assetPosition.value.z ??
                                    mesh.position.z,
                            };
                        }
                        // const result = await world.current.edit({
                        //     type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
                        //     artworkId: mesh.userData.id,
                        //     updates: [
                        //         {
                        //             id: mesh.userData.id,
                        //             position: newPosition,
                        //         },
                        //     ],
                        // });
                        await handleChangeTransform({
                            targetMesh: mesh,
                            position: newPosition,
                            analytics: {
                                edited: ["position", "rotation", "scale"],
                                source: "ai",
                            },
                        });
                        didChange = true;
                    }

                    //* Change Scale, support factor
                    if (opts.assetScale) {
                        let newScale = opts.assetScale.value;
                        if (opts.assetScale.reset) newScale = 1;
                        if (opts?.assetScale?.factor)
                            newScale *= mesh.scale.x || 1;
                        // const result = await world.current.edit({
                        //     type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
                        //     artworkId: mesh.userData.id,
                        //     updates: [
                        //         {
                        //             id: mesh.userData.id,
                        //             scale: {
                        //                 x: newScale,
                        //                 y: newScale,
                        //                 z: newScale,
                        //             },
                        //         },
                        //     ],
                        // });

                        await handleChangeTransform({
                            targetMesh: mesh,
                            scale: {
                                x: newScale,
                                y: newScale,
                                z: newScale,
                            },
                            analytics: {
                                edited: ["position", "rotation", "scale"],
                                source: "ai",
                            },
                        });
                        didChange = true;
                    }

                    return didChange ? mesh : null;
                })
            );
        }

        changedTargets = changedTargets.filter(
            (mesh) => mesh?.userData //?.placeholderId
        );

        if (changedTargets.length === 0) {
            return {
                success: false,
                type: "notfound",
                message: "No artworks found.",
            };
        }

        setPrevContext({
            placeholderIds: changedTargets.map(
                (mesh) => mesh.userData.placeholderId
            ),
            type: "artworks",
            opts,
            prevContext: prevContext,
            world: world,
        });

        return {
            success: true,
            prevContext: prevContext.current,
            feedbacks: getArtworksFeedback({
                placeholders: changedTargets,
                modifiedArtworks: changedTargets.map((mesh) => mesh.item.data),
                title: `${changedTargets.length} changed.`,
                world,
            }),
        };
    }

    async function handleChangeSky(opts) {
        try {
            if (
                opts.type !== "color" &&
                opts.type !== "image" &&
                opts.type !== "default" &&
                opts.type !== "sky"
            ) {
                opts.type = "image";
            }

            const onSelect = async (payload) => {
                await exhibitStore.updateExhibitInfo({
                    roomParameters: { sky: payload },
                });

                return {
                    success: true,
                    feedbacks: {
                        title: `Sky changed successfully.`,
                        suggestions: [],
                        undoable: true,
                    },
                };
            };

            const getPayload = (type, name) => {
                let payload: any = {};

                if (type === "color") {
                    payload.background_type = "color";
                    payload.enableSky = false;
                    payload.background = name;
                    payload.enableSky = false;
                }

                if (type === "image") {
                    const backgroundMap = BACKGROUNDMAPS[name];

                    if (backgroundMap) {
                        payload.background_type = "texture";
                        payload.backgroundMap = backgroundMap;
                        payload.applyEnvMapBackground = true;
                        payload.enableSky = false;
                    }
                }

                if (type === "sky") {
                    payload.background_type = "sky";
                    payload.enableSky = true;
                    payload.skyOptions = TYPES[name];
                }

                if (opts.type == "default") {
                    payload = {};
                }

                return payload;
            };

            const payload = getPayload(opts.type, opts.name || opts.color);

            if (opts.type === "image" && !payload.backgroundMap) {
                return {
                    success: true,
                    suggestions: {
                        title: "Skybox not found. Here are some suggestions.",
                        suggestions: Object.keys(BACKGROUNDMAPS)
                            .filter((s) => s !== "custom")
                            .map((key) => ({
                                Component: ({ isSelected }) => {
                                    return (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 12,
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 12,
                                                }}
                                            >
                                                <img
                                                    style={{
                                                        width: 57.38,
                                                        height: 21,
                                                        borderRadius: 2,
                                                        objectFit: "cover",
                                                    }}
                                                    src={
                                                        BACKGROUNDMAPS[key]
                                                            .image
                                                    }
                                                />
                                                <p>
                                                    {BACKGROUNDMAPS[key].name}
                                                </p>
                                            </div>
                                            {isSelected ? (
                                                <EnterBg
                                                    size={18}
                                                    foreground="#292929"
                                                    background="#fff"
                                                />
                                            ) : null}
                                        </div>
                                    );
                                },
                                onfocus: () => {
                                    world.current.uploaderSetRoomParameters({
                                        type: UPLOADER_TYPES.BACKGROUND_TYPE,
                                        roomParameters: {
                                            ...getPayload("image", key),
                                        },
                                    });
                                },
                                onselect: () => {
                                    return onSelect(getPayload("image", key));
                                },
                            })),
                    },
                };
            }

            if (opts.type === "sky" && !payload.skyOptions) {
                return {
                    success: true,
                    suggestions: {
                        title: "Sky not found. Here are some suggestions.",
                        suggestions: Object.keys(TYPES).map((key) => ({
                            text: key,

                            onfocus: () => {
                                world.current.uploaderSetRoomParameters({
                                    type: UPLOADER_TYPES.BACKGROUND_TYPE,
                                    roomParameters: {
                                        ...getPayload("sky", key),
                                    },
                                });
                            },
                            onselect: () => {
                                return onSelect(getPayload("sky", key));
                            },
                        })),
                    },
                };
            }

            world.current.uploaderSetRoomParameters({
                type: UPLOADER_TYPES.BACKGROUND_TYPE,
                roomParameters: { ...payload },
            });

            await exhibitStore.updateExhibitInfo({
                roomParameters: { sky: payload },
            });

            return {
                success: true,
                feedbacks: {
                    title: "Skybox changed",
                    suggestions: [],
                    undoable: true,
                },
            };
        } catch (err) {
            console.error("Skybox error", err);
            return {
                success: false,
            };
        }
    }

    return null;
}
