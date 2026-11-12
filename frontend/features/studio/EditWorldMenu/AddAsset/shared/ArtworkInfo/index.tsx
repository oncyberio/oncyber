import styled from "styled-components";

import { Asset } from "@uitypes/Asset";
import { AssetPreview } from "../AssetPreview";
import { RefreshMetadataButton } from "../../EditAsset/EditArtwork/RefreshMetadataButton";
import { RemoveButton } from "../../EditAsset/EditArtwork/RemoveButton";
import { Label } from "@features/studio/styles/Label";
import { isNft as isNftAsset } from "@features/studio/EditWorldMenu/utils";
import { LockTransform } from "../LockTransform";
import IconImg from "@ui/components/IconImg";

export function ArtworkInfo({
    asset,
    header,
    canDelete = true,
}: {
    asset: Asset;
    header?: string;
    canDelete?: boolean;
}) {
    //

    const isText = asset.mime_type === "cyber/text";

    const isNft = isNftAsset(asset);

    return (
        <Container>
            <Label className="artwork-info-header">
                {header ?? "Asset info"}
            </Label>
            <Wrapper>
                <div className="preview-img-wrapper">
                    <AssetPreview asset={asset} name={asset?.name} index={0} />
                    {asset.d_optimized_files && (
                        <div
                            style={{ position: "absolute", left: 0, bottom: 0 }}
                        >
                            <IconImg size={16} name="blue-check" />
                        </div>
                    )}
                </div>
                <div className="metadata">
                    <h3 className="artwork-name">
                        {isText ? "Text Asset" : asset?.name}
                    </h3>
                    {asset?.addedBy && (
                        <span className="added-by">
                            Added by {asset?.addedBy.slice(0, 8)}
                            ...
                        </span>
                    )}
                </div>
                <div className="header-actions">
                    {isNft && <RefreshMetadataButton />}
                    {canDelete && <RemoveButton />}
                </div>
            </Wrapper>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;

    @media (max-width: 600px) {
        .artwork-info-header {
            display: none;
        }
    }
`;

const Wrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;

    & .artwork-name {
        margin: 0;

        // font-size: 14px;
        font-weight: 500;
        font-size: 16px;
        line-height: 18px;
        color: #ffffff;
        margin-bottom: 6px;

        width: 10em;
        word-wrap: break-word;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    & .added-by {
        font-weight: 500;
        font-size: 12px;

        color: #777980;
    }

    .metadata {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .preview-img-wrapper {
        position: relative;
        flex: 0 0 56px;
        width: 56px;
        height: 56px;
        overflow: hidden;
        cursor: pointer;
        border-radius: 4px;

        @media (max-width: 600px) {
            display: none;
        }

        & .preview-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    .header-actions {
        display: flex;
        justify-content: flex-end;
        column-gap: 8px;
        flex: 0;
        margin-left: auto;
    }
`;
