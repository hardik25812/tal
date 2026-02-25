import './globals.css'
import { Toaster } from "sonner"

export const metadata = {
  title: 'LeadOS - Lead Intelligence Dashboard',
  description: 'Centralized lead database for high-volume cold email operators',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
