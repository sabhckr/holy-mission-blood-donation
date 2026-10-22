import { createHmac } from 'node:crypto';

export interface OutgoingMessage {
  channel: 'sms' | 'email';
  to: string;
  text: string;
}

export interface DeliveryResult {
  status: 'sent' | 'failed' | 'not_configured';
  provider: string;
  providerRef?: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  channel: 'sms' | 'email';
  send(message: OutgoingMessage): Promise<DeliveryResult>;
}

/**
 * Generic signed webhook. Point NOTIFY_WEBHOOK_URL at an SMS/email relay you control.
 * A delivery counts as 'sent' only when the relay answers with HTTP 2xx.
 */
export class WebhookProvider implements NotificationProvider {
  name = 'webhook';
  constructor(
    private readonly url: string,
    private readonly secret: string,
    public readonly channel: 'sms' | 'email',
  ) {}

  async send(message: OutgoingMessage): Promise<DeliveryResult> {
    const body = JSON.stringify(message);
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hm-signature': signature },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { status: 'sent', provider: this.name, providerRef: res.headers.get('x-message-id') ?? undefined };
      return { status: 'failed', provider: this.name, error: `HTTP ${res.status}` };
    } catch (error) {
      return { status: 'failed', provider: this.name, error: error instanceof Error ? error.message.slice(0, 200) : 'unknown error' };
    }
  }
}

/** The configured external provider, or null when none is configured (in-app notifications still work). */
export function getExternalProvider(): NotificationProvider | null {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  const secret = process.env.NOTIFY_WEBHOOK_SECRET;
  if (!url || !secret) return null;
  const channel = process.env.NOTIFY_WEBHOOK_CHANNEL === 'email' ? 'email' : 'sms';
  return new WebhookProvider(url, secret, channel);
}
