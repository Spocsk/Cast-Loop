import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthenticatedAppUser, ValidatedSessionResult } from "@cast-loop/shared";
import { DatabaseService } from "../../database/database.service";
import { SupabaseAdminService } from "../../database/supabase-admin.service";

interface AppUserRow {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  active_organization_id: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly supabaseAdminService: SupabaseAdminService
  ) {}

  async authenticate(accessToken: string) {
    const {
      data: { user },
      error
    } = await this.supabaseAdminService.client.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException("Invalid Supabase session");
    }

    const appUser = await this.upsertAppUser({
      authUserId: user.id,
      email: user.email ?? "",
      fullName: user.user_metadata?.full_name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null
    });

    const memberships = await this.databaseService.query<{
      organization_id: string;
      role: "owner" | "manager" | "editor";
    }>(
      `
        select organization_id, role
        from organization_members
        where user_id = $1
      `,
      [appUser.id]
    );

    return {
      accessToken,
      appUser,
      memberships: memberships.map((membership) => ({
        organizationId: membership.organization_id,
        role: membership.role
      }))
    };
  }

  async validateSession(accessToken: string, organizationId?: string) {
    const authContext = await this.authenticate(accessToken);
    const persistedOrganizationId = await this.getPersistedActiveOrganizationId(authContext.appUser.id);
    const nextActiveOrganizationId = this.resolveActiveOrganizationId(
      authContext.memberships,
      organizationId,
      persistedOrganizationId
    );

    if (nextActiveOrganizationId !== persistedOrganizationId) {
      await this.persistActiveOrganizationId(authContext.appUser.id, nextActiveOrganizationId);
    }

    return {
      user: authContext.appUser,
      memberships: authContext.memberships,
      activeOrganizationId: nextActiveOrganizationId
    } satisfies ValidatedSessionResult;
  }

  async setActiveOrganization(accessToken: string, organizationId: string) {
    const authContext = await this.authenticate(accessToken);
    const hasMembership = authContext.memberships.some((membership) => membership.organizationId === organizationId);

    if (!hasMembership) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    await this.persistActiveOrganizationId(authContext.appUser.id, organizationId);

    return {
      user: authContext.appUser,
      memberships: authContext.memberships,
      activeOrganizationId: organizationId
    } satisfies ValidatedSessionResult;
  }

  private async upsertAppUser(payload: {
    authUserId: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  }): Promise<AuthenticatedAppUser> {
    const [row] = await this.databaseService.query<AppUserRow>(
      `
        insert into users (auth_user_id, email, full_name, avatar_url)
        values ($1, $2, $3, $4)
        on conflict (auth_user_id) do update
        set email = excluded.email,
            full_name = excluded.full_name,
            avatar_url = excluded.avatar_url,
            updated_at = now()
        returning id, auth_user_id, email, full_name, avatar_url, active_organization_id
      `,
      [payload.authUserId, payload.email, payload.fullName, payload.avatarUrl]
    );

    return {
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url
    };
  }

  private resolveActiveOrganizationId(
    memberships: Array<{ organizationId: string; role: "owner" | "manager" | "editor" }>,
    requestedOrganizationId?: string,
    persistedOrganizationId?: string | null
  ) {
    if (requestedOrganizationId && memberships.some((membership) => membership.organizationId === requestedOrganizationId)) {
      return requestedOrganizationId;
    }

    if (persistedOrganizationId && memberships.some((membership) => membership.organizationId === persistedOrganizationId)) {
      return persistedOrganizationId;
    }

    return memberships[0]?.organizationId ?? null;
  }

  private async getPersistedActiveOrganizationId(userId: string) {
    const [user] = await this.databaseService.query<{ active_organization_id: string | null }>(
      `
        select active_organization_id
        from users
        where id = $1
      `,
      [userId]
    );

    return user?.active_organization_id ?? null;
  }

  private async persistActiveOrganizationId(userId: string, organizationId: string | null) {
    await this.databaseService.query(
      `
        update users
        set active_organization_id = $1,
            updated_at = now()
        where id = $2
      `,
      [organizationId, userId]
    );
  }
}
