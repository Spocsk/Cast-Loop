import { IsUUID } from "class-validator";

export class PostOrganizationActionDto {
  @IsUUID()
  organizationId!: string;
}
