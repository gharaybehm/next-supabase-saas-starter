export function isDldLicenseGateDisabled(): boolean {
  return process.env.DISABLE_DLD_LICENSE_GATE === 'true';
}
