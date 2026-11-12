import { BUILD_CARDS } from "./buildOptions";
import {
    DEFAULT_FILTERS,
    fetchLandingFeed,
    filterBrowseCards,
    parseFilters,
    toLandingCards,
} from "./data";
import {
    adjacentColumn,
    selectedCardIndex,
    moveGridSelection,
    columnOpacity,
    cellDimensions,
    createGridLayout,
    cylinderMetrics,
    projectPoint,
} from "./three/layout";

jest.mock("@utils/urlUtils", () => ({ resize: (url: string) => url }));

const exhibits = [
    {
        id: "image",
        info: {
            headline: "Élan Museum",
            heroImg: "https://example.com/landscape.jpg",
            description: "Digital sculptures",
            curator: "Alice",
            customLink: "elan",
        },
        owner: "0xAlice",
        chains: ["ethereum"],
        collections: ["art-blocks"],
    },
    {
        id: "panorama",
        info: {
            headline: "Open skies",
            cHeroImg360: "https://example.com/panorama.jpg",
            cHeroImg: "https://example.com/cover.jpg",
        },
        owner: "0xBob",
        chains: ["polygon"],
    },
    {
        objectID: "portrait",
        headline: "Tall gallery",
        cHeroImg: "https://example.com/portrait.jpg",
        thumbnailOrientation: "portrait",
    },
];

describe("landing discovery data", () => {
    it("keeps cover images and destination links without exposing 360 captures", () => {
        const cards = toLandingCards(exhibits);
        expect(cards).toHaveLength(3);
        expect(cards[0]).toMatchObject({
            href: "/elan",
            imageUrls: ["https://example.com/landscape.jpg"],
        });
        expect(cards[1]).toMatchObject({
            href: "/spaces/panorama",
            imageUrls: ["https://example.com/cover.jpg"],
        });
        expect(cards[2].portrait).toBe(true);
        expect(cards.every((card) => !("panoramaUrl" in card))).toBe(true);
        expect(
            toLandingCards([
                { id: "only-360", cHeroImg360: "https://example.com/360.jpg" },
            ])[0].imageUrls
        ).toEqual([]);
    });
    it("retains experiences without a cover and ignores malformed or repeated records", () => {
        const cards = toLandingCards([
            null,
            {},
            exhibits[0],
            exhibits[0],
            { id: "unpictured", info: {} },
        ]);
        expect(cards.map((card) => card.id)).toEqual(["image", "unpictured"]);
        expect(cards[1].imageUrls).toEqual([]);
    });
    it("rejects non-image URL schemes and keeps custom routes internal", () => {
        const [card] = toLandingCards([
            {
                id: "safe",
                info: {
                    cHeroImg: "javascript:alert(1)",
                    heroImg: "//untrusted.example/a.jpg",
                    cHeroImg360: "data:text/html,x",
                    customLink: "//outside.example",
                },
            },
        ]);
        expect(card.imageUrls).toEqual([]);
        expect(card).not.toHaveProperty("panoramaUrl");
        expect(card.href).toBe("/outside.example");
    });
    it("searches titles, descriptions, and creators without case or accent sensitivity", () => {
        const cards = toLandingCards(exhibits);
        expect(
            filterBrowseCards(cards, {
                ...DEFAULT_FILTERS,
                q: "ELAN alice sculptures",
            }).map((card) => card.id)
        ).toEqual(["image"]);
        expect(
            filterBrowseCards(cards, { ...DEFAULT_FILTERS, q: "missing world" })
        ).toEqual([]);
    });
    it("combines creator, collection and blockchain filters", () => {
        const cards = toLandingCards(exhibits);
        const filters = {
            ...DEFAULT_FILTERS,
            owner: "0xALICE",
            collection: "ART-BLOCKS",
            chain: "ethereum",
        };
        expect(
            filterBrowseCards(cards, filters).map((card) => card.id)
        ).toEqual(["image"]);
        expect(
            filterBrowseCards(cards, { ...filters, chain: "polygon" })
        ).toEqual([]);
    });
    it("normalizes shared URLs without accepting arrays or unknown filter enums", () => {
        expect(
            parseFilters({
                q: ["oops"],
                category: "unknown",
                preview: "unknown",
            })
        ).toEqual(DEFAULT_FILTERS);
        expect(
            parseFilters({
                q: "museum",
                category: "latest",
                preview: "panorama",
            })
        ).toMatchObject({
            q: "museum",
            category: "latest",
        });
    });
});

