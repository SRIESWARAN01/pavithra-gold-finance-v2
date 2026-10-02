import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb, verifyAuthToken } from '@/lib/firebase-admin';

const customerSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^(?:\+91)?[6-9]\d{9}$/).transform((value) => value.replace(/^\+91/, '')),
  password: z.string().min(8).max(128),
  email: z.string().trim().email().max(254),
  phoneAlt: z.string().trim().max(20).optional(),
  dateOfBirth: z.string().trim().max(20).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional(),
  address: z.string().trim().max(500).optional().default(''),
  nationalId: z.string().trim().max(30).optional().default(''),
  panNumber: z.string().trim().max(20).optional().default(''),
  city: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional().default('Tamil Nadu'),
  pinCode: z.string().trim().max(12).optional(),
  occupation: z.string().trim().max(120).optional(),
  monthlyIncome: z.number().finite().nonnegative().optional(),
  referencePerson: z.string().trim().max(120).optional(),
  referencePhone: z.string().trim().max(20).optional(),
  nomineeName: z.string().trim().max(120).optional(),
  nomineeRelation: z.string().trim().max(80).optional(),
  nomineeMobile: z.string().trim().max(20).optional(),
  faceMatchScore: z.number().finite().min(0).max(100).optional(),
  kycExpiryDate: z.string().trim().max(30).optional(),
  branchId: z.string().trim().max(120).optional(),
  branchCode: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,12}$/).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional().default([]),
});

