import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
@UseGuards(SupabaseAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  async getCalendar(
    @CurrentUser() user: { id: string },
    @Query("organizationId") organizationId: string,
    @Query("from") from: string,
    @Query("to") to: string
  ) {
    return this.calendarService.getCalendar(user.id, organizationId, from, to);
  }
}
