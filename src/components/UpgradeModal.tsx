"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRO_FEATURES, PRICING } from "@/lib/pricing"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export default function UpgradeModal(props: any) {
  const { open, onClose } = props as { open: boolean; onClose: () => void }
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly")
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

  if (!open) return null

  const yearlyActive = billingCycle === "yearly"
  const monthlyPrice = PRICING.monthly.price
  const yearlyPriceTotal = PRICING.yearly.price
  const yearlyPricePerMonth = Math.round(yearlyPriceTotal / 12)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Centered modal */}
      <div className="relative w-full max-w-3xl max-h-[100vh] bg-[#111214] text-gray-100 rounded-xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden animate-in fade-in zoom-in">
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
            {/* Annual */}
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`group rounded-lg border text-left px-6 py-5 transition-all ${yearlyActive ? 'border-green-500/70 bg-green-600/10 ring-2 ring-green-500/40' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm flex items-center gap-2">Annual <span className="text-green-400 text-xs font-medium">(Save 45%)</span></span>
                {yearlyActive && <span className="text-green-400 text-xs">Selected</span>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">₹{yearlyPricePerMonth}</span>
                <span className="text-gray-400 text-sm">/ month</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Billed yearly (₹{yearlyPriceTotal})</p>
            </button>
            {/* Monthly */}
            <button
              onClick={() => setBillingCycle("monthly")}
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
          </div>

          <Button asChild className="w-full h-14 text-base font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg">
            <Link href="/signup">✨ Upgrade Now ✨</Link>
          </Button>
          <p className="text-center text-xs text-gray-400">Join thousands of learners leveling up with BlumeNote.</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
