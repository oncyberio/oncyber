import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
    apiKey:
        process.env.OPENAI_API_KEY,
});

const pineconeApiKey = process.env.PINECONE_API_KEY;

const openai = new OpenAIApi(configuration);

//* Things to improve later
//* - fill intents only if they are available
//* - change the introduction text

const getInstructions = async (query: string) => {
    return `
[ Your job is to classify a user query in a 1 line json list format ]
Ex [{"intent":"intent',"filter":{"name":"name"},"scope":"all"}]

[ Important rules ]
if the user mentions a website, add "https://" to the intent
if the user refer to a previous action use [...{..."scope":"prev_context"}] ex: "Make them bigger", "Remove it", "Replace it with moonbird"
if no close intent available answer [{"intent" : "unavailable"}]
you don't need a perfect fit for the intent, just a good one
you can combine actions to achieve a complexe task
you have multiple actions in the list separated with a comma
if you need randomness generate it yourself
Do NOT reply with any extra text or comment. Do not ask for more information, you cannot insert code in your answer
filters and scopes are available for every intent, default scope should be "in_front"
assets should rotate around Z if not specified
make sure to preserve all informations from the query, you can use more than is available in the exemples

[ Format details ]

[{
    "intent": "intent", // intent name from the list below
    "filter": { // filter assets for placement or actions filtering, for replacements use replaceFilter as you need two filters
        "name": "name"
    },
    "scope": "scope" // constrains the action to a specific set of frames/placeholders
    "id_range": [0, 1], // range of ids to limite the scope
    "preserve_context": true, // if true, the scope will not be updated
    ... // other parameters depending on the intent detailed in exemples
}]

[ Intents ]
hang_portal, hang_text, hang_website, remove, create_gallery, hang_artwork, change_asset_options, change_sky, change_gallery_data, change_spawn_point, hang_youtube

[ Filters ]
name, creator, blockchain, type, id, collection, contract, metadata

[ Scopes ]
all, prev_context, closest, random, in_front, closest_in_front, walls

[ Types ]
artwork, model, text, website, portal, youtube, video, image

[ Synonyms ]
- asset, artwork, nft
- place, hang, add, insert, put, put on, place on, add to, put in, place in, add in, fill
- destination, gallery, space, room, scene, exhibition
- manually, click to play

[ Q/A Exemples ]

${await getBestIntent(query)}

[The following will be the user query, only answer with json object]

`;

}

const getEmbedding = async (text) => {
    const resultData = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${configuration.apiKey}`
        },
        body: JSON.stringify({
            input: text,
            model: "text-embedding-ada-002"//! need to play with this & need to match the db
        })
    }).then(response => response.json());
    const vector = resultData.data[0]["embedding"];
    return vector;
}

const getBestIntent = async (text) => {
    const queryVector = await getEmbedding(text);

    const searchObject = {
        "topK": 40,
        "includeMetadata": true,
        "queries": [
            {
                "filter": {},
                "values": queryVector
            }
        ]
    }
    //link change with index name make sure to change it if you change the index
    const results = await fetch('https://mcc-3a55113.svc.northamerica-northeast1-gcp.pinecone.io/query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Api-Key': pineconeApiKey
        },
        body: JSON.stringify(searchObject)
    })
    .then(response => response.json());
    let stringPatch = ""
    for(let i = 0; i < results.results[0].matches.length; i++) {
        stringPatch += "Q:"+results.results[0].matches[i].metadata.question + "\n";
        stringPatch += "A:"+results.results[0].matches[i].metadata.answer + "\n\n";
    }
    return stringPatch;
}

export const getIntent = proc({
    cors: true,
    // Paid model calls: signed-in users only.
    auth: true,

    // schema
    schema: z.object({
        text: z.string(),
        audio: z.string().optional(),
        prompt: z.string().optional(),
    }),

    // handler
    async handler(opts) {
        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: await getInstructions(opts.text),
                    },
                    {
                        role: "user",
                        content: opts.text,
                    },
                ],
                temperature: 0.7,
                max_tokens: 256,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });

            let intentOrErrorMessage =
                completion.data.choices[0].message.content;

            try {
                return {
                    success: true,
                    data: JSON.parse(intentOrErrorMessage),
                };
            } catch (err) {
                return {
                    success: false,
                    // message: intentOrErrorMessage,
                };
            }
        } catch (error) {
            console.log(error);
            return { success: false };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;