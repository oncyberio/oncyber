import styled from "styled-components";

function CloseIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

const Icon = styled(CloseIcon)`
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
                <Icon {...props} />
            </Container>
        </div>
    );
}
