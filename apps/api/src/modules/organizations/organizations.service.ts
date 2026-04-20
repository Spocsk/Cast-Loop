import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService
  ) {}

  async listForUser(userId: string) {
    return this.databaseService.query<{
      id: string;
      name: string;
      slug: string;
      role: "owner" | "manager" | "editor";
    }>(
      `
        select o.id, o.name, o.slug, om.role
        from organizations o
        inner join organization_members om on om.organization_id = o.id
        where om.user_id = $1
        order by o.name asc
      `,
      [userId]
    );
  }

  async createForUser(userId: string, dto: CreateOrganizationDto) {
    const slug = `${slugify(dto.name)}-${Date.now().toString().slice(-6)}`;

    try {
      const organization = await this.databaseService.transaction(async (client) => {
        const [createdOrganization] = await this.databaseService.query<{
          id: string;
          name: string;
          slug: string;
        }>(
          `
            insert into organizations (name, slug, created_by_user_id)
            values ($1, $2, $3)
            returning id, name, slug
          `,
          [dto.name, slug, userId],
          client
        );

        await this.databaseService.query(
          `
            insert into organization_members (organization_id, user_id, role)
            values ($1, $2, 'owner')
          `,
          [createdOrganization.id, userId],
          client
        );

        await this.databaseService.query(
          `
            update users
            set active_organization_id = $1,
                updated_at = now()
            where id = $2
          `,
          [createdOrganization.id, userId],
          client
        );

        await this.auditService.record(
          {
            organizationId: createdOrganization.id,
            actorUserId: userId,
            entityType: "organization",
            entityId: createdOrganization.id,
            action: "organization.created",
            payload: { name: dto.name }
          },
          client
        );

        return createdOrganization;
      });

      return { ...organization, role: "owner" as const };
    } catch (error) {
      if (error instanceof Error && /organizations_slug_key/.test(error.message)) {
        throw new ConflictException("Organization slug already exists");
      }

      throw error;
    }
  }

  async assertMembership(organizationId: string, userId: string) {
    const [membership] = await this.databaseService.query<{
      organization_id: string;
      role: "owner" | "manager" | "editor";
    }>(
      `
        select organization_id, role
        from organization_members
        where organization_id = $1 and user_id = $2
      `,
      [organizationId, userId]
    );

    if (!membership) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    return membership;
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
