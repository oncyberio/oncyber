import Emitter from "events";
import { db } from "@utils/firebase";
import { Experience, Script } from "@uitypes/experience";
import produce, { setAutoFreeze } from "immer";
import { enablePatches, Draft, Patch, applyPatches } from "immer";
import ExhibitService from "@api/exhibit/_api";
import { delay, Failure, noop, Result, Success } from "@utils/js";
import { formatExhibit } from "@utils/metadata/formatExhibit";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { setAnonExhibit } from "@utils/anon";

enablePatches();

setAutoFreeze(true);

export type ExhibitStoreMode = "memory" | "local" | "remote";

export interface ExhibitStoreOpts {
    exhibit: Experience;
    userId: string;
    token: string;
    mode: ExhibitStoreMode;
}

type UpdateCallback = (res: Result<true>) => unknown;

class Update {
    //
    public cbs: Array<UpdateCallback>;

    public scope: ChangeScope = {};

    constructor(
        public patches: Patch[],
        cbs: UpdateCallback | Array<UpdateCallback>
    ) {
        //
        this.cbs = Array.isArray(cbs) ? cbs : [cbs];

        for (let i = 0; i < this.patches.length; i++) {
            //
            const p = this.patches[i];

            let scope = p.path?.[0];

            if (scope != null) {
                //
                this.scope[scope] = true;
            }
        }
    }

    static merge(compressed: Patch[], updates: Update[]) {
        //
        return new Update(
            compressed,
            updates.flatMap((u) => u.cbs)
        );
    }
}

type Task = () => Promise<any>;

const STATE_EVENT = "state-event";

const SNAPSHOT_EVENT = "snapshot-event";

export interface SnapshotEvent {
    current: Experience;
    incoming: Experience;
    scope: ChangeScope;
}

type ChangeScope = {
    portals?: any;
    kitbash?: any;
    artworks?: any;
    other?: any;
};

type SnapshotPayload = {
    exhibit: Experience;
    scope: ChangeScope;
    changes?: any;
};

const heroImgFields = [
    "lastUpdatedHeroImg",
    "cHeroImg",
    "cHeroImg360",
    "fHeroImg",
] as const;

type HeroImgKeys = typeof heroImgFields[number];

export type HeroImgUpdate = Partial<Record<HeroImgKeys, string>>;

const infoBlackList: Array<keyof Experience["info"]> = [
    "room",
    "customLink",
    "curator",
    "currentSkin",
    ...heroImgFields,
];

function isContentUpdate({ path }: Patch) {
    //
    const scope = path[0];

    const subScope = path.length > 1 ? path[1] : null;

    return (
        scope === "artworks" ||
        scope === "portals" ||
        (scope === "params" &&
            (subScope === "initialPlayerPosition" ||
                subScope === "initialPlayerRotation"))
    );
}

export class ExhibitStore {
    //
    exhibit: Experience;

    token: string;

    baseState: Experience;

    localPatchSet: Update[] = [];

    taskQueue: Update[] = [];

    isFlushing: boolean = false;

    flushTimeout: any;

    debounceDelay = 500;

    emitter = new Emitter();

    shouldUpdateHeroImg = false;

    mode: ExhibitStoreMode = "remote";

    transientArts: Set<string> = new Set();

    serverSnapshot: SnapshotPayload;

    hasPendingRemoteChanges = false;

    //
    constructor(public opts: ExhibitStoreOpts) {
        // we need this because 3D scene is doing atrocious mutattions to the exhibit object
        // alternatively we can clone the exhibit object before passing it to the 3D scene
        // but for now don't want to clone the exhibit object every time we update it
        const exhibit = structuredClone(opts.exhibit);

        this.exhibit = exhibit;

        this.token = opts.token;

        this.baseState = exhibit;

        this.serverSnapshot = {
            exhibit: exhibit,
            scope: {},
        };

        this.mode = opts.mode;

        if (
            typeof window !== "undefined" &&
            process.env.NODE_ENV === "development"
        ) {
            (window as any).$$es = this;
        }
    }

