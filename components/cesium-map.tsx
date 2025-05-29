"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as Cesium from "cesium";
import { LoadScript, GoogleMap, StreetViewPanorama, Libraries } from '@react-google-maps/api';
import CustomPopup from "./CustomPopup";
const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

// Add Google Maps API types
declare global {
  interface Window {
    google: any;
  }
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
}



export default function CesiumMap({ properties }: { properties: Property[] }) {
  const cesiumContainerRef = useRef<HTMLDivElement>(null)
  const osmBuildingsRef = useRef<any>(null);
  const [popup, setPopup] = useState<{ position: { x: number; y: number }; content: string; streetViewPosition?: { lat: number; lng: number } } | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    let viewer: Cesium.Viewer;
    const loadCesium = async () => {
      try {
        // Initialize Cesium ion with your access token
        Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN as string
        // @ts-ignore
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
          infoBox: true, // Disable default InfoBox
        })

        // Add camera change listener
        viewer.camera.changed.addEventListener(() => {
          const position = viewer.camera.position;
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const longitude = Cesium.Math.toDegrees(cartographic.longitude);
          const latitude = Cesium.Math.toDegrees(cartographic.latitude);
          const height = cartographic.height;
          
          const heading = Cesium.Math.toDegrees(viewer.camera.heading);
          const pitch = Cesium.Math.toDegrees(viewer.camera.pitch);
          const roll = Cesium.Math.toDegrees(viewer.camera.roll);

          // Hide/show property markers based on camera height
          const heightThreshold = 2000; // meters
          viewer.entities.values.forEach(entity => {
            if (entity.name === 'Mount Albert Community' || entity.name === 'Mount Eden Community') {
              // Always show community boundaries
              entity.show = true;
            } else {
              // Hide property markers when camera is too high
              entity.show = height < heightThreshold;
            }
          });

          console.log('Camera Position:', {
            destination: `Cesium.Cartesian3.fromDegrees(${longitude.toFixed(6)}, ${latitude.toFixed(6)}, ${height.toFixed(6)})`,
            orientation: {
              heading: `Cesium.Math.toRadians(${heading.toFixed(6)})`,
              pitch: `Cesium.Math.toRadians(${pitch.toFixed(6)})`,
              roll: `Cesium.Math.toRadians(${roll.toFixed(6)})`
            }
          });
        });

        // Set up the geocoder
        const geocoder = viewer.geocoder;
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        osmBuildingsRef.current = osmBuildings;
        viewer.scene.primitives.add(osmBuildings);

        // Highlight OSM buildings with NFTs using distance-based color
        const nftProperties = properties.filter((p: Property) => p.id !== undefined);
        const defines: Record<string, string> = {};
        const colorConditions: [string, string][] = [];
        nftProperties.forEach((p, i) => {
          const lng = p.longitude / 1_000_000;
          const lat = p.latitude / 1_000_000;
          defines[`dist${i}`] = `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${lng}, ${lat}))`;
          colorConditions.push([`\${dist${i}} < 0.0001`, "color('#FFD600', 0.9)"]);
        });
        colorConditions.push(["true", "color('#ffffff', 0.8)"]);
        osmBuildings.style = new Cesium.Cesium3DTileStyle({
          defines,
          color: { conditions: colorConditions }
        });

        // Add property markers
        properties.forEach((property) => {
          // Convert latitude and longitude from contract format (multiplied by 1000000)
          const lat = property.latitude / 1000000;
          const lng = property.longitude / 1000000;

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
            description: `
              <div style="min-width: 250px;">
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px; font-weight: 500;">${property.address}</h3>
                <div style="margin-bottom: 10px; font-size: 14px; color: #444;">
                  <p style="margin: 5px 0;"><strong>Owner:</strong> ${property.ownerName}</p>
                  <p style="margin: 5px 0;"><strong>Type:</strong> ${property.propertyType}</p>
                  <p style="margin: 5px 0;"><strong>Last Renovation:</strong> ${new Date(property.renovationDate * 1000).toLocaleDateString()}</p>
                  <p style="margin: 5px 0;"><strong>Estimated Value:</strong> $${property.estimatedValue.toLocaleString()}</p>
                  <p style="margin: 5px 0;"><strong>Status:</strong> ${property.isVerified ? 'Verified' : 'Pending Verification'}</p>
                </div>
                <button 
                  onclick="window.location.href='${property.id !== undefined ? `/nft/${property.id}` : '/submit'}'"
                  style="
                    background-color: ${property.id !== undefined ? '#4CAF50' : '#2196F3'};
                    color: white;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-size: 14px;
                    transition: background-color 0.2s;
                  "
                  onmouseover="this.style.backgroundColor='${property.id !== undefined ? '#388E3C' : '#1976D2'}'"
                  onmouseout="this.style.backgroundColor='${property.id !== undefined ? '#4CAF50' : '#2196F3'}'"
                >
                  ${property.id !== undefined ? 'View NFT' : 'Create NFT'}
                </button>
              </div>
            `,
          });

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
              const buildingProperties: Record<string, any> = {};
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
                    buildingProperties[name] = value;
                  }
                } catch (e) {
                  console.error(`Error getting value for property ${name}:`, e);
                }
              });

              // Extract specific properties
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
                      onclick="window.location.href='${(() => {
                        // Check if there's a property at this location
                        const existingProperty = properties.find((p: Property) => 
                          Math.abs(p.latitude / 1000000 - latitude) < 0.0001 && 
                          Math.abs(p.longitude / 1000000 - longitude) < 0.0001
                        );
                        return existingProperty?.id !== undefined ? `/nft/${existingProperty.id}` : '/submit';
                      })()}'"
                      style="
                        background-color: ${(() => {
                          const existingProperty = properties.find((p: Property) => 
                            Math.abs(p.latitude / 1000000 - latitude) < 0.0001 && 
                            Math.abs(p.longitude / 1000000 - longitude) < 0.0001
                          );
                          return existingProperty?.id !== undefined ? '#4CAF50' : '#2196F3';
                        })()};
                        color: white;
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        width: 100%;
                        font-size: 14px;
                        transition: background-color 0.2s;
                      "
                      onmouseover="this.style.backgroundColor='${(() => {
                        const existingProperty = properties.find((p: Property) => 
                          Math.abs(p.latitude / 1000000 - latitude) < 0.0001 && 
                          Math.abs(p.longitude / 1000000 - longitude) < 0.0001
                        );
                        return existingProperty?.id !== undefined ? '#388E3C' : '#1976D2';
                      })()}'"
                      onmouseout="this.style.backgroundColor='${(() => {
                        const existingProperty = properties.find((p: Property) => 
                          Math.abs(p.latitude / 1000000 - latitude) < 0.0001 && 
                          Math.abs(p.longitude / 1000000 - longitude) < 0.0001
                        );
                        return existingProperty?.id !== undefined ? '#4CAF50' : '#2196F3';
                      })()}'"
                    >
                      ${(() => {
                        const existingProperty = properties.find((p: Property) => 
                          Math.abs(p.latitude / 1000000 - latitude) < 0.0001 && 
                          Math.abs(p.longitude / 1000000 - longitude) < 0.0001
                        );
                        return existingProperty?.id !== undefined ? 'View NFT' : 'Create NFT';
                      })()}
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
          destination: Cesium.Cartesian3.fromDegrees(174.760242, -36.892605, 348.458665),
          orientation: {
            heading: Cesium.Math.toRadians(324.680981),
            pitch: Cesium.Math.toRadians(-21.222449),
            roll: Cesium.Math.toRadians(359.999978),
          },
        });

        // Draw community boundary
        const communityBoundary = viewer.entities.add({
          name: 'Mount Albert Community',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              174.7183, -36.8789,  // Start point
              174.7227, -36.8789,  // Northeast
              174.7227, -36.8842,  // Southeast
              174.7205, -36.8852,  // South
              174.7183, -36.8842,  // Southwest
              174.7183, -36.8789   // Back to start
            ]),
            width: 3,
            material: Cesium.Color.DODGERBLUE,
            clampToGround: true
          },
          label: {
            text: 'Mount Albert Community',
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
          name: 'Mount Eden Community',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              174.7536, -36.8873,  // Start point
              174.7576, -36.8873,  // Northeast
              174.7576, -36.8893,  // Southeast
              174.7556, -36.8903,  // South
              174.7536, -36.8893,  // Southwest
              174.7536, -36.8873   // Back to start
            ]),
            width: 3,
            material: Cesium.Color.RED,
            clampToGround: true
          },
          label: {
            text: 'Mount Eden Community',
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

        // Cleanup function
        return () => {
          viewer.destroy()
        }
      } catch (error) {
        console.error("Error loading Cesium:", error)
      }
    }

    loadCesium()
  }, [properties])

  // Update OSM building style whenever properties change
  useEffect(() => {
    const osmBuildings = osmBuildingsRef.current;
    if (!osmBuildings) return;
    const nftProperties = properties.filter((p: Property) => p.id !== undefined);
    const defines: Record<string, string> = {};
    const colorConditions: [string, string][] = [];
    nftProperties.forEach((p, i) => {
      const lng = p.longitude / 1_000_000;
      const lat = p.latitude / 1_000_000;
      defines[`dist${i}`] = `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${lng}, ${lat}))`;
      colorConditions.push([`\${dist${i}} < 0.0001`, "color('#FFD600', 0.9)"]);
    });
    colorConditions.push(["true", "color('#ffffff', 0.8)"]);
    osmBuildings.style = new Cesium.Cesium3DTileStyle({
      defines,
      color: { conditions: colorConditions }
    });
  }, [properties]);

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
