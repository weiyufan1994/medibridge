import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: {
    llmApiKey: "test-secret",
    llmApiUrl: "https://llm.example/",
    llmEmbeddingModel: "embedding-model",
    llmModel: "chat-model",
    llmTimeoutMs: 1_000,
  },
}));

import { createEmbedding, invokeLLM } from "./llm";

const fetchMock = vi.fn<typeof fetch>();

describe("LLM adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends normalized chat completion requests through the configured URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "completion-1",
          created: 1,
          model: "chat-model",
          choices: [],
        }),
        { status: 200 }
      )
    );

    const result = await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 42,
    });

    expect(result.id).toBe("completion-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://llm.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-secret",
        },
      })
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "chat-model",
      max_tokens: 42,
      messages: [{ role: "user", content: "hello" }],
    });
  });

  it("preserves required-tool validation before issuing a request", async () => {
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "hello" }],
        toolChoice: "required",
      })
    ).rejects.toThrow(
      "tool_choice 'required' was provided but no tools were configured"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves upstream status and body in chat completion errors", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hello" }] })
    ).rejects.toThrow(
      "LLM invoke failed: 503 Service Unavailable – upstream unavailable"
    );
  });

  it("sends trimmed embedding input and returns the provider vector", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
        status: 200,
      })
    );

    await expect(createEmbedding("  symptoms  ")).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://llm.example/v1/embeddings",
      expect.objectContaining({ method: "POST" })
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "embedding-model",
      input: "symptoms",
    });
  });
});
