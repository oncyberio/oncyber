import handler from "./chatgpt-token";

function call(body: any, headers: Record<string, string> = {}) {
    const res: any = {
        statusCode: 0,
        body: undefined,
        headers: {},
        setHeader(k: string, v: string) {
            this.headers[k] = v;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data: any) {
            this.body = data;
            return this;
        },
        end() {
            return this;
        },
    };
    return handler(
        {
            method: "POST",
            body,
            headers: {
                host: "oncyber.com",
                origin: "https://oncyber.com",
                ...headers,
            },
        } as any,
        res
    ).then(() => res);
}

describe("ChatGPT token exchange route", () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
        process.env.NEXT_PUBLIC_CHATGPT_CLIENT_ID = "oaiapp_test";
        delete process.env.CHATGPT_CLIENT_SECRET;
        fetchMock.mockReset();
        (global as any).fetch = fetchMock;
    });

    it("is off until a client ID is set", async () => {
        delete process.env.NEXT_PUBLIC_CHATGPT_CLIENT_ID;
        const res = await call({
            grant_type: "refresh_token",
            refresh_token: "r",
        });
        expect(res.statusCode).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses other sites", async () => {
        const res = await call(
            { grant_type: "refresh_token", refresh_token: "r" },
            { origin: "https://evil.example" }
        );
        expect(res.statusCode).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("forwards a code with this site's callback and returns only tokens", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                access_token: "a",
                refresh_token: "r",
                expires_in: 3600,
                id_token: "secret-ish",
            }),
        });
        const res = await call({
            grant_type: "authorization_code",
            code: "c",
            code_verifier: "v",
            redirect_uri: "https://evil.example/cb",
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            access_token: "a",
            refresh_token: "r",
            expires_in: 3600,
        });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://auth.openai.com/api/accounts/oauth/token");
        const form = new URLSearchParams(init.body.toString());
        expect(form.get("client_id")).toBe("oaiapp_test");
        expect(form.get("redirect_uri")).toBe(
            "https://oncyber.com/contribute/chatgpt-callback"
        );
        expect(form.get("resource")).toBe("https://api.openai.com/v1");
        expect(res.headers["Cache-Control"]).toBe("no-store");
    });
});
