export type TaskRunner<T> = (task: T) => Promise<void>;

export class TaskQueueManager<T> {
    //
    public queues: Record<string, TaskQueue<T>> = {};

    constructor(public runner: TaskRunner<T>) {
        //
        (window as any).pqm = this;
    }

    pushPatches(id: string, ...tasks: T[]) {
        //
        let queue = this.queues[id];

        if (queue == null) {
            //
            queue = this.queues[id] = new TaskQueue(id, this.runner);
        }

        queue.push(...tasks);

        queue.flush();
    }

    abort(id: string) {
        //
        const queue = this.queues[id];

        if (queue == null) return;

        queue.abort();

        delete this.queues[id];
    }

    abortAll() {
        //
        for (let id in this.queues) {
            //
            this.abort(id);
        }
    }
}

class TaskQueue<T> {
    //
    public queue: T[] = [];

    private isFlushing = false;

    constructor(public id: string, public runner: TaskRunner<T>) {
        //
    }

    push(...tasks: T[]) {
        //
        this.queue.push(...tasks);
    }

    ran: T[] = [];

    async runTask(task: T) {
        //
        if (process.env.NODE_ENV === "development") {
            //
            this.ran.push(task);
        }

        try {
            //
            await this.runner(task);
            //
        } catch (err) {
            //
            console.error(err);
        }
    }

    async flush() {
        //
        if (this.isFlushing) return;

        this.isFlushing = true;

        try {
            //
            while (this.queue.length > 0) {
                //
                const task = this.queue.shift();

                await this.runTask(task);
            }
        } finally {
            //
            this.isFlushing = false;
        }
    }

    abort() {
        //
        this.queue = [];

        this.isFlushing = false;
    }
}
