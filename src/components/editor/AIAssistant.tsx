"use client"

import { Button } from '@/components/ui/button'
import { 
  MessageSquare,
  Edit3,
  Mic,
  Paperclip,
  Send,
  ChevronRight
} from 'lucide-react'

interface AIAssistantProps {
  onCollapse?: () => void
}

export default function AIAssistant({ onCollapse }: AIAssistantProps) {
  return (
    <div className="w-full h-full bg-gray-900 flex flex-col relative overflow-y-auto">
      {/* Collapse Button */}
      {onCollapse && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapse}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 text-sm"
        >
          <ChevronRight className="h-4 w-4 mr-1" />
          Collapse
        </Button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 min-w-0">
        {/* AI Greeting */}
        <div className="mb-8 w-full">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 lg:mb-8 px-4">
            Hey, I&apos;m Turbo
          </h1>
          <p className="text-gray-400 text-lg md:text-xl lg:text-2xl leading-relaxed px-4 max-w-sm mx-auto">
            I can work with you on your doc and answer any questions!
          </p>
          </div>

          {/* Input Field */}
        <div className="w-full max-w-xs md:max-w-sm lg:max-w-md mb-6 md:mb-8 px-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Type a question here..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg md:rounded-xl px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 pr-20 md:pr-24 lg:pr-28 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base lg:text-lg"
            />
            <div className="absolute left-3 md:left-4 lg:left-6 top-1/2 transform -translate-y-1/2">
              <button className="text-gray-500 hover:text-gray-300">
                <Mic className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
              </button>
            </div>
            <div className="absolute right-3 md:right-4 lg:right-6 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 md:space-x-3 lg:space-x-4">
              <button className="text-gray-500 hover:text-gray-300">
                <Paperclip className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
              </button>
              <button className="text-gray-500 hover:text-gray-300">
                <Send className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-3 lg:space-x-4 w-full max-w-xs md:max-w-sm lg:max-w-md px-4">
          <button className="w-full sm:flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-3 lg:py-4 bg-purple-600 hover:bg-purple-700 text-white text-sm md:text-base rounded-lg md:rounded-xl transition-colors flex items-center justify-center font-medium">
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
            Chat
          </button>
          <button className="w-full sm:flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-3 lg:py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm md:text-base rounded-lg md:rounded-xl transition-colors flex items-center justify-center border border-gray-600 font-medium">
            <Edit3 className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
            Edit
          </button>
          <button className="w-full sm:flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-3 lg:py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm md:text-base rounded-lg md:rounded-xl transition-colors flex items-center justify-center border border-gray-600 font-medium">
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
            Comment
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="p-4 md:p-6 lg:p-8 border-t border-gray-700">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-2 md:space-x-3 lg:space-x-4">
            <div className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs md:text-sm lg:text-base font-bold">⚡</span>
            </div>
            <span className="text-gray-300 font-medium text-sm md:text-lg lg:text-xl">Turbonotes AI</span>
          </div>
        </div>
      </div>
    </div>
  )
} 