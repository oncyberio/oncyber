/** Legacy Agora tokens have been retired in favor of authenticated WebRTC rooms. */
export default function handler(_req, res) {
    return res.status(410).json({
        success: false,
        error: "Legacy voice token endpoint is no longer available",
    });
}
