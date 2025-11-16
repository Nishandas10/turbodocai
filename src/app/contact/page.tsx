import React from "react";
import Link from "next/link";
import ContactFormEmbed from "./ContactFormEmbed";

export const metadata = {
	title: "Contact Us | BlumeNote",
	description: "Get in touch with BlumeNote support, feedback, and inquiries.",
};

export default function ContactPage() {
	return (
		<main className="mx-auto max-w-3xl px-4 pt-2 pb-6 sm:pt-3 sm:pb-8">
			<nav className="mb-0 border-b border-gray-200 dark:border-gray-700" aria-label="Site">
				<div className="py-2 flex items-center justify-between">
					<Link href="/" className="font-semibold tracking-tight text-gray-900 dark:text-gray-100">BlumeNote AI</Link>
					<Link href="/" className="text-sm text-blue-600 hover:underline">Home</Link>
				</div>
			</nav>
			<article className="text-gray-800 dark:text-gray-200 mt-2">
				<ContactFormEmbed />
			</article>
		</main>
	);
}
