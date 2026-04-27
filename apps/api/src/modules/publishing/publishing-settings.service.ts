import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { ApiVersionResult, SendTelegramTestMessageResult } from "@cast-loop/shared";
import { DatabaseService } from "../../database/database.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { TelegramNotifierService } from "./telegram-notifier.service";
import apiPackageJson from "../../../package.json";

@Injectable()
export class PublishingSettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
    private readonly telegramNotifierService: TelegramNotifierService
  ) {}

  getApiVersion(): ApiVersionResult {
    return {
      apiVersion: apiPackageJson.version
    };
  }

  async sendTelegramTestMessage(
    userId: string,
    organizationId: string
  ): Promise<SendTelegramTestMessageResult> {
    await this.organizationsService.assertMembership(organizationId, userId);

    if (!this.telegramNotifierService.isConfigured()) {
      throw new BadRequestException("Le bot Telegram n'est pas configure sur le serveur.");
    }

    const [organization] = await this.databaseService.query<{ name: string }>(
      `
        select name
        from organizations
        where id = $1
      `,
      [organizationId]
    );

    const sentAt = new Date().toISOString();

    try {
      await this.telegramNotifierService.sendTestMessage({
        organizationName: organization?.name ?? "Organisation",
        sentAt
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue Telegram.";
      throw new BadGatewayException(`Echec de l'envoi du message test Telegram : ${message}`);
    }

    return {
      delivered: true,
      channel: "telegram",
      sentAt
    };
  }
}
