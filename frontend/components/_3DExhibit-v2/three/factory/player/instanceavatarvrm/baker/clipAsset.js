// The packed avatar clips (see clipCodec.js and scripts/pack-avatar-clips.mjs).
// Webpack emits the file under /_next/static/media/ with a content hash, so
// browsers keep it as an immutable file. animationData.js imports this module
// eagerly from inside a dynamic import(): Jest cannot parse import.meta, and
// only tests that load the clips (and mock this module) reach it.
export default new URL("./animations/compute2.bin", import.meta.url).href;
