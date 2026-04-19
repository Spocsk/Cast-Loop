import { SocialAccountCapability, SocialAccountType, SocialProvider } from "@cast-loop/shared";
import { IsIn, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateOrganizationSocialAccountDto {
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

  @IsIn(["personal", "page", "business", "creator"] satisfies SocialAccountType[])
  accountType!: SocialAccountType;

  @IsIn(["publishable", "connect_only"] satisfies SocialAccountCapability[])
  publishCapability!: SocialAccountCapability;

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
