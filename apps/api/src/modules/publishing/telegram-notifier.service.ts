import { basename } from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppEnv } from "../../config/env";

@Injectable()
export class TelegramNotifierService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  isConfigured() {
    return Boolean(
      this.configService.get("telegramBotToken", { infer: true }) &&
      this.configService.get("telegramChatId", { infer: true })
    );
  }

  async sendTestMessage(params: { organizationName: string; sentAt: string }) {
    const message = [
      "Test du canal Telegram Cast Loop",
      "",
      `Entreprise : ${params.organizationName}`,
      `Heure : ${new Date(params.sentAt).toLocaleString("fr-FR")}`,
      "",
      "Le bot Telegram est bien joignable depuis l'application."
    ].join("\n");

    return this.sendTextMessage(message);
  }

  async sendReminder(params: {
    title: string;
    content: string;
    scheduledAt: string;
    targets: Array<{ provider: string; displayName: string; handle: string }>;
    image?: {
      buffer: Buffer;
      mimeType: string;
      fileName: string;
    } | null;
  }) {
    if (!this.isConfigured()) {
      throw new Error("Telegram is not configured");
    }

    const botToken = this.configService.get("telegramBotToken", { infer: true });
    const chatId = this.configService.get("telegramChatId", { infer: true });
    const targetLines = params.targets.map(
      (target) => `• ${target.provider} — ${target.displayName} (${target.handle})`
    );
    const message = [
      `Rappel de publication manuelle`,
      ``,
      `Titre : ${params.title}`,
      `Heure : ${new Date(params.scheduledAt).toLocaleString("fr-FR")}`,
      ``,
      `Comptes a publier manuellement :`,
      ...targetLines,
      ``,
      `Contenu :`,
      params.content
    ].join("\n");

    if (params.image) {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", message.slice(0, 1024));
      formData.append(
        "photo",
        new Blob([new Uint8Array(params.image.buffer)], { type: params.image.mimeType }),
        params.image.fileName || basename("post-image")
      );

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  private async sendTextMessage(text: string) {
    if (!this.isConfigured()) {
      throw new Error("Telegram is not configured");
    }

    const botToken = this.configService.get("telegramBotToken", { infer: true });
    const chatId = this.configService.get("telegramChatId", { infer: true });
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }
}
