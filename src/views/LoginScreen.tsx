import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/session.store'
import toast from 'react-hot-toast'
import type { User } from '../types'
import { Delete } from 'lucide-react'

export default function LoginScreen() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const { setUser } = useSessionStore()
  const navigate = useNavigate()

  useEffect(() => {
    window.posAPI?.users.getAll().then(u => {
      const active = u.filter(x => x.is_active)
      setUsers(active)
    })
  }, [])

  const handleKeyPress = async (key: string) => {
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (key === 'clear') {
      setPin('')
      return
    }
    const newPin = pin + key
    setPin(newPin)

    if (newPin.length === 4) {
      setIsLoading(true)
      try {
        const result = await window.posAPI.users.login(newPin)
        if (result.success && result.user) {
          // If a specific staff card is selected, PIN must belong to THAT person
          if (selectedUser && result.user.id !== selectedUser.id) {
            setShake(true)
            setTimeout(() => { setShake(false); setPin('') }, 600)
            toast.error(`Incorrect PIN for ${selectedUser.name}`)
            return
          }
          setUser(result.user)
          navigate('/')
          toast.success(`Welcome back, ${result.user.name}! 👋`)
        } else {
          setShake(true)
          setTimeout(() => { setShake(false); setPin('') }, 600)
          toast.error('Incorrect PIN')
        }
      } finally {
        setIsLoading(false)
      }
    }
  }

  const KEYS = ['1','2','3','4','5','6','7','8','9','clear','0','backspace']
  const ROLE_COLORS: Record<string, string> = {
    owner: '#F43F5E', manager: '#F59E0B',
    cashier: '#10B981', waiter: '#0EA5E9', kitchen: '#A78BFA',
  }

  return (
    <div className="login-screen">
      <div className="login-card animate-scale-in">
        <div>
          <div className="login-logo">POS</div>
          <p className="login-subtitle">Point of Sale System</p>
        </div>

        {/* Staff Selection */}
        {users.length > 0 && (
          <div style={{ width: '100%' }}>
            <div className="form-label" style={{ marginBottom: 8, textAlign: 'center' }}>
              Select Staff
            </div>
            <div className="staff-list">
              {users.slice(0, 6).map(u => (
                <div
                  key={u.id}
                  className={`staff-card ${selectedUser?.id === u.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedUser(u); setPin('') }}
                >
                  <div
                    className="staff-card__avatar"
                    style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[u.role] || '#6366F1'}, #A78BFA)` }}
                  >
                    {u.name[0]}
                  </div>
                  <span className="staff-card__name">{u.name}</span>
                  <span className="staff-card__role">{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PIN Entry */}
        <div className="pin-input-group">
          <div className="form-label" style={{ textAlign: 'center' }}>
            {selectedUser ? `Enter PIN for ${selectedUser.name}` : 'Enter your PIN'}
          </div>
          <div
            className="pin-display"
            style={{
              animation: shake ? 'shakeX 0.4s ease' : undefined,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`pin-dot ${i < pin.length ? 'pin-dot--filled' : ''}`} />
            ))}
          </div>
          <div
            className="pin-keypad"
            style={{ opacity: isLoading ? 0.6 : 1, pointerEvents: isLoading ? 'none' : undefined }}
          >
            {KEYS.map(key => (
              <button
                key={key}
                className={`pin-key ${key === 'clear' || key === 'backspace' ? 'pin-key--action' : ''}`}
                onClick={() => handleKeyPress(key)}
              >
                {key === 'backspace' ? <Delete size={18} /> : key === 'clear' ? 'C' : key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
