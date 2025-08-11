import type { ReactNode } from "react"

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-800/50 hover:shadow-2xl hover:border-gray-700/50 transition-all duration-300 relative group">
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
      <div className="relative">
        <div className="mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-300">{description}</p>
      </div>
    </div>
  )
}
