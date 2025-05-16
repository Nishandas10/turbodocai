import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQ() {
  const faqs = [
    {
      question: "What types of content can I upload?",
      answer:
        "You can upload or link to PDFs, audio files, video files, YouTube links, and even live meeting notes. Our platform processes all these formats to create learning materials.",
    },
    {
      question: "How accurate are the AI-generated summaries and quizzes?",
      answer:
        "Our AI models are trained on vast educational content and continuously improved. The summaries capture key concepts with high accuracy, and quizzes target important information. You can always provide feedback to improve results.",
    },
    {
      question: "Can I share my learning materials with others?",
      answer:
        "Yes! On the Pro and Team plans, you can share your generated learning materials with others through secure links or by adding them as collaborators.",
    },
    {
      question: "How does the context-aware chatbot work?",
      answer:
        "Our chatbot uses advanced AI to understand the content you've uploaded. It can answer specific questions about your materials, explain concepts, and even help you connect ideas across different content pieces.",
    },
    {
      question: "Is my content secure on your platform?",
      answer:
        "Absolutely. We use enterprise-grade encryption for all uploaded content. Your data is never shared with third parties, and you can delete your content at any time.",
    },
    {
      question: "Can I use this for languages other than English?",
      answer:
        "Currently, we support English, Spanish, French, German, and Chinese. We're actively working on adding more languages to our platform.",
    },
  ]

  return (
    <section className="py-20 bg-white dark:bg-gray-950" id="faq">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Find answers to common questions about our platform.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-lg font-medium dark:text-white">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-300">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
