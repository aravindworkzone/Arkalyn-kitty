import express from 'express';
import { GetPlans, CreateOrder, VerifyPayment, RedeemPromo } from '../controllers/subscription.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createOrderBodySchema,
    verifyPaymentBodySchema,
    redeemPromoBodySchema,
} from '../validators/subscription.validator';

const router = express.Router();

router.get('/plans', verifyToken, GetPlans);
router.post('/order', verifyToken, validate({ body: createOrderBodySchema }), CreateOrder);
router.post('/verify', verifyToken, validate({ body: verifyPaymentBodySchema }), VerifyPayment);
router.post('/redeem', verifyToken, validate({ body: redeemPromoBodySchema }), RedeemPromo);

export default router;
