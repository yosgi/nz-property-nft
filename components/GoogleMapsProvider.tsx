"use client"

import { LoadScript, Libraries } from '@react-google-maps/api';
import { createContext, useContext, useState, ReactNode } from 'react';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

interface GoogleMapsContextType {
  isLoaded: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false });

export const useGoogleMaps = () => useContext(GoogleMapsContext);

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}
      libraries={GOOGLE_MAPS_LIBRARIES}
      onLoad={() => setIsLoaded(true)}
      onError={(error) => console.error('Google Maps failed to load:', error)}
    >
      <GoogleMapsContext.Provider value={{ isLoaded }}>
        {children}
      </GoogleMapsContext.Provider>
    </LoadScript>
  );
}