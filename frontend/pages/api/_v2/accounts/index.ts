//
import { api } from "@utils/rpc/server";

import { authenticate } from "./authenticate";

import { unlink } from "./unlink";

import { logout } from "./logout";

import { initAnon } from "./anon/init";

import { setAnonHash } from "./anon/secure";

import { verifyAnonHash } from "./anon/verify";

import { resetAnon } from "./anon/reset";

import { getUsers } from "./user/getUsers";

import { merge } from "./merge";

import { me } from "./user/me";

import { activateSocial } from "./socials/activate";

const AccountsService = {
    cors: true,
    // auth: true,
    // Services
    authenticate,
    unlink: unlink,
    logout: logout,
    initAnon: initAnon,
    setAnonHash: setAnonHash,
    verifyAnonHash: verifyAnonHash,
    resetAnon: resetAnon,
    getUsers: getUsers,
    me: me,
    merge,
    activateSocial: activateSocial,
};

export default api(AccountsService);
