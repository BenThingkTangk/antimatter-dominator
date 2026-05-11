'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * DtomBrandShell
 *
 * Root theme wrapper for all ΔTOM brand system components.
 * - Sets data-dtom-theme attribute (dark default)
 * - Sets data-dtom-brand attribute
 * - Provides assetBasePath via context
 * - Applies dtom-shell CSS class (scoped base reset + font-smoothing)
 *
 * Place at the root layout of any ΔTOM application.
 *
 * @example
 * <DtomBrandShell assetBasePath="/dtom-assets" theme="dark">
 *   <App />
 * </DtomBrandShell>
 */

export interface DtomBrandContextValue {
  assetBasePath: string;
  theme: 'dark' | 'light';
}

const DtomBrandContext = createContext<DtomBrandContextValue>({
  assetBasePath: '/dtom-assets',
  theme: 'dark',
});

export function useDtomBrand(): DtomBrandContextValue {
  return useContext(DtomBrandContext);
}

export interface DtomBrandShellProps {
  children: ReactNode;
  /** Base path where /dtom-assets is served. Default: "/dtom-assets" */
  assetBasePath?: string;
  /** Color theme. Default: "dark" */
  theme?: 'dark' | 'light';
  /** Brand sub-identifier. Default: "atom" */
  brand?: 'atom' | 'antimatter' | 'nirmata';
  /** Additional CSS class names on the root wrapper */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export function DtomBrandShell({
  children,
  assetBasePath = '/dtom-assets',
  theme = 'dark',
  brand = 'atom',
  className = '',
  style,
}: DtomBrandShellProps): JSX.Element {
  return (
    <DtomBrandContext.Provider value={{ assetBasePath, theme }}>
      <div
        className={`dtom-shell ${className}`.trim()}
        data-dtom-theme={theme}
        data-dtom-brand={brand}
        style={style}
      >
        {children}
      </div>
    </DtomBrandContext.Provider>
  );
}

/** @deprecated Use DtomBrandShell */
export const DtomBrandProvider = DtomBrandShell;

export default DtomBrandShell;
