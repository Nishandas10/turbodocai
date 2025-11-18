"use client"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { PRO_FEATURES, FREE_TRIAL_FEATURES } from "@/lib/pricing"
import { useRouter } from "next/navigation"

export default function Pricing() {
  // Billing cycle toggle
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const router = useRouter()

  const isYearly = billingCycle === "yearly"

  // Plans configured to match requested features and INR pricing
  const plans = [
    {
      name: "Free Trial",
      price: "₹0",
      period: "Forever",
      description: "Experience Pro features with limited monthly quotas.",
      features: FREE_TRIAL_FEATURES,
      buttonText: "Start Free Trial",
      buttonVariant: "default" as const,
    },
    {
      name: "Pro",
      price: isYearly ? "₹2999" : "₹450",
      period: isYearly ? "/year" : "/month",
      description: "Learn at the highest level.",
      features: PRO_FEATURES,
      buttonText: "Select Plan",
      buttonVariant: "default" as const,
      highlighted: true,
    },
  ]

  return (
    <section className="py-20 bg-gray-900/30 backdrop-blur-sm" id="pricing">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Choose the plan that fits your learning needs. All plans include core features.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="inline-flex items-center rounded-full bg-gray-800/60 p-1 border border-gray-700/60">
            <Button
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              className={`px-4 py-1 rounded-full text-sm ${
                billingCycle === "monthly"
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setBillingCycle("monthly")}
            >
              Pay Monthly
            </Button>
            <Button
              variant={billingCycle === "yearly" ? "default" : "ghost"}
              className={`px-4 py-1 rounded-full text-sm ml-1 relative ${
                billingCycle === "yearly"
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setBillingCycle("yearly")}
            >
              Pay Yearly
              <span className="ml-2 text-[10px] text-green-300 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full hidden sm:inline">Save 45%</span>
            </Button>
          </div>
        </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-gray-900/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border relative group ${
                plan.highlighted
                  ? "border-blue-600/50 ring-1 ring-blue-500/30"
                  : "border-gray-800/50"
              }`}
            >
              {/* Glow Effect */}
              <div className={`absolute -inset-1 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300 ${
                plan.highlighted
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20"
                  : "bg-gradient-to-r from-gray-600/20 to-gray-800/20"
              }`}></div>
              <div className="relative">
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline mb-3">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-400 ml-1">{plan.period}</span>}
                </div>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <Button
                  variant={plan.buttonVariant}
                  className={`w-full mb-4 text-sm ${
                    plan.buttonVariant === "default"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "border-blue-400 text-blue-400 hover:bg-blue-400/10"
                  }`}
                  onClick={() => router.push('/dashboard')}
                >
                  {plan.buttonText}
                </Button>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-4 w-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
