import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for trying out the platform",
      features: ["5 uploads per month", "Basic summaries", "Simple quizzes", "24-hour content storage"],
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
    },
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "For serious learners and professionals",
      features: [
        "Unlimited uploads",
        "Advanced summaries",
        "Custom quizzes",
        "Flashcard generation",
        "Context-aware chatbot",
        "Unlimited storage",
      ],
      buttonText: "Start Free Trial",
      buttonVariant: "default" as const,
      highlighted: true,
    },
    {
      name: "Team",
      price: "$49",
      period: "/month",
      description: "For teams and educational institutions",
      features: [
        "Everything in Pro",
        "5 team members",
        "Collaborative learning",
        "Analytics dashboard",
        "Admin controls",
        "Priority support",
      ],
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
    },
  ]

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900" id="pricing">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose the plan that fits your learning needs. All plans include core features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border ${
                plan.highlighted
                  ? "border-blue-200 dark:border-blue-800 ring-2 ring-blue-600 dark:ring-blue-500 ring-opacity-50"
                  : "border-gray-100 dark:border-gray-800"
              }`}
            >
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                {plan.period && <span className="text-gray-600 dark:text-gray-400 ml-1">{plan.period}</span>}
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{plan.description}</p>
              <Button
                variant={plan.buttonVariant}
                className={`w-full mb-6 ${
                  plan.buttonVariant === "default"
                    ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    : "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                }`}
              >
                {plan.buttonText}
              </Button>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
