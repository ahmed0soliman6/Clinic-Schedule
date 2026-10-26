import React from 'react';
import { ClinicIconId } from '../types/schedule';

interface ClinicIconProps {
  icon: ClinicIconId;
  color: string;
  size?: number;
  className?: string;
}

export const ClinicMedicalIcon: React.FC<ClinicIconProps> = ({
  icon,
  color,
  size = 28,
  className = '',
}) => {
  switch (icon) {
    case 'internal':
      // الباطنة — Stomach & Digestive Tract (معدة / بطن وجهاز هضمي)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          {/* Esophagus top entry */}
          <path
            d="M15.5 5V10.5C15.5 11.8 16.5 12.8 18 13"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {/* Stomach J-shaped anatomical body */}
          <path
            d="M15.5 9.8C11.2 10.5 7.8 14.5 8.2 20.2C8.6 25.8 12.8 29.5 18.5 29.2C24.2 28.9 28.2 24.8 28.2 19C28.2 14.2 25.2 11 21.4 11C19.3 11 18 12.4 18 14.4C18 16.8 20.4 18 20.4 20.4C20.4 22.2 18.9 23.4 16.8 23.4C14.8 23.4 13.5 22.3 12.5 24.5L10.8 30.5"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Digestive inner wave highlight */}
          <path
            d="M13 18.5C14.2 17.5 15.8 18.8 17 17.8"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'heart':
      // القلب — Cardiology Heart with ECG Pulse Line (قلب وتخطيط نبض)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M18 29.5C18 29.5 6.5 22.2 6.5 13.5C6.5 9.5 9.6 6.8 13.2 6.8C15.4 6.8 17.2 8 18 9.6C18.8 8 20.6 6.8 22.8 6.8C26.4 6.8 29.5 9.5 29.5 13.5C29.5 22.2 18 29.5 18 29.5Z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 17.5H14L16 13L19.2 21.8L21.4 17.5H26.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'tooth':
      // الأسنان — Gleaming Molar Tooth with Sparkle (ضرس لامع)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M11.5 7.5C8.5 7.5 7 10.5 7.5 14.5C8 18.5 9.8 22 10.5 26.8C11 29.5 12.8 30 13.8 27.8L16 21.5C16.6 20 19.4 20 20 21.5L22.2 27.8C23.2 30 25 29.5 25.5 26.8C26.2 22 28 18.5 28.5 14.5C29 10.5 27.5 7.5 24.5 7.5C22 7.5 20.2 9 18 9C15.8 9 14 7.5 11.5 7.5Z"
            stroke={color}
            strokeWidth="2.3"
            fill={color}
            fillOpacity="0.2"
            strokeLinejoin="round"
          />
          <path
            d="M13.5 12C15 13.2 17 13.5 19.5 12.5"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'bones':
      // العظام — Orthopedic Bone & Knee Joint (عظمة ومفصل)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M15 5.5V12C12.8 12.5 11.8 14.2 12.6 16C13.4 17.3 15.5 17.3 18 17.3C20.5 17.3 22.6 17.3 23.4 16C24.2 14.2 23.2 12.5 21 12V5.5"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 30.5V24C12.8 23.5 11.8 21.8 12.6 20C13.4 18.7 15.5 18.7 18 18.7C20.5 18.7 22.6 18.7 23.4 20C24.2 21.8 23.2 23.5 21 24V30.5"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 18H10.5M25.5 18H27"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'eye':
      // العيون — Eye with Iris, Pupil & Lashes (عين تفصيلية)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M4 18.5C7.2 12 12.2 9 18 9C23.8 9 28.8 12 32 18.5C28.8 25 23.8 28 18 28C12.2 28 7.2 25 4 18.5Z"
            fill={color}
            fillOpacity="0.14"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="18.5" r="5.2" fill={color} />
          <circle cx="19.6" cy="17" r="1.7" fill="#ffffff" />
          <path
            d="M18 6V8M12 7.2L13 9M24 7.2L23 9"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'baby':
      // الأطفال — Cute Smiling Baby Face (طفل رضيع مبتسم)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <circle
            cx="18"
            cy="19"
            r="10.2"
            fill={color}
            fillOpacity="0.16"
            stroke={color}
            strokeWidth="2.3"
          />
          <path
            d="M6.8 17.5C5.4 17.5 4.6 18.5 4.6 19.8C4.6 21 5.5 22 6.9 22"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M29.2 17.5C30.6 17.5 31.4 18.5 31.4 19.8C31.4 21 30.5 22 29.1 22"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M18 8.8C18 6.2 20.6 5.2 22 6.8C23 8 21.2 10.2 19 10.6"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="14.2" cy="18" r="1.6" fill={color} />
          <circle cx="21.8" cy="18" r="1.6" fill={color} />
          <path
            d="M14.5 22.8C15.6 24.4 16.8 25 18 25C19.2 25 20.4 24.4 21.5 22.8"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'gynecology':
      // النساء والتوليد — Maternal Womb / Uterus & Care Heart (رحم ورعاية الأمومة)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          {/* Uterus body & fallopian tubes */}
          <path
            d="M12.5 11.5C9.5 10.5 6.8 11.8 6.2 14.5C5.8 16.5 7.2 18.2 9 18.2C10.4 18.2 11.2 17 10.8 15.8M23.5 11.5C26.5 10.5 29.2 11.8 29.8 14.5C30.2 16.5 28.8 18.2 27 18.2C25.6 18.2 24.8 17 25.2 15.8"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M12 11.5H24C24.5 17.5 21.8 22.5 18 27.5C14.2 22.5 11.5 17.5 12 11.5Z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M18 27.5V31"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'dermatology':
      // الجلدية — Radiant Skin / Care Hand & Sparkles (الجلدية ونضارة البشرة)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          {/* Droplet of skin hydration */}
          <path
            d="M16.5 8.5C16.5 8.5 9.5 16.2 9.5 21.5C9.5 25.4 12.6 28.5 16.5 28.5C20.4 28.5 23.5 25.4 23.5 21.5C23.5 16.2 16.5 8.5 16.5 8.5Z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          {/* Sparkle star */}
          <path
            d="M25.5 7.5L26.6 10.8L30 12L26.6 13.2L25.5 16.5L24.4 13.2L21 12L24.4 10.8L25.5 7.5Z"
            fill={color}
          />
        </svg>
      );

    case 'ear':
      // الأنف والأذن — Anatomical Ear & Sound Waves (أذن وموجات صوتية)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M13 14.5C13 9.5 16.5 6.5 21 6.5C25.5 6.5 28.5 10 28.5 14.8C28.5 20.2 24.2 22.2 22.6 26C21.8 28.2 19.8 29.8 17.2 29.8C14.8 29.8 13.2 28 13.2 26"
            fill={color}
            fillOpacity="0.16"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M17 15C17 12.4 18.8 10.8 20.8 10.8C22.8 10.8 24.2 12.6 24.2 15C24.2 17.5 21.5 18.8 20 21"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M8.5 14C7.2 16.5 7.2 19.5 8.5 22"
            stroke={color}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'brain':
      // المخ والأعصاب — Two-Hemisphere Brain with Neural Folds (المخ والأعصاب)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M17.5 8.5C17.5 6.8 16 5.5 14 5.5C12 5.5 10.5 7 10.5 9C8 9.5 6.5 11.5 6.5 14C6.5 15.8 7.4 17.2 8.5 18C7.2 19 6.5 20.8 7 22.8C7.5 25 9.5 26.5 11.8 26.5C12.2 28.5 13.8 30 15.8 30C17 30 17.5 29 17.5 27.5V8.5Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 8.5C18.5 6.8 20 5.5 22 5.5C24 5.5 25.5 7 25.5 9C28 9.5 29.5 11.5 29.5 14C29.5 15.8 28.6 17.2 27.5 18C28.8 19 29.5 20.8 29 22.8C28.5 25 26.5 26.5 24.2 26.5C23.8 28.5 22.2 30 20.2 30C19 30 18.5 29 18.5 27.5V8.5Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'surgery':
      // الجراحة العامة — Surgical Shield & Precision Cross / Scalpel (الجراحة العامة)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M18 6.5L28 10.5V17.5C28 23.8 23.6 28.6 18 30.5C12.4 28.6 8 23.8 8 17.5V10.5L18 6.5Z"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M18 13V23M13 18H23"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'speech':
      // التخاطب — Speaking Profile Head with Voice Waves (التخاطب)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M17.5 6.5C11.8 6.5 7.8 10.5 7.8 16C7.8 19 9.2 21.6 11 23.4V29H20V25.5H22.8C24.6 25.5 26 24 26 22.2V19.5L28.2 17.6L26 14.8C25.5 10 22 6.5 17.5 6.5Z"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M29.5 14.5C30.8 16 30.8 18.5 29.5 20M32 12.5C34 15.2 34 19.2 32 22"
            stroke={color}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'nutrition':
      // التغذية العلاجية — Healthy Apple with Leaf & Heartbeat (التغذية العلاجية)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M18 11.5C15 10 11 10.8 9.2 14C7.2 17.6 8.5 24.5 12.2 28.2C14 30 16 29.8 18 28.8C20 29.8 22 30 23.8 28.2C27.5 24.5 28.8 17.6 26.8 14C25 10.8 21 10 18 11.5Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M18 11V6.5"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M18.5 8.5C20.5 5.8 24 5.5 24.5 8C23.5 10 20.5 10.2 18.5 8.5Z"
            fill={color}
          />
        </svg>
      );

    case 'physio':
      // العلاج الطبيعي — Active Spine & Rehabilitation Motion (العلاج الطبيعي)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <circle cx="18" cy="8.2" r="3.2" fill={color} />
          <path
            d="M9.5 15C13.5 13.2 22.5 13.2 26.5 15M18 12.5V22.5M18 22.5L12.5 29.8M18 22.5L23.5 29.8"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'chest':
      // الصدر — Detailed Lungs & Bronchial Tree (الرئتين والصدر)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M18 6V16M18 13L14 16.5M18 13L22 16.5"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M15.5 11C11 11 7 15.5 7 21.5C7 26.5 9.5 29 13 29C15.5 29 16.5 27 16.5 24V14.5C16.5 12.5 16 11 15.5 11Z"
            stroke={color}
            strokeWidth="2.3"
            fill={color}
            fillOpacity="0.22"
          />
          <path
            d="M20.5 11C25 11 29 15.5 29 21.5C29 26.5 26.5 29 23 29C20.5 29 19.5 27 19.5 24V14.5C19.5 12.5 20 11 20.5 11Z"
            stroke={color}
            strokeWidth="2.3"
            fill={color}
            fillOpacity="0.22"
          />
        </svg>
      );

    case 'kidney':
      // الكلى — Twin Kidneys with Renal Vessels (الكليتان)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M14.5 9C10 9 7 13 7 18C7 23 10 27 14.5 27C16.5 27 17.5 25 16.2 22.8C15 20.8 15 15.2 16.2 13.2C17.5 11 16.5 9 14.5 9Z"
            stroke={color}
            strokeWidth="2.3"
            fill={color}
            fillOpacity="0.22"
          />
          <path
            d="M21.5 9C26 9 29 13 29 18C29 23 26 27 21.5 27C19.5 27 18.5 25 19.8 22.8C21 20.8 21 15.2 19.8 13.2C18.5 11 19.5 9 21.5 9Z"
            stroke={color}
            strokeWidth="2.3"
            fill={color}
            fillOpacity="0.22"
          />
          <path
            d="M16 18H20M18 15V28"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'urology':
      // المسالك — Kidneys, Ureters & Bladder Tract (المسالك البولية)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M11 8.5C8.5 8.5 7 11 7 14C7 17 8.5 19.5 11 19.5C12.5 19.5 13 18 12.2 16.5V11.5C13 10 12.5 8.5 11 8.5Z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.2"
          />
          <path
            d="M25 8.5C27.5 8.5 29 11 29 14C29 17 27.5 19.5 25 19.5C23.5 19.5 23 18 23.8 16.5V11.5C23 10 23.5 8.5 25 8.5Z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="2.2"
          />
          <path
            d="M12 16L15.5 23.5M24 16L20.5 23.5"
            stroke={color}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M13.5 23.5H22.5C23 26.8 21 29.5 18 30.8C15 29.5 13 26.8 13.5 23.5Z"
            fill={color}
            fillOpacity="0.25"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'psych':
      // النفسية — Peaceful Mind Silhouette with Lotus Leaf (النفسية)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <circle
            cx="18"
            cy="18"
            r="10.5"
            fill={color}
            fillOpacity="0.16"
            stroke={color}
            strokeWidth="2.3"
          />
          <circle cx="14.2" cy="16.2" r="1.6" fill={color} />
          <circle cx="21.8" cy="16.2" r="1.6" fill={color} />
          <path
            d="M13.5 21.8C14.8 23.8 16.3 24.5 18 24.5C19.7 24.5 21.2 23.8 22.5 21.8"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'stethoscope':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.1" />
          <path
            d="M10 7V15C10 19.4 13.6 23 18 23C22.4 23 26 19.4 26 15V7"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M18 23V27.5C18 29.8 20 31.5 22.5 31.5C25 31.5 27 29.8 27 27.5V23.5"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="27" cy="21" r="2.8" fill={color} />
        </svg>
      );
  }
};

