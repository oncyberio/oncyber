const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { handleArtistEvent } = require("./handler");
initializeApp();
exports.indexGalleryArtists = onDocumentWritten(
    {
        document: "exhibits/{exhibitId}",
        region: "us-central1",
        timeoutSeconds: 60,
        memory: "512MiB",
        cpu: 1,
        maxInstances: 1,
        concurrency: 10,
        retry: true,
    },
    (event) => handleArtistEvent(event, { db: getFirestore(), logger })
);
