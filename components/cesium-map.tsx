"use client"

import { useEffect, useRef } from "react"
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as Cesium from "cesium";
export default function CesiumMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Dynamic import of Cesium modules
    const loadCesium = async () => {
      try {
        // Initialize Cesium ion with your access token
        Cesium.Ion.defaultAccessToken = "REMOVED" // In production, use environment variable
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
        })

        // Set initial camera position (San Francisco as example)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(-122.4175, 37.7749, 10000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0,
          },
        })

        // Add a sample 3D building tileset
        try {
          const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188) // San Francisco 3D buildings
          viewer.scene.primitives.add(tileset)

          // Add sample property markers
          addPropertyMarkers(Cesium, viewer)
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
    // Sample property locations (San Francisco)
    const properties = [
      { lon: -122.4194, lat: 37.7749, name: "Property #1", value: "$1,250,000" },
      { lon: -122.4284, lat: 37.7668, name: "Property #2", value: "$980,000" },
      { lon: -122.4104, lat: 37.7835, name: "Property #3", value: "$1,450,000" },
      { lon: -122.4374, lat: 37.7713, name: "Property #4", value: "$2,100,000" },
      { lon: -122.4014, lat: 37.7858, name: "Property #5", value: "$875,000" },
    ]

    // Create entity for each property
    // properties.forEach((property) => {
    //   viewer.entities.add({
    //     position: Cesium.Cartesian3.fromDegrees(property.lon, property.lat),
    //     billboard: {
    //       image: "/placeholder.svg?height=32&width=32", // Use a custom marker in production
    //       verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    //       scale: 0.5,
    //     },
    //     label: {
    //       text: property.name,
    //       font: "14px sans-serif",
    //       style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    //       outlineWidth: 2,
    //       verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    //       pixelOffset: new Cesium.Cartesian2(0, -36),
    //     },
    //     description: `
    //       <h2>${property.name}</h2>
    //       <p>Estimated Value: ${property.value}</p>
    //       <button onclick="window.location.href='/nft'">View NFT</button>
    //     `,
    //   })
    // })
  }

  return <div ref={cesiumContainerRef} className="w-full h-[600px]"></div>
}
