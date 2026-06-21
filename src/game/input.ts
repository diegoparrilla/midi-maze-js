// Single input path: merge held keyboard keys and on-screen touch buttons into the
// one joystick byte the deterministic sim consumes (D-02). Keeping both sources in
// one place guarantees touch produces a byte identical to the keyboard.
import {
  JOYSTICK_BUTTON,
  JOYSTICK_DOWN,
  JOYSTICK_LEFT,
  JOYSTICK_RIGHT,
  JOYSTICK_UP,
} from '../sim/movement';

export type Control = 'up' | 'down' | 'left' | 'right' | 'fire';

export class Input {
  private readonly keys = new Set<string>();
  private readonly buttons: Record<Control, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  };

  keyDown(key: string): void {
    this.keys.add(key);
  }

  keyUp(key: string): void {
    this.keys.delete(key);
  }

  /** Press/release an on-screen control (D-pad direction or fire). */
  setButton(control: Control, pressed: boolean): void {
    this.buttons[control] = pressed;
  }

  /** Release every on-screen button (e.g. when the menu opens or focus is lost). */
  clearButtons(): void {
    this.buttons.up = false;
    this.buttons.down = false;
    this.buttons.left = false;
    this.buttons.right = false;
    this.buttons.fire = false;
  }

  /** The merged JOYSTICK_* byte for this tick (keyboard OR touch). */
  joyByte(): number {
    let j = 0;
    if (this.keys.has('ArrowUp') || this.buttons.up) j |= JOYSTICK_UP;
    if (this.keys.has('ArrowDown') || this.buttons.down) j |= JOYSTICK_DOWN;
    if (this.keys.has('ArrowLeft') || this.buttons.left) j |= JOYSTICK_LEFT;
    if (this.keys.has('ArrowRight') || this.buttons.right) j |= JOYSTICK_RIGHT;
    if (this.keys.has(' ') || this.buttons.fire) j |= JOYSTICK_BUTTON;
    return j;
  }
}
