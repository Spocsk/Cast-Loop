import { SocialProvider } from "@cast-loop/shared";
import { IsIn, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateSocialAccountDto {
  @IsUUID()
  organizationId!: string;

  @IsIn(["facebook", "instagram", "linkedin"] satisfies SocialProvider[])
  provider!: SocialProvider;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  handle!: string;

  @IsString()
  @IsNotEmpty()
  externalAccountId!: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsISO8601()
  tokenExpiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
