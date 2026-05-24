import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredToken,
  fetchCurrentUser,
  getStoredToken,
  logIn,
  signUp,
  storeToken,
  type AuthUser,
} from '../lib/auth-api'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  authReady: boolean
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  signUp: (email: string, username: string, password: string) => Promise<void>
  logIn: (email: string, password: string) => Promise<void>
  logOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stored = getStoredToken()

    if (!stored) {
      setAuthReady(true)
      return
    }

    fetchCurrentUser(stored)
      .then((current) => {
        if (cancelled) return
        setUser(current)
        setToken(stored)
        setAuthReady(true)
      })
      .catch(() => {
        if (cancelled) return
        clearStoredToken()
        setAuthReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleAuthSuccess = useCallback((nextToken: string, nextUser: AuthUser) => {
    storeToken(nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setAuthModalOpen(false)
  }, [])

  const handleSignUp = useCallback(
    async (email: string, username: string, password: string) => {
      const result = await signUp(email, username, password)
      handleAuthSuccess(result.token, result.user)
    },
    [handleAuthSuccess],
  )

  const handleLogIn = useCallback(
    async (email: string, password: string) => {
      const result = await logIn(email, password)
      handleAuthSuccess(result.token, result.user)
    },
    [handleAuthSuccess],
  )

  const handleLogOut = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      authReady,
      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),
      signUp: handleSignUp,
      logIn: handleLogIn,
      logOut: handleLogOut,
    }),
    [user, token, authReady, authModalOpen, handleSignUp, handleLogIn, handleLogOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
