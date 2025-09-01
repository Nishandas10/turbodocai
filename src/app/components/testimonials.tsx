import { Star } from "lucide-react"
import Image from "next/image"

export default function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Medical Student",
      content:
        "This platform has completely transformed how I study. The AI-generated summaries and quizzes have helped me retain information much better than traditional methods.",
      avatar: "/placeholder.svg?height=100&width=100",
    },
    {
      name: "David Chen",
      role: "Software Engineer",
      content:
        "I use this to keep up with technical videos and documentation. The ability to chat with my learning materials has been a game-changer for my professional development.",
      avatar: "/placeholder.svg?height=100&width=100",
    },
    {
      name: "Maria Rodriguez",
      role: "Corporate Trainer",
      content:
        "We've implemented this platform for our company training programs. The analytics and personalized learning paths have improved completion rates by 45%.",
      avatar: "/placeholder.svg?height=100&width=100",
    },
  ]

  return (
    <section className="py-20 bg-gray-900/30 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What Our Users Say</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Join thousands of students and professionals who have transformed their learning experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-800/50 hover:shadow-2xl hover:border-gray-700/50 transition-all duration-300 relative group"
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <Image
                    src={testimonial.avatar || "/placeholder.svg"}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-semibold text-white">{testimonial.name}</h4>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300">{testimonial.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
