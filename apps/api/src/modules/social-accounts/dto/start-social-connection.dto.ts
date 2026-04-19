import { SocialProviderConnectionVariant } from "@cast-loop/shared";
import { IsIn } from "class-validator";

export class StartSocialConnectionDto {
  @IsIn(
    [
      "linkedin_personal",
      "linkedin_page",
      "facebook_page",
      "instagram_professional",
      "meta_personal"
    ] satisfies SocialProviderConnectionVariant[]
  )
  variant!: SocialProviderConnectionVariant;
}
