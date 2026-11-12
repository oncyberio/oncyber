import { Failure, Result, Success } from "@utils/js";

export type Strength = "weak" | "medium" | "strong";

export function validatePassword(pwd: string): Result<{ strength: Strength }> {
    try {
        //
        if (pwd.length < 8) {
            //
            throw new Error("Password must be at least 8 characters long");
        }

        // check for password strength: length, numbers, special characters, upper and lower case letters
        let strength = 0;
        let hasNumber = false;
        let hasSpecial = false;
        let hasUpper = false;
        let hasLower = false;

        for (let i = 0; i < pwd.length; i++) {
            //
            let char = pwd.charCodeAt(i);

            if (!isNaN(char)) {
                //
                hasNumber = true;
            } else if (char >= 33 && char <= 47) {
                //
                hasSpecial = true;
            } else if (char >= 65 && char <= 90) {
                //
                hasUpper = true;
            } else if (char >= 97 && char <= 122) {
                //
                hasLower = true;
            }
        }

        if (hasNumber) {
            //
            strength++;
        }

        if (hasSpecial) {
            //
            strength++;
        }

        if (hasUpper) {
            //
            strength++;
        }

        if (hasLower) {
            //
            strength++;
        }

        if (strength < 2) {
            //
            return Success({ strength: "weak" });
        }

        if (strength < 4) {
            //
            return Success({ strength: "medium" });
        }

        return Success({ strength: "strong" });
        //
    } catch (err) {
        //
        return Failure(err.message);
    }
}

let charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";

let defaultLength = 10;

export function generateRandomPassword(length = defaultLength) {
    let retVal = "";

    for (let i = 0, n = charset.length; i < length; ++i) {
        //
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }

    return retVal;
}
