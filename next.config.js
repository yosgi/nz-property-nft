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
                info: { minimized: true }
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/ThirdParty'),
                to: path.join(__dirname, 'public/static/cesium/ThirdParty'),
                noErrorOnMissing: true,
                info: { minimized: true }
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Workers'),
                to: path.join(__dirname, 'public/static/cesium/Workers'),
                noErrorOnMissing: true,
                info: { minimized: true }
              },
              {
                from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
                to: path.join(__dirname, 'public/static/cesium/Widgets'),
                noErrorOnMissing: true,
                info: { minimized: true }
              }
            ]
          })
        );
      } catch (error) {
        console.error('Error configuring Cesium webpack plugin:', error);
      }
    }
    if (process.env.NODE_ENV === 'development') {
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'build/contracts'),
            to: path.join(__dirname, 'public/contracts'),
          },
        ],
      })
    )
    }
    config.module.rules.push({
      test: /\.js$/,
      include: [
        path.resolve(__dirname, 'public/static/cesium/')
      ],
      type: 'javascript/auto',
    });
    return config;
  },
};

module.exports = nextConfig;
