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
        })

        // Set up the geocoder
        const geocoder = viewer.geocoder;
        // geocoder.viewModel.searchText = "Auckland, New Zealand";
        // (geocoder.viewModel as any).search();
        const osmBuildings= await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);

        // Set initial camera position (Auckland, New Zealand)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(174.76463275594858, -36.91720833422622, 4660.218001334374),
          orientation: {
            heading: Cesium.Math.toRadians(7.363795441494392),
            pitch: Cesium.Math.toRadians(-37.0006208771684),
            roll: Cesium.Math.toRadians(359.9968578532673),
          },
        })

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

  return <div ref={cesiumContainerRef} className="w-full h-[600px]"></div>
}
