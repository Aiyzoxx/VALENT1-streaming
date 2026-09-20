declare module 'react-native-static-server' {
  export default class StaticServer {
    constructor(port?: number | object, root?: string | object, opts?: object);
    start(): Promise<string>;
    stop(): Promise<void>;
    isRunning(): Promise<boolean>;
    readonly origin: string | undefined;
  }
}
