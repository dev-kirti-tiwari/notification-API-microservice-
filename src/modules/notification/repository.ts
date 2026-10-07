import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { CreateNotificationDTO, ListNotificationsQuery, NotificationRecord } from './types';

// In-memory fallback storage when PostgreSQL is not running locally
class InMemoryNotificationStore {
  private notifications: Map<string, NotificationRecord> = new Map();
  private autoIncrement = 90000000100n;

  create(
    tenantId: string,
    organizationId: string,
    softwareId: string,
    idempotencyKey: string,
    data: CreateNotificationDTO,
    createdBy: string | null
  ): NotificationRecord {
    const id = (++this.autoIncrement).toString();
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id,
      tenant_id: tenantId,
      organization_id: organizationId,
      software_id: softwareId,
      recipient_user_id: data.recipient_user_id,
      actor_user_id: data.actor_user_id || null,
      event_key: data.event_key,
      title: data.title,
      message: data.message,
      channel: data.channel || 'IN_APP',
      priority: data.priority || 'NORMAL',
      related_entity_type: data.related_entity_type || null,
      related_entity_id: data.related_entity_id || null,
      action_url: data.action_url || null,
      metadata: data.metadata || null,
      idempotency_key: idempotencyKey,
      is_read: false,
      read_at: null,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    this.notifications.set(id, record);
    return { ...record };
  }

  findByIdempotencyKey(tenantId: string, organizationId: string, softwareId: string, idempotencyKey: string): NotificationRecord | null {
    for (const record of this.notifications.values()) {
      if (
        record.tenant_id === tenantId &&
        record.organization_id === organizationId &&
        record.software_id === softwareId &&
        record.idempotency_key === idempotencyKey &&
        record.deleted_at === null
      ) {
        return { ...record };
      }
    }
    return null;
  }

  findUserNotifications(
    tenantId: string,
    organizationId: string,
    recipientUserId: string,
    options: ListNotificationsQuery
  ): { records: NotificationRecord[]; total: number } {
    const filtered: NotificationRecord[] = [];
    for (const record of this.notifications.values()) {
      if (
        record.tenant_id === tenantId &&
        record.organization_id === organizationId &&
        record.recipient_user_id === recipientUserId &&
        record.deleted_at === null
      ) {
        if (options.is_read !== undefined && record.is_read !== options.is_read) continue;
        if (options.event_key && record.event_key !== options.event_key) continue;
        if (options.channel && record.channel !== options.channel) continue;
        if (options.priority && record.priority !== options.priority) continue;
        filtered.push({ ...record });
      }
    }

    // Sort descending by created_at
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const records = filtered.slice(offset, offset + limit);

    return { records, total };
  }

  getUnreadCount(tenantId: string, organizationId: string, recipientUserId: string): number {
    let count = 0;
    for (const record of this.notifications.values()) {
      if (
        record.tenant_id === tenantId &&
        record.organization_id === organizationId &&
        record.recipient_user_id === recipientUserId &&
        !record.is_read &&
        record.deleted_at === null
      ) {
        count++;
      }
    }
    return count;
  }

  findById(tenantId: string, organizationId: string, id: string, recipientUserId?: string | null): NotificationRecord | null {
    const record = this.notifications.get(id);
    if (!record || record.deleted_at !== null) return null;
    if (record.tenant_id !== tenantId || record.organization_id !== organizationId) return null;
    if (recipientUserId && record.recipient_user_id !== recipientUserId) return null;
    return { ...record };
  }

  markAsRead(tenantId: string, organizationId: string, id: string, recipientUserId: string): NotificationRecord | null {
    const record = this.findById(tenantId, organizationId, id, recipientUserId);
    if (!record) return null;
    const now = new Date().toISOString();
    record.is_read = true;
    record.read_at = now;
    record.updated_at = now;
    this.notifications.set(id, record);
    return { ...record };
  }

  markAllAsRead(tenantId: string, organizationId: string, recipientUserId: string): number {
    const now = new Date().toISOString();
    let updatedCount = 0;
    for (const [id, record] of this.notifications.entries()) {
      if (
        record.tenant_id === tenantId &&
        record.organization_id === organizationId &&
        record.recipient_user_id === recipientUserId &&
        !record.is_read &&
        record.deleted_at === null
      ) {
        record.is_read = true;
        record.read_at = now;
        record.updated_at = now;
        this.notifications.set(id, record);
        updatedCount++;
      }
    }
    return updatedCount;
  }

