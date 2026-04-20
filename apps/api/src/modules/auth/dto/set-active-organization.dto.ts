import { IsUUID } from "class-validator";

export class SetActiveOrganizationDto {
  @IsUUID()
  organizationId!: string;
}
