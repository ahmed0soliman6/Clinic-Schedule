import React from 'react';

interface LogoProps {
  className?: string;
  idSuffix?: string;
}

/**
 * Exact vector reproduction of the uploaded "مجمع ميت عزون الطبي" logo:
 * - Outer mint-green heart (#68e8b7) + inner sky-blue heart (#2aa4df)
 * - White rounded medical cross cutout on the lower-left with bold royal-blue "مجمع"
 * - Bold royal-blue "ميت عزون الطبي" below the heart
 * - "جمعية تنمية المجتمع المحلي" & "مشهرة برقم 2406" at the bottom
 */
export const ComplexBrandLogo: React.FC<LogoProps> = ({
  className = 'h-24 w-auto',
  idSuffix = 'main',
}) => {
  const maskId = `heartCrossCutout_${idSuffix}`;
  return (
    <svg
       xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 540"
      className={className}
      role="img"
      aria-label="شعار مجمع ميت عزون الطبي"
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="500" height="540" fill="white" />
          {/* Vertical arm of white rounded cross */}
          <rect x="130" y="102" width="84" height="230" rx="26" fill="black" />
          {/* Horizontal arm of white rounded cross */}
          <rect x="20" y="182" width="282" height="96" rx="26" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        {/* Outer Mint-Green Heart */}
        <path
          d="M 250 335
             C 250 335, 42 220, 42 112
             C 42 46, 95 10, 154 10
             C 198 10, 232 34, 250 66
             C 268 34, 302 10, 346 10
             C 405 10, 458 46, 458 112
             C 458 220, 250 335, 250 335 Z"
          fill="#68e8b7"
        />

        {/* Inner Sky-Blue Heart */}
        <path
          d="M 250 335
             C 250 335, 86 236, 86 142
             C 86 88, 130 58, 178 58
             C 214 58, 238 78, 250 105
             C 262 78, 286 58, 322 58
             C 370 58, 414 88, 414 142
             C 414 236, 250 335, 250 335 Z"
          fill="#2aa4df"
        />
      </g>

      {/* 'مجمع' inside the horizontal white cross cutout */}
      <text
        x="212"
        y="246"
        textAnchor="middle"
        fill="#194299"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="900"
        fontSize="68"
      >
        مجمع
      </text>

      {/* 'ميت عزون الطبي' */}
      <text
        x="250"
        y="404"
        textAnchor="middle"
        fill="#194299"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="900"
        fontSize="72"
      >
        ميت عزون الطبي
      </text>

      {/* 'جمعية تنمية المجتمع المحلي' */}
      <text
        x="250"
        y="475"
        textAnchor="middle"
        fill="#234fa2"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="700"
        fontSize="33"
      >
        جمعية تنمية المجتمع المحلي
      </text>

      {/* 'مشهرة برقم 2406' */}
      <text
        x="250"
        y="520"
        textAnchor="middle"
        fill="#234fa2"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="700"
        fontSize="33"
      >
        مشهرة برقم 2406
      </text>
    </svg>
  );
};

/**
 * Exact vector reproduction of the uploaded "جمعية تنمية المجتمع المحلي بميت عزون - المشهرة برقم ٢٤٠٦" logo:
 * - Circular seal with outer crimson ring + inner black ring
 * - Left & right green wheat/olive wreaths
 * - Green sprout + warm orange sun + 5-person family with wheelchair in the center
 * - "المشهرة برقم ٢٤٠٦" below the figures
 * - Sweeping 3D navy-blue & lime-green ribbon banner at the bottom
 */
