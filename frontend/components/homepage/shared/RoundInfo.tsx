import Avatar from "@ui/components/Avatar";
import Link from "next/link";
import styled from "styled-components";

interface RoundInfoProps {
    src: string;
    alt: string;
    link: string;
    title: string;
    subtitle?: string;
}

export default function RoundInfo({
    src,
    alt,
    link,
    title,
    subtitle,
}: RoundInfoProps) {
    return (
        <AvatarItem>
            <Avatar
                size="smallplus"
                style={{
                    border: "1px solid #e1dfdf",
                }}
                src={src}
                title={alt}
            />
            <Link href={link} target="_blank" legacyBehavior>
                <a target="_blank">
                    <div style={{ cursor: "pointer" }}>
                        <p>{title}</p>
                        {subtitle ? <span>{subtitle}</span> : null}
                    </div>
                </a>
            </Link>
        </AvatarItem>
    );
}

const AvatarItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    font-size: 15px;
    color: #070707;
    margin: 16px 0;

    p {
        margin: 0;
    }

    span {
        font-size: 0.8em;
        color: #757575;
    }
`;
