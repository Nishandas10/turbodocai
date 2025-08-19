import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useEmailSignIn() {
  const [isReturningWithLink, setIsReturningWithLink] = useState(false);
  const [email, setEmail] = useState("");
  const { signInWithEmail } = useAuth();

  useEffect(() => {
    // Check if user is returning with a sign-in link
    const urlParams = new URLSearchParams(window.location.search);
    const apiKey = urlParams.get("apiKey");

    if (apiKey) {
      setIsReturningWithLink(true);
      // Get email from localStorage
      const savedEmail = window.localStorage.getItem("emailForSignIn");
      if (savedEmail) {
        setEmail(savedEmail);
        // Automatically process the sign-in
        handleEmailSignIn(savedEmail);
      }
    }
  }, []);

  const handleEmailSignIn = async (emailAddress: string) => {
    try {
      await signInWithEmail(emailAddress);
    } catch (error) {
      console.error("Email sign-in error:", error);
    }
  };

  return {
    isReturningWithLink,
    email,
    handleEmailSignIn,
  };
}
