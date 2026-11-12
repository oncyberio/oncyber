import { PaginatorState } from "@components/hooks/usePaginator";
import IconImg from "@ui/components/IconImg";

export function Pagination({
    prev,
    next,
    page,
    setPage,
    pageLinks,
    totalPages,
    maxButtons,
}: PaginatorState) {
    if (pageLinks.length < 2) return null;

    return (
        <div className="pagination">
            {totalPages > maxButtons && (
                <div
                    className={`page-link ${
                        prev == null ? "disabled" : "link"
                    }`}
                    onClick={() => {
                        if (prev != null) {
                            prev();
                        }
                    }}
                >
                    <IconImg size={18} name="chevron-left" />
                </div>
            )}
            {pageLinks.map((link) => {
                //
                const isPageLink = typeof link === "number";

                const linkCss = isPageLink ? "link" : "";

                const activeCss = isPageLink && page == link ? "active" : "";

                return (
                    <div
                        className={`page-link ${activeCss} ${linkCss}`}
                        onClick={() => {
                            if (typeof link === "number") {
                                setPage(link);
                            }
                        }}
                    >
                        <span className="page-link-text">{link}</span>
                    </div>
                );
            })}
            {totalPages > maxButtons && (
                <div
                    className={`page-link ${
                        next == null ? "disabled" : "link"
                    }`}
                    onClick={() => {
                        if (next != null) {
                            next();
                        }
                    }}
                >
                    <IconImg size={18} name="chevron-right" />
                </div>
            )}
        </div>
    );
}
