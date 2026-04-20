import { IsUUID } from "class-validator";

export class SendTelegramTestMessageDto {
  @IsUUID()
  organizationId!: string;
}
