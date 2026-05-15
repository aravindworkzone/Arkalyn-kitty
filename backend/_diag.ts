import mongoose from 'mongoose';
import { env } from './config/env';
import Group from './models/group.model';
import GroupMember from './models/group_member.model';
import { SettlementService } from './services/group.service';

(async () => {
  await mongoose.connect(env.MONGO_URI);
  const groups = await Group.find().limit(8);
  for (const g of groups) {
    const members = await GroupMember.find({ groupId: g._id, isDeleted: false });
    console.log(`\nGROUP ${g.displayId} balance=${g.balance} totalContribution=${g.totalContribution}`);
    for (const m of members) {
      console.log(`  member userId=${m.userId} role=${m.role} settlement=${m.settlement} contribution=${m.contribution} leaveReq=${(m as any).leaveRequestedAt}`);
    }
  }
  for (const g of groups) {
    const m = await GroupMember.findOne({ groupId: g._id, isDeleted: false, settlement: false, role: { $ne: 'SUPER_ADMIN' } });
    const admin = await GroupMember.findOne({ groupId: g._id, isDeleted: false, role: 'SUPER_ADMIN' });
    if (m && admin) {
      console.log(`\n--- SettlementService group ${g.displayId} member ${m.userId} amount=0 balance(passed)=${g.balance} ---`);
      try {
        const r = await SettlementService({ group: g._id as any, userId: admin.userId as any, settlement: 0, member: m.userId as any, balance: g.balance });
        console.log('RESULT:', r);
      } catch (e: any) {
        console.log('ERROR statusCode=', e.statusCode, 'message=', e.message);
        console.log(e.stack);
      }
      break;
    }
  }
  await mongoose.disconnect();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
