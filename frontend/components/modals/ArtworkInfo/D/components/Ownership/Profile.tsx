import React from "react";
import { useProfile } from "@components/hooks/useProfile";
import { LabelledImg } from "./LabelledImg";
import { User } from "@uitypes/user";
import { useCyberTranslation } from "@components/context/I18nContext";

export interface ProfileProps {
    label?: string;
    user: Partial<User> & { id: string };
    url: string;
    className?: string;
    style?: React.CSSProperties;
}

export const Profile = React.forwardRef<HTMLDivElement, ProfileProps>(
    ({ label, user, url, className = "", style = {} }, ref) => {
        //
        const profile = useProfile(user);

        const { t } = useCyberTranslation();

        const target = profile?.id ? `/@${profile?.id}` : url;

        const img =
            profile?.avatar ||
            (profile as any)?.user?.profile_img_url ||
            (profile as any)?.profile_img_url ||
            "/images/opensea-black.png";

        const description =
            user?.username ||
            profile?.username ||
            (profile?.id && "@" + profile.id?.slice(0, 8)) ||
            `${t`LOADING`}…`;

        return (
            <LabelledImg
                ref={ref}
                className={className}
                style={style}
                label={label}
                img={img}
                url={target}
                description={description}
            />
        );
    }
);
