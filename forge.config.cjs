// Local arm64 package; Developer ID / notarization remain externally verified release steps.
module.exports = {
  packagerConfig: {
    name: 'CareerNext', executableName: 'CareerNext', appBundleId: 'dev.career.next',
    asar: true,
    ignore: [/^\/(?!dist(?:\/|$)|node_modules(?:\/|$)|package\.json$|package-lock\.json$).+/, /^\/dist\/(?!application(?:\/|$)|materials-renderer(?:\/|$)).+/],
    osxSign: {
      // Local ad-hoc sealing is not Developer ID distribution signing.
      identity: process.env.CAREER_SIGN_IDENTITY || '-',
      identityValidation: Boolean(process.env.CAREER_SIGN_IDENTITY),
      preAutoEntitlements: false,
      // Hardened Runtime requires an Apple-issued Team ID. Do not relax library validation.
      optionsForFile: () => ({ hardenedRuntime: Boolean(process.env.CAREER_SIGN_IDENTITY), entitlements: 'apps/desktop/packaging/entitlements.plist' }),
    },
    ...(process.env.CAREER_NOTARY_PROFILE ? { osxNotarize: {
      keychainProfile: process.env.CAREER_NOTARY_PROFILE,
    } } : {}),
  },
  rebuildConfig: { force: true },
  plugins: [{ name: '@electron-forge/plugin-auto-unpack-natives', config: {} }],
  makers: [],
};
