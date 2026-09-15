// Public configuration is deliberately required for production builds.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    for (const name of ['EXPO_PUBLIC_API_URL','EXPO_PUBLIC_PRIVACY_URL']) {
      const value = process.env[name] || '';
      if (!/^https:\/\/[^/]+/.test(value) || /localhost|example\.(com|org)/i.test(value)) throw new Error(`${name} must be a real HTTPS URL`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '')) throw new Error('Configure a verified EXPO_PUBLIC_SUPPORT_EMAIL');
  }
  return config;
};
