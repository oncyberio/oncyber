import { CloudinaryNextImage } from "@components/CloudinaryNextImage";
import { UserContext } from "@components/context/UserContext";

import { showModal } from "@components/Dialogs";

import { NButton } from "@ui/components/NButton";

import { PaddingWrapper } from "pages/collections/[slug]";
import { useContext } from "react";

import styled from "styled-components";

import CollectionUpdateModal from "./Modal/Update";

export default function Header({ syncCollection, collection, isEditable }) {
    const { user } = useContext(UserContext);

    function handleClick() {
        showModal(
            <CollectionUpdateModal
                syncCollection={syncCollection}
                collection={collection}
            />,
            {
                style: {
                    width: "450px",
                },
                // The shared dark dialog, on every page.
                theme: "dark",
            }
        );
    }

    return (
        <Container>
            <Background
                background={
                    collection?.images?.banner_image_url ||
                    collection?.images?.large_image_url
                }
            >
                <Overlay />
            </Background>

            <PaddingWrapper>
                <InfoWrapper>
                    <AvatarTitleWrapper>
                        <CloudinaryNextImage
                            alt={`${collection.slug} avatar`}
                            src={
                                collection?.images?.image_url ||
                                collection?.images?.large_image_url
                            }
                            width={130}
                            height={130}
                            style={{
                                objectFit: "cover",
                                borderRadius: 8,
                                boxShadow: "0 3px 5px rgb(0 0 0 / 10%)",
                            }}
                        />

                        <TitleWrapper>
                            <Title>{collection.name}</Title>
                        </TitleWrapper>
                    </AvatarTitleWrapper>

                    {collection.editors
                        .map((wallet) => wallet.toLowerCase())
                        .includes(user.id) ? (
                        <NButton onClick={handleClick}>Edit</NButton>
                    ) : null}
                </InfoWrapper>
            </PaddingWrapper>
        </Container>
    );
}

const Container = styled.div``;

const Background = styled.div<{ background?: string }>`
    background: linear-gradient(
            0deg,
            #ffffff 0%,
            rgba(255, 255, 255, 0) 150.37%
        ),
        url(${(props) => props.background});
    background-size: cover;
    background-position: center;
    margin: -80px 0;
    height: 300px;
    width: 100%;
    z-index: -1;
    position: relative;
    gap: 48px;
`;

const Overlay = styled.div`
    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.6) 0%,
        rgba(0, 0, 0, 0) 100%
    );
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
`;

const AvatarTitleWrapper = styled.div`
    display: flex;
    gap: 32px;
    padding: 12px 0;

    p,
    h1 {
        margin: 0;
    }
`;

const InfoWrapper = styled.div`
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const Title = styled.h1`
    font-weight: 600;
    font-size: 32px;
    line-height: 80%;
    margin-bottom: 12px;
`;

const TitleWrapper = styled.div`
    padding: 12px 0;

    h1 {
        line-height: 1.1em;
    }
`;