    get hasPortalCollection() {
        //
        return this.exhibit.storageVersion === 2;
    }

    updateServerSnapshot(
        opts:
            | { scope: "exhibit"; exhibit: Experience }
            | { scope: "kitbash"; kitbash: Experience["kitbash"] }
            | { scope: "portals"; portals: Experience["portals"] }
    ) {
        //

        if (opts.scope === "exhibit") {
            //
            const data = {
                ...opts.exhibit,
                kitbash: this.serverSnapshot.exhibit.kitbash,
            };

            if (this.hasPortalCollection) {
                //
                data.portals = this.serverSnapshot.exhibit.portals;
            } else {
                //
                this.serverSnapshot.scope.portals = true;
            }

            this.serverSnapshot.exhibit = data;
            this.serverSnapshot.scope.artworks = true;

            this.hasPendingRemoteChanges = !!opts.exhibit.pendingTransaction;
        }

        if (opts.scope === "kitbash") {
            //
            this.serverSnapshot.exhibit = {
                ...this.serverSnapshot.exhibit,
                kitbash: opts.kitbash,
            };

            this.serverSnapshot.scope.kitbash = true;
        }

        if (opts.scope === "portals") {
            //
            this.serverSnapshot.exhibit = {
                ...this.serverSnapshot.exhibit,
                portals: opts.portals,
            };

            this.serverSnapshot.scope.portals = true;
        }

        this.updateFromSnaphot();
    }

    /**
     * This is a bit messed up right now, need to find a simpler/less fragile model
     * basically we're receving snaphsot for the main exhibit doc and also the subcollections (kitbash 7 maybe portals)
     * and we need to sync with local data and patch the 3D scene
     *
     * Issue is that we're receiving the main exhibit doc and the subcollections in different events
     * so when we receive the main exhibit doc we need to complement it with subcollection data
     *
     * We can always use the latest data from the local exhibit for subcollections but this will messup
     * when we have a pending ApplyKit transaction, the transaction is not atomic because of 500 max batch size
     * in firestore, so we might receive many intermediate snapshots while the transaction is being applied
     *
     * So we need to keep track of the pending transaction and skip diffs while we're applying it
     * but in the meantime we need to record the incoming subcollecions data so we can merge it with the local exhibit
     * once the transaction is applied
     *
     * So for now :
     *
     * - serverSnapshot keeps track of the incoming server data
     * - hasPendingRemoteChanges keeps track of the pending transaction
     * - updateFromSnaphot() is responsible for merging the incoming server data with the local exhibit
     * - watchRemote() is responsible for updating the serverSnapshot
     *
     * important rules :
     *
     * - serverSnapshot is updated with, AND ONLY, remote data
     * - serverSnapshot might be temporarily broken beause when we send a kitbash update, we receive 2 snapshots
     *    1 from the main exhibit doc and 1 from the kitbash subcollection, in between the kitbash data
     *    on serverSnapshot will be lagging behind what we sent. If we try to sync the serverSnapshot at that moment
     *    we'll observe a glitch (1st we apply the broken server state then we apply the up to date when we receive
     *    the 2nd snapshot)
     *
     * - So the workaround is to sync kitbash from the serverSnapshot ONLY when we receive a snapshot from the
     *   kitbash subcollection
     *
     * - We can generalize this workaround to all subcollections, we only sync subcollections from the serverSnapshot
     *   when we receive a snapshot from the subcollection, this way we ensure we only sync subcollections when we have
     *   the up to data data. So we hold an additional scope for each subcollection on the serverSnapshot which is set
     *   to true when we receive a snapshot from the subcollection, and cleared when we sync the serverSnapshot with
     *   the local exhibit.
     *
     * - When we detect a room change we need to stop/clear all pending local updates because they've being built on top of
     *   the wrong room.
     *
     */

