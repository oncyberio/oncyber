import styled from "styled-components";

// Shown instead of white-screening when the device/browser can't create a WebGL
// context. ~12% of users hit this (low-end Android, Linux driver blocklists,
// hardware-acceleration off, in-app webviews).
export default function WebGLNotSupported() {
    return (
        <Wrap>
            <Card>
                <h2>3D isn&apos;t available here</h2>
                <p>
                    oncyber needs WebGL to render 3D worlds, and your browser
                    couldn&apos;t start it. To view this world, try:
                </p>
                <ul>
                    <li>
                        Turning on <b>hardware acceleration</b> in your browser
                        settings, then reloading
                    </li>
                    <li>
                        Opening the link directly in <b>Chrome</b> or{" "}
                        <b>Safari</b> (not inside another app&apos;s browser)
                    </li>
                    <li>Updating your browser, or trying another device</li>
                </ul>
                <button onClick={() => location.reload()}>Reload</button>
            </Card>
        </Wrap>
    );
}

const Wrap = styled.div`
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0b0b0e;
    color: #f5f5f5;
    padding: 24px;
    z-index: 1000;
`;

const Card = styled.div`
    max-width: 460px;
    text-align: left;
    font-family: Helvetica, Arial, sans-serif;

    h2 {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 12px;
    }

    p {
        font-size: 15px;
        line-height: 1.5;
        opacity: 0.85;
        margin: 0 0 12px;
    }

    ul {
        margin: 0 0 20px;
        padding-left: 18px;
        font-size: 14px;
        line-height: 1.6;
        opacity: 0.85;
    }

    b {
        color: #fff;
    }

    button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        padding: 10px 18px;
        border-radius: 8px;
        cursor: pointer;

        &:hover {
            background: rgba(255, 255, 255, 0.18);
        }
    }
`;
