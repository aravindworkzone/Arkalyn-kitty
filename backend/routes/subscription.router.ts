import express from 'express';
import { GetPlans, CreateOrder, VerifyPayment, MarkPaymentFailed, GetTransactions, DeleteTransaction, RedeemPromo } from '../controllers/subscription.controller';
import { verifyToken, loadGroup, authorizeRole, ensureGroupActive } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createOrderBodySchema,
    verifyPaymentBodySchema,
    markPaymentFailedBodySchema,
    redeemPromoBodySchema,
    transactionIdParamSchema,
} from '../validators/subscription.validator';

const router = express.Router();

router.get('/plans', verifyToken, GetPlans);

// Billing history is scoped to the PAYER, not a group — these stay account-level
// even though the entitlement they bought did not.
router.get('/transactions', verifyToken, GetTransactions);
router.delete('/transactions/:id', verifyToken, validate({ params: transactionIdParamSchema }), DeleteTransaction);

// Buying and redeeming both grant a plan to a group, so both run the standard
// group chain: validate first (loadGroup reads `groupId` off the parsed body),
// then resolve the group, then require an admin of THAT group, then refuse a
// closed one. Any SUPER_ADMIN or ADMIN can pay — that is the point of per-group
// billing: whoever needs the headroom can buy it, not just the creator.
const groupBilling = [
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    ensureGroupActive,
] as const;

router.post('/order', verifyToken, validate({ body: createOrderBodySchema }), ...groupBilling, CreateOrder);
router.post('/redeem', verifyToken, validate({ body: redeemPromoBodySchema }), ...groupBilling, RedeemPromo);

// Callback routes carry only Razorpay's ids; the group is recovered from the
// stored SubscriptionPayment, so there is nothing to authorize against here
// beyond "the caller is the payer" (checked in the service).
router.post('/verify', verifyToken, validate({ body: verifyPaymentBodySchema }), VerifyPayment);
router.post('/payment-failed', verifyToken, validate({ body: markPaymentFailedBodySchema }), MarkPaymentFailed);

export default router;
