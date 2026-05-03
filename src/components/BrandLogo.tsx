import React from 'react';
import logo from '../../logo.png';
import { cn } from '../lib/utils';

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export default function BrandLogo({ className, alt = 'Caminhos do Êxito' }: BrandLogoProps) {
  return <img src={logo} alt={alt} className={cn('block object-contain', className)} />;
}
