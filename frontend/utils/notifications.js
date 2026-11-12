// OneSignal / push notifications were removed (there is no active OneSignal
// account, and the client SDK init was the single noisiest source of errors in
// PostHog). These exports are kept as graceful no-ops so existing importers
// (the Events "notify me" flow) keep compiling and fail cleanly instead of
// pulling in OneSignal.

const REMOVED = "Push notifications are no longer available.";

export const getUserNotificationId = async () => {
    throw new Error(REMOVED);
};

export function getDeviceId() {
    return null;
}

export const getNotificationSubscription = async () => {
    throw new Error(REMOVED);
};

export const getAnonNotificationSubscription = async () => {
    throw new Error(REMOVED);
};

export const getCleanDeviceName = (deviceName) => deviceName;
