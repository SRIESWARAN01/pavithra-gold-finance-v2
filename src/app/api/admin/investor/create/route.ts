// src/app/api/admin/investor/create/route.ts
// Secure Admin API endpoint to onboard new Investors.
// Creates Firebase Auth user credentials, sets custom claims, creates Profile and Investment Account.

import { NextResponse } from 'next/server';
import { adminAuth, adminDb, verifyAuthToken } from '@/lib/firebase-admin';
import { generateInvestorId, logInvestmentAudit } from '@/lib/db/investments';
import type { UserRole, Profile, InvestmentAccount } from '@/types/database';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Administrator authentication is required.' }, { status: 401 });
    }

    const caller = await verifyAuthToken(idToken);
    if (caller.role !== 'Admin' && caller.role !== 'Owner') {
      return NextResponse.json(
        { error: 'Only an Administrator or Owner can create investor accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      phone,
      password,
      email,
      address = '',
      city = '',
      district = '',
      state = 'Tamil Nadu',
      pinCode = '',
      panNumber = '',
      bankAccountNumber = '',
      bankIfsc = '',
      bankName = '',
      nomineeName = '',
      nomineeRelation = '',
    } = body;

    // Validate mandatory fields per Prompt Section 4
    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'Missing mandatory fields: Investor Name, Mobile Number, and Password are required.' },
        { status: 400 }
      );
    }

    const cleanedPhone = phone.trim().replace('+91', '').replace(/\s+/g, '');
    if (cleanedPhone.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    // Check duplicate phone in profiles
    try {
      const existingProfSnap = await adminDb
        .collection('profiles')
        .where('phone_primary', '==', cleanedPhone)
        .limit(1)
        .get();

      if (!existingProfSnap.empty) {
        const existing = existingProfSnap.docs[0].data();
        return NextResponse.json(
          {
            error: `An account with mobile number ${cleanedPhone} already exists (${existing.name}, Role: ${existing.role}).`,
          },
          { status: 409 }
        );
      }
    } catch (dbErr: any) {
      if (dbErr.message?.includes('Could not load the default credentials') || dbErr.message?.includes('default credentials')) {
        const { db } = await import('@/lib/firebase');
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const q = query(collection(db, 'profiles'), where('phone_primary', '==', cleanedPhone), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const existing = snap.docs[0].data();
          return NextResponse.json(
            {
              error: `An account with mobile number ${cleanedPhone} already exists (${existing.name}, Role: ${existing.role}).`,
            },
            { status: 409 }
          );
        }
      } else {
        throw dbErr;
      }
    }

    // 1. Generate unique Investor ID
    const investorId = await generateInvestorId();

    // 2. Create Firebase Auth user
    const authEmail = email ? email.trim() : `${cleanedPhone}@pgf.local`;
    let uid: string;
    try {
      const userRecord = await adminAuth.createUser({
        email: authEmail,
        password: password.trim(),
        displayName: name.trim(),
        phoneNumber: phone.startsWith('+') ? phone : `+91${cleanedPhone}`,
      });

      uid = userRecord.uid;
      await adminAuth.setCustomUserClaims(uid, { role: 'Investor' as UserRole });
    } catch (authErr: any) {
      if (
        process.env.NODE_ENV !== 'production' &&
        (authErr.message?.includes('Could not load the default credentials') || authErr.message?.includes('default credentials'))
      ) {
        console.warn('[InvestorCreate] ⚠️ Missing default credentials in dev mode. Generating deterministic UID.');
        uid = `inv_${cleanedPhone}`;
      } else {
        throw authErr;
      }
    }

    const now = new Date().toISOString();

    // 4. Create Profile in Firestore
    const profileData: Partial<Profile> = {
      id: uid,
      name: name.trim(),
      phone_primary: cleanedPhone,
      email: email ? email.trim() : null,
      role: 'Investor',
      customer_number: investorId, // Use PGF-INV-000001 as customer_number
      address: address.trim() || 'Address to be updated',
      city: city.trim() || null,
      district: district.trim() || null,
      state: state.trim() || 'Tamil Nadu',
      pin_code: pinCode.trim() || null,
      national_id: panNumber.trim() || 'PENDING',
      kyc_status: 'Approved',
      status: 'Active',
      created_at: now,
      updated_at: now,
    };

    // 5. Initialize Investment Account
    const initialAccount: InvestmentAccount = {
      id: uid,
      investor_id: uid,
      investor_number: investorId,
      total_invested: 0,
      total_additional_investment: 0,
      total_withdrawn: 0,
      accrued_return: 0,
      current_value: 0,
      status: 'Active',
      created_at: now,
      updated_at: now,
    };

    try {
      await adminDb.collection('profiles').doc(uid).set(profileData);
      await adminDb.collection('investment_accounts').doc(uid).set(initialAccount);
    } catch (dbErr: any) {
      if (
        process.env.NODE_ENV !== 'production' &&
        (dbErr.message?.includes('Could not load the default credentials') || dbErr.message?.includes('default credentials'))
      ) {
        const { db } = await import('@/lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'profiles', uid), profileData);
        await setDoc(doc(db, 'investment_accounts', uid), initialAccount);
      } else {
        throw dbErr;
      }
    }

    // 6. Log Audit
    await logInvestmentAudit({
      actor_id: caller.uid,
      action: 'INVESTOR_CREATED',
      entity: 'profiles',
      entity_id: uid,
      details: {
        investorId,
        name: name.trim(),
        phone: cleanedPhone,
        createdBy: caller.uid,
      },
    });

    return NextResponse.json({
      success: true,
      investorId,
      uid,
      name: name.trim(),
      phone: cleanedPhone,
      message: `Investor account ${investorId} created successfully.`,
    });
  } catch (err: any) {
    console.error('Error creating investor:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create investor account.' },
      { status: 500 }
    );
  }
}
