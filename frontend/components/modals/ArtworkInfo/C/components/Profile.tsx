import React from "react";
import styled from "styled-components";
import { useProfile } from "../../../../hooks/useProfile";
import { LabelledImg } from "./LabelledImg";

export const Profile = ({ label, user, url, verified = false }) => {
    const profile = useProfile(user);

    const target = profile?.id ? `/@${profile?.id}` : url;

    const img =
        profile?.avatar ||
        profile?.user?.profile_img_url ||
        "/images/opensea-black.png";

    const description =
        profile?.username ||
        (profile?.id && "@" + profile.id?.slice(0, 8)) ||
        "Loading…";

    return (
        <LabelledImg
            label={label}
            img={img}
            url={target}
            verified={verified}
            description={description}
        />
    );
};