    watchRemote() {
        //

        if (this.mode !== "remote") return () => {};

        if (!this.exhibit?.id) return () => {};

        const offExhibit = onSnapshot(
            doc(db, "exhibits", this.exhibit.id),
            async (doc) => {
                //
                // v9 SDK: exists is a method; data() is undefined when the
                // doc is missing (e.g. dev project doesn't have this exhibit)
                let data = doc.data() as Experience;

                if (!doc.exists() || data == null) return;

                data.id = doc.id;

                data.createdAt =
                    (data.createdAt as any)?.toDate?.()?.toISOString?.() ||
                    data.createdAt;

                data = formatExhibit(data);

                this.checkRoomMismatch();

                console.log("exhibit onSnapchot ", data);

                this.updateServerSnapshot({ scope: "exhibit", exhibit: data });
            }
        );

        let offPortals;

        if (this.hasPortalCollection) {
            //
            offPortals = onSnapshot(
                collection(db, "exhibits", this.exhibit.id, "portals"),
                async (snap) => {
                    //
                    const portals = {};

                    snap.forEach((doc) => {
                        //
                        portals[doc.id] = {
                            id: doc.id,
                            ...doc.data(),
                        };
                    });

                    this.updateServerSnapshot({ scope: "portals", portals });
                }
            );
        }

        let offKitbash;

        if (this.exhibit.hasKitbash) {
            offKitbash = onSnapshot(
                collection(db, "exhibits", this.exhibit.id, "kitbash"),
                async (snap) => {
                    //
                    const kitbash = {};

                    snap.forEach((doc) => {
                        //
                        kitbash[doc.id] = doc.data();
                    });

                    console.log("kitbash onSnapchot ", kitbash);

                    this.updateServerSnapshot({ scope: "kitbash", kitbash });
                },
                (err) => {
                    //
                    console.error(err);
                }
            );
        }

        return () => {
            //
            offExhibit?.();

            offPortals?.();

            offKitbash?.();
        };
    }

    get hasPendingLocalChanges() {
        //
        return (
            this.localPatchSet.length ||
            this.isFlushing ||
            this.taskQueue.length
        );
    }

    get hasPendingKitbashChanges() {
        return;
    }

    private async updateFromSnaphot() {
        //
        if (this.hasPendingLocalChanges || this.hasPendingRemoteChanges) {
            //
            // clearTimeout(this.flushTimeout);

            // this.flushPatches();

            // Ignore incoming updates until we flush the local patch set
            // this is to avoid gliches that may occur when there are conflicting updates
            // from the server and the client

            this.localPatchSet.forEach((u) => {
                if (u.scope.kitbash) {
                    this.serverSnapshot.scope.kitbash = false;
                }
            });

            this.taskQueue.forEach((u) => {
                if (u.scope.kitbash) {
                    this.serverSnapshot.scope.kitbash = false;
                }
            });

            return;
        }

        const { exhibit, scope } = this.serverSnapshot;

        this.serverSnapshot = {
            exhibit,
            scope: {},
        };

        console.log("New exhibit snapshot", exhibit, scope);

        const oldExhibit = this.exhibit;

        const newExhibit = {
            ...exhibit,
            kitbash: this.exhibit.kitbash,
            portals: this.exhibit.portals,
        };

        if (scope.portals) {
            //
            newExhibit.portals = exhibit.portals;
        }

        if (scope.kitbash) {
            //
            newExhibit.kitbash = exhibit.kitbash;
        }

        this.exhibit = newExhibit;

        this.baseState = newExhibit;

        this.emitter.emit(STATE_EVENT, this.exhibit);

        this.emitter.emit(SNAPSHOT_EVENT, {
            current: oldExhibit,
            incoming: this.exhibit,
            scope,
        });
    }

    private checkRoomMismatch() {
        //
        if (this.serverSnapshot.exhibit.info.room !== this.exhibit.info.room) {
            //
            clearTimeout(this.flushTimeout);

            this.localPatchSet.length = 0;

            this.isFlushing = false;

            this.taskQueue.length = 0;

            this.transientArts.clear();

            return true;
        }

        return false;
    }

    subscribe = (cb) => {
        //
        this.emitter.on(STATE_EVENT, cb);

        return () => this.emitter.off(STATE_EVENT, cb);
    };

