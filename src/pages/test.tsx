import { useState, useEffect } from 'react'

export default function TestPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Starting...')

  useEffect(() => {
    console.log('TestPage useEffect started')
    setMessage('UseEffect ran')
    
    setTimeout(() => {
      console.log('Timer finished')
      setMessage('Timer completed')
      setLoading(false)
    }, 2000)
  }, [])

  console.log('TestPage render - loading:', loading, 'message:', message)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-600">Test Page Loaded!</h1>
        <p className="mt-4 text-gray-600">No authentication, no Supabase</p>
        <p className="mt-2 text-gray-600">Message: {message}</p>
      </div>
    </div>
  )
}