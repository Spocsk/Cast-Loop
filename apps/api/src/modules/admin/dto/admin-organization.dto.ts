import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { organizationStatuses } from "@cast-loop/shared";

export class AdminCreateOrganizationDto {
  @IsString()
  @MaxLength(140)
  name!: string;
}

export class AdminUpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsIn(organizationStatuses)
  status?: (typeof organizationStatuses)[number];
}
