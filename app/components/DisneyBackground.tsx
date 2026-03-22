'use client'

/** พื้นหลังแบบแอปจ่ายบิล: ขาว + โทนน้ำเงินอ่อน + คลื่นลายนุ่ม */
export default function DisneyBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-white">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(26, 117, 255, 0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 30%, rgba(0, 89, 179, 0.08), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 70%, rgba(230, 242, 255, 0.9), transparent 45%)',
        }}
      />
      <svg
        className="absolute bottom-0 left-0 w-full text-bill-blueDark/10"
        viewBox="0 0 1440 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        preserveAspectRatio="none"
        style={{ height: '7rem' }}
      >
        <path
          d="M0 80L60 70C120 60 240 40 360 45C480 50 600 80 720 75C840 70 960 35 1080 40C1200 45 1320 85 1380 95L1440 100V120H0V80Z"
          fill="currentColor"
        />
      </svg>
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,89,179,0.35) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  )
}
