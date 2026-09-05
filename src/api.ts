import type { CreateLeadRequest } from "./types";
import type {
  CreateLeadInput,
  Extraction,
  Lead,
  Message,
} from "./types";


async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Response does not contain JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
export const api = {
  listMessages: () => requestJson<Message[]>("/api/messages"),

  getMessage: (messageId: string) =>
    requestJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`),

  listLeads: () => requestJson<Lead[]>("/api/leads"),

  extract: (messageId: string) =>
    requestJson<Extraction>("/api/ai/extract", {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),

  createLead: (input: CreateLeadInput) =>
    requestJson<Lead>("/api/leads", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  markAsContacted: (leadId: string) =>
    requestJson<Lead>(`/api/leads/${encodeURIComponent(leadId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CONTACTED" }),
    }),
  }
