"use client"

// shadcn/ui sonner wrapper
import { Toaster as SonnerToaster, toast as sonnerToast, type ToasterProps } from "sonner"

export const toast = sonnerToast

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      richColors
      position="top-center"
      closeButton
      toastOptions={{
        duration: 10000,
        style: { color: '#000000' },
      }}
      {...props}
    />
  )
}
