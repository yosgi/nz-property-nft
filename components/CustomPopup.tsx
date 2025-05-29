import { useEffect, useRef, useState, useCallback } from "react"
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as Cesium from "cesium";
import { LoadScript, GoogleMap, StreetViewPanorama, Libraries } from '@react-google-maps/api';
interface PopupProps {
    position: { x: number; y: number };
    content: string;
    onClose: () => void;
    streetViewPosition?: { lat: number; lng: number };
  }
const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

function CustomPopup({ position, content, onClose, streetViewPosition }: PopupProps) {
    const mapContainerStyle = {
      height: '200px',
      width: '100%',
    };
    const streetViewRef = useRef<HTMLDivElement>(null);
    const [panorama, setPanorama] = useState<google.maps.StreetViewPanorama | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isApiLoaded, setIsApiLoaded] = useState(false);
  
    const initializeStreetView = useCallback(() => {
      if (streetViewPosition && streetViewRef.current && isApiLoaded) {
        setIsLoading(true);
        setError(null);
        
        try {
          const newPanorama = new google.maps.StreetViewPanorama(
            streetViewRef.current,
            {
              position: streetViewPosition,
              pov: {
                heading: 210,
                pitch: 10,
              },
              addressControl: false,
              showRoadLabels: false,
              zoomControl: false,
              fullscreenControl: false,
              scrollwheel: false,
              panControl: false,
              motionTracking: false,
              motionTrackingControl: false,
              enableCloseButton: false,
            }
          );
  
          newPanorama.addListener('status_changed', () => {
            if (newPanorama.getStatus() === google.maps.StreetViewStatus.OK) {
              setIsLoading(false);
            } else {
              setError('No street view available at this location');
              setIsLoading(false);
            }
          });
  
          setPanorama(newPanorama);
        } catch (err) {
          setError('Failed to load street view');
          setIsLoading(false);
        }
      }
    }, [streetViewPosition, isApiLoaded]);
  
    useEffect(() => {
      initializeStreetView();
    }, [initializeStreetView]);
  
    // Cleanup function to destroy the panorama instance
    useEffect(() => {
      return () => {
        if (panorama) {
          panorama.setVisible(false);
          setPanorama(null);
        }
      };
    }, [panorama]);
  
    const handleClose = () => {
      if (panorama) {
        panorama.setVisible(false);
        setPanorama(null);
      }
      onClose();
    };
  
    return (
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}
        libraries={GOOGLE_MAPS_LIBRARIES}
        onLoad={() => setIsApiLoaded(true)}
      >
        <div
          style={{
            position: 'absolute',
            right: '20px',
            top: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 1000,
            maxWidth: '300px',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: content }} />
          {streetViewPosition && (
            <div 
              ref={streetViewRef}
              style={{ 
                marginTop: '15px', 
                borderRadius: '8px', 
                overflow: 'hidden',
                height: '200px',
                width: '100%',
                position: 'relative'
              }}
            >
              {isLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  zIndex: 1
                }}>
                  Loading street view...
                </div>
              )}
              {error && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: '#666',
                  zIndex: 1
                }}>
                  {error}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '16px',
              padding: '4px',
              lineHeight: '1',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>
      </LoadScript>
    );
  }

  export default CustomPopup;