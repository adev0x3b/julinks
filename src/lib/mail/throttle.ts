/**
 * At most one send per cooldown. A trigger inside the cooldown is not dropped: it marks the
 * next send as due, and that send goes out when the cooldown ends, covering everything that
 * arrived meanwhile. Built for the admins' sign-up notice: a burst of requests costs two
 * messages, not one per request, so the mail relay's hourly quota survives a flood.
 */
export class Throttle {
  private until = 0;
  private due = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly send: () => Promise<unknown>,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Sends now when the last send is older than the cooldown, otherwise once the cooldown ends. */
  async trigger(): Promise<void> {
    if (this.now() >= this.until) {
      this.until = this.now() + this.cooldownMs;
      await this.send();
      return;
    }
    this.due = true;
    this.timer ??= setTimeout(() => this.flush(), this.until - this.now());
    // A pending notice must not keep a test runner or a stopping server alive.
    this.timer.unref?.();
  }

  private flush() {
    this.timer = undefined;
    if (!this.due) return;
    this.due = false;
    this.until = this.now() + this.cooldownMs;
    this.send().catch((error) => console.error("[mail] throttled send failed:", error));
  }
}
