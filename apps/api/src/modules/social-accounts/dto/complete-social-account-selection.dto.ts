import { IsNotEmpty, IsString } from "class-validator";

export class CompleteSocialAccountSelectionDto {
  @IsString()
  @IsNotEmpty()
  selectionToken!: string;

  @IsString()
  @IsNotEmpty()
  externalAccountId!: string;
}
