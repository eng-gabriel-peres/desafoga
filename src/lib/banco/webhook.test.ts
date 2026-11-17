import { afterEach, describe, expect, it, vi } from "vitest";
import { conferirWebhook } from "./webhook";

describe("conferirWebhook", () => {
  afterEach(() => vi.unstubAllEnvs());

  const evento = { event: "transactions/created", eventId: "e1", clientId: "meu-client", itemId: "item-1" };

  it("recusa sem segredo configurado, com segredo errado ou de outro clientId", () => {
    vi.stubEnv("PLUGGY_WEBHOOK_SEGREDO", "");
    vi.stubEnv("PLUGGY_CLIENT_ID", "meu-client");
    expect(conferirWebhook("qualquer", evento)).toBeNull();
    vi.stubEnv("PLUGGY_WEBHOOK_SEGREDO", "segredo-certo");
    expect(conferirWebhook("errado", evento)).toBeNull();
    expect(conferirWebhook(null, evento)).toBeNull();
    expect(conferirWebhook("segredo-certo", { ...evento, clientId: "outro" })).toBeNull();
    expect(conferirWebhook("segredo-certo", "não é objeto")).toBeNull();
  });

  it("aceita o evento com segredo e clientId certos", () => {
    vi.stubEnv("PLUGGY_WEBHOOK_SEGREDO", "segredo-certo");
    vi.stubEnv("PLUGGY_CLIENT_ID", "meu-client");
    expect(conferirWebhook("segredo-certo", evento)).toMatchObject({ event: "transactions/created", itemId: "item-1" });
  });
});
