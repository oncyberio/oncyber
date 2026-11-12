import { createServer } from "node:http";
// One development app: old bookmarks redirect to the canonical preview.
createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(409, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        response.end("The preview moved to http://localhost:13000. Reload there before retrying this action.");
        return;
    }
    const path = request.url?.startsWith("/") && !request.url.startsWith("//") ? request.url : "/";
    response.writeHead(307, { Location: `http://localhost:13000${path}`, "Cache-Control": "no-store" });
    response.end();
}).listen(3000, "127.0.0.1", () => console.log("Old preview redirects to http://localhost:13000"));
