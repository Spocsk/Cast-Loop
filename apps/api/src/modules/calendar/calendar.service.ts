import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { OrganizationsService } from "../organizations/organizations.service";

@Injectable()
export class CalendarService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService
  ) {}

  async getCalendar(userId: string, organizationId: string, from: string, to: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    return this.databaseService.query(
      `
        select p.id,
               p.title,
               p.scheduled_at as "scheduledAt",
               p.state,
               array_agg(distinct pt.provider) as providers
        from posts p
        inner join post_targets pt on pt.post_id = p.id
        where p.organization_id = $1
          and p.scheduled_at is not null
          and p.scheduled_at >= $2
          and p.scheduled_at <= $3
        group by p.id
        order by p.scheduled_at asc
      `,
      [organizationId, from, to]
    );
  }
}
