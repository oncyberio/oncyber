import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useCyberTranslation } from "@components/context/I18nContext";
import Spinner from "@ui/components/Spinner";
import { getUserByWalletId } from "@utils/saveToDb";
import { useEffect, useState } from "react";

import styled from "styled-components";
import { usePanel } from "../context/PanelProvider";

const Creator = ({ creator }) => {
    const [profile, setProfile] = useState(creator);

    const walletId =
        profile?.id?.slice(0, 4) +
        "..." +
        profile?.id?.slice(profile?.id?.length - 4, profile?.id?.length);

    useEffect(() => {
        (async () => {
            if (creator) {
                // we search getUserByWalletId when theres an @
                const d = await getUserByWalletId("@" + creator);

                if (d.success) {
                    // @ts-ignore
                    const _user = { username: d?.username, id: d?.id };

                    setProfile(d?.user || _user);
                }
            }
        })();
    }, []);

    return (
        <span>@{profile?.username || (profile?.id ? walletId : "anon")}</span>
    );
};

export default function Exhibits({ loading, exhibits }) {
    const world = useWorld();

    const { selectedUser, setCurrentTab } = usePanel();

    const { t } = useCyberTranslation();

    if (!loading && exhibits.length === 0)
        return <div className="no-exhibits-found">{t`NO_EXHIBITS`}.</div>;

    return !loading ? (
        <SpaceGrid>
            {exhibits.map((exhibit) => {
                const { invited, info, id, total_artworks } = exhibit;

                const { cHeroImg, heroImg, headline, customLink } = info;

                return (
                    <a
                        onClick={(e) => {
                            e.preventDefault();

                            world.current.summonPortal({
                                exhibitId: id,
                                source: "profile",
                            });

                            setCurrentTab("");

                            return false;
                        }}
                        key={id}
                        target="_blank"
                        href={customLink ? `/${customLink}` : `/spaces/${id}`}
                    >
                        <ExhibitWrapper>
                            <LegacyCloudinaryNextImage
                                className="image"
                                width={170}
                                height={120}
                                src={heroImg || cHeroImg}
                                layout="fill"
                                objectFit="cover"
                                unoptimized
                            />
                            <div>
                                <h3>{headline}</h3>
                                <ul>
                                    <li>
                                        <Creator creator={exhibit?.owner} />
                                    </li>
                                    <li>
                                        <span>
                                            {total_artworks}{" "}
                                            {total_artworks === 1
                                                ? t`ARTWORK`
                                                : t`ARTWORKS`}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </ExhibitWrapper>
                    </a>
                );
            })}
        </SpaceGrid>
    ) : (
        <SpinnerWrapper>
            <Spinner />
        </SpinnerWrapper>
    );
}

const SpinnerWrapper = styled.div`
    display: flex;
    justify-content: center;
`;

const SpaceGrid = styled.div`
    display: grid;

    grid-template-columns: repeat(1, minmax(0, 1fr));

    grid-gap: 8px;
`;

const ExhibitWrapper = styled.div`
    position: relative;

    overflow: hidden;

    height: 120px;

    // z-index: -1;

    border-radius: 8px;

    filter: brightness(80%);
    transition: 0.2s;

    & > div {
        width: 100%;
        height: 100%;
        background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0) 15.2%,
            rgba(0, 0, 0, 0.7) 66.77%
        );
        position: absolute;
        z-index: 1;

        padding: 8px;

        display: flex;
        flex-direction: column;
        justify-content: flex-end;

        p {
            margin: 0;
            font-weight: 400;
            font-size: 12px;
            color: #ffffff;
            opacity: 0.5;
        }

        h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #ffffff;
            overflow: hidden;
            line-height: 100%;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        & > ul {
            margin: 0;
            padding: 0;
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-start;

            & > li {
                margin: 0;
                margin-right: 18px;

                &:first-child {
                    list-style: none;
                }

                & > span {
                    font-weight: 400;
                    font-size: 12px;
                    color: #c2c2c2;
                    line-height: 100%;
                    margin-right: 8px;
                }
            }
        }
    }

    &:hover {
        filter: brightness(100%);
    }
`;
