/**
 * Input map - translates keyboard event codes into aircraft input state.
 * Pure module with no DOM or Three.js dependencies so the input-to-state
 * mapping can be unit tested in Node.
 */

export function createInputState() {
    return {
        pitchUp: false, pitchDown: false,
        rollLeft: false, rollRight: false,
        yawLeft: false, yawRight: false,
        throttleUp: false, throttleDown: false
    };
}

/**
 * Applies a key event to the input state.
 * Returns the name of the input field that changed, or null when the
 * key code is not mapped to a control.
 */
export function applyKeyToInput(input, code, down) {
    switch (code) {
        case 'KeyW': case 'ArrowUp':    input.pitchUp = down;   return 'pitchUp';
        case 'KeyS': case 'ArrowDown':  input.pitchDown = down; return 'pitchDown';
        case 'KeyA': case 'ArrowLeft':  input.rollLeft = down;  return 'rollLeft';
        case 'KeyD': case 'ArrowRight': input.rollRight = down; return 'rollRight';
        case 'KeyQ':                    input.yawLeft = down;   return 'yawLeft';
        case 'KeyE':                    input.yawRight = down;  return 'yawRight';
        case 'ShiftLeft': case 'ShiftRight':
            input.throttleUp = down;
            return 'throttleUp';
        case 'ControlLeft': case 'ControlRight':
            input.throttleDown = down;
            return 'throttleDown';
        default:
            return null;
    }
}
