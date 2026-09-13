export const easingGlslSource = `
float easeLinear(float t){ return clamp(t, 0.0, 1.0); }
float easeQuadIn(float t){ t = clamp(t, 0.0, 1.0); return t * t; }
float easeQuadOut(float t){ t = clamp(t, 0.0, 1.0); return 1.0 - (1.0 - t) * (1.0 - t); }
float easeCubicIn(float t){ t = clamp(t, 0.0, 1.0); return t * t * t; }
float easeCubicOut(float t){ t = clamp(t, 0.0, 1.0); return 1.0 - pow(1.0 - t, 3.0); }
float easeExpoOut(float t){ t = clamp(t, 0.0, 1.0); return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t); }
float easeSineInOut(float t){ t = clamp(t, 0.0, 1.0); return -(cos(3.141592653589793 * t) - 1.0) / 2.0; }
`;

export const easingWgslSource = `
fn easeLinear(t: f32) -> f32 { return clamp(t, 0.0, 1.0); }
fn easeQuadIn(t0: f32) -> f32 { let t = clamp(t0, 0.0, 1.0); return t * t; }
fn easeQuadOut(t0: f32) -> f32 { let t = clamp(t0, 0.0, 1.0); return 1.0 - (1.0 - t) * (1.0 - t); }
fn easeCubicIn(t0: f32) -> f32 { let t = clamp(t0, 0.0, 1.0); return t * t * t; }
fn easeCubicOut(t0: f32) -> f32 { let t = clamp(t0, 0.0, 1.0); return 1.0 - pow(1.0 - t, 3.0); }
`;
