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
  HEIGHT_THRESHOLD: 2000, // meters
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
};

const COMMUNITIES = [
  {
    name: 'Mount Albert Community',
    color: 'DODGERBLUE',
    boundary: [
      174.7183, -36.8789,  // Start point
      174.7227, -36.8789,  // Northeast
      174.7227, -36.8842,  // Southeast
      174.7205, -36.8852,  // South
      174.7183, -36.8842,  // Southwest
      174.7183, -36.8789   // Back to start
    ]
  },
  {
    name: 'Mount Eden Community',
    color: 'RED',
    boundary: [
      174.7536, -36.8873,  // Start point
      174.7576, -36.8873,  // Northeast
      174.7576, -36.8893,  // Southeast
      174.7556, -36.8903,  // South
      174.7536, -36.8893,  // Southwest
      174.7536, -36.8873   // Back to start
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
    Math.abs(p.latitude / 1000000 - lat) < 0.0001 && 
    Math.abs(p.longitude / 1000000 - lng) < 0.0001
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
  
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [cesiumLoaded, setCesiumLoaded] = useState(true);
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

  // Generate property description HTML
  const generatePropertyDescription = useCallback((property: Property) => {
    const { lat, lng } = convertCoordinates(property);
    const hasNFT = property.id !== undefined;
    const buttonColor = hasNFT ? '#4CAF50' : '#2196F3';
    const buttonHoverColor = hasNFT ? '#388E3C' : '#1976D2';
    const buttonText = hasNFT ? 'View NFT' : 'Create NFT';
    const buttonLink = hasNFT ? `/nft/${property.id}` : '/submit';

    return `
      <div style="min-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px; font-weight: 500;">${property.address}</h3>
        <div style="margin-bottom: 10px; font-size: 14px; color: #444;">
          <p style="margin: 5px 0;"><strong>Owner:</strong> ${property.ownerName}</p>
          <p style="margin: 5px 0;"><strong>Type:</strong> ${property.propertyType}</p>
          <p style="margin: 5px 0;"><strong>Last Renovation:</strong> ${new Date(property.renovationDate * 1000).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Estimated Value:</strong> $${formatPropertyValue(property.estimatedValue)}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${property.isVerified ? 'Verified' : 'Pending Verification'}</p>
          ${property.verificationVotes !== undefined ? `<p style="margin: 5px 0;"><strong>Verification Votes:</strong> ${property.verificationVotes}</p>` : ''}
          ${property.rejectionVotes !== undefined ? `<p style="margin: 5px 0;"><strong>Rejection Votes:</strong> ${property.rejectionVotes}</p>` : ''}
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
  }, []);

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
  }, [properties, isLoadingAddress]);

  // Add camera change handler
  const setupCameraChangeHandler = useCallback((viewer: any, Cesium: any) => {
    viewer.camera.changed.addEventListener(() => {
      const position = viewer.camera.position;
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const height = cartographic.height;

      // Hide/show property markers based on camera height
      viewer.entities.values.forEach((entity: any) => {
        if (entity.name?.includes('Community')) {
          // Always show community boundaries
          entity.show = true;
        } else {
          // Hide property markers when camera is too high
          entity.show = height < CAMERA_CONFIG.HEIGHT_THRESHOLD;
        }
      });
    });
  }, []);

  // Add community boundaries
  const addCommunityBoundaries = useCallback((viewer: any, Cesium: any) => {
    COMMUNITIES.forEach(community => {
      viewer.entities.add({
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
    });
  }, []);

  // Add property markers
  const addPropertyMarkers = useCallback((viewer: any, Cesium: any) => {
    // Clear existing entities
    entitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    entitiesRef.current = [];

    properties.forEach((property) => {
      const { lat, lng } = convertCoordinates(property);

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
        description: generatePropertyDescription(property),
      });

      entitiesRef.current.push(entity);

      // Add click handler for the entity
      viewer.screenSpaceEventHandler.setInputAction((click: any) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id === entity) {
          setPopup({
            position: { x: click.position.x, y: click.position.y },
            content: entity.description?.getValue() || '',
            streetViewPosition: { lat, lng }
          });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    });
  }, [properties, generatePropertyDescription]);

  // Setup building click handler
  const setupBuildingClickHandler = useCallback((viewer: any, Cesium: any) => {
    viewer.screenSpaceEventHandler.setInputAction(async (click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      
      if (Cesium.defined(pickedObject) && pickedObject instanceof Cesium.Cesium3DTileFeature) {
        try {
          const cartesian = viewer.scene.pickPosition(click.position);
          
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            // Get building properties
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
        } catch (error) {
          console.error('Error handling building click:', error);
        }
      } else {
        setPopup(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }, [generateBuildingDescription]);

  // Update OSM building style
  const updateOSMBuildingStyle = useCallback(async (Cesium: any) => {
    const osmBuildings = osmBuildingsRef.current;
    if (!osmBuildings) return;

    try {
      osmBuildings.style = new Cesium.Cesium3DTileStyle({
        defines: buildingStyleConfig.defines,
        color: { conditions: buildingStyleConfig.colorConditions }
      });
    } catch (error) {
      console.error('Error updating OSM building style:', error);
    }
  }, [buildingStyleConfig]);

  // Initialize Cesium
  useEffect(() => {
    if (!cesiumContainerRef.current) return;

    let viewer: any;
    
    const loadCesium = async () => {
      try {
        setError(null);
        
        // Check for required environment variables
        const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
        if (!cesiumToken) {
          throw new Error('Cesium access token not found. Please set NEXT_PUBLIC_CESIUM_TOKEN environment variable.');
        }

        // Dynamically import Cesium
        const Cesium = await import('cesium');
        
        // Initialize Cesium ion with your access token
        Cesium.Ion.defaultAccessToken = cesiumToken;
        
        // Set CESIUM_BASE_URL
        window.CESIUM_BASE_URL = '/static/cesium/';
        
        // Create the Cesium viewer
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
        });

        viewerRef.current = viewer;

        // Add OSM buildings
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        osmBuildingsRef.current = osmBuildings;
        viewer.scene.primitives.add(osmBuildings);

        // Setup camera change handler
        setupCameraChangeHandler(viewer, Cesium);

        // Add community boundaries
        addCommunityBoundaries(viewer, Cesium);

        // Add property markers
        addPropertyMarkers(viewer, Cesium);

        // Setup building click handler
        setupBuildingClickHandler(viewer, Cesium);

        // Update OSM building style
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

        setCesiumLoaded(true);
        
      } catch (error) {
        console.error("Error loading Cesium:", error);
        setError(error instanceof Error ? error.message : "Failed to load Cesium map");
      }
    };

    loadCesium();

    // Cleanup function
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      osmBuildingsRef.current = null;
      entitiesRef.current = [];
      setCesiumLoaded(false);
    };
  }, []); // Only run once on mount

  // Update property markers when properties change
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current) return;

    const updatePropertyMarkers = async () => {
      try {
        const Cesium = await import('cesium');
        addPropertyMarkers(viewerRef.current, Cesium);
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
        </div>
      </div>
    );
  }

  // if (!cesiumLoaded) {
  //   return (
  //     <div className="w-full h-[600px] flex items-center justify-center bg-muted">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>

  //         <p className="text-sm text-muted-foreground">Initializing Cesium...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={cesiumContainerRef} className="w-full h-[600px]" />
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