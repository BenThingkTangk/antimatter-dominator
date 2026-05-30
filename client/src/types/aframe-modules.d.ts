// Ambient module declarations for A-Frame and its add-ons, which ship no
// first-party TypeScript types. Imported only for side effects (registering
// globals + custom elements), so an untyped module is sufficient and keeps
// `strict` / `noImplicitAny` happy without disabling checks globally.
//
// Kept in its own pure-ambient file (no imports/exports) so these `declare
// module` statements are treated as global ambient declarations rather than
// module-scoped augmentations.
declare module "aframe";
declare module "aframe-extras";
declare module "aframe-environment-component";
