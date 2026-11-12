import styled from "styled-components";

function MenuIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

const Icon = styled(MenuIcon)`
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

export default function StyledMenuIcon({
    size = 24,
    color = "#010103",
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
