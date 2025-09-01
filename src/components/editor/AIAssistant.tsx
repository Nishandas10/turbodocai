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
  isCollapsed?: boolean
}

export default function AIAssistant({ onCollapse, isCollapsed = false }: AIAssistantProps) {
  return (
    <div className={`w-full h-full bg-gray-900 flex flex-col relative overflow-hidden ${isCollapsed ? 'min-w-0' : ''}`}>
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
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 md:px-6 py-8 md:py-16 min-w-0 overflow-hidden">
        {/* AI Greeting */}
        <div className="mb-6 md:mb-8 w-full min-w-0">
          <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 md:mb-4 lg:mb-6 px-2 md:px-4 break-words">
            Hey, I&apos;m Turbo
          </h1>
          <p className="text-gray-400 text-base md:text-lg lg:text-xl xl:text-2xl leading-relaxed px-2 md:px-4 max-w-xs md:max-w-sm lg:max-w-md mx-auto break-words">
            I can work with you on your doc and answer any questions!
          </p>
        </div>

        {/* Input Field */}
        <div className="w-full max-w-xs md:max-w-sm lg:max-w-md mb-4 md:mb-6 px-2 md:px-4 min-w-0">
          <div className="relative bg-gray-700 border border-gray-600 rounded-lg md:rounded-xl overflow-hidden">
            <input
              type="text"
              placeholder="Type a question here..."
              className="w-full bg-transparent px-4 py-3 md:py-4 text-white placeholder-gray-400 focus:outline-none text-sm md:text-base min-w-0"
            />
            <div className="flex items-center justify-between px-4 py-2">
              <button className="text-gray-300 hover:text-white p-1">
                <Mic className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-3">
                <button className="text-gray-300 hover:text-white p-1">
                  <Paperclip className="h-5 w-5" />
                </button>
                <button className="text-gray-300 hover:text-white p-1">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-3 w-full max-w-xs md:max-w-sm lg:max-w-md px-2 md:px-4 min-w-0">
          <button className="w-full sm:flex-1 px-2 md:px-3 lg:px-4 py-2 md:py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm rounded-lg md:rounded-xl transition-colors flex items-center justify-center font-medium min-w-0">
            <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Chat</span>
          </button>
          <button className="w-full sm:flex-1 px-2 md:px-3 lg:px-4 py-2 md:py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs md:text-sm rounded-lg md:rounded-xl transition-colors flex items-center justify-center border border-gray-600 font-medium min-w-0">
            <Edit3 className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Edit</span>
          </button>
          <button className="w-full sm:flex-1 px-2 md:px-3 lg:px-4 py-2 md:py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs md:text-sm rounded-lg md:rounded-xl transition-colors flex items-center justify-center border border-gray-600 font-medium min-w-0">
            <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Comment</span>
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="p-3 md:p-4 lg:p-6 border-t border-gray-700 min-w-0">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
            <div className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs md:text-sm lg:text-base font-bold">⚡</span>
            </div>
            <span className="text-gray-300 font-medium text-sm md:text-lg lg:text-xl truncate">Turbonotes AI</span>
          </div>
        </div>
      </div>
    </div>
  )
} 