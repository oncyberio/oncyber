import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Exhibit() {
    const router = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV !== "development") return;

        import("../../gl").then((mod) => {
            mod.load3DSpace({ spaceId: router.query.id });
        });
    });

    return null;
}
