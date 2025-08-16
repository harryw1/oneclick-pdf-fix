import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function TestAuthPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Starting auth test...')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    console.log('TestAuthPage useEffect started')
    
    const testAuth = async () => {
      try {
        setMessage('Creating Supabase client...')
        console.log('Creating Supabase client')
        
        const supabase = createClient()
        console.log('Supabase client created')
        
        setMessage('Getting user...')
        console.log('Getting user')
        
        const { data: { user }, error } = await supabase.auth.getUser()
        console.log('getUser result:', { user, error })
        
        if (error) {
          setMessage(`Error: ${error.message}`)
        } else {
          setUser(user)
          setMessage(user ? `User found: ${user.email}` : 'No user found')
        }
      } catch (error: any) {
        console.error('Auth test error:', error)
        setMessage(`Exception: ${error.message}`)
      } finally {
        console.log('Setting loading to false')
        setLoading(false)
      }
    }

    testAuth()
  }, [])

  console.log('TestAuthPage render - loading:', loading, 'message:', message)

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
        <h1 className="text-4xl font-bold text-green-600">Auth Test Complete!</h1>
        <p className="mt-4 text-gray-600">Message: {message}</p>
        <p className="mt-2 text-gray-600">User: {user ? user.email : 'None'}</p>
        <div className="mt-4">
          <a href="/test" className="text-blue-600 underline">Go to basic test</a>
        </div>
      </div>
    </div>
  )
}