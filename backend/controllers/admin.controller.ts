import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/response';
import {
    listUsersService,
    getUserDetailService,
    suspendUserService,
    restoreUserService,
    deleteUserService,
    hardDeleteUserService,
    listGroupSubscriptionsService,
    overrideGroupPlanService,
    createPromoService,
    listPromosService,
    deactivatePromoService,
    getPromoRedemptionsService,
    getAnalyticsService,
    getHealthService,
} from '../services/admin.service';
import {
    listUsersQuerySchema,
    listSubscriptionsQuerySchema,
    analyticsQuerySchema,
} from '../validators/admin.validator';

// ── Users ──
export const ListUsers = asyncHandler(async (req, res) => {
    const { page, limit, search, status, sort } = listUsersQuerySchema.parse(req.query);
    const { items, total } = await listUsersService(page, limit, { search, status, sort });
    sendPaginated(res, items, total, page, limit, 'Users fetched');
});

export const UserDetail = asyncHandler(async (req, res) => {
    const detail = await getUserDetailService(String(req.params.userId));
    sendSuccess(res, detail, 'User detail');
});

export const SuspendUser = asyncHandler(async (req, res) => {
    const result = await suspendUserService(String(req.params.userId));
    sendSuccess(res, result, 'User suspended');
});

export const RestoreUser = asyncHandler(async (req, res) => {
    const result = await restoreUserService(String(req.params.userId));
    sendSuccess(res, result, 'User restored');
});

export const DeleteUser = asyncHandler(async (req, res) => {
    const result = await deleteUserService(String(req.params.userId));
    sendSuccess(res, result, 'User deleted');
});

export const HardDeleteUser = asyncHandler(async (req, res) => {
    const result = await hardDeleteUserService(String(req.params.userId), String(req.user!._id));
    sendSuccess(res, result, 'User permanently deleted');
});

// ── Group subscriptions ──
export const ListSubscriptions = asyncHandler(async (req, res) => {
    const { page, limit, search, plan, sort } = listSubscriptionsQuerySchema.parse(req.query);
    const { items, total } = await listGroupSubscriptionsService(page, limit, { search, plan, sort });
    sendPaginated(res, items, total, page, limit, 'Group subscriptions fetched');
});

export const OverrideGroupPlan = asyncHandler(async (req, res) => {
    const { plan, cycle, expiresAt } = req.body;
    const subscription = await overrideGroupPlanService(String(req.params.groupId), plan, cycle, expiresAt);
    sendSuccess(res, { subscription }, 'Plan updated');
});

// ── Promo codes ──
export const CreatePromo = asyncHandler(async (req, res) => {
    const promo = await createPromoService({ ...req.body, maxRedemptions: req.body.maxRedemptions ?? null });
    sendSuccess(res, { promo }, 'Promo code created', 201);
});

export const ListPromos = asyncHandler(async (_req, res) => {
    const promos = await listPromosService();
    sendSuccess(res, { promos }, 'Promo codes');
});

export const DeactivatePromo = asyncHandler(async (req, res) => {
    const promo = await deactivatePromoService(String(req.params.id));
    sendSuccess(res, { promo }, 'Promo code deactivated');
});

export const PromoRedemptions = asyncHandler(async (req, res) => {
    const redemptions = await getPromoRedemptionsService(String(req.params.id));
    sendSuccess(res, { redemptions }, 'Promo redemptions');
});

// ── Analytics + health ──
export const Analytics = asyncHandler(async (req, res) => {
    const { granularity } = analyticsQuerySchema.parse(req.query);
    const data = await getAnalyticsService(granularity);
    sendSuccess(res, data, 'Analytics');
});

export const Health = asyncHandler(async (_req, res) => {
    const data = await getHealthService();
    sendSuccess(res, data, 'System health');
});
