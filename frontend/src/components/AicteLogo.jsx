import React from 'react';

/**
 * Official AICTE Golden Cogwheel Emblem
 */
export function AicteEmblem({ className = "w-14 h-14" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer gear / cogwheel teeth */}
      <circle cx="50" cy="50" r="46" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
      <g stroke="#92400E" strokeWidth="3">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="4"
            x2="50"
            y2="10"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>

      {/* Inner circular ribbon */}
      <circle cx="50" cy="50" r="38" fill="#FFFBEB" stroke="#D97706" strokeWidth="2" />

      {/* Blue Ashok Chakra / Inner Core Ring */}
      <circle cx="50" cy="50" r="24" fill="#1E3A8A" stroke="#F59E0B" strokeWidth="1.5" />

      {/* Golden Flame of Knowledge / Diya */}
      <path
        d="M50 32 C54 38, 57 43, 50 53 C43 43, 46 38, 50 32 Z"
        fill="#FBBF24"
      />
      <circle cx="50" cy="42" r="3" fill="#EF4444" />

      {/* Open Book Base */}
      <path
        d="M38 58 Q 50 62 50 67 Q 50 62 62 58 L 62 64 Q 50 68 50 72 Q 50 68 38 64 Z"
        fill="#FFFFFF"
        stroke="#1E3A8A"
        strokeWidth="0.8"
      />

      {/* Small Text arc indicator */}
      <circle cx="50" cy="50" r="32" stroke="#D97706" strokeDasharray="3 3" strokeWidth="1" fill="none" />
      <text x="50" y="22" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#92400E" fontFamily="sans-serif">
        AICTE
      </text>
    </svg>
  );
}

/**
 * National Emblem of India (Satyameva Jayate / Ministry of Education)
 */
export function NationalEmblem({ className = "w-8 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Three Lions stylized */}
      <path d="M20 5 C15 5 13 8 13 13 C13 17 15 19 17 21 C15 22 13 25 13 28 C13 32 17 34 20 34 C23 34 27 32 27 28 C27 25 25 22 23 21 C25 19 27 17 27 13 C27 8 25 5 20 5 Z" fill="#334155" />
      <circle cx="20" cy="12" r="2.5" fill="#F8FAFC" />
      {/* Base Ashoka Chakra pedestal */}
      <rect x="10" y="35" width="20" height="4" rx="1" fill="#475569" />
      <circle cx="20" cy="37" r="1.5" fill="#1E3A8A" />
      <rect x="7" y="40" width="26" height="3" rx="0.5" fill="#334155" />
      <text x="20" y="48" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#0F172A">
        सत्यमेव जयते
      </text>
    </svg>
  );
}

/**
 * G20 Bharat 2023 Motif
 */
export function G20Logo({ className = "w-16 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="5" y="24" fontSize="16" fontWeight="900" fill="#EA580C" fontFamily="sans-serif">
        G
      </text>
      <circle cx="27" cy="18" r="8" fill="#10B981" />
      <circle cx="27" cy="18" r="5" fill="#3B82F6" />
      <text x="38" y="24" fontSize="16" fontWeight="900" fill="#2563EB" fontFamily="sans-serif">
        2
      </text>
      <text x="49" y="24" fontSize="16" fontWeight="900" fill="#1E3A8A" fontFamily="sans-serif">
        0
      </text>
      <text x="40" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#475569" letterSpacing="1">
        भारत 2023 INDIA
      </text>
    </svg>
  );
}

/**
 * AICTE Floating Assistant Mascot (matching Image 4 bottom-right)
 */
export function AicteMascot({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 cursor-pointer group transition transform hover:scale-105 active:scale-95"
      title="Ask AICTE e-Governance Portal Support"
    >
      <div className="relative">
        {/* Glowing Orange Outer Ring */}
        <div className="w-14 h-14 rounded-full bg-linear-to-tr from-amber-500 to-orange-500 p-0.5 shadow-2xl flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-slate-900 border-2 border-white flex items-center justify-center overflow-hidden">
            {/* Mascot Avatar representation */}
            <svg viewBox="0 0 40 40" className="w-10 h-10 mt-1">
              {/* Hair */}
              <circle cx="20" cy="16" r="10" fill="#1E293B" />
              {/* Face */}
              <circle cx="20" cy="18" r="8" fill="#FBBF24" />
              {/* Glasses */}
              <rect x="15" y="15" width="4" height="3" rx="1" fill="#0F172A" />
              <rect x="21" y="15" width="4" height="3" rx="1" fill="#0F172A" />
              <line x1="19" y1="16.5" x2="21" y2="16.5" stroke="#0F172A" strokeWidth="1" />
              {/* Smile */}
              <path d="M18 21 Q 20 23 22 21" stroke="#92400E" strokeWidth="1" fill="none" />
              {/* Blue Suit Collar */}
              <path d="M12 28 C14 24 26 24 28 28 L 28 36 L 12 36 Z" fill="#1E3A8A" />
              <polygon points="20,26 18,30 22,30" fill="#EF4444" />
            </svg>
          </div>
        </div>

        {/* Online Status Green Dot */}
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
      </div>
    </div>
  );
}

/**
 * Floating Social Bar (matching Image 3 & 4 right-edge)
 */
export function SocialSidebar() {
  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col shadow-lg">
      <a
        href="https://facebook.com"
        target="_blank"
        rel="noreferrer"
        className="w-9 h-9 bg-[#1877F2] hover:w-11 transition-all flex items-center justify-center text-white text-sm font-bold"
        title="Facebook"
      >
        f
      </a>
      <a
        href="https://twitter.com"
        target="_blank"
        rel="noreferrer"
        className="w-9 h-9 bg-black hover:w-11 transition-all flex items-center justify-center text-white text-xs font-bold"
        title="X (Twitter)"
      >
        𝕏
      </a>
      <a
        href="https://play.google.com"
        target="_blank"
        rel="noreferrer"
        className="w-9 h-9 bg-[#EA4335] hover:w-11 transition-all flex items-center justify-center text-white text-xs font-bold"
        title="AICTE Android Mobile App"
      >
        🤖
      </a>
    </div>
  );
}
