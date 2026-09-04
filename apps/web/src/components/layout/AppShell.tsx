'use client';

import React, { useState } from 'react';
import { PropertyType } from '@propertyos/types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children:
    | React.ReactNode
    | ((props: {
        propertyType: PropertyType;
        setPropertyType: (t: PropertyType) => void;
      }) => React.ReactNode);
  activePath?: string;
  propertyName?: string;
  propertyType?: PropertyType;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activePath,
  propertyName,
  propertyType: propPropertyType,
}) => {
  const [internalPropertyType, setInternalPropertyType] = useState<PropertyType>(
    propPropertyType || PropertyType.PG
  );

  React.useEffect(() => {
    if (propPropertyType) {
      setInternalPropertyType(propPropertyType);
    }
  }, [propPropertyType]);

  const propertyType = propPropertyType || internalPropertyType;
  const setPropertyType = setInternalPropertyType;

  return (
    <div className="flex h-screen bg-surface-subtle overflow-hidden">
      {/* Dynamic Sidebar */}
      <Sidebar currentPropertyType={propertyType} activePath={activePath} />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPropertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          selectedPropertyName={
            propertyName ||
            (propertyType === PropertyType.PG
              ? 'GreenGlen PG Residency, HSR Layout'
              : 'Emerald Heights Apt #402, Indiranagar')
          }
        />

        <main className="flex-1 overflow-y-auto p-8">
          {typeof children === 'function'
            ? children({ propertyType, setPropertyType })
            : children}
        </main>
      </div>
    </div>
  );
};
