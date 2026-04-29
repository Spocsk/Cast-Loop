import { IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { organizationRoles, platformRoles, userStatuses } from "@cast-loop/shared";

export class AdminMembershipDto {
  @IsUUID()
  organizationId!: string;

  @IsIn(organizationRoles)
  role!: (typeof organizationRoles)[number];
}

export class AdminCreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string | null;

  @IsOptional()
  @IsIn(platformRoles)
  platformRole?: (typeof platformRoles)[number];

  @IsOptional()
  @IsIn(userStatuses)
  status?: (typeof userStatuses)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminMembershipDto)
  memberships?: AdminMembershipDto[];
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string | null;

  @IsOptional()
  @IsIn(platformRoles)
  platformRole?: (typeof platformRoles)[number];

  @IsOptional()
  @IsIn(userStatuses)
  status?: (typeof userStatuses)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminMembershipDto)
  memberships?: AdminMembershipDto[];
}
