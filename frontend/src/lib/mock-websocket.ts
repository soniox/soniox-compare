import { mockMessages } from "./mock-transcript-data";
import type { ProviderName } from "./provider-features"; // To filter messages by provider

const MOCK_MESSAGE_INTERVAL = 100; // ms
const MOCK_CONNECTION_DELAY = 200; // ms

export class MockWebSocket {
  // Standard WebSocket read-only properties
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  public readonly bufferedAmount: number = 0;
  public readonly extensions: string = ""; // Mock doesn't support extensions
  public readonly protocol: string = ""; // Mock doesn't negotiate a sub-protocol

  public binaryType: string = "arraybuffer";
  public readyState: number = MockWebSocket.CONNECTING;

  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;

  private messageIntervalId: NodeJS.Timeout | null = null;
  private currentMessageIndex: number = 0;
  private url: string;
  private activeProviders: ProviderName[] = [];

  constructor(url: string) {
    this.url = url;
    try {
      const urlObject = new URL(url, window.location.origin); // Provide a base if URL is relative
      const urlParams = new URLSearchParams(urlObject.search);
      this.activeProviders = urlParams.getAll("providers") as ProviderName[];
    } catch (e) {
      console.error("MockWebSocket: Error parsing URL params from:", url, e);
    }

    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open")); // Use standard Event constructor
      }
      this.startSendingMessages();
    }, MOCK_CONNECTION_DELAY);
  }

  private startSendingMessages(): void {
    if (this.messageIntervalId) {
      clearInterval(this.messageIntervalId);
    }

    const relevantMessages =
      this.activeProviders.length > 0
        ? mockMessages.filter((msg) =>
            this.activeProviders.includes(msg.provider as ProviderName)
          )
        : mockMessages;

    this.messageIntervalId = setInterval(() => {
      if (this.readyState !== MockWebSocket.OPEN) {
        clearInterval(this.messageIntervalId!);
        return;
      }
      if (this.currentMessageIndex < relevantMessages.length) {
        const messageToSend = relevantMessages[this.currentMessageIndex];
        if (this.onmessage) {
          // Use standard MessageEvent constructor
          const event = new MessageEvent("message", {
            data: JSON.stringify(messageToSend),
            origin: this.url,
          });
          this.onmessage(event);
        }
        this.currentMessageIndex++;
      } else {
        this.close(1000, "All mock messages sent");
      }
    }, MOCK_MESSAGE_INTERVAL);
  }

  public send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (typeof data === "string" && data === "END") {
      this.close(1000, "Client sent END");
    }
  }

  public close(code?: number, reason?: string): void {
    if (
      this.readyState === MockWebSocket.CLOSING ||
      this.readyState === MockWebSocket.CLOSED
    ) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    if (this.messageIntervalId) {
      clearInterval(this.messageIntervalId);
      this.messageIntervalId = null;
    }
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        // Use standard CloseEvent constructor
        const event = new CloseEvent("close", {
          code: code || 1000,
          reason: reason || "",
          wasClean: code === 1000 || code === 1005, // 1005 is also a valid 'no status rcvd' often for clean mock closes
        });
        this.onclose(event);
      }
    }, 50);
  }
}
