import crypto from 'crypto';
import { z } from 'zod';

/**
 * The shape `PushSubscription.toJSON()` produces in the browser.
 *
 * `expirationTime` is part of that object and is deliberately not accepted: it
 * is almost always null, nothing here reads it, and a push service retiring an
 * endpoint is discovered from the 410 on send rather than from a stored clock.
 * Unknown keys are stripped rather than rejected so a browser adding a field to
 * the standard object does not start failing this endpoint.
 */
/**
 * Sizes are checked, not just presence. `p256dh` is an uncompressed P-256 point
 * (65 bytes) and `auth` is a 16-byte secret; anything else cannot be encrypted
 * against and fails inside web-push with "Public key is not valid for specified
 * curve". That failure is not a dead endpoint, so the row is never pruned — a
 * malformed subscription accepted here would sit in the collection forever and
 * cost a doomed delivery attempt on every single notification. Rejecting it at
 * the door is the only place the cost is bounded.
 */
const base64UrlBytes = (bytes: number, label: string) =>
    z
        .string()
        .regex(/^[A-Za-z0-9_-]+=*$/, `Subscription key ${label} must be base64url`)
        .refine(
            (v) => Buffer.from(v, 'base64url').length === bytes,
            `Subscription key ${label} must decode to ${bytes} bytes`
        );

/**
 * The length check is necessary but not sufficient: a 65-byte blob can still
 * fail to be a point on P-256, and that is exactly the case that reaches
 * web-push as "Public key is not valid for specified curve".
 *
 * Importing it as a JWK is the exact test — createPublicKey rejects a point the
 * curve does not contain. (ECDH.setPublicKey would also work but is absent from
 * @types/node.) The leading 0x04 is the uncompressed-point marker, and the two
 * 32-byte halves after it are the X and Y coordinates the JWK wants.
 */
const p256dhSchema = base64UrlBytes(65, 'p256dh').refine((v) => {
    const buf = Buffer.from(v, 'base64url');
    if (buf[0] !== 0x04) return false;
    try {
        crypto.createPublicKey({
            key: {
                kty: 'EC',
                crv: 'P-256',
                x: buf.subarray(1, 33).toString('base64url'),
                y: buf.subarray(33, 65).toString('base64url'),
            },
            format: 'jwk',
        });
        return true;
    } catch {
        return false;
    }
}, 'Subscription key p256dh is not a valid P-256 public key');

export const pushSubscriptionBodySchema = z.object({
    endpoint: z.url('A valid push endpoint URL is required'),
    keys: z.object({
        p256dh: p256dhSchema,
        auth: base64UrlBytes(16, 'auth'),
    }),
});

export const pushUnsubscribeBodySchema = z.object({
    endpoint: z.url('A valid push endpoint URL is required'),
});
