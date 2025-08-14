"use client"

import { useState } from 'react'
import { FileText, Edit3, Save, Copy, Download, Search, Filter } from 'lucide-react'

interface TranscriptSection {
  id: string
  timestamp: string
  speaker: string
  content: string
  category: string
}

export default function TranscriptPage() {
  const [transcript, setTranscript] = useState<TranscriptSection[]>([
    {
      id: '1',
      timestamp: '00:00',
      speaker: 'AI Narrator',
      content: 'Welcome to this AI-generated transcript of your notes. Today we\'ll be covering the main concepts and key points that you\'ve documented.',
      category: 'Introduction'
    },
    {
      id: '2',
      timestamp: '00:15',
      speaker: 'AI Narrator',
      content: 'The first concept we\'ll explore is understanding the fundamental principles. This forms the foundation for all subsequent applications.',
      category: 'Concept Understanding'
    },
    {
      id: '3',
      timestamp: '00:32',
      speaker: 'AI Narrator',
      content: 'Key point number one: Always start with the basics. Don\'t rush into complex scenarios without mastering the fundamentals.',
      category: 'Key Points'
    },
    {
      id: '4',
      timestamp: '00:48',
      speaker: 'AI Narrator',
      content: 'Key point number two: Follow the step-by-step process outlined in your notes. This ensures proper implementation and reduces errors.',
      category: 'Key Points'
    },
    {
      id: '5',
      timestamp: '01:05',
      speaker: 'AI Narrator',
      content: 'When applying this knowledge, remember to pay attention to the guidelines. Common mistakes often occur when these are overlooked.',
      category: 'Application'
    },
    {
      id: '6',
      timestamp: '01:22',
      speaker: 'AI Narrator',
      content: 'In conclusion, the main takeaway is that success comes from understanding the principles, following the process, and avoiding common pitfalls.',
      category: 'Summary'
    }
  ])
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showFilters, setShowFilters] = useState(false)

  const categories = ['All', 'Introduction', 'Concept Understanding', 'Key Points', 'Application', 'Summary']

  const handleEdit = (section: TranscriptSection) => {
    setEditingId(section.id)
    setEditContent(section.content)
  }

  const handleSave = () => {
    if (editingId) {
      setTranscript(prev => prev.map(section => 
        section.id === editingId 
          ? { ...section, content: editContent }
          : section
      ))
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleCopy = () => {
    const fullTranscript = transcript.map(section => 
      `[${section.timestamp}] ${section.speaker}: ${section.content}`
    ).join('\n\n')
    navigator.clipboard.writeText(fullTranscript)
  }

  const handleDownload = () => {
    const fullTranscript = transcript.map(section => 
      `[${section.timestamp}] ${section.speaker}: ${section.content}`
    ).join('\n\n')
    
    const blob = new Blob([fullTranscript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcript.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredTranscript = transcript.filter(section => {
    const matchesSearch = section.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         section.speaker.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || section.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-semibold text-foreground">Transcript</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated transcript of your notes with editing capabilities
        </p>
      </div>

      {/* Controls */}
      <div className="border-b border-border p-4 space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>
        </div>

        {/* Category Filter */}
        {showFilters && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy className="h-4 w-4" />
            <span>Copy All</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {filteredTranscript.map((section) => (
            <div
              key={section.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {section.timestamp}
                  </span>
                  <span className="text-sm font-medium text-indigo-600">
                    {section.speaker}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {section.category}
                  </span>
                </div>
                
                <button
                  onClick={() => handleEdit(section)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              {editingId === section.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSave}
                      className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed">{section.content}</p>
              )}
            </div>
          ))}

          {filteredTranscript.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No transcript sections found</h3>
              <p className="text-gray-500">
                Try adjusting your search terms or category filter
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 