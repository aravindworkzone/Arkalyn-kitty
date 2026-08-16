import express from 'express';
import {
    ListUsers,
    UserDetail,
    SuspendUser,
    RestoreUser,
    DeleteUser,
    HardDeleteUser,
    ListSubscriptions,
    OverrideGroupPlan,
    CreatePromo,
    ListPromos,
    DeactivatePromo,
    PromoRedemptions,
    Analytics,
    Health,
} from '../controllers/admin.controller';
import { validate } from '../middlewares/validate.middleware';
import {
    listUsersQuerySchema,
    listSubscriptionsQuerySchema,
    userIdParamSchema,
    groupIdParamSchema,
    promoIdParamSchema,
    createPromoBodySchema,
    overridePlanBodySchema,
    analyticsQuerySchema,
} from '../validators/admin.validator';

// verifyToken + requireAppOwner are applied at the mount point (main.ts), so
// every route here is already owner-guarded.
const router = express.Router();

// Users
router.get('/users', validate({ query: listUsersQuerySchema }), ListUsers);
router.get('/users/:userId', validate({ params: userIdParamSchema }), UserDetail);
router.post('/users/:userId/suspend', validate({ params: userIdParamSchema }), SuspendUser);
router.post('/users/:userId/restore', validate({ params: userIdParamSchema }), RestoreUser);
router.delete('/users/:userId', validate({ params: userIdParamSchema }), DeleteUser);
router.delete('/users/:userId/hard', validate({ params: userIdParamSchema }), HardDeleteUser);

// Group subscriptions — plans hang off groups, so the override targets a group.
router.get('/subscriptions', validate({ query: listSubscriptionsQuerySchema }), ListSubscriptions);
router.post(
    '/groups/:groupId/plan',
    validate({ params: groupIdParamSchema, body: overridePlanBodySchema }),
    OverrideGroupPlan
);

// Promo codes
router.post('/promos', validate({ body: createPromoBodySchema }), CreatePromo);
router.get('/promos', ListPromos);
router.post('/promos/:id/deactivate', validate({ params: promoIdParamSchema }), DeactivatePromo);
router.get('/promos/:id/redemptions', validate({ params: promoIdParamSchema }), PromoRedemptions);

// Analytics + health
router.get('/analytics', validate({ query: analyticsQuerySchema }), Analytics);
router.get('/health', Health);

export default router;
