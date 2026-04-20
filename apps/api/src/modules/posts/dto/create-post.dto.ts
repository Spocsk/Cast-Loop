import { IsArray, IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreatePostDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsUUID()
  primaryMediaAssetId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  targetSocialAccountIds?: string[];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsBoolean()
  sendTelegramReminder?: boolean;
}
