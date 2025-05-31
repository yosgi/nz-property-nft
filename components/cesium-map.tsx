"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import CustomPopup from "./CustomPopup";

// Add Google Maps API types
declare global {
  interface Window {
    google: any;
    CESIUM_BASE_URL: string;
  }
}

interface Property {
  id?: number;
  address: string;
  ownerName: string;
  propertyType: string;
  renovationDate: number;
  imageURI: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
  estimatedValue: number;
  currentOwner?: string;
  verificationVotes?: number;
  rejectionVotes?: number;
}

interface PopupState {
  position: { x: number; y: number };
  content: string;
  streetViewPosition?: { lat: number; lng: number };
}

// Constants
const CAMERA_CONFIG = {
  INITIAL_POSITION: {
    destination: [174.760242, -36.892605, 348.458665] as const,
    orientation: {
      heading: 324.680981,
      pitch: -21.222449,
      roll: 359.999978,
    }
  },
  HEIGHT_THRESHOLD: 2000,
  AUTO_REFRESH_INTERVAL: 30000,
};

const COMMUNITIES = [
  {
    name: 'Mount Albert Community',
    color: 'DODGERBLUE',
    boundary: [
      174.7183, -36.8789,
      174.7227, -36.8789,
      174.7227, -36.8842,
      174.7205, -36.8852,
      174.7183, -36.8842,
      174.7183, -36.8789
    ]
  },
  {
    name: 'Mount Eden Community',
    color: 'RED',
    boundary: [
      174.7536, -36.8873,
      174.7576, -36.8873,
      174.7576, -36.8893,
      174.7556, -36.8903,
      174.7536, -36.8893,
      174.7536, -36.8873
    ]
  }
];

// Utility functions
const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('Google Maps API key not found');
    return '';
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return '';
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return '';
  }
};

const convertCoordinates = (property: Property) => ({
  lat: property.latitude / 1000000,
  lng: property.longitude / 1000000,
});

const findPropertyAtLocation = (properties: Property[], lat: number, lng: number) => {
  return properties.find((p: Property) => 
    Math.abs(p.latitude / 1000000 - lat) < 0.0005 && 
    Math.abs(p.longitude / 1000000 - lng) < 0.0005
  );
};

const formatPropertyValue = (value: number): string => {
  return value.toLocaleString();
};