describe("cylindrical grid", () => {
    const cards = toLandingCards(
        Array.from({ length: 70 }, (_, index) => ({
            ...exhibits[index % 3],
            id: `world-${index}`,
        }))
    );
    it.each([
        [2, 2],
        [1, 1],
    ])(
        "fills a continuous %i×%i grid with no page gaps or repeated cards",
        (columns, rows) => {
            const { cells, columnCount, maxScrollColumn } = createGridLayout(
                cards,
                columns,
                rows
            );
            const occupied = new Set();
            expect(cells).toHaveLength(cards.length);
            expect(columnCount).toBe(Math.ceil(cards.length / rows));
            expect(maxScrollColumn).toBe(Math.max(0, columnCount - columns));
            for (const cell of cells) {
                expect(cell.row).toBeLessThan(rows);
                expect(cell.column).toBeLessThan(columnCount);
                const key = `${cell.row}:${cell.column}`;
                expect(occupied.has(key)).toBe(false);
                occupied.add(key);
                expect(cell.column * rows + cell.row).toBe(cell.index);
            }
        }
    );
    it.each([
        [2, 2],
        [1, 1],
    ])(
        "snaps one column in %i×%i and retains the overlapping cards",
        (columns, rows) => {
            const metrics = cylinderMetrics(1280, 360, columns, rows);
            const { cells, maxScrollColumn } = createGridLayout(
                cards,
                columns,
                rows
            );
            const first = cellDimensions(cells[0], metrics, 0);
            const last = cellDimensions(cells[columns * rows - 1], metrics, 0);
            expect(first.x + last.x).toBeCloseTo(0);
            expect(first.y + last.y).toBeCloseTo(0);
            const nextStop = adjacentColumn(0, 1, maxScrollColumn);
            expect(nextStop).toBe(1);
            expect(cellDimensions(cells[rows], metrics, nextStop)).toEqual(
                first
            );
            expect(cellDimensions(cells[0], metrics, nextStop).x).toBeCloseTo(
                first.x - metrics.columnStride
            );
            const visibleAt = (progress: number) =>
                cells
                    .filter(
                        (cell) =>
                            columnOpacity(cell.column, progress, columns) === 1
                    )
                    .map((cell) => cell.index);
            const before = visibleAt(0);
            const after = visibleAt(nextStop);
            expect(after).toEqual(
                Array.from({ length: columns * rows }, (_, i) => i + rows)
            );
            expect(
                after.filter((index) => before.includes(index))
            ).toHaveLength((columns - 1) * rows);
            expect(
                after.filter((index) => !before.includes(index))
            ).toHaveLength(rows);
            if (columns > 1)
                expect(metrics.columnStride).toBe(
                    metrics.cardWidth + metrics.gap
                );
        }
    );
    it.each([
        [2, 2],
        [1, 1],
    ])(
        "ends a %i×%i grid at the last column, including a partial final column",
        (columns, rows) => {
            const { cells, maxScrollColumn } = createGridLayout(
                cards.slice(0, 13),
                columns,
                rows
            );
            const visible = cells.filter(
                (cell) =>
                    columnOpacity(cell.column, maxScrollColumn, columns) === 1
            );
            expect(visible[visible.length - 1].index).toBe(12);
            expect(visible[0].index).toBe(maxScrollColumn * rows);
            expect(adjacentColumn(maxScrollColumn, 1, maxScrollColumn)).toBe(
                maxScrollColumn
            );
            expect(
                createGridLayout(cards.slice(0, 1), columns, rows)
                    .maxScrollColumn
            ).toBe(0);
            expect(createGridLayout([], columns, rows).maxScrollColumn).toBe(0);
        }
    );
    it("uses the reference's single-card width and leaves neighboring cards visible", () => {
        const metrics = cylinderMetrics(1630, 424, 1, 1);
        expect(metrics.cardWidth).toBeCloseTo(755);
        expect(metrics.cardHeight).toBeCloseTo(418, 0);
        expect(metrics.captionHeight / metrics.cardHeight).toBeCloseTo(0.227);
        const cells = createGridLayout(cards, 1, 1).cells;
        const previous = cellDimensions(cells[0], metrics, 1);
        const next = cellDimensions(cells[2], metrics, 1);
        expect(
            projectPoint(previous.x + previous.width / 2, 0, metrics).x
        ).toBeGreaterThan(0);
        expect(
            projectPoint(next.x - next.width / 2, 0, metrics).x
        ).toBeLessThan(metrics.width);
    });
    it.each([
        [1122, 383],
        [1630, 600],
        [1920, 280],
    ])(
        "preserves the 1×1 reference proportions in a %i×%i viewport",
        (width, height) => {
            const metrics = cylinderMetrics(width, height, 1, 1);
            expect(metrics.cardWidth / metrics.cardHeight).toBeCloseTo(
                755 / 418
            );
            expect(metrics.cardHeight).toBeLessThanOrEqual(height - 6);
            expect(metrics.cardWidth).toBeLessThanOrEqual(width * 0.5);
        }
    );
    it("does not move existing cards when another page is appended", () => {
        expect(createGridLayout(cards).cells.slice(0, 30)).toEqual(
            createGridLayout(cards.slice(0, 30)).cells
        );
    });
    it("uses a subtle, symmetric horizontal curve", () => {
        const metrics = cylinderMetrics(1280, 360, 2, 2);
        const left = projectPoint(-400, 100, metrics);
        const right = projectPoint(400, 100, metrics);
        expect(left.x + right.x).toBeCloseTo(metrics.width);
        expect(left.y).toBeCloseTo(right.y);
        expect((right.x - metrics.width / 2) / 400).toBeGreaterThan(0.99);
        expect(projectPoint(0, 0, metrics)).toEqual({ x: 640, y: 180 });
    });
    it("keeps all visible columns bright while fading the columns on either side", () => {
        for (const column of [1, 2])
            expect(columnOpacity(column, 1, 2)).toBe(1);
        expect(columnOpacity(0, 1, 2)).toBeCloseTo(0.14);
        expect(columnOpacity(3, 1, 2)).toBeCloseTo(0.14);
        expect(columnOpacity(1, 1.5, 2)).toBe(columnOpacity(3, 1.5, 2));
        expect(columnOpacity(2, 2, 1)).toBe(1);
        expect(columnOpacity(1, 2, 1)).toBeCloseTo(0.14);
        expect(columnOpacity(3, 2, 1)).toBeCloseTo(0.14);
    });
    it("bounds keyboard and arrow navigation at the first and last column stops", () => {
        expect(adjacentColumn(0, -1, 4)).toBe(0);
        expect(adjacentColumn(4, 1, 4)).toBe(4);
        expect(adjacentColumn(1.1, 1, 4)).toBe(2);
        expect(adjacentColumn(2.9, -1, 4)).toBe(2);
    });
});

