import { MobileControls } from './MobileControls';

// Single instance — Joystick mounts its DOM into document.body on construct,
// so we can't mount/unmount per component without leaking joystick elements.
let _mobile: MobileControls | null = null;
export function getMobile(): MobileControls {
  if (!_mobile) _mobile = new MobileControls();
  return _mobile;
}
