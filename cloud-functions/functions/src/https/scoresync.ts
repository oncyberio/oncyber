import { https, logger, pubsub } from "firebase-functions";
import { createApp } from "../utils/express";
import snowflake from "snowflake-sdk";
import { database } from "../utils/db";

const app = createApp({ cors: true, auth: true });

async function syncscore() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("ScoreSync: Started!");
            const connection = snowflake.createConnection({
                account: process.env.SNOWFLAKE_ACCOUNT,
                username: process.env.SNOWFLAKE_USERNAME,
                password: process.env.SNOWFLAKE_PASSWORD,
                database: process.env.SNOWFLAKE_DATABASE,
                schema: process.env.SNOWFLAKE_SCHEMA,
                warehouse: process.env.SNOWFLAKE_WAREHOUSE,
            });

            connection.connect(function (err, conn) {
                if (err) {
                    console.error("Unable to connect: " + err.message);
                    return reject("Unable to connect: " + err.message);
                } else {
                    console.log("Successfully connected as ID: " + connection.getId());

                    const sqlText = `
                        SELECT

                        AVG(CASE WHEN EVENT_PROPERTIES['score'] > 100 THEN null ELSE EVENT_PROPERTIES['score'] END) AS "score",

                        EVENT_PROPERTIES['exhibitId'] AS "exhibitId",

                        COUNT(*) AS "count"

                        from AMPLITUDE.EVENTS_346272 WHERE contains(EVENT_TYPE, 'fps sample 20s') AND EVENT_PROPERTIES['exhibitId'] IS NOT NULL

                        GROUP BY EVENT_PROPERTIES['exhibitId']

                        HAVING COUNT(*) > 10 AND "score" IS NOT NULL
                    `;

                    connection.execute({
                        sqlText: sqlText,
                        complete: async function (err, stmt, rows) {
                            if (err) {
                                console.error("Failed to execute statement due to the following error: " + err.message);

                                return reject("Unable to connect: " + err.message);
                            } else {
                                const chunks = [];

                                const chunkSize = 500;

                                for (let i = 0; i < rows.length; i += chunkSize) {
                                    const chunk = rows.slice(i, i + chunkSize);

                                    chunks.push(chunk);
                                }

                                let exists = 0;
                                let doesntExist = 0;

                                await Promise.all(
                                    chunks.map(async (chunk, index) => {
                                        const batch = database.batch();
                                        let exists = 0;
                                        let doesntExist = 0;

                                        await Promise.all(
                                            chunk.map(async (row) => {
                                                const { exhibitId, score, count } = row;

                                                // we have to fetch because the batch will fail all together in case of a single document not existing
                                                const ref = database.collection("exhibits").doc(exhibitId);

                                                const doc = await ref.get();

                                                if (doc.exists) {
                                                    exists++;
                                                    batch.update(ref, {
                                                        analytics: {
                                                            score,
                                                            count,
                                                        },
                                                    });
                                                } else {
                                                    doesntExist++;
                                                }
                                            })
                                        );

                                        console.log("saved", exists, doesntExist);
                                        try {
                                            await batch.commit();
                                            console.log("Batch", index, "saved to firestore");
                                        } catch (e) {
                                            console.log(e);
                                        }
                                    })
                                );

                                return resolve(chunks);
                            }
                        },
                    });
                }
            });
        } catch (e) {
            logger.error(e);
            reject(e.message);
        }
    });
}

export const scoreSyncCron = pubsub.schedule("every 24 hours").onRun(async (context) => {
    console.log("ScoreSync: Started!");
    return await syncscore();
});

app.post("/", async (request, response) => {
    // functions.logger.info("Hello logs!", { structuredData: true });

    try {
        const resp = await syncscore();
        response.json(resp);
    } catch (err) {
        console.log(err);
        response.status(400).json(Error(err.message));
    }
});

export const scoresync = https.onRequest(app);

// use DATABASE AMPLITUDEDB;

// use warehouse AMPLITUDE;

// SELECT

// EVENT_PROPERTIES['score'] AS "score",
// EVENT_PROPERTIES['exhibitId'] AS "exhibitId"

// from AMPLITUDE.EVENTS_346272 WHERE contains(EVENT_TYPE, 'fps sample 20s') AND EVENT_PROPERTIES['exhibitId'] = 'qCjKilnOj2khEFtVOHSJ'

// FINAL =============
// use DATABASE AMPLITUDEDB;

// use warehouse AMPLITUDE;

// SELECT

// AVG(EVENT_PROPERTIES['score']) AS "score",
// EVENT_PROPERTIES['exhibitId'] AS "exhibitId",
// COUNT(*) AS "count"

// from AMPLITUDE.EVENTS_346272 WHERE contains(EVENT_TYPE, 'fps sample 20s') AND EVENT_PROPERTIES['score'] IS NOT NULL

// GROUP BY EVENT_PROPERTIES['exhibitId']

// TEST =============

// use DATABASE AMPLITUDEDB;

// use warehouse AMPLITUDE;

// SELECT

// AVG(EVENT_PROPERTIES['score']) AS "score",
// EVENT_PROPERTIES['exhibitId'] AS "exhibitId",
// COUNT(*) AS "count"

// from AMPLITUDE.EVENTS_346272 WHERE contains(EVENT_TYPE, 'fps sample 20s') AND EVENT_PROPERTIES['exhibitId'] = 'qCjKilnOj2khEFtVOHSJ'

// GROUP BY EVENT_PROPERTIES['exhibitId']

// FIANL =============

// use DATABASE AMPLITUDEDB;

// use warehouse AMPLITUDE;

// SELECT

// AVG(CASE WHEN EVENT_PROPERTIES['score'] > 100 THEN null ELSE EVENT_PROPERTIES['score'] END) AS "score",
// EVENT_PROPERTIES['exhibitId'] AS "exhibitId",
// COUNT(*) AS "count"

// from AMPLITUDE.EVENTS_346272 WHERE contains(EVENT_TYPE, 'fps sample 20s') AND EVENT_PROPERTIES['score'] IS NOT NULL

// GROUP BY EVENT_PROPERTIES['exhibitId']
// HAVING COUNT(*) > 1
