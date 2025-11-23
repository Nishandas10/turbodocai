"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRO_FEATURES, PRICING } from "@/lib/pricing"
import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/AuthContext"
import { updateUserSubscription } from "@/lib/firestore"

export default function UpgradeModal(props: any) {
  const { open, onClose } = props as { open: boolean; onClose: () => void }
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly") // Default to monthly
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = "hidden"
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open])

  const yearlyActive = billingCycle === "yearly"
  const monthlyPrice = PRICING.monthly.price
  const yearlyPriceTotal = PRICING.yearly.price
  const yearlyPricePerMonth = Math.round(yearlyPriceTotal / 12)

  const handleUpgrade = useCallback(async (planOverride?: "monthly" | "yearly") => {
    const plan = planOverride ?? (yearlyActive ? "yearly" : "monthly");
    const amount = plan === "yearly" ? yearlyPriceTotal : monthlyPrice;
    try {
      setLoading(true)
      // ...existing code...
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, plan }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to create payment order")
      }
      const { order, keyId } = await res.json() as { order: { id: string; amount: number; currency: string }, keyId: string }

      type RazorpayHandlerPayload = {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }
      type RazorpayOptions = {
        key: string;
        amount: number;
        currency: string;
        name: string;
        description: string;
        order_id: string;
        handler: (response: RazorpayHandlerPayload) => Promise<void> | void;
        prefill?: { name?: string; email?: string; contact?: string };
        theme?: { color?: string };
        readonly?: { name?: boolean; email?: boolean; contact?: boolean };
        hidden?: { email?: boolean; contact?: boolean };
      }

      const options: RazorpayOptions = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "BlumeNote",
        description: plan === "monthly" ? "Pro Monthly Subscription" : "Pro Yearly Subscription",
        order_id: order.id,
        handler: async (response: RazorpayHandlerPayload) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                userId: user?.uid,
                plan,
              }),
            })
            const verify = await verifyRes.json()
            if (!verifyRes.ok || !verify?.success) {
              throw new Error(verify?.error || "Payment verification failed")
            }
            // Update subscription on Firestore client-side
            if (user?.uid) {
              await updateUserSubscription(user.uid, "premium")
            }
            alert("Payment successful! Your plan has been upgraded.")
            onClose()
          } catch (e: any) {
            alert(e?.message || "Payment verification failed.")
          }
        },
        prefill: {
          name: user?.displayName || "User",
          email: user?.email || "",
          // Do not pass contact since we are not collecting phone numbers
          // contact: undefined,
        },
        // Hide and lock phone field so users are not asked for it
        hidden: { contact: true },
        readonly: { contact: true },
        theme: { color: "#6366F1" },
      }

      const RazorpayCtor = (window as unknown as { Razorpay: new (options: RazorpayOptions) => { open: () => void } }).Razorpay
      const rzp = new RazorpayCtor(options)
      rzp.open()
    } catch (e: any) {
      alert(e?.message || "Unable to start payment.")
    } finally {
      setLoading(false)
    }
  }, [monthlyPrice, yearlyPriceTotal, yearlyActive, user, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center p-4 md:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Only close if clicking the backdrop itself, not bubbled events
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Centered modal */}
      <div className="relative w-full max-w-lg md:max-w-3xl max-h-[100vh] md:max-h-[100vh] bg-[#111214] text-gray-100 rounded-xl shadow-2xl border border-gray-800 flex flex-col overflow-y-auto animate-in fade-in zoom-in">
        {/* Close button */}
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-md hover:bg-white/5">
          <X className="h-5 w-5" />
        </button>

        {/* Hero header */}
        <div className="px-8 pt-12 pb-8 text-center">
          <h2 className="text-3xl md:text-[34px] font-bold tracking-tight mb-6">Upgrade to BlumeNote Pro</h2>
          <p className="text-base md:text-lg text-gray-300 max-w-2xl mx-auto">
            BlumeNote is <span className="font-semibold italic text-purple-300">faster</span>, more <span className="font-semibold italic text-indigo-300">intelligent</span>, and <span className="font-semibold italic text-pink-300">unlimited</span> with premium.
          </p>
        </div>

        {/* Key highlights (subset for punch) */}
        <div className="px-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-8">
          {PRO_FEATURES.slice(0,10).map((f,i) => (
            <div key={i} className="flex items-start">
              <Check className="h-4 w-4 text-green-400 mt-0.5 mr-2" />
              <span className="text-gray-200">{f}</span>
            </div>
          ))}
        </div>

        {/* Pricing options */}
        <div className="px-8 pb-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Monthly */}
            <button
              onClick={() => { setBillingCycle("monthly"); handleUpgrade("monthly"); }}
              className={`group rounded-lg border text-left px-6 py-5 transition-all ${!yearlyActive ? 'border-purple-500/70 bg-purple-600/10 ring-2 ring-purple-500/40' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">Monthly</span>
                {!yearlyActive && <span className="text-purple-400 text-xs">Selected</span>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">₹{monthlyPrice}</span>
                <span className="text-gray-400 text-sm">/ month</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Billed monthly</p>
            </button>
            {/* Annual */}
            <button
              onClick={() => { setBillingCycle("yearly"); handleUpgrade("yearly"); }}
              className={`group rounded-lg border text-left px-6 py-5 transition-all ${yearlyActive ? 'border-green-500/70 bg-green-600/10 ring-2 ring-green-500/40' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm flex items-center gap-2">Annual <span className="text-green-400 text-xs font-medium">(2 months FREE)</span></span>
                {yearlyActive && <span className="text-green-400 text-xs">Selected</span>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">₹{yearlyPricePerMonth}</span>
                <span className="text-gray-400 text-sm">/ month</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Billed yearly (₹{yearlyPriceTotal})</p>
            </button>
          </div>

          <Button
            disabled={loading}
            onClick={() => handleUpgrade()}
            className="w-full h-14 text-base font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg disabled:opacity-60"
          >
            {loading ? "Processing..." : "✨ Upgrade Now ✨"}
          </Button>
          <p className="text-center text-xs text-gray-400">Join thousands of learners leveling up with BlumeNote.</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
