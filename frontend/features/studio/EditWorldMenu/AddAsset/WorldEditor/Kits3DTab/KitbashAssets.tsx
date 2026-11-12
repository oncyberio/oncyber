import styled from "styled-components";
import { SearchInput } from "../../shared/SearchInput";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMemo, useState } from "react";
import { cloudinary, resize } from "@utils/urlUtils";
import { useEditWorld } from "../../../context/WorldEditContext";
import { useStylekit } from "@components/hooks/useStylekit";
import { Card } from "../Card";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { DRAG_MIMES } from "@3constants";

export function KitbashAssets({ kit }) {
    //

    const { handleAddKitbash, handleDragStart, exhibit, destination } =
        useEditWorld();

    const isNewUpload = destination.uPath?.fileURL != null;

    const [query, setQuery] = useState("");

    const stylekitData = useStylekit(kit);

    const world = useWorld();

    const types = world.current.getKitBashTypes();

    let kitImgs = {};

    if (isNewUpload) {
        //
        kitImgs = world.current.getKitbashImages();
    } else {
        //
        kitImgs = stylekitData.data?.kitbashImgs;
    }

    const shownTypes = useMemo(() => {
        if (!query) return types;

        return types.filter((it) => {
            return it.type?.toLowerCase().includes(query?.toLowerCase());
        });
    }, [query, types]);

    const handleAddType = async (type) => {
        handleAddKitbash({ ctype: type, kit, autoSelect: true });
    };

    const handleDrag = useEventCallback(
        (type: string, previewUrl: string, e: React.MouseEvent) => {
            //
            handleDragStart(e as any, DRAG_MIMES.KITBASH, {
                previewUrl,
                asset: { type, kit },
                mime: DRAG_MIMES.KITBASH,
            });
        },
        []
    );

    return (
        <Container>
            <SearchInput
                placeholder={"Search"}
                value={query}
                onChange={setQuery}
            />
            <Content className="scrollbar-hidden">
                {shownTypes.map((info) => {
                    //
                    let image = kitImgs?.[info.type];

                    if (image != null) {
                        image = resize(image, 256);
                    }

                    return (
                        <Card
                            key={info.type}
                            height={83}
                            image={image}
                            label={info.type}
                            onClick={() => {
                                handleAddType(info.type);
                            }}
                            onDrag={(e) => {
                                handleDrag(info.type, image, e);
                            }}
                        />
                    );
                })}
            </Content>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
`;

const Content = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(48px, 1fr));
    grid-column-gap: 12px;
    grid-row-gap: 12px;
    overflow-y: auto;
    width: 100%;
    height: 100%;
`;
