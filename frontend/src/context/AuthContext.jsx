import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ek_token')
    if (token) {
      authApi.me().then((r) => setUser(r.data)).catch(() => localStorage.removeItem('ek_token')).finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login = async (email, password) => {
    const r = await authApi.login(email, password)
    localStorage.setItem('ek_token', r.data.access_token)
    const me = await authApi.me()
    setUser(me.data)
  }

  const logout = () => {
    localStorage.removeItem('ek_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)