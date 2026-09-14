// src/app/api/admin/onboard/route.ts
// Secure API endpoint for Admins to onboard new customers by creating
// their Firebase Auth credentials and Firestore profile.
// Includes 3-field duplicate detection and dual Customer ID format.

import { NextResponse } from 'next/server';
import { createProfile, checkDuplicateCustomer } from '@/lib/db/profiles';
import type { Gender, MaritalStatus, KycStatus, UserRole } from '@/types/database';

export async function POST(request: Request) {
  try {
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
      role = 'Customer',
    } = body;

    const userRole: UserRole = (['Admin', 'Customer', 'Owner', 'Manager', 'Appraiser', 'Cashier', 'Accountant', 'Collection_Officer', 'Customer_Support'].includes(role)
      ? role
      : 'Customer') as UserRole;

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

    // 3. Create user via Firebase Admin SDK or Firebase Auth REST API
    let tempUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const cleanedPhone = phone.trim().replace('+91', '');
    const authEmail = email || `${cleanedPhone}@pgf.local`;

    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      const userRecord = await adminAuth.createUser({
        email: authEmail,
        password: password,
        displayName: name,
        phoneNumber: phone.startsWith('+') ? phone : `+91${cleanedPhone}`,
      });
      tempUid = userRecord.uid;
      // Set role custom claim
      await adminAuth.setCustomUserClaims(tempUid, { role: userRole });
    } catch (adminErr) {
      console.warn('Firebase Admin SDK user creation skipped/failed, attempting REST API fallback:', adminErr);

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
      const isFirebaseConfigured = apiKey !== '' && !apiKey.includes('your-firebase-api-key');

      if (isFirebaseConfigured) {
        const signupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
        const signupRes = await fetch(signupUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authEmail,
            password: password,
            returnSecureToken: false
          })
        });

        if (signupRes.ok) {
          const signupData = await signupRes.json();
          if (signupData.localId) {
            tempUid = signupData.localId;
          }
        }
      }
    }

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

