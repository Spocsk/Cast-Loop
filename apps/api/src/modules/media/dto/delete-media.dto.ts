import { IsUUID } from "class-validator";

export class DeleteMediaDto {
  @IsUUID()
  organizationId!: string;
}
