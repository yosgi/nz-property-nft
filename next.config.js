/** @type {import('next').NextConfig} */
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const nextConfig = {
  // Enable ESLint and TypeScript checks in production
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  // Only disable image optimization if specifically needed
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      try {
        config.plugins.push(
          new CopyWebpackPlugin({
            patterns: [
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Assets'),
                to: path.join(__dirname, 'public/static/cesium/Assets'),
                noErrorOnMissing: true,
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/ThirdParty'),
                to: path.join(__dirname, 'public/static/cesium/ThirdParty'),
                noErrorOnMissing: true,
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Workers'),
                to: path.join(__dirname, 'public/static/cesium/Workers'),
                noErrorOnMissing: true,
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
                to: path.join(__dirname, 'public/static/cesium/Widgets'),
                noErrorOnMissing: true,
              }
            ]
          })
        );
      } catch (error) {
        console.error('Error configuring Cesium webpack plugin:', error);
      }
    }
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'build/contracts'),
            to: path.join(__dirname, 'public/contracts'),
          },
        ],
      })
    );
    return config;
  },
};

module.exports = nextConfig;