describe("single-card selection", () => {
    it("moves through all four visible cards without scrolling the 2×2 grid", () => {
        let selection = { index: 0, firstColumn: 0 };
        const moves = [
            ["down", 1],
            ["right", 3],
            ["up", 2],
            ["left", 0],
        ] as const;
        for (const [direction, index] of moves) {
            selection = moveGridSelection(
                selection.index,
                direction,
                selection.firstColumn,
                2,
                2,
                30
            );
            expect(selection).toEqual({ index, firstColumn: 0 });
        }
    });
    it("scrolls one column at an edge and preserves the row during rapid moves", () => {
        let selection = { index: 3, firstColumn: 0 };
        for (const index of [5, 7, 9]) {
            selection = moveGridSelection(
                selection.index,
                "right",
                selection.firstColumn,
                2,
                2,
                30
            );
            expect(selection).toEqual({
                index,
                firstColumn: (index - 3) / 2,
            });
        }
        expect(moveGridSelection(6, "left", 3, 2, 2, 30)).toEqual({
            index: 4,
            firstColumn: 2,
        });
    });
    it("keeps selection on existing neighbors at the row and content boundaries", () => {
        expect(moveGridSelection(0, "left", 0, 2, 2, 5)).toEqual({
            index: 0,
            firstColumn: 0,
        });
        expect(moveGridSelection(0, "up", 0, 2, 2, 5).index).toBe(0);
        expect(moveGridSelection(1, "down", 0, 2, 2, 5).index).toBe(1);
        expect(moveGridSelection(3, "right", 0, 2, 2, 5)).toEqual({
            index: 4,
            firstColumn: 1,
        });
        expect(moveGridSelection(4, "down", 1, 2, 2, 5).index).toBe(4);
        expect(moveGridSelection(4, "right", 1, 2, 2, 5).index).toBe(4);
        expect(moveGridSelection(0, "down", 0, 2, 2, 1).index).toBe(0);
        expect(moveGridSelection(0, "right", 0, 2, 2, 0)).toEqual({
            index: -1,
            firstColumn: 0,
        });
    });
    it.each(["left", "right", "up", "down"] as const)(
        "maps %s to the neighboring card in 1×1",
        (direction) => {
            const index = direction === "left" || direction === "up" ? 1 : 3;
            expect(moveGridSelection(2, direction, 2, 1, 1, 5)).toEqual({
                index,
                firstColumn: index,
            });
        }
    );
    it.each([
        [2, 2],
        [1, 1],
    ])("selects exactly one visible card in %i×%i", (columns, rows) => {
        const count = 13;
        for (
            let firstColumn = 0;
            firstColumn <= Math.ceil(count / rows) - columns;
            firstColumn++
        ) {
            const selected = selectedCardIndex(
                firstColumn,
                columns,
                rows,
                count,
                { column: 0, row: 0 }
            );
            expect(selected).toBe(firstColumn * rows);
            const indices = Array.from({ length: count }, (_, i) => i);
            expect(indices.filter((index) => index === selected)).toHaveLength(
                1
            );
        }
    });
    it("keeps the hovered or focused grid slot selected as columns scroll", () => {
        const slot = { column: 1, row: 1 };
        expect(selectedCardIndex(0, 2, 2, 30, slot)).toBe(3);
        expect(selectedCardIndex(1, 2, 2, 30, slot)).toBe(5);
        expect(selectedCardIndex(2, 2, 2, 30, slot)).toBe(7);
    });
    it("selects an existing card when the last column or build grid is incomplete", () => {
        expect(selectedCardIndex(5, 2, 2, 13, { column: 1, row: 1 })).toBe(12);
        expect(selectedCardIndex(0, 2, 2, 4, { column: 1, row: 1 })).toBe(3);
        expect(selectedCardIndex(0, 2, 2, 1, { column: 1, row: 1 })).toBe(0);
        expect(selectedCardIndex(0, 2, 2, 0, { column: 0, row: 0 })).toBe(-1);
    });
});

