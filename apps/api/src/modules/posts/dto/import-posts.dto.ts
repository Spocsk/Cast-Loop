import { Allow, IsArray, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ImportPostItemDto {
  @Allow()
  title?: unknown;

  @Allow()
  content?: unknown;

  @Allow()
  primaryMediaAssetId?: unknown;

  @Allow()
  targetSocialAccountIds?: unknown;

  @Allow()
  scheduledAt?: unknown;

  @Allow()
  sendTelegramReminder?: unknown;
}

export class ImportPostsDto {
  @IsUUID()
  organizationId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPostItemDto)
  posts!: ImportPostItemDto[];
}
