import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
