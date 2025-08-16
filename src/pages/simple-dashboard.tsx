import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'

export default function SimpleDashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    console.log('SimpleDashboard mounted')
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading simple dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Simple Dashboard</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Dashboard Content</h2>
            <p className="text-gray-600">This is a simple dashboard without any authentication logic.</p>
            <div className="mt-4 space-y-2">
              <p><strong>Mounted:</strong> {mounted ? 'Yes' : 'No'}</p>
              <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
            </div>
            <div className="mt-6 space-x-4">
              <a href="/test" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                Go to Test Page
              </a>
              <a href="/test-auth" className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                Go to Auth Test
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  }
}