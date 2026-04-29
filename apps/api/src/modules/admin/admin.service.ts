import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminCreateOrganizationInput,
  AdminCreateUserInput,
  AdminOrganizationSummary,
  AdminPasswordLinkResult,
  AdminResetSocialConnectionsResult,
  AdminUpdateOrganizationInput,
  AdminUpdateUserInput,
  AdminUserSummary,
  OrganizationRole
} from "@cast-loop/shared";
import { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { SupabaseAdminService } from "../../database/supabase-admin.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly supabaseAdminService: SupabaseAdminService
  ) {}

  async listUsers(): Promise<AdminUserSummary[]> {
    const rows = await this.databaseService.query<AdminUserSummary & { memberships: unknown }>(
      `
        select
          u.id,
          u.auth_user_id as "authUserId",
          u.email,
          u.full_name as "fullName",
          u.platform_role as "platformRole",
          u.status,
          u.created_at as "createdAt",
          coalesce(
            json_agg(
              json_build_object(
                'organizationId', o.id,
                'organizationName', o.name,
                'role', om.role
              )
              order by o.name asc
            ) filter (where om.id is not null),
            '[]'::json
          ) as memberships
        from users u
        left join organization_members om on om.user_id = u.id
        left join organizations o on o.id = om.organization_id
        group by u.id
        order by u.created_at desc
      `
    );

    return rows.map((row) => ({
      ...row,
      memberships: Array.isArray(row.memberships) ? row.memberships : []
    })) as AdminUserSummary[];
  }

  async createUser(actorUserId: string, input: AdminCreateUserInput) {
    const email = input.email.trim().toLowerCase();
    const { data, error } = await this.supabaseAdminService.client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: input.fullName ?? null }
    });

    if (error || !data.user) {
      throw new BadRequestException(error?.message ?? "Impossible de creer l'utilisateur Supabase.");
    }

    const user = await this.databaseService.transaction(async (client) => {
      const [createdUser] = await this.databaseService.query<{ id: string }>(
        `
          insert into users (auth_user_id, email, full_name, platform_role, status)
          values ($1, $2, $3, $4, $5)
          on conflict (auth_user_id) do update
          set email = excluded.email,
              full_name = excluded.full_name,
              platform_role = excluded.platform_role,
              status = excluded.status,
              updated_at = now()
          returning id
        `,
        [
          data.user.id,
          email,
          input.fullName ?? null,
          input.platformRole ?? "user",
          input.status ?? "active"
        ],
        client
      );

      await this.replaceMemberships(createdUser.id, input.memberships ?? [], client);
      return createdUser;
    });

    const actionLink = await this.generatePasswordLink(email);
    return { userId: user.id, actionLink } satisfies AdminPasswordLinkResult;
  }

  async updateUser(userId: string, input: AdminUpdateUserInput): Promise<AdminUserSummary> {
    const [existing] = await this.databaseService.query<{ auth_user_id: string; email: string }>(
      `select auth_user_id, email from users where id = $1`,
      [userId]
    );

    if (!existing) {
      throw new NotFoundException("Utilisateur introuvable.");
    }

    const nextEmail = input.email?.trim().toLowerCase();

    if (nextEmail || input.fullName !== undefined) {
      const { error } = await this.supabaseAdminService.client.auth.admin.updateUserById(existing.auth_user_id, {
        email: nextEmail,
        user_metadata: input.fullName !== undefined ? { full_name: input.fullName } : undefined
      });

      if (error) {
        throw new BadRequestException(error.message);
      }
    }

    await this.databaseService.transaction(async (client) => {
      await this.databaseService.query(
        `
          update users
          set email = coalesce($2, email),
              full_name = case when $3::boolean then $4 else full_name end,
              platform_role = coalesce($5, platform_role),
              status = coalesce($6, status),
              updated_at = now()
          where id = $1
        `,
        [
          userId,
          nextEmail ?? null,
          input.fullName !== undefined,
          input.fullName ?? null,
          input.platformRole ?? null,
          input.status ?? null
        ],
        client
      );

      if (input.memberships) {
        await this.replaceMemberships(userId, input.memberships, client);
      }
    });

    const [user] = (await this.listUsers()).filter((entry) => entry.id === userId);
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable.");
    }
    return user;
  }

  async deleteUser(actorUserId: string, userId: string, hard: boolean) {
    if (actorUserId === userId && hard) {
      throw new BadRequestException("Impossible de supprimer definitivement votre propre compte.");
    }

    const [user] = await this.databaseService.query<{ auth_user_id: string }>(
      `select auth_user_id from users where id = $1`,
      [userId]
    );

    if (!user) {
      throw new NotFoundException("Utilisateur introuvable.");
    }

    if (hard) {
      const { error } = await this.supabaseAdminService.client.auth.admin.deleteUser(user.auth_user_id);
      if (error) {
        throw new BadRequestException(error.message);
      }
      await this.databaseService.query(`delete from users where id = $1`, [userId]);
    } else {
      await this.databaseService.query(
        `update users set status = 'disabled', updated_at = now() where id = $1`,
        [userId]
      );
    }

    return { id: userId, deleted: true as const, hard };
  }

  async resetPassword(userId: string): Promise<AdminPasswordLinkResult> {
    const [user] = await this.databaseService.query<{ email: string }>(`select email from users where id = $1`, [userId]);

    if (!user) {
      throw new NotFoundException("Utilisateur introuvable.");
    }

    return {
      userId,
      actionLink: await this.generatePasswordLink(user.email)
    };
  }

  async listOrganizations(): Promise<AdminOrganizationSummary[]> {
    return this.databaseService.query<AdminOrganizationSummary>(
      `
        select
          o.id,
          o.name,
          o.slug,
          o.status,
          o.created_at as "createdAt",
          count(distinct om.id)::int as "memberCount",
          count(distinct sa.id)::int as "socialAccountCount"
        from organizations o
        left join organization_members om on om.organization_id = o.id
        left join social_accounts sa on sa.organization_id = o.id
        group by o.id
        order by o.created_at desc
      `
    );
  }

  async createOrganization(actorUserId: string, input: AdminCreateOrganizationInput): Promise<AdminOrganizationSummary> {
    const slug = `${slugify(input.name)}-${Date.now().toString().slice(-6)}`;

    try {
      const [organization] = await this.databaseService.query<{ id: string }>(
        `
          insert into organizations (name, slug, created_by_user_id)
          values ($1, $2, $3)
          returning id
        `,
        [input.name, slug, actorUserId]
      );

      return this.getOrganization(organization.id);
    } catch (error) {
      if (error instanceof Error && /organizations_slug_key/.test(error.message)) {
        throw new ConflictException("Ce slug d'entreprise existe deja.");
      }
      throw error;
    }
  }

  async updateOrganization(organizationId: string, input: AdminUpdateOrganizationInput): Promise<AdminOrganizationSummary> {
    const [organization] = await this.databaseService.query<{ id: string }>(
      `
        update organizations
        set name = coalesce($2, name),
            slug = coalesce($3, slug),
            status = coalesce($4, status),
            updated_at = now()
        where id = $1
        returning id
      `,
      [organizationId, input.name ?? null, input.slug ? slugify(input.slug) : null, input.status ?? null]
    );

    if (!organization) {
      throw new NotFoundException("Entreprise introuvable.");
    }

    return this.getOrganization(organization.id);
  }

  async deleteOrganization(organizationId: string, hard: boolean) {
    const [organization] = await this.databaseService.query<{ id: string }>(`select id from organizations where id = $1`, [
      organizationId
    ]);

    if (!organization) {
      throw new NotFoundException("Entreprise introuvable.");
    }

    if (hard) {
      await this.databaseService.query(`delete from organizations where id = $1`, [organizationId]);
    } else {
      await this.databaseService.query(
        `update organizations set status = 'disabled', updated_at = now() where id = $1`,
        [organizationId]
      );
    }

    return { id: organizationId, deleted: true as const, hard };
  }

  async resetSocialConnections(organizationId: string): Promise<AdminResetSocialConnectionsResult> {
    const result = await this.databaseService.query<{ id: string }>(
      `
        update social_accounts
        set status = 'disconnected',
            access_token_encrypted = null,
            refresh_token_encrypted = null,
            token_expires_at = null,
            updated_at = now()
        where organization_id = $1
        returning id
      `,
      [organizationId]
    );

    return {
      organizationId,
      resetCount: result.length
    };
  }

  private async getOrganization(organizationId: string) {
    const [organization] = await this.databaseService.query<AdminOrganizationSummary>(
      `
        select
          o.id,
          o.name,
          o.slug,
          o.status,
          o.created_at as "createdAt",
          count(distinct om.id)::int as "memberCount",
          count(distinct sa.id)::int as "socialAccountCount"
        from organizations o
        left join organization_members om on om.organization_id = o.id
        left join social_accounts sa on sa.organization_id = o.id
        where o.id = $1
        group by o.id
      `,
      [organizationId]
    );

    if (!organization) {
      throw new NotFoundException("Entreprise introuvable.");
    }

    return organization;
  }

  private async replaceMemberships(
    userId: string,
    memberships: Array<{ organizationId: string; role: OrganizationRole }>,
    client: PoolClient
  ) {
    await this.databaseService.query(`delete from organization_members where user_id = $1`, [userId], client);

    for (const membership of memberships) {
      await this.databaseService.query(
        `
          insert into organization_members (organization_id, user_id, role)
          values ($1, $2, $3)
        `,
        [membership.organizationId, userId, membership.role],
        client
      );
    }
  }

  private async generatePasswordLink(email: string) {
    const { data, error } = await this.supabaseAdminService.client.auth.admin.generateLink({
      type: "recovery",
      email
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      throw new BadRequestException("Supabase n'a pas retourne de lien de reinitialisation.");
    }

    return actionLink;
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
