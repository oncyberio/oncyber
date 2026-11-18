import dynamic from "next/dynamic";

/** The avatar maker: build a toon avatar from sliders, choices and colours. */
const AvatarMaker = dynamic(
    () => import("@features/toon-avatar/maker/AvatarMaker"),
    {
        ssr: false,
    }
);

export default function AvatarMakerPage() {
    return <AvatarMaker />;
}
