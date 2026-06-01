/**
 * JSX typings for A-Frame custom elements used by the WebXR War Room scene.
 *
 * A-Frame ships web components (<a-scene>, <a-entity>, …) whose attributes are
 * declarative component strings. React/TS does not know these intrinsic
 * elements, so we declare a permissive-but-typed surface here rather than
 * disabling type-checking globally. Every element accepts the standard HTML
 * attributes plus any A-Frame component attribute (all string/number based).
 */
import type * as React from "react";

type AFrameAttributes = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  [attr: string]: unknown;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "a-scene": AFrameAttributes;
      "a-entity": AFrameAttributes;
      "a-assets": AFrameAttributes;
      "a-asset-item": AFrameAttributes;
      "a-mixin": AFrameAttributes;
      "a-camera": AFrameAttributes;
      "a-cursor": AFrameAttributes;
      "a-box": AFrameAttributes;
      "a-sphere": AFrameAttributes;
      "a-cylinder": AFrameAttributes;
      "a-plane": AFrameAttributes;
      "a-circle": AFrameAttributes;
      "a-ring": AFrameAttributes;
      "a-text": AFrameAttributes;
      "a-light": AFrameAttributes;
      "a-sky": AFrameAttributes;
      "a-torus": AFrameAttributes;
      "a-cone": AFrameAttributes;
      "a-image": AFrameAttributes;
      "a-curvedimage": AFrameAttributes;
      "a-gltf-model": AFrameAttributes;
    }
  }
}

export {};
