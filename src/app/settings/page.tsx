"use client"

import { Settings, CreditCard, Globe, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import { useState } from "react"
import { updateUserProfile } from "@/lib/firestore"
import { auth } from "@/lib/firebase"
import { updateProfile } from "firebase/auth"

export default function SettingsPage() {
  const { user } = useAuth()
  const [nameEditing, setNameEditing] = useState(false)
  const [nameValue, setNameValue] = useState<string>(
    user?.displayName || user?.email?.split("@")[0] || ""
  )
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const startEditName = () => {
    setNameValue(user?.displayName || user?.email?.split("@")[0] || "")
    setNameEditing(true)
    setNameError(null)
  }

  const cancelEditName = () => {
    setNameEditing(false)
    setNameError(null)
  }

  const saveName = async () => {
    const trimmed = (nameValue || "").trim()
    if (!user?.uid) return
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }
    setSavingName(true)
    setNameError(null)
    try {
      await updateUserProfile(user.uid, { displayName: trimmed })
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmed })
      }
      setNameEditing(false)
    } catch {
      setNameError("Failed to update name. Please try again.")
    } finally {
      setSavingName(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
        <DashboardSidebar />
        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <Settings className="h-8 w-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-foreground">My Account</h1>
            </div>
          </div>

          {/* Account Settings Sections */}
          <div className="space-y-6">
            {/* Full Name */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Full Name</h3>
                  <p className="text-muted-foreground">Your Full Name</p>
                </div>
                {!nameEditing ? (
                  <div className="flex items-center gap-3">
                    <span className="text-foreground">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-border h-9 w-9 flex items-center justify-center"
                      onClick={startEditName}
                      aria-label="Edit name"
                      title="Edit name"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Enter your name"
                      disabled={savingName}
                    />
                    <Button onClick={saveName} disabled={savingName} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {savingName ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="outline" className="border-border" onClick={cancelEditName} disabled={savingName}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {nameError && (
                <div className="mt-2 text-sm text-red-500">{nameError}</div>
              )}
            </div>

            {/* Email */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Email</h3>
                  <p className="text-muted-foreground">Your Email</p>
                </div>
                <span className="text-foreground">{user?.email || 'No email'}</span>
              </div>
            </div>

            {/* Change Language */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Change language</h3>
                  <p className="text-muted-foreground">This language will be used to generate all content.</p>
                </div>
                <Button variant="outline" className="bg-muted border-border text-foreground hover:bg-muted/80">
                  <Globe className="h-4 w-4 mr-2" />
                  English
                </Button>
              </div>
            </div>

            {/* Current Pricing Plan */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Current Pricing Plan</h3>
                  <p className="text-muted-foreground">Your Enrolled Plan</p>
                </div>
                <span className="text-foreground">Starter Plan</span>
              </div>
            </div>

            {/* Billing Portal */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Billing Portal</h3>
                  <p className="text-muted-foreground">Upgrade, cancel, or view your subscription</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Billing Portal
                </Button>
              </div>
            </div>

            {/* Logout now handled via user dropdown in DashboardSidebar */}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 