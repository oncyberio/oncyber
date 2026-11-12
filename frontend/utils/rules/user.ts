import { Failure, Result, Success } from "@utils/js";

const USERNAME_REGEX = /^[^@\s]\S{0,17}$/;

export function validateUsername(s: string): Result<null> {
    if (USERNAME_REGEX.test(s)) {
        return Success(null);
    } else {
        return Failure(
            "username must be less than 18 characters, not contain spaces and not start with '@'"
        );
    }
}
