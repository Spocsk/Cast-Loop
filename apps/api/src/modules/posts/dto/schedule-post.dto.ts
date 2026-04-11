import { IsISO8601, IsUUID } from "class-validator";

export class SchedulePostDto {
  @IsUUID()
  organizationId!: string;

  @IsISO8601()
  scheduledAt!: string;
}
