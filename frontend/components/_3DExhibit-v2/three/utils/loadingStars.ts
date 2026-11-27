// Three-free and engine-free: the page side sets it before the engine loads.

/**
 * Whether something outside this document is covering the world while it
 * loads, so that the engine's own loading stars would not be seen.
 *
 * A framed world's first load is covered by the page around it, which
 * draws the stars itself (features/worlds/WorldStars): loading visuals are
 * the frontend's, and stars drawn here would only take frames from the
 * thread that is loading. A load nothing covers still gets the engine's
 * stars: an unframed world, a gated one (its prompt must show), and a
 * portal taken inside a frame, which loads the next space in this same
 * document while the page shows the world.
 */
let covered = false;

export function setLoadCovered(value: boolean) {
    covered = value;
}

export function loadCovered() {
    return covered;
}
