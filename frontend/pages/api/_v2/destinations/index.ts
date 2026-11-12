//
import { api } from "@utils/rpc/server";
import { deleteDestination } from "./deleteDestination";
import { getSpacesCreatedTopOfDest } from "./getMarketplaceDestinations";
import { getDestinationBySlug } from "./getDestinationBySlug";
import {
    getDestinationById,
    getDestinationByTokenId,
    getDestinationsByTag,
    getUserDestinations,
    getUserDestinationBySlug,
    getDestinationsBySlugs,
    getAllDestinations,
    getUpcomingDestinations,
    getCreatedSpaces,
    checkSlugExists,
} from "./readOperations";
import {
    createDestination,
    updateDestinationById,
    submitReview,
    cancelSubmit,
    finalizeCreateDrop,
    finalizeMint,
    finalizeDestination,
    updateRoomParameters,
} from "./writeOperations";
import {
    uploadDestinationFiles,
    uploadDestinationThumbnail,
    uploadDestinationMedia,
} from "./uploadOperations";

const DestinationService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: false,

    // Services
    deleteDestination,
    getDestinationBySlug,
    getSpacesCreatedTopOfDest,
    getDestinationById,
    getDestinationByTokenId,
    getDestinationsByTag,
    getUserDestinations,
    getUserDestinationBySlug,
    getDestinationsBySlugs,
    getAllDestinations,
    getUpcomingDestinations,
    getCreatedSpaces,
    checkSlugExists,
    createDestination,
    updateDestinationById,
    submitReview,
    cancelSubmit,
    finalizeCreateDrop,
    finalizeMint,
    finalizeDestination,
    updateRoomParameters,
    uploadDestinationFiles,
    uploadDestinationThumbnail,
    uploadDestinationMedia,
    //...
};

export default api(DestinationService);
