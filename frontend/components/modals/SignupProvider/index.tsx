import styled from "styled-components";
import DestinationSelector from "@features/spaces/create/components/DestinationSelector";
// import DestinationSelector from "@features/spaces/create/components/DestinationSelector";
import ProviderButtons from "./ProviderButtons";
import { WalletConnection } from "@dapp/connect";
import DefaultLayout from "@components/layouts/default";
import { Step, UserContext, USER_LOGIN } from "@context/UserContext";
import { useContext } from "react";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Experience } from "@uitypes/experience";
import { ProviderButtonsWrapper } from "./ProviderButtonsWrapper";

interface SignupProviderProps {
    step: Step;
    setStep?: Function;
    errorMessage?: string;
    onConnect?: (connection: WalletConnection, token: string) => Promise<void>;
}

const SignupProvider: React.FunctionComponent<SignupProviderProps> = ({
    onConnect,
    step,
    setStep,
    errorMessage,
}) => {
    const { user, dispatch, exhibit } = useContext(UserContext);

    const handleClose = useEventCallback(() => {
        dispatch({
            type: USER_LOGIN,
            payload: {
                authenticated: true,
            },
        });
    }, []);

    const handleCreateSpace = (exhibit: Experience) => {
        dispatch({
            type: USER_LOGIN,
            payload: {
                authenticated: true,
                loading: false,
                isFirstLogin: true,
                exhibit,
            },
        });
    };

    return (
        <DefaultLayout overrideTheme="light">
            <Container>
                {step === "connect" ? (
                    <SignUpWrapper>
                        <ProviderButtonsWrapper
                            errorMessage={errorMessage}
                            onConnect={onConnect}
                        >
                            <ProviderButtons hideLogo />
                        </ProviderButtonsWrapper>
                    </SignUpWrapper>
                ) : null}
                {step === "create-destination" ? (
                    <DestinationSelector
                        context={"studio"}
                        isModal={!!(user?.id && exhibit)}
                        handleClose={handleClose}
                        onCreateSpace={handleCreateSpace}
                        title={
                            <>
                                Choose your <span className="art">WORLD</span>
                            </>
                        }
                        description={
                            <>
                                Select your oncyber world. Some are designed by
                                select architects and released in limited
                                editions as NFTs.
                            </>
                        }
                    />
                ) : null}
            </Container>
        </DefaultLayout>
    );
};

const Container = styled.div`
    max-width: 100%;
    background: #fff;
    margin: 0 auto;
    position: relative;
    display: flex;
    justify-content: center;
    min-height: 90vh;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const SignUpWrapper = styled.div`
    display: flex;
    align-items: center;
    margin: 0 auto;
    max-width: 350px;
    width: 100%;

    .provider-buttons_main {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
    }

    .provider-buttons_content {
        display: flex;
    }
`;

const How = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    background: linear-gradient(180deg, #111111 0%, #010103 100%);
    padding: 48px;
    color: white;

    & > div {
        color: white;
        border-radius: 20px;
        padding-bottom: 80px;
    }

    h1 {
        max-width: 320px;

        font-weight: 600;
        font-size: 40px;
    }

    p {
        max-width: 320px;
        // float: right;
        text-align: left;
        font-size: 16px;
        font-weight: 400;
        margin: 12px 0px;
        // display: flex;
        // align-items: center;
        a {
            color: #9400f4;
        }
        img {
            height: 40px;
        }
    }

    @media (max-width: 1200px) {
        padding: 32px 0px 32px 32px;

        h1 {
            font-size: 36px;
        }

        p {
            font-size: 16px;
        }
    }

    @media (max-width: 900px) {
        display: none;
        padding: 8px;
        p {
            font-size: 16px;
        }
    }
`;

const Info = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    background: linear-gradient(180deg, #111111 0%, #010103 100%);
    padding: 48px;
    color: white;

    & > div {
        color: white;
        border-radius: 20px;
        padding-bottom: 80px;
    }

    h1 {
        max-width: 320px;

        font-weight: 600;
        font-size: 40px;
        margin-bottom: 0;
    }

    p {
        max-width: 320px;
        // float: right;
        text-align: left;
        font-size: 16px;
        font-weight: 400;
        margin: 12px 0px;
        // display: flex;
        // align-items: center;
        a {
            color: #9400f4;
        }
        img {
            height: 40px;
        }
    }

    @media (max-width: 1200px) {
        padding: 32px 16px 32px 32px;

        h1 {
            font-size: 36px;
        }

        p {
            font-size: 16px;
        }
    }

    @media (max-width: 900px) {
        display: none;
        padding: 24px;
        p {
            font-size: 16px;
        }
    }
`;

const Certifications = styled.div`
    display: flex;
    justify-content: space-between;
    width: 100%;
    text-align: center;
    margin-top: 20px;
    padding-bottom: 0 !important;
    max-width: 320px;

    a {
        opacity: 0.4;
        font-weight: 400;
        font-size: 14px;
        margin: 0;
    }
`;

export default SignupProvider;
