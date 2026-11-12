import { useMemo, useState } from "react";

function range(start: number, end: number) {
    let res: number[] = [];

    for (let i = start; i <= end; i++) {
        res[i - start] = i;
    }

    return res;
}

export interface PaginatorState {
    prev: null | (() => void);
    next: null | (() => void);
    totalPages: number;
    page: number;
    setPage: (page: number) => void;
    pageLinks: (string | number)[];
    maxButtons: number;
}

export function usePaginator(
    totalItems: number,
    pageSize: number,
    maxButtons: number
): PaginatorState {
    const [page, setPage] = useState(1);
    const [offset, setOffset] = useState(1);

    //

    const totalPages = useMemo(() => {
        return Math.ceil(totalItems / pageSize);
    }, [totalItems, pageSize]);
    //

    const { pageLinks, prev, next } = useMemo(() => {
        //
        let pageLinks: any[];

        if (totalItems <= pageSize) {
            pageLinks = [1];
        } else if (totalPages <= maxButtons) {
            pageLinks = range(1, totalPages);
        } else if (totalPages - offset < maxButtons) {
            pageLinks = range(offset, totalPages);
        } else {
            pageLinks = [
                ...range(offset, offset + maxButtons - 3),
                "...",
                totalPages,
            ];
        }

        const prev =
            totalPages < 2 || page === 1
                ? null
                : () => {
                      setPage((s) => s - 1);
                      if (page === offset) {
                          setOffset((s) => s - 1);
                      } else if (
                          page === totalPages &&
                          pageLinks.every((it) => it !== page - 1)
                      ) {
                          setOffset(totalPages - maxButtons + 1);
                      }
                  };

        const next =
            totalPages < 2 || page === totalPages
                ? null
                : () => {
                      setPage((s) => s + 1);
                      if (
                          page === offset + maxButtons - 3 &&
                          totalPages - offset >= maxButtons
                      ) {
                          setOffset((s) => s + 1);
                      }
                  };

        return { prev, next, pageLinks };
    }, [totalPages, maxButtons, offset, page]);

    return {
        prev,
        next,
        totalPages,
        page,
        setPage,
        pageLinks,
        maxButtons,
    } as const;
}