export const AssociationBrandLogo: React.FC<LogoProps> = ({
  className = 'h-24 w-auto',
  idSuffix = 'main',
}) => {
  const skyGlowId = `skyGlow_${idSuffix}`;
  const navyRibbonId = `navyRibbon_${idSuffix}`;
  const greenRibbonId = `greenRibbon_${idSuffix}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={className}
      role="img"
      aria-label="شعار جمعية تنمية المجتمع المحلي بميت عزون المشهرة برقم 2406"
    >
      <defs>
        <radialGradient id={skyGlowId} cx="50%" cy="38%" r="48%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="65%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#ffffff" />
        </radialGradient>
        <linearGradient id={navyRibbonId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#090d2a" />
          <stop offset="30%" stopColor="#1d2b6f" />
          <stop offset="70%" stopColor="#172554" />
          <stop offset="100%" stopColor="#090d2a" />
        </linearGradient>
        <linearGradient id={greenRibbonId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4d7c0f" />
          <stop offset="45%" stopColor="#84cc16" />
          <stop offset="85%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#3f6212" />
        </linearGradient>
      </defs>

      {/* Circular Seal Outer Red & Inner Black Rings */}
      <circle
        cx="250"
        cy="215"
        r="178"
        fill="#ffffff"
        stroke="#7f1d1d"
        strokeWidth="6"
      />
      <circle
        cx="250"
        cy="215"
        r="168"
        fill={`url(#${skyGlowId})`}
        stroke="#111827"
        strokeWidth="5"
      />

      {/* Left Green Wheat / Olive Wreath */}
      <g fill="#047857">
        <path d="M 135 320 C 92 260, 92 160, 148 100 C 122 155, 118 250, 152 312 Z" />
        <path d="M 108 265 C 95 242, 102 222, 122 235 C 114 248, 112 256, 108 265 Z" />
        <path d="M 104 225 C 92 200, 102 182, 122 198 C 114 208, 110 216, 104 225 Z" />
        <path d="M 110 185 C 102 162, 114 146, 130 162 C 122 172, 116 178, 110 185 Z" />
        <path d="M 122 148 C 118 126, 132 114, 144 130 C 136 138, 130 142, 122 148 Z" />
        <path d="M 140 258 C 154 240, 148 220, 128 232 C 134 244, 136 250, 140 258 Z" />
        <path d="M 138 218 C 152 198, 144 180, 126 194 C 132 204, 134 210, 138 218 Z" />
        <path d="M 142 180 C 156 162, 150 145, 134 158 C 138 168, 140 174, 142 180 Z" />
      </g>

      {/* Right Green Wheat / Olive Wreath */}
      <g fill="#047857">
        <path d="M 365 320 C 408 260, 408 160, 352 100 C 378 155, 382 250, 348 312 Z" />
        <path d="M 392 265 C 405 242, 398 222, 378 235 C 386 248, 388 256, 392 265 Z" />
        <path d="M 396 225 C 408 200, 398 182, 378 198 C 386 208, 390 216, 396 225 Z" />
        <path d="M 390 185 C 398 162, 386 146, 370 162 C 378 172, 384 178, 390 185 Z" />
        <path d="M 378 148 C 382 126, 368 114, 356 130 C 364 138, 370 142, 378 148 Z" />
        <path d="M 360 258 C 346 240, 352 220, 372 232 C 366 244, 364 250, 360 258 Z" />
        <path d="M 362 218 C 348 198, 356 180, 374 194 C 368 204, 366 210, 362 218 Z" />
        <path d="M 358 180 C 344 162, 350 145, 366 158 C 362 168, 360 174, 358 180 Z" />
      </g>

      {/* Center Top: Green Plant Sprout (Left) & Warm Sun (Right) */}
      <g stroke="#065f46" strokeWidth="3.5" strokeLinecap="round" fill="#065f46">
        <line x1="212" y1="120" x2="212" y2="168" />
        <path d="M 212 135 Q 198 126 196 118 Q 208 122 212 135 Z" />
        <path d="M 212 135 Q 226 126 228 118 Q 216 122 212 135 Z" />
        <path d="M 212 150 Q 195 140 193 132 Q 206 136 212 150 Z" />
        <path d="M 212 150 Q 229 140 231 132 Q 218 136 212 150 Z" />
        <path d="M 212 164 Q 196 154 194 146 Q 206 150 212 164 Z" />
        <path d="M 212 164 Q 228 154 230 146 Q 218 150 212 164 Z" />
      </g>

      {/* Glowing Orange Sun */}
      <circle cx="272" cy="142" r="21" fill="#fde047" opacity="0.55" />
      <circle cx="272" cy="142" r="15" fill="#ea580c" stroke="#f59e0b" strokeWidth="3" />

      {/* Family Figures in Center */}
      <circle cx="182" cy="174" r="9.5" fill="#1e1b4b" />
      <path
        d="M 155 224 Q 168 186 182 186 Q 194 186 202 214 L 194 268 L 182 232 L 172 266 L 166 212 Z"
        fill="#64748b"
      />

      {/* Wheelchair Person (Dark Navy) */}
      <circle cx="216" cy="198" r="8.5" fill="#1e1b4b" />
      <path
        d="M 204 234 Q 204 210 218 210 L 234 222 L 222 242 L 234 262 L 222 268 Z"
        fill="#1e1b4b"
      />
      <circle cx="209" cy="252" r="15" fill="none" stroke="#64748b" strokeWidth="4" />

      {/* Center Golden Mother Figure */}
      <circle cx="246" cy="164" r="9.5" fill="#451a03" />
      <path
        d="M 224 218 L 246 178 L 270 218 L 264 242 L 256 242 L 250 272 L 242 272 L 240 242 L 232 242 Z"
        fill="#d97706"
      />

      {/* Child Figure (Crimson) */}
      <circle cx="280" cy="208" r="6.5" fill="#64748b" />
      <path
        d="M 268 232 L 280 218 L 292 232 L 286 266 L 280 248 L 274 266 Z"
        fill="#881337"
      />

      {/* Right Dark Green Adult */}
      <circle cx="296" cy="172" r="9.5" fill="#65a30d" />
      <path
        d="M 284 216 Q 294 184 310 184 Q 324 184 330 214 L 318 210 L 316 266 L 306 234 L 298 264 Z"
        fill="#064e3b"
      />

      {/* 'المشهرة برقم ٢٤٠٦' inside the circle below figures */}
      <text
        x="250"
        y="296"
        textAnchor="middle"
        fill="#111827"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="900"
        fontSize="23"
      >
        المشهرة برقم ٢٤٠٦
      </text>

      {/* Lower 3D Lime-Green Ribbon Wave ('بميت عزون') */}
      <path
        d="M 125 270
           C 52 310, 42 425, 148 442
           L 360 442
           C 395 442, 392 470, 365 482
           C 425 468, 435 390, 365 376
           L 150 376
           C 95 372, 95 305, 125 270 Z"
        fill={`url(#${greenRibbonId})`}
      />

      {/* Upper 3D Navy-Blue Ribbon Wave ('جمعية تنمية المجتمع المحلي') */}
      <path
        d="M 125 270
           C 82 315, 86 382, 165 380
           L 355 372
           C 430 370, 435 445, 365 482
           C 462 455, 475 340, 378 310
           C 305 295, 215 322, 145 318
           C 118 315, 118 290, 125 270 Z"
        fill={`url(#${navyRibbonId})`}
      />

      {/* White Arabic Text on Navy Ribbon */}
      <text
        x="280"
        y="356"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="900"
        fontSize="31"
      >
        جمعية تنمية المجتمع المحلي
      </text>

      {/* White Arabic Text on Green Ribbon */}
      <text
        x="245"
        y="422"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Cairo', 'Tajawal', sans-serif"
        fontWeight="900"
        fontSize="34"
      >
        بميت عزون
      </text>
    </svg>
  );
};
