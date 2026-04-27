import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { DatabaseService } from "../../database/database.service";
import { PostsService } from "./posts.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const publishableTargetId = "33333333-3333-4333-8333-333333333333";
const connectOnlyTargetId = "44444444-4444-4444-8444-444444444444";

describe("PostsService importPosts", () => {
  const buildService = (
    overrides: {
      query?: jest.Mock;
      transaction?: jest.Mock;
      configGet?: jest.Mock;
    } = {}
  ) => {
    const query = overrides.query ?? buildQueryMock();
    const transaction =
      overrides.transaction ??
      jest.fn(async (callback: (client: unknown) => Promise<unknown>) => callback({ tx: true }));
    const databaseService = { query, transaction } as unknown as DatabaseService;
    const organizationsService = {
      assertMembership: jest.fn().mockResolvedValue(undefined)
    } as unknown as OrganizationsService;
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined)
    } as unknown as AuditService;
    const configService = {
      get:
        overrides.configGet ??
        jest.fn((key: string) => {
          if (key === "telegramBotToken") return "telegram-token";
          if (key === "telegramChatId") return "telegram-chat";
          return undefined;
        })
    } as unknown as ConfigService;

    return {
      service: new PostsService(databaseService, organizationsService, auditService, configService as never),
      query,
      transaction,
      organizationsService,
      auditService
    };
  };

  it("cree plusieurs brouillons dans une seule transaction", async () => {
    const { service, transaction, auditService } = buildService();

    const result = await service.importPosts(userId, {
      organizationId,
      posts: [
        { title: "Post 1", content: "Contenu 1" },
        { title: "Post 2", content: "Contenu 2" }
      ]
    });

    expect(result.createdCount).toBe(2);
    expect(result.posts).toHaveLength(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "post.import.completed", payload: { createdCount: 2 } }),
      expect.anything()
    );
  });

  it("cree plusieurs posts planifies avec cibles valides", async () => {
    const { service, transaction } = buildService();

    const result = await service.importPosts(userId, {
      organizationId,
      posts: [
        {
          title: "Post 1",
          content: "Contenu 1",
          scheduledAt: "2026-05-01T09:00:00.000Z",
          targetSocialAccountIds: [publishableTargetId]
        },
        {
          title: "Post 2",
          content: "Contenu 2",
          scheduledAt: "2026-05-02T09:00:00.000Z",
          targetSocialAccountIds: [publishableTargetId]
        }
      ]
    });

    expect(result.posts.every((post) => post.state === "scheduled")).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("rejette tout le fichier si une cible est invalide", async () => {
    const { service, transaction } = buildService();

    await expect(
      service.importPosts(userId, {
        organizationId,
        posts: [
          {
            title: "Post",
            content: "Contenu",
            scheduledAt: "2026-05-01T09:00:00.000Z",
            targetSocialAccountIds: ["55555555-5555-4555-8555-555555555555"]
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejette un post planifie sans cible", async () => {
    const { service, transaction } = buildService();

    await expect(
      service.importPosts(userId, {
        organizationId,
        posts: [
          {
            title: "Post",
            content: "Contenu",
            scheduledAt: "2026-05-01T09:00:00.000Z"
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejette sendTelegramReminder=true sans compte connect_only", async () => {
    const { service, transaction } = buildService();

    await expect(
      service.importPosts(userId, {
        organizationId,
        posts: [
          {
            title: "Post",
            content: "Contenu",
            targetSocialAccountIds: [publishableTargetId],
            sendTelegramReminder: true
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("ne cree aucune ligne si une ligne invalide suit une ligne valide", async () => {
    const { service, transaction } = buildService();

    await expect(
      service.importPosts(userId, {
        organizationId,
        posts: [
          { title: "Valide", content: "Contenu valide" },
          { title: "", content: "Contenu invalide" }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("accepte un rappel Telegram avec une cible connect_only", async () => {
    const { service, transaction } = buildService();

    const result = await service.importPosts(userId, {
      organizationId,
      posts: [
        {
          title: "Post",
          content: "Contenu",
          scheduledAt: "2026-05-01T09:00:00.000Z",
          targetSocialAccountIds: [connectOnlyTargetId],
          sendTelegramReminder: true
        }
      ]
    });

    expect(result.createdCount).toBe(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

function buildQueryMock() {
  let postIndex = 0;

  return jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes("from social_accounts") && sql.includes("publish_capability")) {
      const targetIds = params[1] as string[];

      return targetIds
        .filter((id) => id === publishableTargetId || id === connectOnlyTargetId)
        .map((id) => ({
          id,
          status: "connected",
          publishCapability: id === connectOnlyTargetId ? "connect_only" : "publishable"
        }));
    }

    if (sql.includes("from media_assets")) {
      return [];
    }

    if (sql.includes("insert into posts")) {
      postIndex += 1;
      return [
        {
          id: `post-${postIndex}`,
          organizationId: params[0],
          title: params[2],
          content: params[3],
          scheduledAt: params[5] ?? null,
          state: params[6],
          sendTelegramReminder: params[7]
        }
      ];
    }

    return [];
  });
}
