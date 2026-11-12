import { useEffect, useContext } from "react";
import nookies from "nookies";
import { auth } from "@utils/middlewares/authMiddleware";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext, USER_LOGIN } from "@components/context/UserContext";
import HomeNavigation from "@components/nav/home";
import styled from "styled-components";
import HomeProvider from "@components/context/HomeContext";
import DestinationSelector from "@features/spaces/create/components/DestinationSelector";
import { feedBasicServerSideProps } from "@utils/serverside/feedBasicServerSideProps";
import { useEventCallback } from "@components/hooks/useEventCallback";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import SignupProvider from "@components/modals/SignupProvider";
import { noop } from "@utils/js";
import { useRouter } from "next/router";
import { fetchMarketplaceRooms } from "@dapp/cyberRooms";

function DestinationMarketplace_Child({ rooms }) {
    //
    const { user, dispatch, authenticated, token } = useContext(UserContext);

    const router = useRouter();

    useEffect(() => {
        amplitude_logAnalyticsEvent(`view_marketplace`, {
            user_id: user?.id,
            source: "Marketplace",
        });
    }, []);

    const handleCreateSpace = useEventCallback(() => {
        //
        return window.location.href = "/studio"
    }, []);

    return (
        <div style={{ position: "relative" }}>
            <HomeNavigation />
            <DestinationSelector
                context={"marketplace"}
                rooms={rooms}
                isModal={false}
                onCreateSpace={handleCreateSpace}
                title={
                    <>
                        Build A <span className="art">3D World</span>
                    </>
                }
                description={
                    <>Select a Template and start building your mini world</>
                }
            />
        </div>
    );
}

export default function DestinationMarketplace({ rooms, ...props }) {
    //

    return (
        <HomeProvider isFilter={false} {...props}>
            <DestinationMarketplace_Child rooms={rooms} />
        </HomeProvider>
    );
}

export const getServerSideProps = async (context) => {
    //
    const [feedProps, roomProps] = await Promise.all([
        feedBasicServerSideProps(context),
        roomServerSideProps(context),
    ]);

    return {
        props: {
            ...feedProps.props,
            ...roomProps.props,
        },
    };
};

const roomServerSideProps = async (context) => {
    try {
        //
        const cookies = nookies.get(context);

        let token = cookies?.[cookies?.["_CCA"]];

        let userId = null;

        if (token) {
            try {
                userId = await auth({ cookies });
            } catch (err) {}
        }

        const rooms = await fetchMarketplaceRooms(userId, token);

        return {
            props: {
                rooms,
            },
        };

        //
    } catch (err) {
        //
        console.error(err);

        return {
            props: {},
        };
    }
};
