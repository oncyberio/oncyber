//
import { api } from "@utils/rpc/server";
import { create } from "./create";
import { getEvents } from "./get";
import { sendNotification } from "./sendNotification";
import { cancelNotification } from "./cancelNotification";
import { deleteEvent } from "./deleteEvent";

const EventScheduler = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: false,

    // Services
    create,
    getEvents,
    sendNotification,
    cancelNotification,
    deleteEvent,
    //...
};

export default api(EventScheduler);
