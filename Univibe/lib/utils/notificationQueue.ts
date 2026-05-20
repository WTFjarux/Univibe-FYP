// ============================================
// NOTIFICATION QUEUE MANAGER
// - Sequential toast display (one at a time)
// - Live-updates current toast when same ID arrives
// - Instantly swaps to new toast when different ID arrives
// - Replaces queued items with same ID
// ============================================

import {
  InAppNotification,
  QueueItem,
  TOAST_CONFIG,
} from "../types/inAppNotification";

type QueueCallback = (notification: InAppNotification) => void;
type EmptyCallback = () => void;

class NotificationQueue {
  private queue: QueueItem[] = [];
  private isDisplaying: boolean = false;
  private currentDisplayedId: string | null = null;
  private onShow: QueueCallback | null = null;
  private onHide: EmptyCallback | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private processTimer: ReturnType<typeof setTimeout> | null = null;

  registerCallbacks(onShow: QueueCallback, onHide: EmptyCallback): void {
    this.onShow = onShow;
    this.onHide = onHide;
  }

  enqueue(notification: InAppNotification): void {
    // Case 1: Same ID currently displayed → update content live, reset timer
    if (this.isDisplaying && this.currentDisplayedId === notification.id) {
      this.onShow?.(notification);
      this.resetHideTimer();
      return;
    }

    // Case 2: Different ID currently displayed → swap instantly, no hide animation
    if (this.isDisplaying && this.currentDisplayedId !== notification.id) {
      this.currentDisplayedId = notification.id;
      this.onShow?.(notification);
      this.resetHideTimer();
      return;
    }

    // Case 3: Same ID already in queue → replace it
    const existingIndex = this.queue.findIndex(
      (item) => item.notification.id === notification.id,
    );
    if (existingIndex !== -1) {
      this.queue[existingIndex] = { notification, showAfter: Date.now() };
      return;
    }

    // Case 4: Enforce max queue size
    if (this.queue.length >= TOAST_CONFIG.MAX_QUEUE_SIZE) {
      this.queue.shift();
    }

    // Case 5: Add to queue, start processing if idle
    this.queue.push({ notification, showAfter: Date.now() });

    if (!this.isDisplaying) {
      this.processNext();
    }
  }

  private resetHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (this.processTimer) clearTimeout(this.processTimer);

    this.hideTimer = setTimeout(() => {
      this.onHide?.();
      this.currentDisplayedId = null;

      this.processTimer = setTimeout(() => {
        this.processNext();
      }, TOAST_CONFIG.GAP_BETWEEN_TOASTS);
    }, TOAST_CONFIG.AUTO_HIDE_DELAY);
  }

  private processNext(): void {
    if (this.queue.length === 0) {
      this.isDisplaying = false;
      this.currentDisplayedId = null;
      return;
    }

    this.isDisplaying = true;
    const item = this.queue.shift()!;
    this.currentDisplayedId = item.notification.id;

    this.onShow?.(item.notification);

    this.hideTimer = setTimeout(() => {
      this.onHide?.();
      this.currentDisplayedId = null;

      this.processTimer = setTimeout(() => {
        this.processNext();
      }, TOAST_CONFIG.GAP_BETWEEN_TOASTS);
    }, TOAST_CONFIG.AUTO_HIDE_DELAY);
  }

  clear(): void {
    this.queue = [];
    this.isDisplaying = false;
    this.currentDisplayedId = null;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }

    this.onHide?.();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getIsDisplaying(): boolean {
    return this.isDisplaying;
  }

  destroy(): void {
    this.clear();
    this.onShow = null;
    this.onHide = null;
  }
}

export const notificationQueue = new NotificationQueue();
