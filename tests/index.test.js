import { expect, describe, it, beforeEach } from "bun:test";
import { PromiseQueue } from "../index"

describe('PromiseQueue', () => {
    let queue;

    beforeEach(() => {
        queue = new PromiseQueue(2);  // Create fresh queue with concurrency of 2
    });

    // Helper function to create delayed tasks
    const createDelayedTask = (value, delay = 50) => {
        return async () => {
            await new Promise(resolve => setTimeout(resolve, delay));
            return value;
        };
    };

    describe('Basic Queue Operations', () => {
        it('should process tasks in order', async () => {
            const results = [];

            const promises = [
                queue.enqueue(createDelayedTask('first', 50)),
                queue.enqueue(createDelayedTask('second', 50)),
                queue.enqueue(createDelayedTask('third', 50))
            ];

            await Promise.all(promises.map(p => p.then(result => results.push(result))));
            expect(results).toEqual(['first', 'second', 'third']);
        });

        it('should respect concurrency limit', async () => {
            let maxRunning = 0;
            let currentRunning = 0;

            const createTrackedTask = () => async () => {
                currentRunning++;
                maxRunning = Math.max(maxRunning, currentRunning);
                await new Promise(resolve => setTimeout(resolve, 50));
                currentRunning--;
                return 'done';
            };

            const promises = Array(5).fill().map(() =>
                queue.enqueue(createTrackedTask())
            );

            await Promise.all(promises);
            expect(maxRunning).toBeLessThanOrEqual(2);
        });
    });

    describe('Timeout Handling', () => {
        it('should resolve task within timeout', async () => {
            const result = await queue.enqueue(createDelayedTask('success', 50), 100);
            expect(result).toBe('success');
        });

        it('should reject task on timeout', async () => {
            const slowTask = createDelayedTask('too late', 200);
            await expect(queue.enqueue(slowTask, 50))
                .rejects
                .toThrow('Task timed out after 50ms');
        });

        it('should process next task after timeout', async () => {
            const results = [];

            try {
                await queue.enqueue(createDelayedTask('slow', 200), 50);
            } catch (error) {
                results.push('timeout');
            }

            const result = await queue.enqueue(createDelayedTask('fast', 50));
            results.push(result);

            expect(results).toEqual(['timeout', 'fast']);
        });
    });

    describe('Queue Management', () => {
        it('should report correct queue status', async () => {
            queue.enqueue(createDelayedTask('first', 100));
            queue.enqueue(createDelayedTask('second', 100));
            queue.enqueue(createDelayedTask('third', 100));

            const status = queue.getStatus();
            expect(status.running).toBeLessThanOrEqual(2);
            expect(status.queued).toBeGreaterThanOrEqual(1);
        });

        it('should clear pending tasks', async () => {
            const singleQueue = new PromiseQueue(1); // Only 1 concurrent task

            // Add two tasks
            singleQueue.enqueue(createDelayedTask('first', 100));
            singleQueue.enqueue(createDelayedTask('second', 100));

            // Second task should be queued
            const clearedCount = singleQueue.clear();
            expect(clearedCount).toBeGreaterThan(0);
            expect(singleQueue.getStatus().queued).toBe(0);
        });
    });
});