export const StethoscopeHeaderIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M8 5V12.5C8 16.6 11.1 20 15 20C18.9 20 22 16.6 22 12.5V5"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M6 5H10M20 5H24"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M15 20V24.5C15 26.7 16.8 28.5 19 28.5C21.2 28.5 23 26.7 23 24.5V19"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="23" cy="16.5" r="2.6" stroke="white" strokeWidth="2.2" fill="none" />
  </svg>
);

export const DoctorHeaderIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="9.5" r="5" fill="white" />
    <path
      d="M7.5 26.5C7.5 21.5 11.2 18 16 18C20.8 18 24.5 21.5 24.5 26.5V28H7.5V26.5Z"
      fill="white"
    />
    <path
      d="M14 19.5L16 23.5L18 19.5"
      stroke="#059669"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ClockHeaderIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="11" stroke="white" strokeWidth="2.6" />
    <path
      d="M16 10V16.5L20 19"
      stroke="white"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CalendarBadgeIcon: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="white" stroke="#6d28d9" strokeWidth="2.5" />
    <rect x="13" y="14" width="22" height="20" rx="3" stroke="#5b21b6" strokeWidth="2.2" fill="#f5f3ff" />
    <path d="M13 20H35" stroke="#5b21b6" strokeWidth="2.2" />
    <path d="M18 11V15M30 11V15" stroke="#5b21b6" strokeWidth="2.4" strokeLinecap="round" />
    <rect x="17" y="23" width="3" height="3" rx="0.5" fill="#5b21b6" />
    <rect x="22.5" y="23" width="3" height="3" rx="0.5" fill="#5b21b6" />
    <rect x="28" y="23" width="3" height="3" rx="0.5" fill="#5b21b6" />
    <rect x="17" y="28" width="3" height="3" rx="0.5" fill="#5b21b6" />
    <rect x="22.5" y="28" width="3" height="3" rx="0.5" fill="#5b21b6" />
    <rect x="28" y="28" width="3" height="3" rx="0.5" fill="#5b21b6" />
  </svg>
);