type CustomerProfile = Record<string, unknown> & {
  id: string;
  name: string;
  phone_primary: string;
  role: 'Customer';
  customer_number: string;
};

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
      return NextResponse.json({ error: 'Only an Administrator or Owner can create customer accounts.' }, { status: 403 });
    }

    const parsed = customerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Please check the customer details and try again.' }, { status: 400 });
    const input = parsed.data;
    const contactEmail = input.email.toLowerCase();
    // Application login is phone-based and uses this private Firebase email alias.
    const authEmail = `${input.phone}@pgf.local`;
    const requestRef = adminDb.collection('customer_creation_requests').doc(input.requestId);
    const prior = await requestRef.get();
    if (prior.exists) {
      const priorData = prior.data();
      if (priorData?.identity?.phone !== input.phone || priorData?.identity?.email !== contactEmail || priorData?.identity?.name !== input.name) {
        return NextResponse.json({ error: 'This retry key belongs to a different customer. Refresh the form and retry.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, profile: priorData?.profile as CustomerProfile });
    }

    const user = await adminAuth.createUser({
      email: authEmail,
      password: input.password,
      displayName: input.name,
      phoneNumber: `+91${input.phone}`,
    });
    createdUid = user.uid;
    await adminAuth.setCustomUserClaims(user.uid, { role: 'Customer' });

    const profile = await adminDb.runTransaction(async (transaction): Promise<CustomerProfile> => {
      const requestSnap = await transaction.get(requestRef);
      if (requestSnap.exists) {
        const requestData = requestSnap.data();
        if (requestData?.identity?.phone !== input.phone || requestData?.identity?.email !== contactEmail || requestData?.identity?.name !== input.name) {
          throw new Error('REQUEST_ID_CONFLICT');
        }
        return requestData.profile as CustomerProfile;
      }

      const profiles = adminDb.collection('profiles');
      const phoneQuery = profiles.where('phone_primary', '==', input.phone).limit(5);
      const phoneMatches = await transaction.get(phoneQuery);
      const emailMatches = await transaction.get(profiles.where('email', '==', contactEmail).limit(5));
      const aadhaarMatches = input.nationalId
        ? await transaction.get(profiles.where('national_id', '==', input.nationalId).limit(5))
        : null;
      const panMatches = input.panNumber
        ? await transaction.get(profiles.where('pan_number', '==', input.panNumber.toUpperCase()).limit(5))
        : null;

      const duplicates = new Map<string, { id: string; name: string; phone_primary: string; customer_number: string | null; field: string }>();
      for (const [field, snapshot] of [['phone', phoneMatches], ['email', emailMatches], ['aadhaar', aadhaarMatches], ['pan', panMatches]] as const) {
        snapshot?.docs.forEach((doc) => {
          const data = doc.data();
          duplicates.set(doc.id, {
            id: doc.id,
            name: String(data.name || 'Unknown'),
            phone_primary: String(data.phone_primary || ''),
            customer_number: typeof data.customer_number === 'string' ? data.customer_number : null,
            field,
          });
        });
      }
      if (duplicates.size) {
        const duplicateError = new Error('DUPLICATE_CUSTOMER');
        Object.assign(duplicateError, { duplicates: [...duplicates.values()] });
        throw duplicateError;
      }

      const branchCode = input.branchCode?.toUpperCase();
      const counterKey = branchCode ? `customer_number_${branchCode}` : 'customer_number';
      const counterRef = adminDb.collection('counters').doc(counterKey);
      const counterSnap = await transaction.get(counterRef);
      const next = Number(counterSnap.data()?.value || 0) + 1;
      const customerNumber = branchCode
        ? `PGF-${branchCode}-${String(next).padStart(6, '0')}`
        : `PGF-CUST-${String(next).padStart(6, '0')}`;
      const now = new Date().toISOString();

      const profileData: CustomerProfile = {
        id: user.uid,
        name: input.name,
        phone_primary: input.phone,
        phone_alt: input.phoneAlt || null,
        email: contactEmail,
        date_of_birth: input.dateOfBirth || null,
        gender: input.gender || null,
        marital_status: input.maritalStatus || null,
        address: input.address || 'Tamil Nadu',
        national_id: input.nationalId || '',
        pan_number: input.panNumber.toUpperCase() || null,
        city: input.city || null,
        district: input.district || null,
        state: input.state || 'Tamil Nadu',
        pin_code: input.pinCode || null,
        occupation: input.occupation || null,
        monthly_income: input.monthlyIncome ?? null,
        reference_person: input.referencePerson || null,
        reference_phone: input.referencePhone || null,
        nominee_name: input.nomineeName || null,
        nominee_relation: input.nomineeRelation || null,
        nominee_mobile: input.nomineeMobile || null,
        face_match_score: input.faceMatchScore ?? null,
        kyc_expiry_date: input.kycExpiryDate || null,
        kyc_status: input.nationalId || input.panNumber ? 'Submitted' : 'Pending',
        kyc_approved_by: null,
        kyc_approved_at: null,
        kyc_rejection_reason: null,
        branch_id: input.branchId || null,
        tags: input.tags,
        photo_url: null,
        signature_url: null,
        aadhaar_front_url: null,
        aadhaar_back_url: null,
        pan_url: null,
        is_2fa_enabled: false,
        two_factor_secret: null,
        blocked_at: null,
        blocked_reason: null,
        deleted_at: null,
        customer_number: customerNumber,
        role: 'Customer',
        status: 'Active',
        created_at: now,
        updated_at: now,
      };

      const profileRef = profiles.doc(user.uid);
      const auditRef = adminDb.collection('audit_logs').doc();
      transaction.set(counterRef, { value: next, updated_at: now }, { merge: true });
      transaction.create(profileRef, profileData);
      transaction.create(auditRef, {
        actor_id: caller.uid,
        action_type: 'CUSTOMER_CREATED',
        affected_entity: 'profiles',
        affected_entity_id: user.uid,
        old_state: null,
        new_state: { customer_number: customerNumber, role: 'Customer' },
        timestamp: now,
      });
      transaction.create(requestRef, {
        identity: { name: input.name, phone: input.phone, email: contactEmail },
        profile: profileData,
        created_at: now,
      });
      return profileData;
    });

    if (profile.id !== createdUid) {
      await adminAuth.deleteUser(createdUid);
      createdUid = undefined;
    }
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch {
        // Keep the failure visible; Auth cleanup is retried by an administrator if needed.
      }
    }

    const failure = error as { code?: string; message?: string; duplicates?: Array<{ field: string; name: string; customer_number: string | null; id: string; phone_primary: string }> };
    if (failure.message === 'REQUEST_ID_CONFLICT') {
      return NextResponse.json({ error: 'This retry key belongs to a different customer. Refresh the form and retry.' }, { status: 409 });
    }
    if (failure.message === 'DUPLICATE_CUSTOMER') {
      const duplicates = failure.duplicates || [];
      const detail = duplicates.map((item) => `${item.field.toUpperCase()} match: ${item.name} (${item.customer_number || item.id})`).join('; ');
      return NextResponse.json({ error: `Duplicate account detected: ${detail}. Please verify the existing account.`, duplicates }, { status: 409 });
    }
    if (failure.code === 'auth/email-already-exists' || failure.code === 'auth/phone-number-already-exists') {
      return NextResponse.json({ error: 'An account with this email or phone number already exists.' }, { status: 409 });
    }
    console.error('Customer provisioning failed.', { code: failure.code });
    return NextResponse.json({ error: 'Customer account could not be created. Please retry with the same request.' }, { status: 500 });
  }
}
