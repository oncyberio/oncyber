export const cookieSettings = {
    httpOnly: true,
    // Relative, so it stays 30 days however long the server has been up.
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    secure: true,
    sameSite: "lax" as const,
};
