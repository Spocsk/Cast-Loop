import { BadRequestException } from "@nestjs/common";
import { PostsService } from "../src/modules/posts/posts.service";

const ORG_ID = "8fe2d17d-b0f0-4f87-8f30-e10d2da3521e";
const ACCOUNT_ID = "a1111111-1111-1111-1111-111111111111";
const POST_ID = "b2222222-2222-4222-8222-222222222222";

type QueryMock = jest.Mock;

const buildService = (queryImpl: (sql: string, params?: unknown[]) => unknown[] | Promise<unknown[]>) => {
  const query: QueryMock = jest.fn((sql: string, params?: unknown[]) => Promise.resolve(queryImpl(sql, params)));
  const transaction = jest.fn(async (callback: (client: unknown) => Promise<unknown>) => callback({}));
  const organizationsService = { assertMembership: jest.fn() };
  const auditService = { record: jest.fn() };

  const service = new PostsService(
    { query, transaction } as never,
    organizationsService as never,
    auditService as never
  );

  return { service, query, transaction, organizationsService, auditService };
};

describe("PostsService.create", () => {
  it("creates a draft without any targets", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes("insert into posts")) {
        return [{ id: "post-1", state: "draft" }];
      }
      return [];
    });

    const result = await service.create("user-1", {
      organizationId: ORG_ID,
      title: "Draft",
      content: "hello"
    });

    expect(result).toEqual(expect.objectContaining({ id: "post-1", state: "draft" }));
  });

  it("creates a draft even when target accounts are not connected", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes("from social_accounts")) {
        return [{ id: ACCOUNT_ID, status: "expired" }];
      }
      if (sql.includes("insert into posts")) {
        return [{ id: "post-1", state: "draft" }];
      }
      return [];
    });

    const result = await service.create("user-1", {
      organizationId: ORG_ID,
      title: "Draft",
      content: "hello",
      targetSocialAccountIds: [ACCOUNT_ID]
    });

    expect(result.state).toBe("draft");
  });

  it("rejects a scheduled post with no targets", async () => {
    const { service } = buildService(() => []);

    await expect(
      service.create("user-1", {
        organizationId: ORG_ID,
        title: "Scheduled",
        content: "body",
        targetSocialAccountIds: [],
        scheduledAt: "2030-01-01T10:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a scheduled post when a target is not connected", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes("from social_accounts")) {
        return [{ id: ACCOUNT_ID, status: "expired" }];
      }
      return [];
    });

    await expect(
      service.create("user-1", {
        organizationId: ORG_ID,
        title: "Scheduled",
        content: "body",
        targetSocialAccountIds: [ACCOUNT_ID],
        scheduledAt: "2030-01-01T10:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a scheduled post when all targets are connected", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes("from social_accounts")) {
        return [{ id: ACCOUNT_ID, status: "connected" }];
      }
      if (sql.includes("insert into posts")) {
        return [{ id: "post-1", state: "scheduled" }];
      }
      return [];
    });

    const result = await service.create("user-1", {
      organizationId: ORG_ID,
      title: "Scheduled",
      content: "body",
      targetSocialAccountIds: [ACCOUNT_ID],
      scheduledAt: "2030-01-01T10:00:00.000Z"
    });

    expect(result.state).toBe("scheduled");
  });
});

describe("PostsService.update", () => {
  it("updates a draft without any targets", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "draft", archivedAt: null }];
      }
      if (sql.includes("update posts") && sql.includes("set title =")) {
        return [{ id: POST_ID, state: "draft" }];
      }
      return [];
    });

    const result = await service.update("user-1", POST_ID, {
      organizationId: ORG_ID,
      title: "Draft",
      content: "hello"
    });

    expect(result).toEqual(expect.objectContaining({ id: POST_ID, state: "draft" }));
  });

  it("updates a scheduled post when all targets are connected", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "scheduled", archivedAt: null }];
      }
      if (sql.includes("from social_accounts")) {
        return [{ id: ACCOUNT_ID, status: "connected" }];
      }
      if (sql.includes("update posts") && sql.includes("set title =")) {
        return [{ id: POST_ID, state: "scheduled" }];
      }
      return [];
    });

    const result = await service.update("user-1", POST_ID, {
      organizationId: ORG_ID,
      title: "Scheduled",
      content: "body",
      targetSocialAccountIds: [ACCOUNT_ID],
      scheduledAt: "2030-01-01T10:00:00.000Z"
    });

    expect(result.state).toBe("scheduled");
  });

  it("rejects a scheduled update with no targets", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "scheduled", archivedAt: null }];
      }
      return [];
    });

    await expect(
      service.update("user-1", POST_ID, {
        organizationId: ORG_ID,
        title: "Scheduled",
        content: "body",
        targetSocialAccountIds: [],
        scheduledAt: "2030-01-01T10:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a scheduled update when a target is not connected", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "scheduled", archivedAt: null }];
      }
      if (sql.includes("from social_accounts")) {
        return [{ id: ACCOUNT_ID, status: "expired" }];
      }
      return [];
    });

    await expect(
      service.update("user-1", POST_ID, {
        organizationId: ORG_ID,
        title: "Scheduled",
        content: "body",
        targetSocialAccountIds: [ACCOUNT_ID],
        scheduledAt: "2030-01-01T10:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("PostsService.archive lifecycle", () => {
  it("archives a draft post", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "draft", archivedAt: null }];
      }
      if (sql.includes('returning id, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, archivedAt: "2030-01-01T10:00:00.000Z" }];
      }
      return [];
    });

    const result = await service.archive("user-1", POST_ID, ORG_ID);
    expect(result).toEqual(expect.objectContaining({ id: POST_ID }));
  });

  it("archives a scheduled post", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "scheduled", archivedAt: null }];
      }
      if (sql.includes('returning id, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, archivedAt: "2030-01-01T10:00:00.000Z" }];
      }
      return [];
    });

    const result = await service.archive("user-1", POST_ID, ORG_ID);
    expect(result).toEqual(expect.objectContaining({ id: POST_ID }));
  });

  it("restores an archived post", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "draft", archivedAt: "2030-01-01T10:00:00.000Z" }];
      }
      if (sql.includes("set archived_at = null")) {
        return [{ id: POST_ID, archivedAt: null }];
      }
      return [];
    });

    const result = await service.restore("user-1", POST_ID, ORG_ID);
    expect(result).toEqual({ id: POST_ID, archivedAt: null });
  });

  it("deletes an archived post definitively", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "draft", archivedAt: "2030-01-01T10:00:00.000Z" }];
      }
      return [];
    });

    await expect(service.deleteArchived("user-1", POST_ID, ORG_ID)).resolves.toEqual({
      id: POST_ID,
      deleted: true
    });
  });

  it("rejects definitive deletion when the post is not archived", async () => {
    const { service } = buildService((sql) => {
      if (sql.includes('select id, state, archived_at as "archivedAt"')) {
        return [{ id: POST_ID, state: "draft", archivedAt: null }];
      }
      return [];
    });

    await expect(service.deleteArchived("user-1", POST_ID, ORG_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("PostsService.list", () => {
  it("filters active posts by default", async () => {
    const { service, query } = buildService(() => []);

    await service.list("user-1", { organizationId: ORG_ID });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("p.archived_at is null"), [ORG_ID]);
  });

  it("filters archived posts explicitly", async () => {
    const { service, query } = buildService(() => []);

    await service.list("user-1", { organizationId: ORG_ID, visibility: "archived" });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("p.archived_at is not null"), [ORG_ID]);
  });
});
