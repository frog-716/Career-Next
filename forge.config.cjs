// G0 arm64 packaging probe; not a release/signing policy for Career.
module.exports = {
  packagerConfig: {
    name: 'CareerNextG0', executableName: 'CareerNextG0', appBundleId: 'dev.career.next.g0',
    asar: true,
    ignore: [/^\/(?!dist(?:\/|$)|node_modules(?:\/|$)|package\.json$|package-lock\.json$).+/],
    osxSign: {
      // Local ad-hoc sealing is not Developer ID distribution signing.
      identity: process.env.CAREER_G0_SIGN_IDENTITY || '-',
      identityValidation: Boolean(process.env.CAREER_G0_SIGN_IDENTITY),
      preAutoEntitlements: false,
      // Hardened Runtime requires an Apple-issued Team ID. Do not relax library validation.
      optionsForFile: () => ({ hardenedRuntime: Boolean(process.env.CAREER_G0_SIGN_IDENTITY), entitlements: 'apps/desktop/probe/entitlements.plist' }),
    },
    ...(process.env.CAREER_G0_NOTARY_PROFILE ? { osxNotarize: {
      keychainProfile: process.env.CAREER_G0_NOTARY_PROFILE,
    } } : {}),
  },
  rebuildConfig: { force: true },
  plugins: [{ name: '@electron-forge/plugin-auto-unpack-natives', config: {} }],
  makers: [],
};
