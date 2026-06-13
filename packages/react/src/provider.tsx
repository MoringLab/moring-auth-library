import React, { createContext } from 'react';

export interface MoringAuthContextType {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
}

export const MoringAuthContext = createContext<MoringAuthContextType | null>(null);

export interface MoringAuthProviderProps {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  children: React.ReactNode;
}

export const MoringAuthProvider: React.FC<MoringAuthProviderProps> = ({
  issuer,
  clientId,
  redirectUri,
  scope,
  children,
}) => {
  return (
    <MoringAuthContext.Provider value={{ issuer, clientId, redirectUri, scope }}>
      {children}
    </MoringAuthContext.Provider>
  );
};
