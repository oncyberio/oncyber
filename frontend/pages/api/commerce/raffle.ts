import { sleep } from "@utils/js";
import moment from "moment";
import { auth } from "../../../utils/middlewares/authMiddleware";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

const addUserRaffle = async (raffleId, address, res) => {
    try {
        // could need something else to
        // raffle Id needs to be 1 or 2
        if (raffleId != 1 && raffleId != 2) {
            return res.json({ code: 404, message: "Raffle ID not found" });
        }

        const request = await fetch(
            "https://api.rtfkt.com/raffle-entries/public",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        process.env.RTFKT_RAFFLE_TOKEN,
                },
                body: JSON.stringify({
                    address: address,
                    raffleId,
                    hasBeenAccepted: false,
                }),
            }
        );

        const response = await request.json();

        return res.json(response);
    } catch (err) {
        console.log("error", err);
        throw err;
    }
};

const getUserRaffleState = async (raffleId, userId, res) => {
    try {
        await sleep(2000);

        if (raffleId != 1 && raffleId != 2) {
            return res.json({ code: 404, message: "Raffle ID not found" });
        }

        const request = await fetch(
            `https://api.rtfkt.com/raffle-entries/${raffleId}/address/${userId}/all`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        process.env.RTFKT_RAFFLE_TOKEN,
                },
            }
        );

        const response = await request.json();

        return res.json(response);

        // return res.json({ success: false });
    } catch (err) {
        console.log("error", err);
        throw err;
    }
};

export const getRaffleState = async (req, res) => {
    try {
        return res.json({ success: true });
    } catch (err) {
        console.log("error", err);
        throw err;
    }
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    if (req.body && typeof req.body === "string") {
        req.body = JSON.parse(req.body);
    }

    // need to auth user
    const userId = await auth(req);

    try {
        //
        const raffleId = req?.body?.raffleId;
        if (req.query.type === "RUA") {
            addUserRaffle(raffleId, userId, res);
        } else if (req.query.type === "GURS") {
            getUserRaffleState(raffleId, userId, res);
        } else if (req.query.type === "RS") {
            getRaffleState(req, res);
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
        });
    }
};
