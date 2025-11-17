STEP:1 Backend — Create Payment Order (Next.js API route)

Razorpay requires you to create an order on the server before showing the checkout UI.

/pages/api/create-order.ts

import Razorpay from "razorpay";

export default async function handler(req, res) {
if (req.method !== "POST") return res.status(405).end();

const razorpay = new Razorpay({
key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const { amount } = req.body; // amount in INR, multiply by 100 for paise

try {
const order = await razorpay.orders.create({
amount: amount \* 100, // amount in paise
currency: "INR",
receipt: `receipt_${Date.now()}`,
});
res.status(200).json({ order });
} catch (err) {
res.status(500).json({ error: err.message });
}
}

⚙️ Step 3: Frontend — Razorpay Checkout Integration

Install the Razorpay script:

npm install razorpay

Then in your component:

const handlePayment = async () => {
const response = await fetch("/api/create-order", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ amount: 20 }), // Pro plan ₹20
});
const { order } = await response.json();

const options = {
key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
amount: order.amount,
currency: order.currency,
name: "LearnAI",
description: "Pro Plan Subscription",
order_id: order.id,
handler: async function (response) {
await fetch("/api/verify-payment", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(response),
});
alert("Payment successful!");
},
prefill: {
name: "User Name",
email: "user@example.com",
},
theme: { color: "#6366F1" },
};

const rzp = new window.Razorpay(options);
rzp.open();
};

⚙️ Step 4: Verify Payment and Update User Subscription

Create another API route:

/pages/api/verify-payment.ts

import crypto from "crypto";
import { db } from "@/lib/firebase"; // or Supabase

export default async function handler(req, res) {
const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

const body = razorpay_order_id + "|" + razorpay_payment_id;
const expectedSignature = crypto
.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
.update(body)
.digest("hex");

if (expectedSignature === razorpay_signature) {
// ✅ Mark user as Pro in your database
await db.collection("users").doc(userId).update({
plan: "pro",
subscriptionActive: true,
subscriptionDate: new Date(),
});

    res.status(200).json({ success: true });

} else {
res.status(400).json({ error: "Invalid signature" });
}
}