describe("build options", () => {
    it("enables Gallery and Gaussian creation while keeping Videos deferred", () => {
        expect(BUILD_CARDS.map((card) => card.title)).toEqual([
            "Gallery",
            "Gaussian",
            "Videos",
        ]);
        expect(
            BUILD_CARDS.filter((card) => card.href).map((card) => card.href)
        ).toEqual([
            "/studio/new-gallery",
            "/studio/new-splat",
        ]);
        expect(
            BUILD_CARDS.filter((card) => !card.href).map(
                (card) => card.buildStatus
            )
        ).toEqual(["Coming later"]);
    });
    it.each([
        [2, 2],
        [1, 1],
    ])("uses the same %i×%i cell positions as worlds", (columns, rows) => {
        const metrics = cylinderMetrics(1280, 360, columns, rows);
        const worlds = toLandingCards(exhibits);
        const worldCells = createGridLayout(
            [...worlds, ...worlds],
            columns,
            rows
        ).cells;
        const buildCells = createGridLayout(BUILD_CARDS, columns, rows).cells;
        buildCells.forEach((cell, index) =>
            expect(cellDimensions(cell, metrics, 0)).toEqual(
                cellDimensions(worldCells[index], metrics, 0)
            )
        );
    });
});

describe("feed pagination and failures", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
    });
    it("preserves the server cursor even when the last record has no cover", async () => {
        const page = Array.from({ length: 30 }, (_, index) => ({
            id: `id-${index}`,
            info: {},
        }));
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, exhibits: page }),
        });
        const result = await fetchLandingFeed("most-visited");
        expect(result.cursor).toBe("id-29");
        expect(result.hasMore).toBe(true);
        expect(result.cards).toHaveLength(30);
    });
    it("stops at the end and encodes cursors as query parameters", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, exhibits: [] }),
        });
        expect(await fetchLandingFeed("latest", "id&cursor")).toMatchObject({
            hasMore: false,
            cards: [],
        });
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("lastVisible=id%26cursor"),
            expect.anything()
        );
    });
    it("surfaces HTTP and API errors instead of treating them as empty results", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false });
        await expect(fetchLandingFeed("latest")).rejects.toThrow("unavailable");
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: false }),
        });
        await expect(fetchLandingFeed("latest")).rejects.toThrow("unavailable");
    });
});

it("does not turn explicitly private or unpublished exhibits into fallback cards", () => {
    const hidden = [
        { visibility: "private" },
        { visibility: "unlisted" },
        { visibility: "draft" },
        { isPublic: false },
        { published: false },
        { deleted: true },
        { mock: true },
        { info: { private: true } },
    ].map((flags, index) => ({ id: `hidden-${index}`, ...flags }));
    expect(toLandingCards(hidden)).toEqual([]);
    expect(
        toLandingCards([
            { id: "public-no-preview", info: { headline: "Public world" } },
        ])
    ).toHaveLength(1);
});

it("filters displayed artists and gallery-maker aliases without conflating ACK with Jack Butcher", () => {
    const cards = toLandingCards([
        {
            ...exhibits[0],
            artistSearch: {
                names: ["Jack Butcher"],
                curatorNames: ["Claire Silver", "clairesilver"],
            },
        },
        {
            ...exhibits[1],
            artistSearch: { names: ["ACK", "alphacentaurikid"] },
        },
    ]);
    expect(
        filterBrowseCards(cards, { ...DEFAULT_FILTERS, q: "ack" }).map(
            (card) => card.id
        )
    ).toEqual(["panorama"]);
    expect(
        filterBrowseCards(cards, { ...DEFAULT_FILTERS, q: "butcher" }).map(
            (card) => card.id
        )
    ).toEqual(["image"]);
    expect(
        filterBrowseCards(cards, {
            ...DEFAULT_FILTERS,
            q: "@clairesilver",
        }).map((card) => card.id)
    ).toEqual(["image"]);
    expect(cards[0].artistNames).toEqual(["Jack Butcher"]);
});
