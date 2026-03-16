/**
 * ToolHandler — Executes Gemini tool calls via backend REST endpoints.
 *
 * When the Gemini Live API issues a function call over WebSocket, the
 * browser intercepts it, calls the corresponding backend endpoint, and
 * sends the result back to Gemini.
 */

import type { FunctionCall } from './gemini-live';

/** Map from Gemini function name → backend REST endpoint path. */
const TOOL_ENDPOINTS: Record<string, string> = {
  analyze_medication: '/api/companion/analyze-medication',
  flag_emotional_distress: '/api/companion/flag-emotional-distress',
  log_health_checkin: '/api/companion/log-health-checkin',
  set_reminder: '/api/companion/set-reminder',
  complete_reminder: '/api/companion/complete-reminder',
};

export interface ToolHandlerConfig {
  /** Base URL for the backend API (e.g. http://localhost:8080) */
  apiBaseUrl: string;
  /** Returns the current Firebase ID token for auth */
  getAuthToken: () => Promise<string | null>;
  /** Current user ID */
  userId: string;
}

export class ToolHandler {
  private config: ToolHandlerConfig;
  private pendingCalls = new Set<string>();

  constructor(config: ToolHandlerConfig) {
    this.config = config;
  }

  /**
   * Execute a batch of function calls from Gemini.
   * Returns an array of responses to send back via toolResponse.
   */
  async executeCalls(
    calls: FunctionCall[],
  ): Promise<Array<{ id: string; name: string; response: unknown }>> {
    const results = await Promise.all(
      calls.map((call) => this.executeCall(call)),
    );
    return results;
  }

  /**
   * Cancel pending calls (called when Gemini sends toolCallCancellation).
   */
  cancelCalls(ids: string[]): void {
    for (const id of ids) {
      this.pendingCalls.delete(id);
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async executeCall(
    call: FunctionCall,
  ): Promise<{ id: string; name: string; response: unknown }> {
    const endpoint = TOOL_ENDPOINTS[call.name];
    if (!endpoint) {
      return {
        id: call.id,
        name: call.name,
        response: {
          status: 'error',
          errorMessage: `Unknown tool: ${call.name}`,
        },
      };
    }

    this.pendingCalls.add(call.id);

    try {
      const authToken = await this.config.getAuthToken();
      const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          userId: this.config.userId,
          args: call.args,
        }),
      });

      // If the call was cancelled while we were waiting, discard the result
      if (!this.pendingCalls.has(call.id)) {
        return {
          id: call.id,
          name: call.name,
          response: { status: 'error', errorMessage: 'Cancelled' },
        };
      }

      const data = await response.json();
      return { id: call.id, name: call.name, response: data };
    } catch (err) {
      return {
        id: call.id,
        name: call.name,
        response: {
          status: 'error',
          errorMessage:
            err instanceof Error ? err.message : 'Tool execution failed',
        },
      };
    } finally {
      this.pendingCalls.delete(call.id);
    }
  }
}
