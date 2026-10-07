import { Router } from 'express';
import { internalAuthMiddleware } from '../../middleware/internalAuth';
import { tenantContextMiddleware, requireUserContext } from '../../middleware/context';
import { notificationController } from './controller';

const router = Router();

// Apply internal Bearer token validation and context header parsing to all notification routes
router.use(internalAuthMiddleware);
router.use(tenantContextMiddleware);

// Sub-routes before /:id parameter routes
router.get('/unread-count', requireUserContext, notificationController.getUnreadCount);
router.patch('/read-all', requireUserContext, notificationController.markAllAsRead);

// Collection routes
router.post('/', notificationController.createNotification);
router.get('/', requireUserContext, notificationController.listNotifications);

// Member routes by ID
router.get('/:id', notificationController.getNotificationById);
router.patch('/:id/read', requireUserContext, notificationController.markAsRead);
router.delete('/:id', requireUserContext, notificationController.deleteNotification);

export default router;
