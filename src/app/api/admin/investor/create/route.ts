import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb, verifyAuthToken } from '@/lib/firebase-admin';

const investorSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^(?:\+91)?[6-9]\d{9}$/).transform((value) => value.replace(/^\+91/, '')),
  password: z.string().min(6).max(128),
  email: z.union([z.string().trim().email().max(254), z.null()]).optional(),
  address: z.string().trim().max(500).optional().default(''),
  city: z.string().trim().max(120).optional().default(''),
  district: z.string().trim().max(120).optional().default(''),
  pinCode: z.string().trim().max(12).optional().default(''),
  panNumber: z.string().trim().max(20).optional().default(''),
  bankAccountNumber: z.string().trim().max(40).optional().default(''),
  bankIfsc: z.string().trim().max(20).optional().default(''),
  bankName: z.string().trim().max(120).optional().default(''),
  nomineeName: z.string().trim().max(120).optional().default(''),
  nomineeRelation: z.string().trim().max(80).optional().default(''),
});

type CreatedInvestor = { success: true; investorId: string; uid: string; name: string; phone: string };

export async function POST(request: Request) {
  let createdUid: string | undefined;

  try {
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'Administrator authentication is required.' }, { status: 401 });

    let caller: Awaited<ReturnType<typeof verifyAuthToken>>;
    try {
      caller = await verifyAuthToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Your administrator session is invalid or expired. Please sign in again.' }, { status: 401 });
    }
    if (caller.role !== 'Admin' && caller.role !== 'Owner') {
      return NextResponse.json({ error: 'Only an Administrator or Owner can create investor accounts.' }, { status: 403 });
    }

    const parsed = investorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the investor details and try again.' }, { status: 400 });
    }

    const input = parsed.data;
    const requestRef = adminDb.collection('investor_creation_requests').doc(input.requestId);
    const prior = await requestRef.get();
    if (prior.exists) {
      const priorData = prior.data();
      if (priorData?.identity?.name !== input.name || priorData?.identity?.phone !== input.phone || priorData?.identity?.email !== (input.email || null)) {
        return NextResponse.json({ error: 'This retry key belongs to a different investor. Refresh the form and retry.' }, { status: 409 });
      }
      return NextResponse.json(priorData?.result as CreatedInvestor);
    }

    const contactEmail = input.email || null;
    // Login uses the phone number and this private Firebase email alias.
    const authEmail = `${input.phone}@pgf.local`;
    const phoneE164 = `+91${input.phone}`;

    // Auth is provisioned first because Firestore security rules rely on its UID.
    // If any subsequent step fails, the catch below removes this incomplete identity.
    const user = await adminAuth.createUser({
      email: authEmail,
      password: input.password,
      displayName: input.name,
      phoneNumber: phoneE164,
    });
    createdUid = user.uid;
    await adminAuth.setCustomUserClaims(user.uid, { role: 'Investor' });

    const result = await adminDb.runTransaction(async (transaction): Promise<CreatedInvestor> => {
      const requestSnap = await transaction.get(requestRef);
      if (requestSnap.exists) {
        const requestData = requestSnap.data();
        if (requestData?.identity?.name !== input.name || requestData?.identity?.phone !== input.phone || requestData?.identity?.email !== contactEmail) {
          throw new Error('REQUEST_ID_CONFLICT');
        }
        return requestData?.result as CreatedInvestor;
      }

      const duplicatePhone = await transaction.get(
        adminDb.collection('profiles').where('phone_primary', '==', input.phone).limit(1),
      );
      if (!duplicatePhone.empty) {
        throw new Error('PHONE_ALREADY_REGISTERED');
      }
      if (contactEmail) {
        const duplicateEmail = await transaction.get(
          adminDb.collection('profiles').where('email', '==', contactEmail).limit(1),
        );
        if (!duplicateEmail.empty) throw new Error('EMAIL_ALREADY_REGISTERED');
      }

      const counterRef = adminDb.collection('counters').doc('investor_id_counter');
      const counterSnap = await transaction.get(counterRef);
      const nextValue = Number(counterSnap.data()?.lastValue || 0) + 1;
      const investorId = `PGF-INV-${String(nextValue).padStart(6, '0')}`;
      const now = new Date().toISOString();
      const bankDetails = input.bankAccountNumber ? {
        accountNumber: input.bankAccountNumber,
        ifsc: input.bankIfsc.toUpperCase(),
        bankName: input.bankName,
        accountHolderName: input.name,
      } : null;
      const nomineeDetails = input.nomineeName ? {
        name: input.nomineeName,
        relationship: input.nomineeRelation,
        phone: '',
      } : null;

      const profileRef = adminDb.collection('profiles').doc(user.uid);
      const investorRef = adminDb.collection('investors').doc(user.uid);
      const accountRef = adminDb.collection('investment_accounts').doc(user.uid);
      const auditRef = adminDb.collection('investment_audit_logs').doc();

      transaction.set(counterRef, { lastValue: nextValue, updated_at: now }, { merge: true });
      transaction.create(profileRef, {
        id: user.uid,
        name: input.name,
        phone_primary: input.phone,
        email: contactEmail,
        role: 'Investor',
        customer_number: investorId,
        address: input.address || 'Address to be updated',
        city: input.city || null,
        district: input.district || null,
        state: 'Tamil Nadu',
        pin_code: input.pinCode || null,
        national_id: input.panNumber.toUpperCase() || 'PENDING',
        kyc_status: 'Approved',
        status: 'Active',
        bank_details: bankDetails,
        nominee_details: nomineeDetails,
        created_at: now,
        updated_at: now,
      });
      transaction.create(investorRef, {
        id: user.uid,
        uid: user.uid,
        investorId,
        name: input.name,
        phone: input.phone,
        email: contactEmail,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      });
      transaction.create(accountRef, {
        id: user.uid,
        investor_id: user.uid,
        investor_number: investorId,
        total_invested: 0,
        total_additional_investment: 0,
        total_withdrawn: 0,
        accrued_return: 0,
        current_value: 0,
        status: 'Active',
        created_at: now,
        updated_at: now,
      });
      transaction.create(auditRef, {
        actor_id: caller.uid,
        action: 'INVESTOR_CREATED',
        entity: 'profiles',
        entity_id: user.uid,
        details: { investorId, createdBy: caller.uid },
        created_at: now,
      });

      const response: CreatedInvestor = {
        success: true,
        investorId,
        uid: user.uid,
        name: input.name,
        phone: input.phone,
      };
      transaction.create(requestRef, {
        result: response,
        identity: { name: input.name, phone: input.phone, email: contactEmail },
        created_at: now,
      });
      return response;
    });

    if (result.uid !== createdUid) {
      await adminAuth.deleteUser(createdUid);
      createdUid = undefined;
    }
    return NextResponse.json(result);
  } catch (error) {
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch {
        // The Firestore request record is the recovery source if the commit already succeeded.
      }
    }

    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : '';
    if (message === 'REQUEST_ID_CONFLICT') {
      return NextResponse.json({ error: 'This retry key belongs to a different investor. Refresh the form and retry.' }, { status: 409 });
    }
    if (message === 'PHONE_ALREADY_REGISTERED' || message === 'EMAIL_ALREADY_REGISTERED' || code === 'auth/email-already-exists' || code === 'auth/phone-number-already-exists') {
      return NextResponse.json({ error: 'An account with this email or phone number already exists.' }, { status: 409 });
    }
    console.error('Investor provisioning failed.', { code });
    return NextResponse.json({ error: 'Investor account could not be created. Please retry with the same request.' }, { status: 500 });
  }
}
