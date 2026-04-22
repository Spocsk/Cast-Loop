import { Blob } from "node:buffer";
import { PublishingService } from "../src/modules/publishing/publishing.service";

const buildService = (mode: "mock" | "live" = "live") => {
  const postsService = {
    claimDuePosts: jest.fn(),
    getPublishingPayload: jest.fn(),
    recordPublishResult: jest.fn()
  };
  const tokenCipherService = {
    decrypt: jest.fn((value: string) => value.replace(/^enc:/, ""))
  };
  const supabaseAdminService = {
    client: {
      storage: {
        from: jest.fn(() => ({
          download: jest.fn()
        }))
      }
    }
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "socialPublishMode") return mode;
      if (key === "linkedinApiVersion") return "202604";
      return "";
    })
  };
  const telegramNotifierService = {
    sendReminder: jest.fn()
  };

  const service = new PublishingService(
    postsService as never,
    tokenCipherService as never,
    supabaseAdminService as never,
    configService as never,
    telegramNotifierService as never
  );

  return {
    service,
    postsService,
    tokenCipherService,
    supabaseAdminService,
    configService,
    telegramNotifierService
  };
};

describe("PublishingService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("publishes a live LinkedIn text post for a personal account", async () => {
    const { service, postsService } = buildService("live");
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" }
      })
    );

    global.fetch = fetchMock as typeof fetch;

    postsService.getPublishingPayload.mockResolvedValue({
      post: {
        id: "post-1",
        title: "Titre interne",
        content: "Bonjour LinkedIn",
        scheduledAt: null,
        sendTelegramReminder: false,
        storageBucket: null,
        storagePath: null,
        mimeType: null
      },
      targets: [
        {
          id: "target-1",
          provider: "linkedin",
          displayName: "John Doe",
          handle: "@john",
          accessTokenEncrypted: "enc:token-1",
          publishCapability: "publishable",
          accountType: "personal",
          status: "pending",
          metadata: {
            linkedinPersonUrn: "urn:li:person:abc123"
          }
        }
      ]
    });

    await service.publishPost("post-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linkedin.com/rest/posts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "LinkedIn-Version": "202604"
        }),
        body: expect.any(String)
      })
    );

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        author: "urn:li:person:abc123",
        commentary: "Bonjour LinkedIn",
        lifecycleState: "PUBLISHED"
      })
    );

    expect(postsService.recordPublishResult).toHaveBeenCalledWith("post-1", [
      expect.objectContaining({
        postTargetId: "target-1",
        success: true,
        targetStatus: "published",
        externalPostId: "urn:li:share:123"
      })
    ]);
  });

  it("publishes a live LinkedIn post with an image for an organization", async () => {
    const { service, postsService, supabaseAdminService } = buildService("live");
    const download = jest.fn().mockResolvedValue({
      data: new Blob([Buffer.from("fake-image")], { type: "image/png" }),
      error: null
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: {
              uploadUrl: "https://upload.linkedin.example/image",
              image: "urn:li:image:img-123"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "AVAILABLE" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:456" }
        })
      );

    global.fetch = fetchMock as typeof fetch;
    supabaseAdminService.client.storage.from.mockReturnValue({ download });

    postsService.getPublishingPayload.mockResolvedValue({
      post: {
        id: "post-2",
        title: "Image de test",
        content: "Publication avec image",
        scheduledAt: null,
        sendTelegramReminder: false,
        storageBucket: "media",
        storagePath: "posts/test.png",
        mimeType: "image/png"
      },
      targets: [
        {
          id: "target-2",
          provider: "linkedin",
          displayName: "Acme",
          handle: "@acme",
          accessTokenEncrypted: "enc:token-2",
          publishCapability: "publishable",
          accountType: "page",
          status: "pending",
          metadata: {
            linkedinOrganizationUrn: "urn:li:organization:999"
          }
        }
      ]
    });

    await service.publishPost("post-2");

    expect(download).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const [, initializeRequest] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(initializeRequest.body)).toEqual({
      initializeUploadRequest: {
        owner: "urn:li:organization:999"
      }
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://upload.linkedin.example/image",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "image/png"
        })
      })
    );

    const [, postRequest] = fetchMock.mock.calls[3] as [string, { body: string }];
    expect(JSON.parse(postRequest.body)).toEqual(
      expect.objectContaining({
        author: "urn:li:organization:999",
        commentary: "Publication avec image",
        content: {
          media: {
            id: "urn:li:image:img-123",
            altText: "Image de test"
          }
        }
      })
    );
  });
});
