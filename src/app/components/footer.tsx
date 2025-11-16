import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-gray-950 text-gray-300 border-t border-gray-800">
      <div className="container mx-auto px-4 py-10">
  <div className="w-full text-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:px-8 lg:px-12">
          {/* Left-aligned copyright */}
          <p className="text-gray-400">&copy; {year} BlumeNote. All rights reserved.</p>
          {/* Right-aligned links with Contact Us first */}
          <nav aria-label="Legal" className="flex flex-wrap gap-6">
            <Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link>
            <Link href="/terms-conditions" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
            <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
