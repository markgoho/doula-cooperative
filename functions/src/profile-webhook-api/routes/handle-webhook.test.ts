import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createProfileWebhookTestPlugin } from "../test-utils/create-profile-webhook-test-plugin.js";

describe("POST /", () => {
  interface SetupOptions {
    body?: {
      notificationType?: string;
      slug?: string;
      secret?: string;
    };
    deployWebhookSecret?: string | null;
    invalidSecret?: boolean;
    memberNotFound?: boolean;
    emailFails?: boolean;
  }

  function setup({
    body = {
      notificationType: "publish",
      slug: "jane-doe",
      secret: "test-secret",
    },
    deployWebhookSecret = "test-secret",
    invalidSecret = false,
    memberNotFound = false,
    emailFails = false,
  }: SetupOptions = {}) {
    if (deployWebhookSecret === null) {
      delete process.env["DEPLOY_WEBHOOK_SECRET"];
    } else {
      process.env["DEPLOY_WEBHOOK_SECRET"] = deployWebhookSecret;
    }

    const testApp = createProfileWebhookTestPlugin({
      profileWebhookService: {
        verifySecret: mock(() => !invalidSecret),
        findMemberBySlug: mock(({ slug }: { slug: string }) => {
          if (memberNotFound) {
            return Promise.resolve(undefined);
          }
          return Promise.resolve({
            uid: "member-123",
            email: "jane@example.com",
            name: "Jane Doe",
            slug,
          });
        }),
        sendNotificationEmail: mock(() => {
          if (emailFails) {
            return Promise.reject(new Error("SMTP failed"));
          }
          return Promise.resolve();
        }),
      },
    });

    const request = new Request("http://localhost/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return { testApp, request };
  }

  it("should return 200 and notified:true for valid publish payload", async () => {
    const { testApp, request } = setup();

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(true);
  });

  it("should return 200 and notified:true for valid update payload", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "update",
        slug: "jane-doe",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(true);
  });

  it("should return 200 and notified:true for valid image-update payload", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "image-update",
        slug: "jane-doe",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(true);
  });

  it("should return 200 and notified:true for valid image-delete payload", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "image-delete",
        slug: "jane-doe",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(true);
  });

  it("should return 200 with not_single_profile when slug is empty", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "update",
        slug: "",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
      reason?: string;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(false);
    expect(responseBody.reason).toBe("not_single_profile");
  });

  it("should return 200 with not_profile_related for unsupported notification type", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "delete",
        slug: "jane-doe",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
      reason?: string;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(false);
    expect(responseBody.reason).toBe("not_profile_related");
  });

  it("should return 200 with invalid_payload when notificationType is missing", async () => {
    const { testApp, request } = setup({
      body: {
        slug: "jane-doe",
        secret: "test-secret",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
      reason?: string;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(false);
    expect(responseBody.reason).toBe("invalid_payload");
  });

  it("should return 401 for missing secret", async () => {
    const { testApp, request } = setup({
      body: {
        notificationType: "publish",
        slug: "jane-doe",
      },
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(401);
    const responseBody = (await response.json()) as {
      status?: string;
      error?: string;
    };
    expect(responseBody.status).toBe("error");
    expect(responseBody.error).toBe("Unauthorized");
  });

  it("should return 401 for invalid secret", async () => {
    const { testApp, request } = setup({ invalidSecret: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(401);
    const responseBody = (await response.json()) as {
      status?: string;
      error?: string;
    };
    expect(responseBody.status).toBe("error");
    expect(responseBody.error).toBe("Unauthorized");
  });

  it("should return 200 with member_not_found when member does not exist", async () => {
    const { testApp, request } = setup({ memberNotFound: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
      reason?: string;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(false);
    expect(responseBody.reason).toBe("member_not_found");
  });

  it("should return 200 with email_failed when email sending fails", async () => {
    const { testApp, request } = setup({ emailFails: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      status?: string;
      received?: boolean;
      notified?: boolean;
      reason?: string;
    };
    expect(responseBody.status).toBe("success");
    expect(responseBody.received).toBe(true);
    expect(responseBody.notified).toBe(false);
    expect(responseBody.reason).toBe("email_failed");
  });

  it("should return 500 when deploy webhook secret is not configured", async () => {
    const { testApp, request } = setup({
      deployWebhookSecret: null,
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(500);
    const responseBody = (await response.json()) as {
      status?: string;
      error?: string;
    };
    expect(responseBody.status).toBe("error");
    expect(responseBody.error).toBe("Server configuration error");
  });
});
