"use client"

import { Button } from '@/components/ui/button'
import { 
  ArrowLeft,
  MessageSquare,
  Edit3,
  Mic,
  Paperclip,
  Send
} from 'lucide-react'

export default function AIAssistant() {
  return (
    <div className="w-80 bg-sidebar border-l border-sidebar-border flex flex-col">
      {/* Top Right */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" className="text-sidebar-foreground hover:text-sidebar-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Hide →
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full text-sidebar-foreground hover:bg-sidebar-accent text-left justify-start"
        >
          add risks on polar caps
        </Button>
      </div>

      {/* AI Chat Interface */}
      <div className="flex-1 p-4">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">⚡</span>
            </div>
            <span className="text-sidebar-foreground font-semibold">Turbo AI</span>
          </div>
          
          <div className="bg-sidebar-accent rounded-lg p-3 mb-4">
            <p className="text-sidebar-foreground text-sm">
              I can help you add a brief section about the risks to the polar caps. Would you like me to:
            </p>
            <ol className="text-sidebar-foreground text-sm mt-2 space-y-1">
              <li>1. Write it here in the chat for you to copy and paste wherever you&apos;d like, or</li>
              <li>2. Add it directly to your document? (You&apos;ll need to switch to edit mode for that.)</li>
            </ol>
            <p className="text-sidebar-foreground text-sm mt-2">Which would you prefer?</p>
          </div>
        </div>

        {/* Chat Input */}
        <div className="mt-auto">
          {/* Tabs */}
          <div className="flex space-x-1 mb-3">
            <button className="flex-1 px-3 py-2 text-sidebar-foreground text-sm rounded-lg bg-sidebar-accent">
              <MessageSquare className="h-4 w-4 inline mr-2" />
              Chat
            </button>
            <button className="flex-1 px-3 py-2 text-sidebar-foreground text-sm rounded-lg bg-purple-600 text-white">
              <Edit3 className="h-4 w-4 inline mr-2" />
              Edit
            </button>
            <button className="flex-1 px-3 py-2 text-sidebar-foreground text-sm rounded-lg bg-sidebar-accent">
              <MessageSquare className="h-4 w-4 inline mr-2" />
              Comment
            </button>
          </div>

          {/* Input Field */}
          <div className="relative">
            <input
              type="text"
              placeholder="Type a question here..."
              className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-3 text-sidebar-foreground placeholder-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button className="text-sidebar-accent-foreground hover:text-sidebar-accent-foreground">
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button className="text-sidebar-accent-foreground hover:text-sidebar-accent-foreground">
                <Paperclip className="h-4 w-4" />
              </button>
              <button className="text-sidebar-accent-foreground hover:text-sidebar-accent-foreground">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 