import { RequestContext } from '../../middleware/context';
import { AppError } from '../../middleware/errorHandler';
import { PaginationMeta } from '../../utils/response';
import { NotificationRepository, notificationRepository } from './repository';
import { CreateNotificationDTO, ListNotificationsQuery, NotificationRecord } from './types';

export class NotificationService {
  constructor(private repo: NotificationRepository = notificationRepository) {}

  async createNotification(
    context: RequestContext,
    idempotencyKey: string,
    data: CreateNotificationDTO
  ): Promise<{ notification: NotificationRecord; isDuplicate: boolean }> {
    // 1. Idempotency Check
    const existing = await this.repo.findByIdempotencyKey(
      context.tenantId,
      context.organizationId,
      context.softwareId,
      idempotencyKey
    );

    if (existing) {
      return { notification: existing, isDuplicate: true };
    }

    // 2. Insert new notification
    const notification = await this.repo.create(
      context.tenantId,
      context.organizationId,
      context.softwareId,
      idempotencyKey,
      data,
      context.userId || null
    );

    return { notification, isDuplicate: false };
  }

  async listUserNotifications(
    context: RequestContext,
    query: ListNotificationsQuery
  ): Promise<{ records: NotificationRecord[]; pagination: PaginationMeta }> {
    if (!context.userId) {
      throw new AppError(400, 'INVALID_CONTEXT_HEADERS', 'User context is required for list operation');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const { records, total } = await this.repo.findUserNotifications(
      context.tenantId,
      context.organizationId,
      context.userId,
      query
    );

    const totalPages = Math.ceil(total / limit) || 1;
    const pagination: PaginationMeta = {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1,
    };

    return { records, pagination };
  }

  async getUnreadCount(context: RequestContext): Promise<{ unread_count: number }> {
    if (!context.userId) {
      throw new AppError(400, 'INVALID_CONTEXT_HEADERS', 'User context is required for unread count');
    }

    const count = await this.repo.getUnreadCount(
      context.tenantId,
      context.organizationId,
      context.userId
    );

    return { unread_count: count };
  }

  async getNotificationById(context: RequestContext, id: string): Promise<NotificationRecord> {
    const notification = await this.repo.findById(
      context.tenantId,
      context.organizationId,
      id,
      context.userId || null
    );

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found within current security scope');
    }

    return notification;
  }

  async markAsRead(context: RequestContext, id: string): Promise<NotificationRecord> {
    if (!context.userId) {
      throw new AppError(400, 'INVALID_CONTEXT_HEADERS', 'User context is required to mark notification read');
    }

    const updated = await this.repo.markAsRead(
      context.tenantId,
      context.organizationId,
      id,
      context.userId
    );

    if (!updated) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found within current security scope');
    }

    return updated;
  }

  async markAllAsRead(context: RequestContext): Promise<{ updated_count: number }> {
    if (!context.userId) {
      throw new AppError(400, 'INVALID_CONTEXT_HEADERS', 'User context is required to mark all notifications read');
    }

    const updatedCount = await this.repo.markAllAsRead(
      context.tenantId,
      context.organizationId,
      context.userId
    );

    return { updated_count: updatedCount };
  }

  async deleteNotification(context: RequestContext, id: string): Promise<void> {
    if (!context.userId) {
      throw new AppError(400, 'INVALID_CONTEXT_HEADERS', 'User context is required to delete notification');
    }

    const success = await this.repo.softDelete(
      context.tenantId,
      context.organizationId,
      id,
      context.userId
    );

    if (!success) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found within current security scope');
    }
  }
}

export const notificationService = new NotificationService();
