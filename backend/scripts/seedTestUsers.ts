import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { BCRYPT_SALT_ROUNDS } from '../config/constants';
import User from '../models/user.model';

/**
 * Seeds the local test accounts.
 *
 *   npm run seed:users
 *
 * Idempotent by design: it upserts on email and resets the password every run,
 * so re-running after someone has changed a password (or half a run failed)
 * lands you back on a known state instead of crashing on the unique email
 * index. That is the property that makes a seed useful — you should never have
 * to clean up before re-seeding.
 *
 * Passwords are hashed with bcrypt at BCRYPT_SALT_ROUNDS, exactly as
 * SignUpService does, so these accounts log in through the normal endpoint with
 * no special casing anywhere.
 *
 * Refuses to run against a non-local database unless SEED_FORCE=1 — the whole
 * point of this script is to overwrite passwords, which is not something you
 * want to fire at a shared or production cluster by accident.
 */

interface SeedUser {
    name: string;
    email: string;
    password: string;
}

// test1-4 are the original four and keep their passwords — every other seeded
// group is built from them, and changing those would invalidate anyone's saved
// login. test5-10 exist so the chit can run at a realistic SIZE: a 4-person
// rotation finishes in four cycles and never shows the states that only appear
// over a longer term.
const USERS: SeedUser[] = [
    { name: 'Test One', email: 'test1@gmail.com', password: 'test@1' },
    { name: 'Test Two', email: 'test2@gmail.com', password: 'test@2' },
    { name: 'Test Three', email: 'test3@gmail.com', password: 'test@3' },
    { name: 'Test Four', email: 'test4@gmail.com', password: 'test@4' },
    { name: 'Test Five', email: 'test5@gmail.com', password: 'test@5' },
    { name: 'Test Six', email: 'test6@gmail.com', password: 'test@6' },
    { name: 'Test Seven', email: 'test7@gmail.com', password: 'test@7' },
    { name: 'Test Eight', email: 'test8@gmail.com', password: 'test@8' },
    { name: 'Test Nine', email: 'test9@gmail.com', password: 'test@9' },
    { name: 'Test Ten', email: 'test10@gmail.com', password: 'test@10' },
];

const looksLocal = (uri: string) => /localhost|127\.0\.0\.1|host\.docker\.internal/.test(uri);

const seed = async () => {
    const uri = env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set — check backend/.env');

    if (!looksLocal(uri) && process.env.SEED_FORCE !== '1') {
        throw new Error(
            'MONGO_URI does not look like a local database, and this script overwrites ' +
                'passwords. Re-run with SEED_FORCE=1 if you really mean to seed it.'
        );
    }

    await mongoose.connect(uri);
    console.log(`connected: ${mongoose.connection.name}`);

    const results: { email: string; action: string }[] = [];

    for (const u of USERS) {
        const password = await bcrypt.hash(u.password, BCRYPT_SALT_ROUNDS);
        const email = u.email.trim().toLowerCase();

        const existing = await User.findOne({ email }).select('_id');

        // Only fields a test account needs to be usable are touched. Role is
        // left at its schema default (USER). Accounts carry no plan — every
        // group these users create starts FREE and is upgraded on its own.
        await User.updateOne(
            { email },
            {
                $set: { password, status: 'ACTIVE', authProvider: 'LOCAL' },
                $setOnInsert: { name: u.name, email },
            },
            { upsert: true }
        );

        results.push({ email, action: existing ? 'password reset' : 'created' });
    }

    console.table(
        results.map((r, i) => ({
            email: r.email,
            password: USERS[i]!.password,
            result: r.action,
        }))
    );

    await mongoose.disconnect();
    console.log('done');
};

seed().catch(async (err) => {
    console.error('seed failed:', err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
