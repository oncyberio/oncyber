import { useCyberTheme } from "@components/context/ThemeProvider";
import RecArrowDown from "@ui/icons/RecArrowDown";
import RecArrowUp from "@ui/icons/RecArrowUp";
import { CSSProperties } from "react";
import styled from "styled-components";

type CollaborateProps = {
    style: CSSProperties;
    spaceVisits: string | number;
    daysSinceCreation: string | number;
};

const Metrics = (props: CollaborateProps) => {
    const { toggleTheme, isLightTheme } = useCyberTheme();

    return (
        <Container {...props}>
            <h2>Metrics</h2>

            <div>
                {/* <div>
                    <div>
                        <span>Time spent in your spaces</span>
                        <Clock
                            width="20px"
                            height="20px"
                            strokeColor="#18191C"
                        />
                    </div>
                    <h3>56:27</h3>
                </div> */}

                <Stats>
                    <div>
                        <span>Total Space Visits</span>
                        {/* <RecArrowUp
                            width="20px"
                            height="20px"
                            strokeColor="#18191C"
                        /> */}
                    </div>
                    <h3>{props.spaceVisits}</h3>
                </Stats>

                <Stats>
                    <div>
                        <span>Days Since Creation</span>
                        {/* <RecArrowDown
                            width="20px"
                            height="20px"
                            strokeColor="#18191C"
                        /> */}
                    </div>
                    <h3>{props.daysSinceCreation}</h3>
                </Stats>
            </div>
        </Container>
    );
};

const Container = styled.div<CollaborateProps>`
    width: 100%;
    display: flex;
    padding: 0px;
    transition: 0.4s;
    background: #ffffff;
    align-items: baseline;
    -webkit-transition: 0.4s;
    border-bottom: 1px solid #dfdfe4;
    align-items: flex-start;
    // margin-top: 68px;
    padding-top: 100px;

    @media (max-width: 954px) {
        height: auto;
        flex-direction: column;
    }

    & > h2 {
        font-style: normal;
        font-weight: 600;
        font-size: 32px;
        color: #18191c;
        line-height: 40px;
        margin: 0;
        min-width: 240px;
    }

    & > div {
        width: 100%;
        height: 100%;
        display: flex;
        flex-wrap: wrap;
        margin-left: 18.75rem;

        @media (max-width: 1162px) {
            margin-left: 16.875rem;
        }

        @media (max-width: 954px) {
            margin-left: 0px;
            margin-top: 20px;
            justify-content: flex-start;
        }
    }
`;

const Stats = styled.div`
    width: 240px;
    height: 170px;
    display: flex;
    // align-items: flex-end;
    flex-direction: column;
    padding: 8px 0px;

    @media (max-width: 1162px) {
        &:last-child {
            width: auto;
        }
    }

    @media (max-width: 830px) {
        margin-top: 20px;
        align-items: flex-start;
        padding: 0;
    }

    @media (max-width: 600px) {
        width: 120px;
    }

    & > div {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;

        @media (max-width: 830px) {
            width: 100%;
            justify-content: flex-start;
            flex-direction: row;
        }

        & > span {
            width: 80px;
            font-style: normal;
            font-weight: 400;
            font-size: 12px;
            line-height: 100%;
            color: #5c5c5c;
            margin-right: 10px;
        }
    }

    & > h3 {
        font-style: normal;
        font-weight: 600;
        font-size: 48px;
        line-height: 60px;
        color: #070707;
        margin: 0px;
        text-align: left;
    }
`;

Metrics.defaultProps = {
    style: {},
};

export default Metrics;
