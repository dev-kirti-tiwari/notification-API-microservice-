import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import { NotificationService, notificationService } from './service';
import {
  createNotificationSchema,
  idParamSchema,
  listQuerySchema,
} from './validation';

export class NotificationController {
  constructor(private service: NotificationService = notificationService) {}

  createNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey = req.headers['idempotency-key'];
      const keyString = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;

      if (!keyString || !keyString.trim()) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Idempotency-Key header is required for create operation');
        return;
      }

      const validation = createNotificationSchema.safeParse(req.body);
      if (!validation.success) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          validation.error.errors[0]?.message || 'Validation error',
          validation.error.flatten().fieldErrors
        );
        return;
      }

      const { notification, isDuplicate } = await this.service.createNotification(
        req.context!,
        keyString.trim(),
        validation.data
      );

      sendSuccess(res, notification, isDuplicate ? 200 : 201);
    } catch (err) {
      next(err);
    }
  };

  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = listQuerySchema.safeParse(req.query);
      if (!validation.success) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          validation.error.errors[0]?.message || 'Validation error',
          validation.error.flatten().fieldErrors
        );
        return;
      }

      const { records, pagination } = await this.service.listUserNotifications(
        req.context!,
        validation.data
      );

      sendSuccess(res, records, 200, pagination);
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getUnreadCount(req.context!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  };

  getNotificationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramValidation = idParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid notification ID');
        return;
      }

      const record = await this.service.getNotificationById(req.context!, req.params.id);
      sendSuccess(res, record, 200);
    } catch (err) {
      next(err);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramValidation = idParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid notification ID');
        return;
      }

      const record = await this.service.markAsRead(req.context!, req.params.id);
      sendSuccess(res, record, 200);
    } catch (err) {
      next(err);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.markAllAsRead(req.context!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramValidation = idParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid notification ID');
        return;
      }

      await this.service.deleteNotification(req.context!, req.params.id);
      sendSuccess(res, { message: 'Notification deleted successfully' }, 200);
    } catch (err) {
      next(err);
    }
  };
}

export const notificationController = new NotificationController();
