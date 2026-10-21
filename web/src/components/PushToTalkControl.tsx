import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Mic } from 'lucide-react'

export interface PushToTalkControlProps {
  onTalkingChange?: (isTalking: boolean) => void
}

export const PushToTalkControl: React.FC<PushToTalkControlProps> = ({
  onTalkingChange,
}) => {
  const [isPressed, setIsPressed] = useState<boolean>(false)
  const isPressedRef = useRef<boolean>(false)

  const setTalking = useCallback(
    (pressed: boolean) => {
      if (isPressedRef.current !== pressed) {
        isPressedRef.current = pressed
        setIsPressed(pressed)
        onTalkingChange?.(pressed)
      }
    },
    [onTalkingChange]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        if (!e.repeat) setTalking(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          // Releasing an existing hold must work even if focus moved while held.
          if (isPressedRef.current) setTalking(false)
          return
        }
        e.preventDefault()
        setTalking(false)
      }
    }

    const handleWindowBlur = () => {
      setTalking(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [setTalking])

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        data-testid="ptt-button"
        data-talking={isPressed}
        onMouseDown={() => setTalking(true)}
        onMouseUp={() => setTalking(false)}
        onMouseLeave={() => setTalking(false)}
        onTouchStart={(e) => {
          e.preventDefault()
          setTalking(true)
        }}
        onTouchEnd={(e) => {
          e.preventDefault()
          setTalking(false)
        }}
        onTouchCancel={() => setTalking(false)}
        className="press relative inline-flex select-none items-center gap-2.5 rounded-full px-6 py-3.5 t-body font-semibold"
        style={{
          background: isPressed ? 'var(--danger)' : 'rgba(255,255,255,0.92)',
          color: isPressed ? '#fff' : '#0a0a0c',
          transform: isPressed ? 'scale(0.96)' : undefined,
          boxShadow: isPressed
            ? '0 0 0 6px color-mix(in srgb, var(--danger) 28%, transparent)'
            : '0 8px 24px -8px rgba(0,0,0,0.7)',
          transition:
            'transform 0.5s var(--spring), background-color 0.15s, box-shadow 0.25s var(--ease-settle), color 0.15s',
        }}
      >
        <Mic className="h-4 w-4" strokeWidth={2.4} />
        <span>{isPressed ? 'Transcribing answer...' : 'Hold to speak (or Space)'}</span>
      </button>
    </div>
  )
}
