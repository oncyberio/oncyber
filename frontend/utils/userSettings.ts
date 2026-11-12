const USER_SETTINGS_KEY = "user_settings";

export function saveUserSetting(key, value) {
    try {
        let settings = JSON.parse(
            localStorage.getItem(USER_SETTINGS_KEY) || "{}"
        );

        settings = { ...settings, [key]: value };

        localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
        console.error(err);
    }
}

export function getUserSetting(key) {
    try {
        let settings = JSON.parse(
            localStorage.getItem(USER_SETTINGS_KEY) || "{}"
        );

        return settings[key];
    } catch (err) {
        console.error(err);
    }
}
