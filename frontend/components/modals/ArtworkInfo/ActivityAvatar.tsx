import { useEffect, useRef, useState } from "react";
import { fetchOpenSeaProfileImage } from "@utils/artworks/history/profile";

const DEFAULT_AVATAR = "/images/opensea-black.png";

export function ActivityAvatar({
    address,
    fallbackSrc,
    label,
}: {
    address?: string;
    fallbackSrc?: string;
    label?: string;
}) {
    const ref = useRef<HTMLImageElement>(null);
    const [profile, setProfile] = useState<{ address: string; image: string }>(
        null
    );
    const [failedSources, setFailedSources] = useState<string[]>([]);
    const fallback = fallbackSrc || DEFAULT_AVATAR;
    const image = profile?.address === address ? profile.image : null;
    const src =
        [image, fallback, DEFAULT_AVATAR].find(
            (value) => value && !failedSources.includes(value)
        ) || DEFAULT_AVATAR;

    useEffect(() => {
        let disposed = false;
        setFailedSources([]);
        const load = () => {
            fetchOpenSeaProfileImage(address).then((image) => {
                if (!disposed) setProfile({ address, image });
            });
        };
        let observer: IntersectionObserver;
        if (typeof IntersectionObserver === "undefined") {
            load();
        } else {
            observer = new IntersectionObserver(
                (entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        observer.disconnect();
                        load();
                    }
                },
                { rootMargin: "100px" }
            );
            if (ref.current) observer.observe(ref.current);
        }
        return () => {
            disposed = true;
            observer?.disconnect();
        };
    }, [address]);

    return (
        <img
            ref={ref}
            src={src}
            alt={label || address || "Profile"}
            title={label || address}
            loading="lazy"
            decoding="async"
            style={{ objectFit: "cover" }}
            onError={() => {
                if (src !== DEFAULT_AVATAR)
                    setFailedSources((failed) => [...failed, src]);
            }}
        />
    );
}
