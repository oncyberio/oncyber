import { useContext, useEffect, useState } from "react";
import { UserContext } from "@components/context/UserContext";

/** Space link actions carried over from the old details panel. */
export default function SpaceActions({
    spaceId,
    title,
    onGuestbook,
}: {
    spaceId: string;
    title: string;
    onGuestbook(): void;
}) {
    const { token, user } = useContext(UserContext) || ({} as any);
    const [bookmarked, setBookmarked] = useState(false);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (!token) return;
        let live = true;
        import("@utils/saveToDb")
            .then(({ didUserFavorited }) => didUserFavorited(spaceId, token))
            .then(
                (data) =>
                    live && data?.success && setBookmarked(!!data.hasFavorited)
            )
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [spaceId, token]);

    const flash = (text: string) => {
        setNotice(text);
        window.setTimeout(() => setNotice(""), 1600);
    };
    const link = () => {
        const url = new URL(window.location.href);
        url.hash = "";
        return url.toString();
    };
    const copy = async (text: string, done: string) => {
        try {
            await navigator.clipboard.writeText(text);
            flash(done);
        } catch {
            flash("Couldn’t copy. Try again.");
        }
    };
    const bookmark = async () => {
        if (!token || !user?.id) return flash("Sign in to bookmark spaces.");
        try {
            const { toggleFavorite } = await import("@utils/saveToDb");
            const data = await toggleFavorite(spaceId, token);
            if (data?.success) setBookmarked(!!data.hasFavorited);
        } catch {
            flash("Couldn’t update the bookmark.");
        }
    };

    return (
        <section className="info-section">
            <h3>Share and save</h3>
            <div className="space-actions">
                <button
                    type="button"
                    onClick={() => copy(link(), "Link copied")}
                >
                    Copy link
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const params = new URLSearchParams({
                            text: `${title} ${link()}`,
                        });
                        window.open(
                            `https://twitter.com/intent/tweet?${params}`,
                            "_blank",
                            "noopener"
                        );
                    }}
                >
                    Share on X
                </button>
                <button
                    type="button"
                    onClick={() =>
                        copy(
                            `<iframe width="100%" height="100%" src="${link()}"></iframe>`,
                            "Embed code copied"
                        )
                    }
                >
                    Embed
                </button>
                <button
                    type="button"
                    aria-pressed={bookmarked}
                    onClick={bookmark}
                >
                    {bookmarked ? "Bookmarked" : "Bookmark"}
                </button>
                <button type="button" onClick={onGuestbook}>
                    Guestbook
                </button>
            </div>
            <p className="action-notice" role="status" aria-live="polite">
                {notice}
            </p>
        </section>
    );
}
