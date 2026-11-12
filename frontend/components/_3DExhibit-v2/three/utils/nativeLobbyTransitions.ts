/** Share arrival/return dependencies in one lazy chunk. Import only after the
 * native world initializes: its Camera/Root singletons have an ordered startup. */
export {
    createNativeLobbyReveal,
    createNativeLobbyRevealInSlices,
} from "./lobbyWorldReveal";
export { createNativeLobbyDeparture } from "./lobbyWorldDeparture";
