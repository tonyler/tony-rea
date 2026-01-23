import { env } from '../config/env';
import { QueuedMessage } from '../types';
import { createLogger } from './logger';

const logger = createLogger('Queue');

type ProcessCallback = (message: QueuedMessage) => Promise<void>;

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private intervalId: NodeJS.Timeout | null = null;
  private processCallback: ProcessCallback | null = null;

  /**
   * Add a message to the queue
   */
  enqueue(message: QueuedMessage): boolean {
    if (this.queue.length >= env.QUEUE_MAX_SIZE) {
      // Drop oldest message
      const dropped = this.queue.shift();
      logger.warn('Queue full, dropping oldest message', {
        droppedId: dropped?.id,
        projectId: dropped?.projectId,
      });
    }

    this.queue.push(message);
    logger.debug('Message enqueued', {
      messageId: message.id,
      projectId: message.projectId,
      queueSize: this.queue.length,
    });

    return true;
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Start processing the queue
   */
  start(callback: ProcessCallback): void {
    if (this.intervalId) {
      logger.warn('Queue already started');
      return;
    }

    this.processCallback = callback;
    this.processing = true;

    logger.info('Queue started', {
      intervalMs: env.QUEUE_PROCESS_INTERVAL_MS,
      maxSize: env.QUEUE_MAX_SIZE,
    });

    this.intervalId = setInterval(async () => {
      await this.processNext();
    }, env.QUEUE_PROCESS_INTERVAL_MS);
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.processing = false;
    logger.info('Queue stopped', { remainingMessages: this.queue.length });
  }

  /**
   * Process the next message in the queue
   */
  private async processNext(): Promise<void> {
    if (!this.processing || !this.processCallback || this.queue.length === 0) {
      return;
    }

    const message = this.queue.shift();
    if (!message) return;

    try {
      logger.debug('Processing message', {
        messageId: message.id,
        projectId: message.projectId,
        remainingInQueue: this.queue.length,
      });

      await this.processCallback(message);

      logger.debug('Message processed successfully', {
        messageId: message.id,
        projectId: message.projectId,
      });
    } catch (error) {
      logger.error('Failed to process message', {
        messageId: message.id,
        projectId: message.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    logger.info('Queue cleared', { clearedMessages: count });
  }

  /**
   * Get queue status
   */
  getStatus(): {
    size: number;
    processing: boolean;
    maxSize: number;
  } {
    return {
      size: this.queue.length,
      processing: this.processing,
      maxSize: env.QUEUE_MAX_SIZE,
    };
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();
