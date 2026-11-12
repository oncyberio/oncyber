//
import { api } from "@utils/rpc/server";

import { getSubscription } from "./getSubscription";
import { getUserDevices } from "./getUserDevices";
import { sendVisitNotification } from "./sendVisitNotification";
import { deletePlayerId } from "./deletePlayerId";
import { getNotificationId } from "./getNotificationId";


const NotificationService = {
    cors: true,
    auth: false,
    //...
    sendVisitNotification: sendVisitNotification,
    getSubscription: getSubscription,
    getUserDevices,
    deletePlayerId,
    getNotificationId,
};

export default api(NotificationService);