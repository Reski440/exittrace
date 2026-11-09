import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'ExitTrace — Browser Logout Security Tester', description: 'Automated browser testing for post-logout exposure.' }

function Nav() {
  const links = [['/', 'Dashboard'], ['/new', 'New Test'], ['/history', 'History'], ['/settings', 'Settings']]
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">Exit<span className="text-sky-400">Trace</span></Link>
        <nav className="flex gap-5 text-sm text-muted" aria-label="Main">
          {links.map(([href, label]) => (<Link key={href} href={href} className="hover:text-white">{label}</Link>))}
        </nav>
      </div>
    </header>
  )
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body><Nav /><main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">ExitTrace tests only applications you own or are explicitly authorised to test. Credentials are session-only and are never stored.</footer>
    </body></html>
  )
}
