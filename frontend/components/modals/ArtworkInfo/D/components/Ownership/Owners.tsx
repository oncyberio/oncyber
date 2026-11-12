import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Popover } from "../Popover";
import { ImageList } from "../ImageList";
import { Profile } from "./Profile";
import { formatUser } from "../../utils";
import { getEditorsProfile } from "@utils/saveToDb";
import { mergeUserData } from "@components/hooks/useProfile";
import { User } from "@uitypes/user";
import { LabelledImg } from "./LabelledImg";
import { IS_TOUCH } from "@components/_3DExhibit-v2/three/constants";
import { noop } from "@utils/js";
import { useCyberTranslation } from "@components/context/I18nContext";
import AccountsAPI from "@api/accounts/_api";

export const Owners = (props: {
    owners: Array<{ owner: Partial<User>; quantity: number }>;
    supply: number;
}) => {
    //

    const { t } = useCyberTranslation();

    const [owners, setOwners] = useState(props.owners);

    const hasAllOwners = useMemo(() => {
        //
        if (!props.supply) return owners.length < 10;

        const totalOwned = owners.reduce((acc, it) => acc + it.quantity, 0);

        return totalOwned === props.supply;
    }, [owners, props.supply]);

    useEffect(() => {
        const abort = new AbortController();

        async function fetchUsers() {
            //
            const result = await AccountsAPI.getUsers({
                type: "users",
                walletIds: props.owners.map(({ owner }) => owner.id),
            });

            if (abort.signal.aborted) return;

            if (result.success) {
                //
                let map = result.editors;

                setOwners((state) => {
                    return state.map((it) => {
                        let newUser = map[it.owner.id.toLowerCase()];
                        if (newUser) {
                            return {
                                ...it,
                                owner: mergeUserData(it.owner, newUser),
                            };
                        }
                        return it;
                    });
                });
            }
        }

        fetchUsers();

        return () => {
            abort.abort();
        };
    }, []);

    const triggerRef = useRef(null);

    const images = owners.map(({ owner }) => {
        return {
            url: owner.avatar,
            alt: owner.username || owner.id,
        };
    });

    return (
        <Container>
            <Popover
                placement={"top"}
                className="popover"
                triggerRef={triggerRef}
                trigger="click"
            >
                <h2 className="title">
                    {!hasAllOwners ? t`TOP_TEN` : ""} {t`ART_COLLECTORS`}{" "}
                </h2>
                <div className="popover-content d-scrollbar">
                    {owners.map(({ owner, quantity }, index) => {
                        //
                        const target = owner.id
                            ? `/@${owner.id}`
                            : owner?.avatar;

                        const img =
                            owner?.avatar || "/images/opensea-black.png";

                        const description =
                            owner.username ||
                            (owner.id && "@" + owner.id?.slice(0, 8));

                        return (
                            <LabelledImg
                                key={owner.id}
                                description={`${description} (${quantity})`}
                                img={img}
                                url={target}
                                style={{ border: "none" }}
                            />
                        );
                    })}
                </div>
            </Popover>
            <ImageList
                ref={triggerRef}
                maxShown={6}
                images={images}
                onClickMore={noop}
            />
        </Container>
    );
};

const Container = styled.div`
    position: relative;

    --max-item-width: 300px;

    & > .popover {
        width: 320px;
        max-height: 380px;
        display: flex;
        flex-direction: column;
        gap: 12px;

        & > h2.title {
            margin: 0;
            font-weight: 500;
            font-size: 20px;
            line-height: 28px;
            letter-spacing: -0.02em;
            color: #ffffff;
        }
    }

    & .popover-content {
        height: 100%;
        overflow-y: auto;
    }
`;
