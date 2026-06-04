import express from 'express';
import { GetPlans, CreateOrder, VerifyPayment, MarkPaymentFailed, GetTransactions, RedeemPromo } from '../controllers/subscription.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createOrderBodySchema,
    verifyPaymentBodySchema,
    markPaymentFailedBodySchema,
    redeemPromoBodySchema,
} from '../validators/subscription.validator';

const router = express.Router();

router.get('/plans', verifyToken, GetPlans);
router.get('/transactions', verifyToken, GetTransactions);
router.post('/order', verifyToken, validate({ body: createOrderBodySchema }), CreateOrder);
router.post('/verify', verifyToken, validate({ body: verifyPaymentBodySchema }), VerifyPayment);
router.post('/payment-failed', verifyToken, validate({ body: markPaymentFailedBodySchema }), MarkPaymentFailed);
router.post('/redeem', verifyToken, validate({ body: redeemPromoBodySchema }), RedeemPromo);

export default router;
