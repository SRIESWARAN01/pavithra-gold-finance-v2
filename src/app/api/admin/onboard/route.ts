// src/app/api/admin/onboard/route.ts
// Secure API endpoint for Admins to onboard new customers by creating
// their Firebase Auth credentials and Firestore profile.
// Includes 3-field duplicate detection and dual Customer ID format.

import { NextResponse } from 'next/server';
import { createProfile, checkDuplicateCustomer } from '@/lib/db/profiles';
import { adminAuth, verifyAuthToken } from '@/lib/firebase-admin';
import type { Gender, MaritalStatus, KycStatus, UserRole } from '@/types/database';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Administrator authentication is required.' }, { status: 401 });
    }

    const caller = await verifyAuthToken(idToken);
    if (caller.role !== 'Admin' && caller.role !== 'Owner') {
      return NextResponse.json({ error: 'Only an Administrator or Owner can create customer accounts.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      phone,
      password,
      phoneAlt,
      email,
      dateOfBirth,
      gender,
      maritalStatus,
      address = '',
      nationalId = '',
      panNumber,
      city,
      district,
      state = 'Tamil Nadu',
      pinCode,
      occupation,
      monthlyIncome,
      referencePerson,
      referencePhone,
      nomineeName,
      nomineeRelation,
      nomineeMobile,
      faceMatchScore,
      kycExpiryDate,
      kycStatus,
      branchId,
      branchCode,
      tags,
    } = body;

    // This public-facing onboarding endpoint may create customers only. Staff
    // roles must be provisioned by a separate, privileged administration flow.
    const userRole: UserRole = 'Customer';

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'Missing mandatory parameters: Customer Name, Mobile Number, and Password are required.' },
        { status: 400 }
      );
    }

    // 2. Run 3-field duplicate detection (Phone + Aadhaar + PAN)
    const duplicateCheck = await checkDuplicateCustomer(phone, nationalId, panNumber);
    if (duplicateCheck.hasDuplicate) {
      const matchDetails = duplicateCheck.matches.map(
        (m) => `${m.field.toUpperCase()} match: ${m.existingCustomerName} (${m.existingCustomerNumber || m.existingCustomerId})`
      ).join('; ');
      return NextResponse.json(
        {
          error: `Duplicate account detected: ${matchDetails}. Please verify if this user already exists.`,
          duplicates: duplicateCheck.matches,
        },
        { status: 409 }
      );
    }

    // 3. Create the Firebase Authentication account with the Admin SDK.
    const cleanedPhone = phone.trim().replace('+91', '');
    const authEmail = email || `${cleanedPhone}@pgf.local`;
    const userRecord = await adminAuth.createUser({
      email: authEmail,
      password,
      displayName: name,
      phoneNumber: phone.startsWith('+') ? phone : `+91${cleanedPhone}`,
    });
    const tempUid = userRecord.uid;
    await adminAuth.setCustomUserClaims(tempUid, { role: userRole });

    // 4. Create customer profile in Firestore with dual Customer ID format
    const profile = await createProfile({
      id: tempUid,
      name,
      phone_primary: cleanedPhone,
      phone_alt: phoneAlt ? phoneAlt.trim() : undefined,
      email: email ? email.trim() : undefined,
      date_of_birth: dateOfBirth ? dateOfBirth.trim() : undefined,
      gender: gender as Gender | undefined,
      marital_status: maritalStatus as MaritalStatus | undefined,
      address,
      national_id: nationalId,
      pan_number: panNumber ? panNumber.trim() : undefined,
      city: city ? city.trim() : undefined,
      district: district ? district.trim() : undefined,
      state: state ? state.trim() : undefined,
      pin_code: pinCode ? pinCode.trim() : undefined,
      occupation: occupation ? occupation.trim() : undefined,
      monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      reference_person: referencePerson ? referencePerson.trim() : undefined,
      reference_phone: referencePhone ? referencePhone.trim() : undefined,
      nominee_name: nomineeName ? nomineeName.trim() : undefined,
      nominee_relation: nomineeRelation ? nomineeRelation.trim() : undefined,
      nominee_mobile: nomineeMobile ? nomineeMobile.trim() : undefined,
      face_match_score: faceMatchScore ? parseFloat(faceMatchScore) : undefined,
      kyc_expiry_date: kycExpiryDate ? kycExpiryDate.trim() : undefined,
      kyc_status: (kycStatus as KycStatus) || 'Pending',
      branch_id: branchId ? branchId.trim() : undefined,
      tags: tags || [],
      role: userRole,
    }, branchCode ? branchCode.trim() : undefined);

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Admin') ? 403 : 500 }
    );
  }
}
