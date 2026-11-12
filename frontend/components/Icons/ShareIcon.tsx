import styled from "styled-components";

function ShareIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
            {...props}
        >
            <path
                stroke={props?.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3.334 10v6.667a1.667 1.667 0 001.667 1.666h10a1.667 1.667 0 001.666-1.666V10M13.333 5L9.999 1.667 6.666 5M10 1.667V12.5"
            ></path>
        </svg>
    );
}

const Icon = styled(ShareIcon)`
    position: absolute;
    left: 0;
    top: 0;
`;

const Container = styled.div`
    width: 100%;
    height: 0;
    padding-top: 100%;
    position: relative;
`;

export default function StyledCloseIcon({
    size = 24,
    color = "#070707",
    ...props
}) {
    return (
        <div style={{ width: size, height: size, color }}>
            <Container>
                <Icon {...props} color={color} />
            </Container>
        </div>
    );
}
