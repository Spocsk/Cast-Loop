import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  async record(
    entry: {
      organizationId: string;
      actorUserId: string | null;
      entityType: string;
      entityId: string;
      action: string;
      payload: Record<string, unknown>;
    },
    client?: PoolClient
  ) {
    await this.databaseService.query(
      `
        insert into audit_logs (
          organization_id,
          actor_user_id,
          entity_type,
          entity_id,
          action,
          payload
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [entry.organizationId, entry.actorUserId, entry.entityType, entry.entityId, entry.action, entry.payload],
      client
    );
  }
}
