import { Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { SocialAccountsService } from "./social-accounts.service";

@Controller("social-auth")
export class SocialAuthController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get("linkedin/callback")
  async handleLinkedInCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() response: Response
  ) {
    const result = await this.socialAccountsService.handleLinkedInCallback({
      code,
      state,
      error
    });

    return response.redirect(result.redirectUrl);
  }

  @Get("meta/callback")
  async handleMetaCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: Response
  ) {
    const result = await this.socialAccountsService.handleMetaCallback({
      code,
      state,
      error
    });

    return response.redirect(result.redirectUrl);
  }
}
