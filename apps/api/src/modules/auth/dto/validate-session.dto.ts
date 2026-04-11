import { IsOptional, IsUUID } from "class-validator";

export class ValidateSessionDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
