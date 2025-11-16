import React from "react";
import Link from "next/link";

export const metadata = {
	title: "Privacy Policy | BlumeNote",
	description: "BlumeNote Privacy Policy explaining collection, use, and protection of personal information.",
};

export default function PrivacyPolicyPage() {
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
				<header className="mb-6">
					<h1 className="text-3xl font-bold tracking-tight mb-3">BlumeNote Privacy Policy</h1>
					<p className="text-gray-600 dark:text-gray-400 text-sm">
						<strong>Last Updated:</strong> <em>November 16, 2025</em>
					</p>
								<p className="mt-4">
									This Privacy Policy (&quot;Policy&quot;) explains how <strong>BlumeNote</strong> (&quot;BlumeNote,&quot; &quot;we,&quot; &quot;us,&quot; or
									&quot;our&quot;) collects, uses, shares, and protects personal information when you use our
									website(s), our mobile or web application (&quot;App&quot;), and our AI-powered study tools,
									content-processing features, and related services (&quot;Services&quot;).
								</p>
					<p className="mt-3">If you have questions, you may contact us using the details at the end of this Policy.</p>
					<p className="mt-3">We may update this Policy from time to time. Any material changes will be posted prominently in the App or on our Site. Minor changes may not be separately announced. All changes take effect immediately once posted.</p>
				</header>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">1. Information We Collect</h2>
								<p>
									We collect information that identifies, describes, relates to, or can reasonably be linked to you (&quot;Personal Information&quot;). We collect information in three ways:
								</p>
					<ol className="list-decimal pl-6 mt-2 space-y-1">
						<li>Information you provide to us</li>
						<li>Information we collect automatically</li>
						<li>Information from third parties</li>
					</ol>
					<p className="mt-4 font-medium">Important Note About Uploaded Content:</p>
					<p>
						BlumeNote allows users to upload files such as lecture audio, PDFs, notes, or documents. You choose what to upload. For your safety, <strong>do not upload sensitive or confidential personal data</strong> such as:
					</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Government-issued ID numbers</li>
						<li>Banking/financial data</li>
						<li>Medical or health information</li>
						<li>Passwords or security credentials</li>
					</ul>
					<p className="mt-2">No platform is 100% secure, so please upload responsibly.</p>
				</section>

				<section>
					<h3 className="text-xl font-semibold mt-6 mb-2">1.1 Information You Provide to Us</h3>
					<h4 className="text-lg font-semibold mt-4 mb-1">Account Registration</h4>
					<p>When you create an account, we collect:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Name</li>
						<li>Email address</li>
						<li>Password or authentication info</li>
						<li>Any optional profile information you choose to provide</li>
					</ul>
					<p className="mt-2">
						If you use <strong>Google Login</strong>, you authorize us to verify your Google credentials. We do <strong>not</strong> store your Google password—only whether Google confirmed your identity.
					</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Subscription Information</h4>
					<p>If you purchase a subscription, we collect:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Name</li>
						<li>Contact details</li>
						<li>Subscription tier and history</li>
					</ul>
					<h4 className="text-lg font-semibold mt-6 mb-1">Payment Information</h4>
					<p>
						Payments are processed by a <strong>PCI-compliant third-party payment processor</strong>. BlumeNote does <strong>not</strong> receive or store your full credit/debit card number.
					</p>
					<p>We may receive:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Your payment confirmation</li>
						<li>Partial billing information</li>
						<li>Your subscription details</li>
						<li>Contact information</li>
					</ul>
					<h4 className="text-lg font-semibold mt-6 mb-1">Service-Related Information</h4>
					<p>We collect Personal Information contained in:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Files you upload</li>
						<li>Audio or text you submit for AI processing</li>
						<li>Messages sent to our support team</li>
						<li>Queries submitted to our AI tools</li>
					</ul>
					<h4 className="text-lg font-semibold mt-6 mb-1">Feedback</h4>
					<p>
						Feedback, suggestions, comments, or reviews may be used internally to improve the Service. Feedback is not treated as confidential and may be used without attribution, provided no personal identity is revealed.
					</p>
				</section>

				<section>
					<h3 className="text-xl font-semibold mt-8 mb-2">1.2 Information Collected Automatically</h3>
					<p>We use cookies, analytics, and other tracking technologies to collect:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>IP address</li>
						<li>Device type and identifiers</li>
						<li>Browser type</li>
						<li>App usage data</li>
						<li>Interaction logs</li>
						<li>Approximate location</li>
						<li>Pages viewed</li>
						<li>Referral URLs</li>
					</ul>
					<p className="mt-2">You may disable some tracking technologies in your browser, but certain essential cookies cannot be disabled.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Google Analytics</h4>
					<p>
						We use Google Analytics for usage statistics. Google may set tracking technologies that automatically send data from your device to Google.
					</p>
					<p className="mt-2">More info:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Google Privacy Policy</li>
						<li>Google Analytics Opt-Out Browser Add-On</li>
						<li>Google “How your data is used” page</li>
					</ul>
					<h4 className="text-lg font-semibold mt-6 mb-1">Google Sign-In</h4>
					<p>If you use Google for login, Google may receive a notification of this usage. Your Google account data is governed by Google’s Privacy Policy.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Google Ads &amp; Behavioral Advertising</h4>
					<p>
						We may use Google Ads or social media ad networks to display relevant ads. You can manage Google ad preferences at: <a className="text-blue-600 hover:underline" href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">https://adssettings.google.com/</a>.
					</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Do Not Track (DNT)</h4>
					<p>Currently, BlumeNote does <strong>not</strong> respond to DNT browser signals.</p>
				</section>

				<section>
					<h3 className="text-xl font-semibold mt-8 mb-2">1.3 Information From Other Sources</h3>
						<p>We may receive Personal Information from:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>Third-party service providers</li>
							<li>Analytics partners</li>
							<li>Other users (e.g., if they upload content that includes your info)</li>
							<li>Social media interactions with our accounts</li>
						</ul>
						<p className="mt-2">Information publicly posted on social media is not confidential and may be re-shared on our Services.</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">2. How We Use Your Information</h2>
					<p>We use Personal Information for the following purposes:</p>
					<h4 className="text-lg font-semibold mt-4 mb-1">As Disclosed at the Time of Collection</h4>
					<p>Example: responding to your message, creating your summary, or fulfilling a request.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Artificial Intelligence Processing</h4>
					<p>We use uploaded content and user interactions to:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>Generate summaries, notes, flashcards, and learning materials</li>
						<li>Improve model performance</li>
						<li>Train internal systems</li>
						<li>Enhance user experience</li>
					</ul>
					<p className="mt-2">We do <strong>not</strong> use your personal identity to train external AI models.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Administration</h4>
					<p>For tasks like managing accounts, processing subscriptions, sending receipts, tracking usage, understanding user demographics, and improving user experience.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Service Management</h4>
					<p>To troubleshoot technical issues, improve performance, customize content, detect and prevent fraud, and monitor system health.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Business Analytics</h4>
					<p>To measure feature usage, engagement, marketing performance, user demographics, and market trends.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Communications</h4>
					<p>We may send service-related notifications, transactional emails (e.g., “Your summary is ready”), and account or security alerts.</p>
					<p className="mt-2">We do <strong>not</strong> currently send promotional emails. If this changes, you will be able to opt out.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Legal Protection</h4>
					<p>We may use information to enforce our Terms, protect rights, users, or the public, and respond to legal requests.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Aggregated / Anonymized Data</h4>
					<p>We may convert data into aggregated or de-identified form. This data is not subject to this Policy.</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">3. Retention of Personal Information</h2>
					<p>
						We retain Personal Information only as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements. If you request deletion, we will remove your data unless doing so violates legal or business requirements. Deleted data may persist in backups for a limited time.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				{/* User Data Rights relocated to become section 4 */}
				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">4. User Data Rights</h2>
					<p>
						BlumeNote respects your rights over your personal information. Regardless of where you live, you have the following rights concerning your data. You may exercise any of these rights by contacting us at <a href="mailto:dasbudhe@gmail.com" className="text-blue-600 hover:underline">dasbudhe@gmail.com</a>.
					</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Access</h3>
					<p>You may request a copy of the personal data we hold about you, including account details, uploads, and usage information.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Delete</h3>
					<p>
						You may request that we delete your personal data at any time. If you delete your account, we will remove your personal information from our active systems. <em>Residual copies may remain in backups for a limited period as part of normal system operations.</em>
					</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Correct (Rectification)</h3>
					<p>If any of your information is inaccurate or incomplete, you may request that we update or correct it.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Download or Export Data</h3>
					<p>You may request an export of your data in a commonly used digital format so that you can move it to another service.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Opt-Out of AI Training</h3>
					<p>
						BlumeNote does <strong>not</strong> use user-uploaded content (notes, documents, images, audio, or text) to train our external AI models. If at any time we introduce optional opt-in training features, you may withdraw your consent or opt out at any time.
					</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Withdraw Consent</h3>
					<p>
						If we rely on your consent to process any type of data, you may withdraw that consent at any time without affecting the legality of any processing that occurred before the withdrawal.
					</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Restrict or Object to Processing</h3>
					<p>
						You may request that we stop using or limit the use of your data in certain circumstances—such as when you believe the data is inaccurate or the processing is unnecessary.
					</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Right to Complain</h3>
					<p>
						If you believe your privacy rights have been violated, you may contact us directly. If applicable in your region, you may also contact your local data protection authority.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">5. Disclosure of Personal Information</h2>
					<p>We may share Personal Information with:</p>
					<h4 className="text-lg font-semibold mt-4 mb-1">Affiliates</h4>
					<p>For operational needs under this Policy.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Educational Institutions</h4>
					<p>If required for enforcing academic integrity or platform rules.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Service Providers / Third-Party Vendors</h4>
					<p>
						Such as hosting providers, cloud infrastructure, analytics services, customer support tools, payment processors, and AI model providers (e.g., OpenAI, Anthropic, Groq). Uploaded content may be processed strictly to fulfill your requests. Their use of data is governed by their privacy policies.
					</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Government / Legal Authorities</h4>
					<p>We may disclose information when legally required, advised by counsel, or to protect rights or prevent harm.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Professional Advisors</h4>
					<p>Such as attorneys, accountants, and consultants.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">Business Transfers</h4>
					<p>If BlumeNote is merged, sold, or restructured, personal data may transfer to the acquiring entity.</p>
					<h4 className="text-lg font-semibold mt-6 mb-1">With Your Consent</h4>
					<p>Whenever you explicitly authorize a disclosure.</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">6. AI Model Behavior &amp; Limitations</h2>
					<p>
						BlumeNote uses artificial intelligence technologies to generate summaries, explanations, flashcards, quizzes, and other study materials from the content you upload. While these systems are designed to be helpful, please review the limitations below.
					</p>
					<h3 className="text-lg font-semibold mt-6 mb-2">AI Outputs May Contain Errors</h3>
					<p>
						AI-generated content may occasionally be incomplete, inaccurate, misleading, or inconsistent. BlumeNote does not guarantee the accuracy, reliability, or correctness of any AI‑generated output.
					</p>
					<h3 className="text-lg font-semibold mt-6 mb-2">Users Must Verify All Information</h3>
					<p>
						All AI outputs—including summaries, explanations, flashcards, quizzes, or study materials—should be reviewed and verified by you. You are responsible for evaluating whether generated content is correct, appropriate, or suitable for academic or personal use.
					</p>
					<h3 className="text-lg font-semibold mt-6 mb-2">No Liability for Outcomes</h3>
					<p>
						BlumeNote is not responsible for academic, professional, certification, exam, or other consequences arising from reliance on AI‑generated content. The platform is a study aid—not a replacement for learning, attending classes, or consulting official materials.
					</p>
					<h3 className="text-lg font-semibold mt-6 mb-2">How AI Providers Process Your Data</h3>
					<p>
						To generate outputs, uploaded content may be sent to trusted third‑party AI service providers (e.g., OpenAI, Anthropic, Google). These providers process your content solely to produce the requested output and do <strong>not</strong> retain or use it to train their general models unless you explicitly opt in (if such future options are offered).
					</p>
					<h3 className="text-lg font-semibold mt-6 mb-2">No Guarantee of Continuous AI Availability</h3>
					<p>
						AI services may experience delays, temporary outages, rate limits, or degraded performance. BlumeNote does not guarantee uninterrupted availability of AI features.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">7. Data Storage Location</h2>
					<p>BlumeNote uses Google Firebase to store and manage certain user data. By using the Services, you acknowledge and agree to the following:</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Storage in the United States and Other Regions</h3>
					<p>Data processed or stored through Firebase may be hosted on servers located in:</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>The United States (primary region)</li>
						<li>Other Google Cloud regions, depending on availability, performance needs, or redundancy requirements</li>
					</ul>
					<p className="mt-2">Firebase may automatically route or replicate data across regions to maintain service reliability, security, and performance.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">International Transfers</h3>
					<p>If you access BlumeNote from outside the United States, your Personal Information may be transferred to, stored in, or processed in the United States or other countries where Firebase servers are located. These regions may have data protection laws that differ from those in your country of residence.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Google Firebase Compliance</h3>
					<p>Google Firebase implements industry-standard security measures and maintains applicable certifications (at the time of writing):</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>ISO/IEC 27001</li>
						<li>SOC 1, SOC 2, and SOC 3</li>
						<li>GDPR-compliant data processing agreements</li>
						<li>Encryption in-transit and at-rest</li>
					</ul>
					<p className="mt-2">Learn more in Firebase’s official documentation: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Privacy &amp; Security</a>.</p>
					<h3 className="text-xl font-semibold mt-6 mb-2">Your Consent to Data Transfer</h3>
					<p>By using our Services, you consent to the transfer and processing of your Personal Information in the United States and any other region where Firebase hosts or processes data.</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">8. Children’s Information</h2>
					<p>
						BlumeNote is <strong>not intended for individuals under 16</strong>. We do not knowingly collect Personal Information from children under 16. If we discover such data, we will delete it promptly. Parents may contact us to request deletion.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">9. Data Security</h2>
					<p>
						We use commercially reasonable security measures to protect your data. However, <strong>no system is perfectly secure</strong>, and we cannot guarantee complete protection. You provide Personal Information at your own risk.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">10. International Users</h2>
					<p>
						If you access BlumeNote from outside your home country, your data may be transferred, stored, and processed in jurisdictions with different data protection laws. By using the Services, you consent to these transfers.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">11. Third-Party Links</h2>
					<p>
						Our Services may link to external websites or apps. We are not responsible for their privacy practices. You should review the privacy policy of each site you visit.
					</p>
				</section>

				<hr className="my-8 border-gray-200 dark:border-gray-700" />

				<section>
					<h2 className="text-2xl font-semibold mt-8 mb-2">12. Contact Us</h2>
					<p>If you have questions about this Privacy Policy or how your data is handled, contact:</p>
					<p className="mt-2"><strong>Name:</strong> Nishant Das</p>
					<p className="mt-1"><strong>Email:</strong> <a className="text-blue-600 hover:underline" href="mailto:dasbudhe@gmail.com">dasbudhe@gmail.com</a></p>
				</section>

			</article>
		</main>
	);
}

