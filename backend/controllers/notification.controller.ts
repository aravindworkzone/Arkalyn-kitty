import Notification from '../models/notification.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const getNotifications = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipient: req.user._id };

    const [items, total] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('actor', 'name')
            .populate('group', 'name')
            .lean(),
        Notification.countDocuments(filter),
    ]);

    sendPaginated(res, items, total, page, limit, 'Notifications fetched');
});

export const markNotificationRead = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { $set: { read: true } },
        { new: true }
    );

    if (!notification) throw new AppError('Notification not found', 404);

    sendSuccess(res, { notification }, 'Notification marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const result = await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { $set: { read: true } }
    );

    sendSuccess(res, { modified: result.modifiedCount }, 'All notifications marked as read');
});

export const getUnreadCount = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const count = await Notification.countDocuments({ recipient: req.user._id, read: false });

    sendSuccess(res, { count }, 'Unread count fetched');
});

export const deleteNotification = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        recipient: req.user._id,
    });

    if (!notification) throw new AppError('Notification not found', 404);

    sendSuccess(res, null, 'Notification deleted');
});
