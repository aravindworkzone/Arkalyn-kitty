import express from 'express';
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    deleteNotification,
} from '../controllers/notification.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    notificationIdParamsSchema,
    listNotificationsQuerySchema,
} from '../validators/notification.validator';

const router = express.Router();

router.get('/', verifyToken, validate({ query: listNotificationsQuerySchema }), getNotifications);

router.get('/unread-count', verifyToken, getUnreadCount);

router.patch('/read-all', verifyToken, markAllNotificationsRead);

router.patch(
    '/:id/read',
    verifyToken,
    validate({ params: notificationIdParamsSchema }),
    markNotificationRead
);

router.delete(
    '/:id',
    verifyToken,
    validate({ params: notificationIdParamsSchema }),
    deleteNotification
);

export default router;
