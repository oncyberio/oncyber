// Pools may be parked between scenes and lazily restarted on the next job.
const activePools = new Set();
export default class WorkerPool {
    /**
     * `opts` is what each new worker receives first: an object, posted as
     * `{ init: true, ...opts }` (structured clone), or a function called per
     * worker that returns `{ message, transfer }`, so each worker can be given
     * its own buffers by transfer instead of a clone.
     */
    constructor(source, size = 12, debug = false, opts = null) {
        this.source = source;
        this.size = size;
        this.opts = opts;
        this.pool = [];
        this.jobs = [];
        this.activeJobs = 0;
        this.disposing = false;
    }
    createWorker() {
        const worker = new this.source();
        if (typeof this.opts === "function") {
            const { message, transfer = [] } = this.opts();
            worker.postMessage(message, transfer);
        } else if (this.opts) worker.postMessage({ init: true, ...this.opts });
        return worker;
    }
    queueJob(url, msg, cb, ctx, signal) {
        if (signal?.aborted || this.disposing) {
            cb.call(ctx, { data: { error: true, cancel: true } });
            return;
        }
        activePools.add(this);
        const job = { msg, cb, ctx, signal, worker: null };
        job.abort = () =>
            this.finish(job, { data: { error: true, cancel: true } }, true);
        signal?.addEventListener("abort", job.abort, { once: true });
        this.jobs.push(job);
        this.activeJobs = this.jobs.length;
        this.drain();
    }
    drain() {
        if (this.disposing) return;
        for (const job of this.jobs) {
            if (job.worker) continue;
            let worker = this.pool.find((worker) => !worker.job);
            if (!worker && this.pool.length < this.size) {
                worker = this.createWorker();
                this.pool.push(worker);
            }
            if (!worker) break;
            worker.job = job;
            job.worker = worker;
            job.message = (event) => this.finish(job, event);
            job.error = () => this.finish(job, { data: { error: true } }, true);
            worker.addEventListener("message", job.message);
            worker.addEventListener("error", job.error);
            worker.postMessage(job.msg);
        }
    }
    finish(job, event, terminate = false) {
        const index = this.jobs.indexOf(job);
        if (index < 0) return;
        this.jobs.splice(index, 1);
        this.activeJobs = this.jobs.length;
        job.signal?.removeEventListener("abort", job.abort);
        const worker = job.worker;
        if (worker) {
            worker.removeEventListener("message", job.message);
            worker.removeEventListener("error", job.error);
            worker.job = null;
            if (terminate) {
                worker.terminate();
                this.pool.splice(this.pool.indexOf(worker), 1);
            }
        }
        try {
            job.cb.call(job.ctx, event);
        } catch (error) {
            console.error("Worker job callback failed", error);
        } finally {
            job.cb = job.ctx = job.msg = job.worker = null;
            this.drain();
        }
    }
    dispose() {
        this.disposing = true;
        try {
            for (const job of [...this.jobs]) {
                this.finish(job, { data: { error: true, cancel: true } }, true);
            }
            for (const worker of this.pool) worker.terminate();
            this.pool = [];
            activePools.delete(this);
        } finally {
            this.disposing = false;
        }
    }
    static get activeWorkerCount() {
        return [...activePools].reduce(
            (sum, pool) => sum + pool.pool.length,
            0
        );
    }
    static disposeAll() {
        for (const pool of [...activePools]) pool.dispose();
    }
}
