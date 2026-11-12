// @ts-check

import { delay } from "@utils/js";
// import { resolve } from "path";

/**
 * @typedef { object } JobKey
 * @typedef { () => Promise<void> } Job
 */




export class JobQueue {

    /**
     *
     * @param { { maxConcurrent: number } } opts
     */
    constructor(opts) {

        this.maxConcurrent = opts.maxConcurrent

        this.nbLoading = 0;



        /** @type { { key: JobKey, job: Job }[] } */
        this.pendingJobs = []

        /** @type { WeakMap<JobKey, number> } */
        this.pendingJobsMap = new WeakMap()
    }

    /**
     *
     * @param { Job } job
     */
    async runJob(job) {

        this.nbLoading++

        try {

            await job()
        }
        finally {

            this.nbLoading--

            this.loadNext()
        }

    }

    /**
     *
     * @param { number } index
     * @param { JobKey } key
     * @param { Job } job
     * @returns
     */
    setJobAt(index, key, job) {

        return new Promise((resolve, reject) => {

            this.pendingJobs[index] = {

                key,

                job: () => {

                    return this.runJob(job).then(resolve, reject)
                }
            }
        })

    }


    /**
     *
     * @param { object } key
     * @param { Job } job
     * @returns
     */
    async addJob(key, job) {

        let index = this.pendingJobsMap.get(key)

        if(index != null) {

            return this.setJobAt(index, key, job)
        }

        if (this.nbLoading < this.maxConcurrent) {

            await this.runJob(job)
        }
        else {

            let index = this.pendingJobs.length

            this.pendingJobsMap.set(key, index)

            return this.setJobAt(index, key, job)
        }


    }

    /**
     *
     * @param { JobKey } key
     */
    removeJob(key) {

        let index = this.pendingJobsMap.get(key)

        if(index != null) {

            this.pendingJobs.splice(index, 1)

            this.pendingJobsMap.delete(key)
        }
    }

    async loadNext() {

        if(this.pendingJobs.length) {

            const { key, job } = this.pendingJobs.shift()

            this.pendingJobsMap.delete(key)

            job()
        }
    }

}