export default function CesiumMap({ properties }: { properties: Property[] }) {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osmBuildingsRef = useRef<any>(null);
  const entitiesRef = useRef<any[]>([]);
  const cesiumRef = useRef<any>(null);
  const initializingRef = useRef<boolean>(false);
  
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Memoized values
  const nftProperties = useMemo(() => 
    properties.filter((p: Property) => p.id !== undefined), 
    [properties]
  );

  const buildingStyleConfig = useMemo(() => {
    const defines: Record<string, string> = {};
    const colorConditions: [string, string][] = [];
    
    nftProperties.forEach((p, i) => {
      const { lat, lng } = convertCoordinates(p);
      defines[`dist${i}`] = `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${lng}, ${lat}))`;
      colorConditions.push([`\${dist${i}} < 0.0001`, "color('#FFD600', 0.9)"]);
    });
    
    colorConditions.push(["true", "color('#ffffff', 0.8)"]);
    
    return { defines, colorConditions };
  }, [nftProperties]);


  // Generate building popup content
  const generateBuildingDescription = useCallback(async (
    buildingProperties: Record<string, any>,
    latitude: number,
    longitude: number
  ) => {
    const buildingName = buildingProperties['name'];
    const buildingHeight = buildingProperties['cesium#estimatedHeight'] || buildingProperties['height'];
    const buildingType = buildingProperties['building'];
    const buildingOperator = buildingProperties['operator'];
    const buildingTourism = buildingProperties['tourism'];
    const buildingOpeningHours = buildingProperties['opening_hours'];
    const buildingAccess = buildingProperties['access'];
    const buildingDescription = buildingProperties['description'];
    const buildingWikidata = buildingProperties['wikidata'];
    const buildingRef = buildingProperties['ref'];

    // Construct address string
    let addressString = '';
    const fullAddress = buildingProperties['addr:full'];
    if (fullAddress) {
      addressString = fullAddress;
    } else {
      const addressParts = [
        buildingProperties['addr:unit'],
        buildingProperties['addr:housenumber'],
        buildingProperties['addr:street'],
        buildingProperties['addr:suburb'],
        buildingProperties['addr:city'],
        buildingProperties['addr:postcode'],
        buildingProperties['addr:country']
      ].filter(Boolean);
      addressString = addressParts.join(', ');
    }

    // Try Google Maps reverse geocoding if no address from OSM
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

    const existingProperty = findPropertyAtLocation(properties, latitude, longitude);
    const hasNFT = existingProperty?.id !== undefined;
    const buttonColor = hasNFT ? '#4CAF50' : '#2196F3';
    const buttonHoverColor = hasNFT ? '#388E3C' : '#1976D2';
    const buttonText = hasNFT ? 'View NFT' : 'Create NFT';
    const buttonLink = hasNFT ? `/nft/${existingProperty.id}` : '/submit';

    return `
      <div style="min-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px; font-weight: 500;">${buildingName || 'Building Information'}</h3>
        <div style="margin-bottom: 10px; font-size: 14px; color: #444;">
          <p style="margin: 5px 0;"><strong>Location:</strong> ${longitude.toFixed(4)}°, ${latitude.toFixed(4)}°</p>
          ${addressString ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${addressString}</p>` : ''}
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
          onclick="window.location.href='${buttonLink}'"
          style="
            background-color: ${buttonColor};
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            font-size: 14px;
            transition: background-color 0.2s;
          "
          onmouseover="this.style.backgroundColor='${buttonHoverColor}'"
          onmouseout="this.style.backgroundColor='${buttonColor}'"
        >
          ${buttonText}
        </button>
      </div>
    `;
  }, [properties]);

  // Clear all entities efficiently
  const clearEntities = useCallback((viewer: any) => {
    if (!viewer || viewer.isDestroyed()) return;
    
    try {
      // Remove entities in batches to avoid blocking the main thread
      const batchSize = 50;
      const entities = [...entitiesRef.current];
      
      const removeBatch = (startIndex: number) => {
        const endIndex = Math.min(startIndex + batchSize, entities.length);
        
        for (let i = startIndex; i < endIndex; i++) {
          try {
            if (entities[i] && viewer.entities.contains(entities[i])) {
              viewer.entities.remove(entities[i]);
            }
          } catch (error) {
            console.warn('Error removing entity:', error);
          }
        }
        
        if (endIndex < entities.length) {
          // Use requestAnimationFrame to avoid blocking
          requestAnimationFrame(() => removeBatch(endIndex));
        }
      };
      
      if (entities.length > 0) {
        removeBatch(0);
      }
      
      entitiesRef.current = [];
    } catch (error) {
      console.error('Error clearing entities:', error);
      entitiesRef.current = [];
    }
  }, []);

  // Add camera change handler with throttling
  const setupCameraChangeHandler = useCallback((viewer: any, Cesium: any) => {
    let isThrottled = false;
    
    viewer.camera.changed.addEventListener(() => {
      if (isThrottled) return;
      
      isThrottled = true;
      
      // Throttle camera change events
      setTimeout(() => {
        try {
          const position = viewer.camera.position;
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const height = cartographic.height;

          // Hide/show property markers based on camera height
          viewer.entities.values.forEach((entity: any) => {
            if (entity.name?.includes('Community')) {
              entity.show = true;
            } else {
              entity.show = height < CAMERA_CONFIG.HEIGHT_THRESHOLD;
            }
          });
        } catch (error) {
          console.warn('Error in camera change handler:', error);
        }
        
        isThrottled = false;
      }, 100); // Throttle to 10fps
    });
  }, []);

  // Add community boundaries
  const addCommunityBoundaries = useCallback((viewer: any, Cesium: any) => {
    if (!viewer || viewer.isDestroyed()) return;
    
    try {
      COMMUNITIES.forEach(community => {
        const entity = viewer.entities.add({
          name: community.name,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(community.boundary),
            width: 3,
            material: Cesium.Color[community.color as keyof typeof Cesium.Color],
            clampToGround: true
          },
          label: {
            text: community.name,
            font: '16px sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            showBackground: true,
            backgroundColor: Cesium.Color[community.color as keyof typeof Cesium.Color].withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(7, 5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        entitiesRef.current.push(entity);
      });
    } catch (error) {
      console.error('Error adding community boundaries:', error);
    }
  }, []);

  // Add property markers with improved error handling
  const addPropertyMarkers = useCallback((viewer: any, Cesium: any) => {
    if (!viewer || viewer.isDestroyed()) return;
    
    try {
      // Clear existing property entities (but keep community boundaries)
      const propertyEntities = entitiesRef.current.filter(entity => 
        !entity.name?.includes('Community')
      );
      
      propertyEntities.forEach(entity => {
        try {
          if (viewer.entities.contains(entity)) {
            viewer.entities.remove(entity);
          }
        } catch (error) {
          console.warn('Error removing property entity:', error);
        }
      });
      
      // Keep only community entities
      entitiesRef.current = entitiesRef.current.filter(entity => 
        entity.name?.includes('Community')
      );

      // Add property markers
      properties.forEach((property) => {
        try {
          const { lat, lng } = convertCoordinates(property);
          
          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            return;
          }
          
          const entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            billboard: {
              image: property.isVerified ? "/verified-property.svg" : "/property.svg",
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: 0.5,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            label: {
              text: property.address,
              font: "14px sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -36),
              fillColor: property.isVerified ? Cesium.Color.GREEN : Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              showBackground: true,
              backgroundColor: property.isVerified ? Cesium.Color.GREEN.withAlpha(0.7) : Cesium.Color.BLUE.withAlpha(0.7),
              backgroundPadding: new Cesium.Cartesian2(7, 5),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
          entitiesRef.current.push(entity);
        } catch (error) {
          console.warn('Error adding property marker:', error);
        }
      });
      viewer.scene.requestRender();
    } catch (error) {
      console.error('Error adding property markers:', error);
    }
  }, [properties]);

  // Setup building click handler with improved error handling
  const setupBuildingClickHandler = useCallback((viewer: any, Cesium: any) => {
    if (!viewer || viewer.isDestroyed()) return;
    
    try {
      viewer.screenSpaceEventHandler.setInputAction(async (click: any) => {
        try {
          const pickedObject = viewer.scene.pick(click.position);
          
          if (Cesium.defined(pickedObject) && pickedObject instanceof Cesium.Cesium3DTileFeature) {
            const cartesian = viewer.scene.pickPosition(click.position);
            
            if (cartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
              const longitude = Cesium.Math.toDegrees(cartographic.longitude);
              const latitude = Cesium.Math.toDegrees(cartographic.latitude);
              
              // Get building properties safely
              const buildingProperties: Record<string, any> = {};
              const commonProperties = [
                'name', 'cesium#estimatedHeight', 'building', 'opening_hours', 'operator',
                'tourism', 'wikidata', 'ref', 'access', 'description', 'height',
                'addr:street', 'addr:housenumber', 'addr:postcode', 'addr:city',
                'addr:country', 'addr:suburb', 'addr:unit', 'addr:floor', 'addr:full'
              ];

              commonProperties.forEach(name => {
                try {
                  const value = pickedObject.getProperty(name);
                  if (value !== undefined) {
                    buildingProperties[name] = value;
                  }
                } catch (e) {
                  // Silently ignore property access errors
                }
              });

              const content = await generateBuildingDescription(buildingProperties, latitude, longitude);
              
              setPopup({
                position: { x: 0, y: 0 },
                content,
                streetViewPosition: { lat: latitude, lng: longitude }
              });
            }
          } else {
            setPopup(null);
          }
        } catch (error) {
          console.warn('Error handling building click:', error);
          setPopup(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } catch (error) {
      console.error('Error setting up building click handler:', error);
    }
  }, [generateBuildingDescription]);

  // Update OSM building style with error handling
  const updateOSMBuildingStyle = useCallback(async (Cesium: any) => {
    try {
      const osmBuildings = osmBuildingsRef.current;
      if (!osmBuildings) return;

      osmBuildings.style = new Cesium.Cesium3DTileStyle({
        defines: buildingStyleConfig.defines,
        color: { conditions: buildingStyleConfig.colorConditions }
      });
    } catch (error) {
      console.warn('Error updating OSM building style:', error);
    }
  }, [buildingStyleConfig]);

  // Initialize Cesium with improved error handling and cleanup
  useEffect(() => {
    if (!cesiumContainerRef.current || initializingRef.current) return;

    let viewer: any;
   
    
    const loadCesium = async () => {

      try {
        initializingRef.current = true;
        setError(null);
        
        // Check for required environment variables
        const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
        if (!cesiumToken) {
          throw new Error('Cesium access token not found. Please set NEXT_PUBLIC_CESIUM_TOKEN environment variable.');
        }

        // Dynamically import Cesium
        const Cesium = await import('cesium');

        
        cesiumRef.current = Cesium;
        
        // Initialize Cesium ion with your access token
        Cesium.Ion.defaultAccessToken = cesiumToken;
        
        // Set CESIUM_BASE_URL
        window.CESIUM_BASE_URL = '/static/cesium/';
        
        // Create the Cesium viewer with optimized settings
        viewer = new Cesium.Viewer(cesiumContainerRef.current!, {
          terrainProvider: await Cesium.createWorldTerrainAsync(),
          baseLayerPicker: true,
          geocoder: true,
          homeButton: true,
          navigationHelpButton: true,
          sceneModePicker: true,
          timeline: false,
          animation: false,
          infoBox: true,
          // Performance optimizations
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          contextOptions: {
            requestWebgl1: true, // Force WebGL 1
            webgl: {
              alpha: false,
              depth: true,
              stencil: false,
              antialias: true,
              powerPreference: "high-performance"
            }
          }
        });

  

        viewerRef.current = viewer;

        // Wait for globe to load
        await new Promise<void>((resolve) => {
          if (viewer.scene.globe.tilesLoaded) {
            resolve();
          } else {
            const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((queuedTileCount: number) => {
              if (queuedTileCount === 0) {
                removeListener();
                resolve();
              }
            });
          }
        });

   

        // Add OSM buildings with error handling
        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync(
            {
              enableShowOutline: false,
            }
          );
          if ( !viewer.isDestroyed()) {
            osmBuildings.maximumScreenSpaceError = 8; // Higher = less detail
            osmBuildings.skipLevelOfDetail = true;
            osmBuildingsRef.current = osmBuildings;
            viewer.scene.primitives.add(osmBuildings);
          }
        } catch (error) {
          console.warn('OSM buildings failed to load:', error);
        }

        if ( viewer.isDestroyed()) return;

        // Setup handlers and add content
        setupCameraChangeHandler(viewer, Cesium);
        addCommunityBoundaries(viewer, Cesium);
        addPropertyMarkers(viewer, Cesium);
        setupBuildingClickHandler(viewer, Cesium);
        await updateOSMBuildingStyle(Cesium);

        // Set initial camera position
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(...CAMERA_CONFIG.INITIAL_POSITION.destination),
          orientation: {
            heading: Cesium.Math.toRadians(CAMERA_CONFIG.INITIAL_POSITION.orientation.heading),
            pitch: Cesium.Math.toRadians(CAMERA_CONFIG.INITIAL_POSITION.orientation.pitch),
            roll: Cesium.Math.toRadians(CAMERA_CONFIG.INITIAL_POSITION.orientation.roll),
          },
        });

    
        
      } catch (error) {
        console.error("Error loading Cesium:", error);
   
      } finally {
        initializingRef.current = false;
        setCesiumLoaded(true);
      }
    };

    loadCesium();

    // Cleanup function
    return () => {

      
      if (viewer && !viewer.isDestroyed()) {
        try {
          // Clear entities before destroying viewer
          clearEntities(viewer);
          viewer.destroy();
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
      
      viewerRef.current = null;
      osmBuildingsRef.current = null;
      entitiesRef.current = [];
      cesiumRef.current = null;
      setCesiumLoaded(false);
    };
  }, []); 

  // Update property markers when properties change
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;

    const updatePropertyMarkers = async () => {
      try {
        const viewer = viewerRef.current;
        const Cesium = cesiumRef.current;
        
        if (viewer.isDestroyed()) return;
        
        addPropertyMarkers(viewer, Cesium);
        await updateOSMBuildingStyle(Cesium);
      } catch (error) {
        console.error('Error updating property markers:', error);
      }
    };

    updatePropertyMarkers();
  }, [properties, cesiumLoaded, addPropertyMarkers, updateOSMBuildingStyle]);

  // Handle loading and error states
  if (error) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-red-50 border border-red-200 rounded">
        <div className="text-center">
          <p className="text-red-700 mb-2">Failed to load 3D map</p>
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={cesiumContainerRef} className="w-full h-[600px]" />
      {!cesiumLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Loading 3D map...</p>
          </div>
        </div>
      )}
      {popup && (
        <CustomPopup
          position={popup.position}
          content={popup.content}
          onClose={() => setPopup(null)}
          streetViewPosition={popup.streetViewPosition}
        />
      )}
    </div>
  );
}