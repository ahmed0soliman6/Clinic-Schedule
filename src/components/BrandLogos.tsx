import React from 'react';
import {
  ASSOCIATION_LOGO_DATA_URL,
  COMPLEX_LOGO_DATA_URL,
} from '../assets/logoDataUrls';

interface LogoProps {
  className?: string;
  idSuffix?: string;
}

/**
 * High-resolution pixel-exact "مجمع ميت عزون الطبي" logo with transparent outer edges
 * and tight circular bounding box, preserving original Arabic typography and artwork untouched.
 */
export const ComplexBrandLogo: React.FC<LogoProps> = ({
  className = 'h-28 w-auto',
}) => {
  return (
    <img
      src={COMPLEX_LOGO_DATA_URL}
      alt="شعار مجمع ميت عزون الطبي"
      draggable={false}
      className={className}
    />
  );
};

/**
 * High-resolution pixel-exact "جمعية تنمية المجتمع المحلي بميت عزون - المشهرة برقم 2406" logo
 * with transparent outer edges and tight bounding box, preserving original Arabic typography and artwork untouched.
 */
export const AssociationBrandLogo: React.FC<LogoProps> = ({
  className = 'h-24 w-auto',
}) => {
  return (
    <img
      src={ASSOCIATION_LOGO_DATA_URL}
      alt="شعار جمعية تنمية المجتمع المحلي بميت عزون المشهرة برقم 2406"
      draggable={false}
      className={className}
    />
  );
};
