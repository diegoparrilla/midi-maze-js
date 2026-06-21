import { describe, expect, it } from 'vitest';
import { JOYSTICK_BUTTON, JOYSTICK_LEFT, JOYSTICK_RIGHT, JOYSTICK_UP } from '../sim/movement';
import { Input } from './input';

describe('Input.joyByte', () => {
  it('is 0 with nothing held', () => {
    expect(new Input().joyByte()).toBe(0);
  });

  it('maps arrow keys + space to the JOYSTICK_* bits', () => {
    const i = new Input();
    i.keyDown('ArrowUp');
    i.keyDown(' ');
    expect(i.joyByte()).toBe(JOYSTICK_UP | JOYSTICK_BUTTON);
    i.keyUp('ArrowUp');
    expect(i.joyByte()).toBe(JOYSTICK_BUTTON);
  });

  it('maps on-screen buttons to the same bits', () => {
    const i = new Input();
    i.setButton('left', true);
    i.setButton('fire', true);
    expect(i.joyByte()).toBe(JOYSTICK_LEFT | JOYSTICK_BUTTON);
  });

  it('merges keyboard and touch (OR), without double-counting', () => {
    const i = new Input();
    i.keyDown('ArrowRight');
    i.setButton('right', true); // same direction from both sources
    i.setButton('up', true);
    expect(i.joyByte()).toBe(JOYSTICK_RIGHT | JOYSTICK_UP);
  });

  it('clearButtons releases touch but keeps keyboard', () => {
    const i = new Input();
    i.keyDown('ArrowUp');
    i.setButton('fire', true);
    i.clearButtons();
    expect(i.joyByte()).toBe(JOYSTICK_UP);
  });
});
