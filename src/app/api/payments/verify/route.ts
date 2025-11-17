import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId?: string, plan?: "monthly" | "yearly" }
export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      plan,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment parameters" },
        { status: 400 }
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      return NextResponse.json(
        { error: "Razorpay secret not configured" },
        { status: 500 }
      );
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(body)
      .digest("hex");

    const verified = expectedSignature === razorpay_signature;
    if (!verified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // NOTE: We are not updating Firestore server-side here because the repo lacks Admin SDK config.
    // The client should update the user's subscription upon receiving success = true.
    // You can wire Firebase Admin in this route later for a secure server-side update.

    return NextResponse.json({
      success: true,
      userId: userId || null,
      plan: plan || null,
    });
  } catch (err: unknown) {
    console.error("/api/payments/verify error", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