  softDelete(tenantId: string, organizationId: string, id: string, recipientUserId: string): boolean {
    const record = this.findById(tenantId, organizationId, id, recipientUserId);
    if (!record) return false;
    record.deleted_at = new Date().toISOString();
    this.notifications.set(id, record);
    return true;
  }
}

export class NotificationRepository {
  private memStore = new InMemoryNotificationStore();
  private useMemStore = false;

  public enableMemoryStore() {
    this.useMemStore = true;
  }

  async create(
    tenantId: string,
    organizationId: string,
    softwareId: string,
    idempotencyKey: string,
    data: CreateNotificationDTO,
    createdBy: string | null = null
  ): Promise<NotificationRecord> {
    if (this.useMemStore) {
      return this.memStore.create(tenantId, organizationId, softwareId, idempotencyKey, data, createdBy);
    }

    try {
      const sql = `
        INSERT INTO notifications (
          tenant_id,
          organization_id,
          software_id,
          recipient_user_id,
          actor_user_id,
          event_key,
          title,
          message,
          channel,
          priority,
          related_entity_type,
          related_entity_id,
          action_url,
          metadata,
          idempotency_key,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING *;
      `;

      const params = [
        tenantId,
        organizationId,
        softwareId,
        data.recipient_user_id,
        data.actor_user_id || null,
        data.event_key,
        data.title,
        data.message,
        data.channel || 'IN_APP',
        data.priority || 'NORMAL',
        data.related_entity_type || null,
        data.related_entity_id || null,
        data.action_url || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        idempotencyKey,
        createdBy,
      ];

      const result = await query<NotificationRecord>(sql, params);
      return result.rows[0];
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        logger.warn('PostgreSQL unreachable, switching to memory store fallback');
        this.useMemStore = true;
        return this.memStore.create(tenantId, organizationId, softwareId, idempotencyKey, data, createdBy);
      }
      throw err;
    }
  }

  async findByIdempotencyKey(
    tenantId: string,
    organizationId: string,
    softwareId: string,
    idempotencyKey: string
  ): Promise<NotificationRecord | null> {
    if (this.useMemStore) {
      return this.memStore.findByIdempotencyKey(tenantId, organizationId, softwareId, idempotencyKey);
    }

    try {
      const sql = `
        SELECT * FROM notifications
        WHERE tenant_id = $1
          AND organization_id = $2
          AND software_id = $3
          AND idempotency_key = $4
          AND deleted_at IS NULL
        LIMIT 1;
      `;
      const result = await query<NotificationRecord>(sql, [tenantId, organizationId, softwareId, idempotencyKey]);
      return result.rows[0] || null;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.findByIdempotencyKey(tenantId, organizationId, softwareId, idempotencyKey);
      }
      throw err;
    }
  }

  async findUserNotifications(
    tenantId: string,
    organizationId: string,
    recipientUserId: string,
    options: ListNotificationsQuery
  ): Promise<{ records: NotificationRecord[]; total: number }> {
    if (this.useMemStore) {
      return this.memStore.findUserNotifications(tenantId, organizationId, recipientUserId, options);
    }

    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const conditions: string[] = [
        'tenant_id = $1',
        'organization_id = $2',
        'recipient_user_id = $3',
        'deleted_at IS NULL',
      ];
      const params: any[] = [tenantId, organizationId, recipientUserId];

      if (options.is_read !== undefined) {
        params.push(options.is_read);
        conditions.push(`is_read = $${params.length}`);
      }

      if (options.event_key) {
        params.push(options.event_key);
        conditions.push(`event_key = $${params.length}`);
      }

      if (options.channel) {
        params.push(options.channel);
        conditions.push(`channel = $${params.length}`);
      }

      if (options.priority) {
        params.push(options.priority);
        conditions.push(`priority = $${params.length}`);
      }

      const whereClause = conditions.join(' AND ');

      // Total count
      const countSql = `SELECT COUNT(*) AS total FROM notifications WHERE ${whereClause};`;
      const countResult = await query<{ total: string }>(countSql, params);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Data rows
      const dataSql = `
        SELECT * FROM notifications
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
      `;
      const dataResult = await query<NotificationRecord>(dataSql, [...params, limit, offset]);

      return {
        records: dataResult.rows,
        total,
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.findUserNotifications(tenantId, organizationId, recipientUserId, options);
      }
      throw err;
    }
  }

  async getUnreadCount(
    tenantId: string,
    organizationId: string,
    recipientUserId: string
  ): Promise<number> {
    if (this.useMemStore) {
      return this.memStore.getUnreadCount(tenantId, organizationId, recipientUserId);
    }

    try {
      const sql = `
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE tenant_id = $1
          AND organization_id = $2
          AND recipient_user_id = $3
          AND is_read = FALSE
          AND deleted_at IS NULL;
      `;
      const result = await query<{ count: string }>(sql, [tenantId, organizationId, recipientUserId]);
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.getUnreadCount(tenantId, organizationId, recipientUserId);
      }
      throw err;
    }
  }

  async findById(
    tenantId: string,
    organizationId: string,
    id: string,
    recipientUserId?: string | null
  ): Promise<NotificationRecord | null> {
    if (this.useMemStore) {
      return this.memStore.findById(tenantId, organizationId, id, recipientUserId);
    }

    try {
      const conditions = [
        'tenant_id = $1',
        'organization_id = $2',
        'id = $3',
        'deleted_at IS NULL',
      ];
      const params: any[] = [tenantId, organizationId, id];

      if (recipientUserId) {
        params.push(recipientUserId);
        conditions.push(`recipient_user_id = $${params.length}`);
      }

      const sql = `
        SELECT * FROM notifications
        WHERE ${conditions.join(' AND ')}
        LIMIT 1;
      `;
      const result = await query<NotificationRecord>(sql, params);
      return result.rows[0] || null;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.findById(tenantId, organizationId, id, recipientUserId);
      }
      throw err;
    }
  }

  async markAsRead(
    tenantId: string,
    organizationId: string,
    id: string,
    recipientUserId: string
  ): Promise<NotificationRecord | null> {
    if (this.useMemStore) {
      return this.memStore.markAsRead(tenantId, organizationId, id, recipientUserId);
    }

    try {
      const sql = `
        UPDATE notifications
        SET is_read = TRUE,
            read_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1
          AND organization_id = $2
          AND id = $3
          AND recipient_user_id = $4
          AND deleted_at IS NULL
        RETURNING *;
      `;
      const result = await query<NotificationRecord>(sql, [tenantId, organizationId, id, recipientUserId]);
      return result.rows[0] || null;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.markAsRead(tenantId, organizationId, id, recipientUserId);
      }
      throw err;
    }
  }

  async markAllAsRead(
    tenantId: string,
    organizationId: string,
    recipientUserId: string
  ): Promise<number> {
    if (this.useMemStore) {
      return this.memStore.markAllAsRead(tenantId, organizationId, recipientUserId);
    }

    try {
      const sql = `
        UPDATE notifications
        SET is_read = TRUE,
            read_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1
          AND organization_id = $2
          AND recipient_user_id = $3
          AND is_read = FALSE
          AND deleted_at IS NULL;
      `;
      const result = await query(sql, [tenantId, organizationId, recipientUserId]);
      return result.rowCount || 0;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.markAllAsRead(tenantId, organizationId, recipientUserId);
      }
      throw err;
    }
  }

  async softDelete(
    tenantId: string,
    organizationId: string,
    id: string,
    recipientUserId: string
  ): Promise<boolean> {
    if (this.useMemStore) {
      return this.memStore.softDelete(tenantId, organizationId, id, recipientUserId);
    }

    try {
      const sql = `
        UPDATE notifications
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1
          AND organization_id = $2
          AND id = $3
          AND recipient_user_id = $4
          AND deleted_at IS NULL;
      `;
      const result = await query(sql, [tenantId, organizationId, id, recipientUserId]);
      return (result.rowCount ?? 0) > 0;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.useMemStore = true;
        return this.memStore.softDelete(tenantId, organizationId, id, recipientUserId);
      }
      throw err;
    }
  }
}

export const notificationRepository = new NotificationRepository();
