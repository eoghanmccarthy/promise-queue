export class PromiseQueue {
    constructor(maxConcurrent = 1) {
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.queue = [];
    }

    enqueue(asyncFunction, timeout = null) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                asyncFunction,
                resolve,
                reject,
                timeout
            };

            this.queue.push(queueItem);
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        this.running++;
        const item = this.queue.shift();

        try {
            let timeoutId;

            // Promise.race takes an array of promises and returns a new promise
            // that resolves or rejects as soon as the first promise in the array settles
            // (either resolves or rejects).
            //
            // In this case, we're racing between:
            // 1. The actual task (item.asyncFunction)
            // 2. A timeout promise that only knows how to reject after a delay
            //
            // - If the task completes first: Promise.race resolves with the task's result
            // - If the timeout happens first: Promise.race rejects with timeout error
            const result = await Promise.race([
                item.asyncFunction(),
                new Promise((_, reject) => {
                    if (item.timeout) {
                        timeoutId = setTimeout(() => {
                            reject(new Error(`Task timed out after ${item.timeout}ms`));
                        }, item.timeout);
                    }
                })
            ]);

            // Clear timeout if task completed successfully
            if (timeoutId) clearTimeout(timeoutId);
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.running--;
            this.processQueue();  // Process next item
        }
    }

    // Get current queue status
    getStatus() {
        return {
            running: this.running,
            queued: this.queue.length
        };
    }

    // Clear all pending tasks
    clear() {
        const cleared = this.queue.length;
        this.queue = [];
        return cleared;
    }
}
