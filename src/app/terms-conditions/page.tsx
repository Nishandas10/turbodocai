// Plain, static Terms & Conditions page rendered from TERMS.md content
// Route: /terms-conditions
import React from "react";
import Link from "next/link";

export const metadata = {
	title: "Terms & Conditions | BlumeNote",
	description: "BlumeNote Terms & Conditions",
};

export default function TermsConditionsPage() {
	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
			<nav className="mb-6 border-b border-gray-200 dark:border-gray-700" aria-label="Site">
				<div className="py-3 flex items-center justify-between">
					<Link href="/" className="font-semibold tracking-tight text-gray-900 dark:text-gray-100">
						BlumeNote AI
					</Link>
					<Link href="/" className="text-sm text-blue-600 hover:underline">
						Home
					</Link>
				</div>
			</nav>
			<article className="text-gray-800 dark:text-gray-200">
				<h1 className="text-3xl font-bold tracking-tight mb-3">
					BlumeNote – Terms &amp; Conditions
				</h1>
				<p className="mt-1">
					<strong>Contact:</strong>{" "}
					<a className="text-blue-600 hover:underline" href="mailto:dasbudhe@gmail.com">dasbudhe@gmail.com</a>
				</p>
				<p className="mt-1 text-gray-600 dark:text-gray-400">
					<strong>Last Updated:</strong> <em>November 16, 2025</em>
				</p>

				<p className="mt-6">
					Welcome to <strong>BlumeNote</strong> (“we,” “our,” “the Service”). By accessing or
					using our platform, you (“you,” “user”) agree to these Terms &amp; Conditions
					(“Terms”). Please read them carefully. If you do not agree, do not use
					BlumeNote.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">1. Recording &amp; Content Upload Policy</h2>
				<p>
					BlumeNote is committed to respecting institutional rules, copyright law, and
					privacy regulations. By using the Service, you agree to the following:
				</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">1.1 Compliance with Institutional Rules</h3>
				<p>
					You must not record, upload, or share any content that violates policies set by
					your school, college, university, workplace, or instructor. It is your
					responsibility to understand and comply with your institution’s rules regarding:
				</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Recording of lectures or meetings</li>
					<li>Sharing educational materials</li>
					<li>Uploading class content</li>
				</ul>

				<h3 className="text-xl font-semibold mt-6 mb-2">1.2 Adherence to Copyright Law</h3>
				<p>You may not upload copyrighted materials without explicit permission from the copyright holder. This includes:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Lecture slides</li>
					<li>Instructor-generated notes</li>
					<li>Textbooks, PDFs, or excerpts</li>
					<li>Multimedia content</li>
					<li>Any other copyright-protected resources</li>
				</ul>

				<h3 className="text-xl font-semibold mt-6 mb-2">1.3 Privacy &amp; Sensitive Information</h3>
				<p>You may not record, upload, or share:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Private conversations</li>
					<li>Confidential academic or workplace discussions</li>
					<li>Legally protected or sensitive information</li>
				</ul>
				<p>
					The user is solely responsible for ensuring that any recording or content shared
					through BlumeNote complies with privacy laws and institutional rules.
				</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">1.4 User Responsibility</h3>
				<p>
					BlumeNote disclaims all liability for content users upload. By using the
					platform, you agree to <strong>indemnify and hold harmless</strong> BlumeNote and its
					owner from any claims arising from unauthorized or illegal content uploads.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">2. License to Use BlumeNote Content</h2>
				<p>
					Subject to these Terms, BlumeNote grants you a <strong>limited, non-exclusive,
					non-commercial, revocable, non-transferable</strong> license to access
					BlumeNote-generated content (“Blume Content”) solely for personal educational use.
				</p>
				<p>You agree <strong>not to</strong>:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Copy, download, or extract content using bots, scrapers, crawlers, scripts, or automated tools</li>
					<li>Frame, mask, mine, or harvest Blume Content</li>
					<li>Share subscription access with others</li>
				</ul>
				<p>
					Any expanded access or automated use requires <strong>written permission</strong> from
					BlumeNote.
				</p>
				<p>BlumeNote may impose reasonable limits on:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Number of devices</li>
					<li>Frequency of access</li>
					<li>Amount of material generated</li>
					<li>Subscription usage</li>
				</ul>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">3. Fulfillment &amp; Subscription Policy</h2>
				<h3 className="text-xl font-semibold mt-6 mb-2">3.1 Refund Policy</h3>
				<p>Refunds are issued <strong>only</strong> when:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>A technical issue prevents proper use</li>
					<li>Our support team cannot resolve the issue</li>
				</ul>
				<p>
					Refund requests must be submitted within <strong>30 days</strong> of purchase, along with
					detailed error information.
				</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">3.2 Delivery Policy</h3>
				<p>
					All services are delivered <strong>digitally</strong>. Access to paid features is granted
					immediately after purchase, and confirmation details are emailed to the user.
				</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">3.3 Return Policy</h3>
				<p>Because BlumeNote provides digital services, <strong>returns are not applicable</strong>.</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">3.4 Cancellation Policy</h3>
				<p>Users may cancel subscriptions anytime through the account billing portal. After cancellation:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Access continues until the end of the billing cycle</li>
					<li>No additional charges will be applied</li>
					<li>Premium access ends when the cycle ends</li>
				</ul>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">4. Copyright &amp; Intellectual Property Policy</h2>
				<p>BlumeNote respects the rights of educators and content creators.</p>
				<h3 className="text-xl font-semibold mt-6 mb-2">4.1 Prohibited Actions</h3>
				<p>The following actions are strictly forbidden:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Uploading copyrighted material without permission</li>
					<li>Uploading instructor/faculty-created resources without consent</li>
					<li>Sharing lecture recordings or verbatim transcripts</li>
					<li>Storing or sharing tests, quizzes, exam material</li>
					<li>Uploading content that violates university or school rules</li>
				</ul>
				<p>
					BlumeNote only provides <strong>AI-generated summaries</strong>, not stored transcripts or
					direct lecture reproductions.
				</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">4.2 DMCA Compliance</h3>
				<p>
					BlumeNote complies with the <strong>Digital Millennium Copyright Act (DMCA)</strong>.
				</p>
				<p>To file a DMCA notice, email: <a className="text-blue-600 hover:underline" href="mailto:dasbudhe@gmail.com">dasbudhe@gmail.com</a> with:</p>
				<ol className="list-decimal pl-6 mt-2 space-y-1">
					<li>Your contact information</li>
					<li>Identification of the copyrighted work</li>
					<li>URL/location of the infringing content</li>
					<li>A good-faith statement of unauthorized use</li>
					<li>Your physical or electronic signature</li>
				</ol>
				<p>Upon valid notice, BlumeNote will promptly remove the infringing content.</p>

				<h3 className="text-xl font-semibold mt-6 mb-2">4.3 Consequences of Violation</h3>
				<p>Violations may lead to:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Removal of content</li>
					<li>Account suspension</li>
					<li>Account termination</li>
					<li>Possible legal action</li>
				</ul>
				<p>We may cooperate with educational institutions where required.</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">5. Honor Code &amp; Academic Integrity</h2>
				<p>
					BlumeNote is designed to support learning—not replace it. Users must <strong>not</strong>
					use BlumeNote for:
				</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Cheating</li>
					<li>Academic misconduct</li>
					<li>Sharing or requesting exam/test answers</li>
					<li>Plagiarism</li>
					<li>Circumventing academic integrity policies</li>
				</ul>
				<p>
					If we detect misuse, we may: remove content, disable accounts, report publicly
					posted content to academic institutions, and share relevant account information
					with universities if misconduct occurs.
				</p>
				<p>We believe learning requires genuine effort, not shortcuts.</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				{/* Newly added concise legal sections (original sections 6-9 preserved and renumbered below) */}
				<h2 className="text-2xl font-semibold mt-8 mb-2">6. Data Loss Disclaimer</h2>
				<p>
					BlumeNote is not responsible for any loss of data, including but not limited to deleted notes, corrupted files, failed uploads, service outages, or other technical issues. Users are encouraged to keep their own backups of important materials.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">7. Governing Law &amp; Jurisdiction</h2>
				<p>
					These Terms are governed by the laws of India. Any disputes arising from or related to the use of BlumeNote shall be resolved exclusively in the courts of <strong>Guwahati, India</strong>.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">8. Indemnification</h2>
				<p>Users agree to indemnify, defend, and hold harmless BlumeNote and its owner (Nishant Das) from any claims, damages, liabilities, losses, or expenses arising from:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>Misuse of the Services</li>
					<li>Uploading or sharing content that violates copyright or other legal rights</li>
					<li>Violations of academic integrity policies or institutional rules</li>
					<li>Any action taken on the platform that causes legal or financial consequences</li>
				</ul>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">9. Third-Party Services</h2>
				<p>
					BlumeNote may use third-party services such as cloud hosting providers, AI models, analytics tools, and payment processors. BlumeNote is not responsible for any downtime, errors, failures, or data issues caused by these external services. Users understand that service availability may depend on these third-party systems.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">10. User Responsibilities</h2>
				<p>By using BlumeNote, you agree:</p>
				<ul className="list-disc pl-6 mt-2 space-y-1">
					<li>You are solely responsible for your uploads</li>
					<li>You will comply with all laws and institutional rules</li>
					<li>You will not misuse the platform</li>
					<li>You will not attempt to reverse engineer, copy, or replicate the Service</li>
				</ul>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">11. Limitation of Liability</h2>
				<p>
					BlumeNote and its owner are <strong>not liable</strong> for: user-uploaded content, misuse
					of recordings, violations of institutional or copyright policies, or any damages
					arising from unauthorized use. Your use of BlumeNote is at your own risk.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">12. Modifications to the Terms</h2>
				<p>
					BlumeNote retains the right to modify these Terms at any time. Continued use after
					updates constitutes acceptance of the new Terms.
				</p>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<h2 className="text-2xl font-semibold mt-8 mb-2">13. Contact</h2>
				<p>
					For support, DMCA issues, or policy questions: {" "}
					<strong>
						<a className="text-blue-600 hover:underline" href="mailto:dasbudhe@gmail.com">dasbudhe@gmail.com</a>
					</strong>
				</p>
			</article>
		</main>
	);
}

