import { BadGatewayException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PublishingSettingsService } from "../src/modules/publishing/publishing-settings.service";

const ORGANIZATION_ID = "8fe2d17d-b0f0-4f87-8f30-e10d2da3521e";

const buildService = () => {
  const databaseService = {
    query: jest.fn().mockResolvedValue([{ name: "Acme Studio" }])
  };
  const organizationsService = {
    assertMembership: jest.fn().mockResolvedValue({ organization_id: ORGANIZATION_ID, role: "owner" })
  };
  const telegramNotifierService = {
    isConfigured: jest.fn().mockReturnValue(true),
    sendTestMessage: jest.fn().mockResolvedValue({ ok: true })
  };

  const service = new PublishingSettingsService(
    databaseService as never,
    organizationsService as never,
    telegramNotifierService as never
  );

  return { service, databaseService, organizationsService, telegramNotifierService };
};

describe("PublishingSettingsService.sendTelegramTestMessage", () => {
  it("returns a delivery payload when telegram is configured", async () => {
    const { service, organizationsService, databaseService, telegramNotifierService } = buildService();

    const result = await service.sendTelegramTestMessage("user-1", ORGANIZATION_ID);

    expect(organizationsService.assertMembership).toHaveBeenCalledWith(ORGANIZATION_ID, "user-1");
    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining("select name"), [
      ORGANIZATION_ID
    ]);
    expect(telegramNotifierService.sendTestMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: "Acme Studio",
        sentAt: expect.any(String)
      })
    );
    expect(result).toEqual({
      delivered: true,
      channel: "telegram",
      sentAt: expect.any(String)
    });
  });

  it("rejects when the user has no access to the organization", async () => {
    const { service, organizationsService } = buildService();
    organizationsService.assertMembership.mockRejectedValueOnce(new ForbiddenException("No access"));

    await expect(service.sendTelegramTestMessage("user-1", ORGANIZATION_ID)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("rejects when telegram is not configured", async () => {
    const { service, telegramNotifierService } = buildService();
    telegramNotifierService.isConfigured.mockReturnValueOnce(false);

    await expect(service.sendTelegramTestMessage("user-1", ORGANIZATION_ID)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("wraps telegram provider errors with a readable API error", async () => {
    const { service, telegramNotifierService } = buildService();
    telegramNotifierService.sendTestMessage.mockRejectedValueOnce(new Error("telegram says nope"));

    await expect(service.sendTelegramTestMessage("user-1", ORGANIZATION_ID)).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });
});
