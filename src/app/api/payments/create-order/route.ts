import { NextRequest, NextResponse } from "next/server";

type RazorpayOrder = { id: string; amount: number; currency: string };
interface RazorpayClient {
  orders: {
    create: (args: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string> | undefined;
    }) => Promise<RazorpayOrder>;
  };
}
type RazorpayCtor = new (opts: {
  key_id: string;
  key_secret: string;
}) => RazorpayClient;

// POST /api/payments/create-order
// Body: { amount: number, plan?: "monthly" | "yearly" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const plan = body?.plan as "monthly" | "yearly" | undefined;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      return NextResponse.json(
        { error: "Razorpay keys are not configured on the server" },
        { status: 500 }
      );
    }

    // Import razorpay dynamically to avoid type issues
    const mod = await import("razorpay");
    const Razorpay: RazorpayCtor =
      (mod as unknown as { default?: RazorpayCtor }).default ??
      (mod as unknown as RazorpayCtor);
    const razorpay = new Razorpay({ key_id, key_secret });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: plan ? { plan } : undefined,
    });

    return NextResponse.json({ order, keyId: key_id });
  } catch (err: unknown) {
    console.error("/api/payments/create-order error", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
