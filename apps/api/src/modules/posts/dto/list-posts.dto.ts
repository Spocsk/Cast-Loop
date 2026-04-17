import { IsIn, IsOptional, IsUUID } from "class-validator";

export class ListPostsDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsIn(["draft", "scheduled", "publishing", "published", "failed", "cancelled"])
  state?: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";

  @IsOptional()
  @IsIn(["active", "archived"])
  visibility?: "active" | "archived";
}
