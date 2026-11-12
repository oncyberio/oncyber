import { db } from "@utils/firebaseAdmin";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

// Write-only public room log; nothing serves it back to clients. Direct
// messages are never stored, and only a small, bounded message is kept.
const MAX_BODY = 4096;

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const roomId = req.query.roomId;
        const body = req.body;
        if (
            req.method !== "POST" ||
            typeof roomId !== "string" ||
            !/^[A-Za-z0-9_:@.-]{1,128}$/.test(roomId) ||
            !body ||
            typeof body !== "object" ||
            JSON.stringify(body).length > MAX_BODY
        ) {
            return res.status(400).json({ success: false });
        }
        if (body.direct) return res.json({ success: true });

        await db
            .collection("chat_history")
            .doc(roomId)
            .collection("history")
            .add({
                type: String(body.type ?? "").slice(0, 32),
                message: String(body.message ?? "").slice(0, 2000),
                username: String(body.username ?? "").slice(0, 64),
                acc_date: String(body.acc_date ?? new Date().toISOString()).slice(0, 40),
                savedAt: new Date(),
            });

        res.json({
            success: true,
        });
    } catch (err) {
        res.json({
            success: false,
            message: "Failed to add message",
        });
    }
};
