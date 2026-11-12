import { Failure, Result, Success } from "@utils/js";

export function validatePath(path: string): Result<string> {
    try {
        let url = new URL(`http://localhost:3000/${path}`);
        return Success(url.pathname);
    } catch (_) {
        return Failure("Invalid url");
    }
}
