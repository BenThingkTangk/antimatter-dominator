export interface ATOMLoaderOptions {
  /**
   * Boot sequence duration in milliseconds.
   * @default 2500
   */
  duration?: number;

  /**
   * Automatically play the loader after initialization.
   * @default true
   */
  autoStart?: boolean;

  /**
   * Remove the loader from the document flow after exit.
   * Keep false when you want to replay it.
   * @default false
   */
  removeOnHide?: boolean;
}

export interface ATOMLoaderAPI {
  init(options?: ATOMLoaderOptions): void;
  show(options?: ATOMLoaderOptions): void;
  hide(options?: ATOMLoaderOptions): void;
  play(options?: ATOMLoaderOptions): void;
}

export const ATOMLoader: ATOMLoaderAPI;

declare global {
  interface Window {
    ATOMLoader: ATOMLoaderAPI;
  }
}

export default ATOMLoader;