    onRemoteSnaphot = (cb) => {
        //
        this.emitter.on(SNAPSHOT_EVENT, cb);

        return () => this.emitter.off(SNAPSHOT_EVENT, cb);
    };

    getState = () => {
        //
        return this.exhibit;
    };

    updateExhibit = (recipe: (state: Draft<Experience>) => void) => {
        //
        if (this.hasPendingRemoteChanges) {
            //
            return null;
        }

        return new Promise((resolve, reject) => {
            //
            this.updateLocal(recipe, resolve, reject);

            this.updateRemote();
        });
    };

    updateExhibitInfo = (update: Partial<Experience["info"]>) => {
        //
        return this.updateExhibit((draft) => {
            //
            for (let key in update) {
                //
                if (infoBlackList.includes(key as any)) return;

                draft.info[key] = update[key];
            }
        });
    };

    updateExhibitParams = (update: Partial<Experience["params"]> | null) => {
        //
        return this.updateExhibit((draft) => {
            //
            if (draft.params == null) {
                //
                draft.params = {};
            }

            for (let key in update) {
                //
                const value = update[key];

                if (value == null) {
                    //
                    delete draft.params[key];
                } else {
                    //
                    draft.params[key] = value;
                }
            }
        });
    };

    updateExhibitGating = (update: Partial<Experience["gating"]> | null) => {
        //
        return this.updateExhibit((draft) => {
            //

            if (update == null) {
                //
                delete draft.gating;

                return;
            }

            if (draft.gating == null) {
                //
                draft.gating = {};
            }

            for (let key in update) {
                //
                const value = update[key];

                if (value == null) {
                    //
                    delete draft.gating[key];
                } else {
                    //
                    draft.gating[key] = value;
                }
            }
        });
    };

    async updateCustomLink(link: string) {
        //

        const data = await ExhibitService.updateCustomLink({
            link,
            exhibitId: this.exhibit.id,
        });

        if (data.success) {
            //
            this.updateLocal(
                (draft) => {
                    //
                    draft.info.customLink = link;
                },
                noop,
                noop
            );
        }

        return data;
    }

    async updateKit(exhibit: Experience) {
        //
        if (this.hasPendingRemoteChanges) return false;

        this.exhibit = exhibit;

        this.baseState = exhibit;

        this.resetState();

        let res = true;

        if (this.mode === "local") {
            //
            this.updateLocalStorage();
            //
        } else if (this.mode === "remote") {
            //
            res = await ExhibitService.opts({
                token: this.token,
            }).updateExhibitKit({
                exhibit,
            });
        }

        this.emitter.emit(STATE_EVENT, this.exhibit);

        return res;
    }

    updateHeroImgs(update: HeroImgUpdate) {
        //
        /**
         * Hero images are uploaded and updated on google cloud
         * Here we just update the local copy
         */
        this.exhibit = produce(this.exhibit, (draft) => {
            //
            for (let key in update) {
                //
                if (!heroImgFields.includes(key as any)) return;

                draft.info[key] = update[key];
            }
        });

        this.shouldUpdateHeroImg = false;

        this.emitter.emit(STATE_EVENT, this.exhibit);
    }

    updateExhibitScripts = (opts: {
        id: string;
        type: Script["type"];
        script: string;
        game: string;
    }) => {
        throw new Error("Gallery custom scripts have been retired");
    };

    public toggleTransientState(id: string) {
        //
        if (this.transientArts.has(id)) {
            //
            this.transientArts.delete(id);

            this.updateRemote();
        } else {
            //
            this.transientArts.add(id);
        }
    }

    private isTranscient(u: Update) {
        //
        const p = u.patches[0];

        if (p.path[0] === "artworks") {
            //
            const id = p.path[1];

            return this.transientArts.has(String(id));
        }

        return false;
    }

