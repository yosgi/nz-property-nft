"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as Cesium from "cesium";
import { LoadScript, GoogleMap, StreetViewPanorama, Libraries } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

// Add Google Maps API types
declare global {
  interface Window {
    google: any;
  }
}

interface PopupProps {
  position: { x: number; y: number };
  content: string;
  onClose: () => void;
  streetViewPosition?: { lat: number; lng: number };
}

// Add reverse geocoding function
async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return '';
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return '';
  }
}

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
          onClick={onClose}
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


export default function CesiumMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<{ position: { x: number; y: number }; content: string; streetViewPosition?: { lat: number; lng: number } } | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    const loadCesium = async () => {
      try {
        // Initialize Cesium ion with your access token
        Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN as string
        // @ts-ignore
        window.CESIUM_BASE_URL = '/static/cesium/';
        // Create the Cesium viewer
        const viewer = new Cesium.Viewer(cesiumContainerRef.current!, {
          terrainProvider: await Cesium.createWorldTerrainAsync(),
          baseLayerPicker: true,
          geocoder: true,
          homeButton: true,
          navigationHelpButton: true,
          sceneModePicker: true,
          timeline: false,
          animation: false,
          infoBox: true, // Disable default InfoBox
        })

        // Set up the geocoder
        const geocoder = viewer.geocoder;
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);

        // Add click event handler for OSM buildings
        viewer.screenSpaceEventHandler.setInputAction(async (click: any) => {
          const pickedObject = viewer.scene.pick(click.position);
          
          if (Cesium.defined(pickedObject) && pickedObject instanceof Cesium.Cesium3DTileFeature) {
            const cartesian = viewer.scene.pickPosition(click.position);
            
            if (cartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
              const longitude = Cesium.Math.toDegrees(cartographic.longitude);
              const latitude = Cesium.Math.toDegrees(cartographic.latitude);
              
              // Get building properties
              const properties: Record<string, any> = {};
              const commonProperties = [
                'name',
                'cesium#estimatedHeight',
                'building',
                'opening_hours',
                'operator',
                'tourism',
                'wikidata',
                'ref',
                'access',
                'description',
                'height',
                'addr:street',
                'addr:housenumber',
                'addr:postcode',
                'addr:city',
                'addr:country',
                'addr:suburb',
                'addr:unit',
                'addr:floor',
                'addr:full'
              ];

              commonProperties.forEach(name => {
                try {
                  const value = pickedObject.getProperty(name);
                  if (value !== undefined) {
                    properties[name] = value;
                  }
                } catch (e) {
                  console.error(`Error getting value for property ${name}:`, e);
                }
              });

              // Extract specific properties
              const buildingName = properties['name'];
              const buildingHeight = properties['cesium#estimatedHeight'] || properties['height'];
              const buildingType = properties['building'];
              const buildingOperator = properties['operator'];
              const buildingTourism = properties['tourism'];
              const buildingOpeningHours = properties['opening_hours'];
              const buildingAccess = properties['access'];
              const buildingDescription = properties['description'];
              const buildingWikidata = properties['wikidata'];
              const buildingRef = properties['ref'];

              // Construct address string
              let addressString = '';
              const fullAddress = properties['addr:full'];
              if (fullAddress) {
                addressString = fullAddress;
              } else {
                const addressParts = [
                  properties['addr:unit'],
                  properties['addr:housenumber'],
                  properties['addr:street'],
                  properties['addr:suburb'],
                  properties['addr:city'],
                  properties['addr:postcode'],
                  properties['addr:country']
                ].filter(Boolean);
                addressString = addressParts.join(', ');
              }

              // If no address from OSM, try Google Maps reverse geocoding
              if (!addressString) {
                setIsLoadingAddress(true);
                try {
                  const googleAddress = await reverseGeocode(latitude, longitude);
                  if (googleAddress) {
                    addressString = googleAddress;
                  }
                } catch (error) {
                  console.error('Error getting address from Google Maps:', error);
                } finally {
                  setIsLoadingAddress(false);
                }
              }

              // Show popup with Street View
              setPopup({
                position: { x: 0, y: 0 },
                content: `
                  <div style="min-width: 250px;">
                    <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px; font-weight: 500;">${buildingName || 'Building Information'}</h3>
                    <div style="margin-bottom: 10px; font-size: 14px; color: #444;">
                      <p style="margin: 5px 0;"><strong>Location:</strong> ${longitude.toFixed(4)}°, ${latitude.toFixed(4)}°</p>
                      ${addressString ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${addressString}</p>` : ''}
                      ${isLoadingAddress ? `<p style="margin: 5px 0;"><em>Loading address...</em></p>` : ''}
                      ${buildingType ? `<p style="margin: 5px 0;"><strong>Type:</strong> ${buildingType}</p>` : ''}
                      ${buildingOperator ? `<p style="margin: 5px 0;"><strong>Operator:</strong> ${buildingOperator}</p>` : ''}
                      ${buildingTourism ? `<p style="margin: 5px 0;"><strong>Tourism Type:</strong> ${buildingTourism}</p>` : ''}
                      ${buildingHeight ? `<p style="margin: 5px 0;"><strong>Height:</strong> ${buildingHeight}m</p>` : ''}
                      ${buildingOpeningHours ? `<p style="margin: 5px 0;"><strong>Opening Hours:</strong> ${buildingOpeningHours}</p>` : ''}
                      ${buildingAccess ? `<p style="margin: 5px 0;"><strong>Access:</strong> ${buildingAccess}</p>` : ''}
                      ${buildingDescription ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${buildingDescription}</p>` : ''}
                      ${buildingWikidata ? `<p style="margin: 5px 0;"><strong>Wikidata:</strong> <a href="https://www.wikidata.org/wiki/${buildingWikidata}" target="_blank" style="color: #2196F3; text-decoration: none;">${buildingWikidata}</a></p>` : ''}
                      ${buildingRef ? `<p style="margin: 5px 0;"><strong>Reference:</strong> <a href="${buildingRef}" target="_blank" style="color: #2196F3; text-decoration: none;">Website</a></p>` : ''}
                    </div>
                    <button 
                      onclick="window.location.href='/nft'"
                      style="
                        background-color: #2196F3;
                        color: white;
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        width: 100%;
                        font-size: 14px;
                        transition: background-color 0.2s;
                      "
                      onmouseover="this.style.backgroundColor='#1976D2'"
                      onmouseout="this.style.backgroundColor='#2196F3'"
                    >
                      View NFT
                    </button>
                  </div>
                `,
                streetViewPosition: { lat: latitude, lng: longitude }
              });
            }
          } else {
            setPopup(null);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Set initial camera position (Auckland, New Zealand)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(174.76463275594858, -36.91720833422622, 4660.218001334374),
          orientation: {
            heading: Cesium.Math.toRadians(7.363795441494392),
            pitch: Cesium.Math.toRadians(-37.0006208771684),
            roll: Cesium.Math.toRadians(359.9968578532673),
          },
        });

        // Draw community boundary
        const communityBoundary = viewer.entities.add({
          name: 'Ponsonby Community',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              174.7383, -36.8489,  // Start point
              174.7423, -36.8479,  // Northeast
              174.7483, -36.8489,  // East
              174.7493, -36.8519,  // Southeast
              174.7483, -36.8549,  // South
              174.7453, -36.8589,  // Southwest
              174.7383, -36.8589,  // West
              174.7353, -36.8559,  // Northwest
              174.7343, -36.8529,  // North
              174.7363, -36.8499,  // North central
              174.7383, -36.8489   // Back to start
            ]),
            width: 3,
            material: Cesium.Color.DODGERBLUE,
            clampToGround: true
          },
          label: {
            text: 'Ponsonby Community',
            font: '16px sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            showBackground: true,
            backgroundColor: Cesium.Color.DODGERBLUE.withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(7, 5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });

        // Draw Parnell community boundary
        const parnellBoundary = viewer.entities.add({
          name: 'Parnell Community',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              174.7783, -36.8589,  // Start point
              174.7823, -36.8579,  // Northeast
              174.7883, -36.8589,  // East
              174.7893, -36.8619,  // Southeast
              174.7883, -36.8649,  // South
              174.7853, -36.8689,  // Southwest
              174.7783, -36.8689,  // West
              174.7753, -36.8659,  // Northwest
              174.7743, -36.8629,  // North
              174.7763, -36.8599,  // North central
              174.7783, -36.8589   // Back to start
            ]),
            width: 3,
            material: Cesium.Color.RED,
            clampToGround: true
          },
          label: {
            text: 'Parnell Community',
            font: '16px sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            showBackground: true,
            backgroundColor: Cesium.Color.RED.withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(7, 5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });

        // Add a sample 3D building tileset
        try {
          // const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188) // San Francisco 3D buildings
          // viewer.scene.primitives.add(tileset)

          // // Add sample property markers
          // addPropertyMarkers(Cesium, viewer)
        } catch (error) {
          console.error("Error loading 3D tileset:", error)
        }

        // Cleanup function
        return () => {
          viewer.destroy()
        }
      } catch (error) {
        console.error("Error loading Cesium:", error)
      }
    }

    loadCesium()
  }, [])

  // Function to add property markers
  const addPropertyMarkers = (Cesium: any, viewer: any) => {
    // Sample property locations (Auckland)
    const properties = [
      { lon: -174.7633, lat: 36.8509, name: "Auckland CBD", value: "$2,500,000" },
      { lon: -174.7683, lat: 36.8489, name: "Ponsonby", value: "$1,980,000" },
      { lon: -174.7583, lat: 36.8529, name: "Newmarket", value: "$1,750,000" },
      { lon: -174.7733, lat: 36.8469, name: "Grey Lynn", value: "$1,650,000" },
      { lon: -174.7533, lat: 36.8549, name: "Remuera", value: "$2,800,000" },
    ]

    // Create entity for each property
    properties.forEach((property) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(property.lon, property.lat),
        billboard: {
          image: "/placeholder.svg?height=32&width=32",
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.5,
        },
        label: {
          text: property.name,
          font: "14px sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -36),
        },
        description: `
          <h2>${property.name}</h2>
          <p>Estimated Value: ${property.value}</p>
          <button onclick="window.location.href='/nft'">View NFT</button>
        `,
      })
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={cesiumContainerRef} className="w-full h-[600px]"></div>
      {popup && (
        <CustomPopup
          position={popup.position}
          content={popup.content}
          onClose={() => setPopup(null)}
          streetViewPosition={popup.streetViewPosition}
        />
      )}
    </div>
  )
}
