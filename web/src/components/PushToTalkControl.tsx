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
        className={`group relative flex items-center gap-3 px-6 py-3.5 rounded-2xl font-medium text-sm transition-all select-none shadow-xl ${
          isPressed
            ? 'bg-rose-500 text-white scale-95 ring-4 ring-rose-500/30'
            : 'bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-200 border border-neutral-700/60 active:scale-95'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full transition-colors ${
            isPressed ? 'bg-white animate-ping' : 'bg-neutral-500'
          }`}
        />
        <Mic className={`w-4 h-4 ${isPressed ? 'text-white' : 'text-neutral-400'}`} />
        <span>{isPressed ? 'Transcribing answer...' : 'Hold to speak (or Space)'}</span>
      </button>
      <span className="text-[11px] text-neutral-500">
        Press & hold button or Spacebar while speaking
      </span>
    </div>
  )
}