    private updateLocal(
        recipe: (state: Draft<Experience>) => void,
        resolve,
        reject
    ) {
        //
        this.exhibit = produce(this.exhibit, recipe, (patches) => {
            //
            if (patches.length === 0) {
                //
                return;
            }

            this.localPatchSet.push(
                //
                new Update(patches, (res) => {
                    //
                    if (res.success === true) resolve?.(true);
                    else reject?.(new Error(res.error));
                })
            );

            patches.forEach((p) => {
                if (
                    (p.op === "add" || p.op === "replace") &&
                    p.path.length === 2 &&
                    p.path[0] === "artworks" &&
                    p.value.data.__transient
                ) {
                    //
                    this.toggleTransientState(p.path[1] as string);
                }
            });
        });

        this.localPatchSet.forEach((update) => {
            //
            update.patches.forEach((it) => {
                //
                if (!this.shouldUpdateHeroImg && isContentUpdate(it)) {
                    //
                    this.shouldUpdateHeroImg = true;
                }
            });
        });

        this.emitter.emit(STATE_EVENT, this.exhibit);
    }

    private updateRemote() {
        //
        clearTimeout(this.flushTimeout);

        this.flushTimeout = setTimeout(() => {
            //
            void this.flushPatches().catch(console.error);
        }, this.debounceDelay);
    }

    private async flushPatches() {
        //
        if (this.localPatchSet.length === 0) return this.flushTasks();

        let patches: Patch[];

        const transient: Update[] = [];

        const persist: Update[] = [];

        this.localPatchSet.forEach((u) => {
            //
            if (this.isTranscient(u)) {
                //
                transient.push(u);
            } else {
                //
                persist.push(u);
            }
        });

        this.localPatchSet = transient;

        if (persist.length > 0) {
            //
            this.baseState = produce(
                this.baseState,
                (draft) => {
                    //
                    applyPatches(
                        draft,
                        persist.flatMap((u) => u.patches)
                    );
                },
                (_patches) => {
                    //
                    patches = _patches;
                }
            );

            if (patches.length) {
                //
                const task = new Update(
                    patches,
                    persist.flatMap((u) => u.cbs)
                );

                // console.log("flush patches", patches);

                this.taskQueue.push(task);

                await this.flushTasks();
            }
        }
    }

    updateLocalStorage() {
        //
        return setAnonExhibit(this.exhibit);
    }

    didError = null;

    private flushPromise: Promise<void> = null;

    private flushTasks() {
        if (!this.flushPromise) {
            this.flushPromise = this.drainTasks().finally(() => { this.flushPromise = null; });
        }
        return this.flushPromise;
    }

    private async drainTasks() {
        //
        if (this.isFlushing) return;

        try {
            this.isFlushing = true;

            while (this.taskQueue.length) {
                //
                let next = this.taskQueue.shift();

                try {
                    if (this.mode === "local") {
                        //
                        await this.updateLocalStorage();
                        //
                    } else if (this.mode === "remote") {
                        //
                        // if (!this.didError) {
                        //     //
                        //     this.didError = next;
                        // }

                        // if (this.didError == next) {
                        //     //
                        //     throw new Error("Simulated error");
                        // }

                        // Patches are not logged: they can carry a newly typed
                        // world password.

                        await ExhibitService.opts({ token: this.token }).update(
                            {
                                id: this.exhibit.id,
                                patches: next.patches as any,
                            }
                        );
                    }

                    let res = Success(true as const);

                    next.cbs.forEach((cb) => cb(res));
                    //
                } catch (err) {
                    //
                    console.error(err);

                    let res = Failure(err.message);

                    next.cbs.forEach((cb) => cb(res));
                    next.cbs = [];
                    this.taskQueue.unshift(next);
                    throw err;
                }
            }
        } finally {
            //
            this.isFlushing = false;
        }
    }

    resetState() {
        //
        clearTimeout(this.flushTimeout);

        this.localPatchSet.length = 0;

        this.taskQueue.length = 0;

        this.exhibit = this.baseState;

        this.isFlushing = false;

        this.transientArts.clear();
    }

    async dispose() {
        clearTimeout(this.flushTimeout);
        await this.flushPatches();
        await this.flushTasks();
    }
}
