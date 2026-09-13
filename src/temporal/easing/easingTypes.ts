export type EasingId =
  | 'linear'
  | 'quad.in' | 'quad.out' | 'quad.inOut'
  | 'cubic.in' | 'cubic.out' | 'cubic.inOut'
  | 'quart.in' | 'quart.out' | 'quart.inOut'
  | 'expo.in' | 'expo.out' | 'expo.inOut'
  | 'sine.in' | 'sine.out' | 'sine.inOut';

export type EasingFunction = (t: number) => number;

export interface EasingDefinition {
  id: EasingId | string;
  label: string;
  fn: EasingFunction;
  glsl?: string;
  wgsl?: string;
}
