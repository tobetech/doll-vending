'use client'

export default function DisneyBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - Disney magenta tone */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #FFE4F0 0%, #FCE4EC 30%, #F8B4D9 60%, #E91E8C 100%)',
        }}
      />
      {/* Soft cartoon clouds / bubbles */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-[10%] left-[5%] w-32 h-32 rounded-full bg-white/60 blur-2xl" />
        <div className="absolute top-[20%] right-[10%] w-40 h-40 rounded-full bg-white/50 blur-2xl" />
        <div className="absolute bottom-[15%] left-[15%] w-36 h-36 rounded-full bg-white/50 blur-2xl" />
        <div className="absolute bottom-[25%] right-[5%] w-28 h-28 rounded-full bg-white/60 blur-2xl" />
        <div className="absolute top-[50%] left-[50%] w-48 h-48 rounded-full bg-white/30 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>
      {/* Cute decorative stars / sparkles */}
      <svg className="absolute inset-0 w-full h-full overflow-hidden opacity-30" aria-hidden>
        <defs>
          <pattern id="stars" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="20" r="1.5" fill="#E91E8C" />
            <circle cx="50" cy="45" r="1" fill="#FF85A2" />
            <circle cx="80" cy="15" r="1.2" fill="#F8B4D9" />
            <circle cx="30" cy="70" r="1" fill="#E91E8C" />
            <circle cx="70" cy="80" r="1.5" fill="#FF69B4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#stars)" />
      </svg>
      {/* Small cartoon-style shapes */}
      <div className="absolute top-8 right-12 text-4xl opacity-50">✨</div>
      <div className="absolute top-24 left-8 text-3xl opacity-40">🌸</div>
      <div className="absolute bottom-32 right-16 text-3xl opacity-40">⭐</div>
      <div className="absolute bottom-20 left-12 text-4xl opacity-50">💖</div>
    </div>
  )
}
