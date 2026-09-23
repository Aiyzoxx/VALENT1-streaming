declare module 'mux.js' {
  export namespace mp4 {
    export interface TransmuxerOptions {
      keepOriginalTimestamps?: boolean;
      remux?: boolean;
    }

    export interface TransmuxerSegment {
      initSegment?: Uint8Array;
      data?: Uint8Array;
      type?: string;
    }

    export class Transmuxer {
      constructor(options?: TransmuxerOptions);
      push(data: Uint8Array): void;
      flush(): void;
      on(event: 'data', callback: (segment: TransmuxerSegment) => void): void;
      on(event: 'done', callback: () => void): void;
      off(event: string, callback?: (...args: any[]) => void): void;
      dispose(): void;
    }
  }

  const muxjs: {
    mp4: {
      Transmuxer: typeof mp4.Transmuxer;
    };
  };

  export default muxjs;
}
