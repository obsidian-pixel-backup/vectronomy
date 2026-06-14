export declare class WebSerialBridge {
    private port;
    private reader;
    private writer;
    isConnected: boolean;
    private onLineReceived;
    constructor();
    connect(baudRate?: number): Promise<boolean>;
    disconnect(): Promise<void>;
    setOnLineReceived(callback: (line: string) => void): void;
    private setupStreams;
    sendCommand(cmd: string): Promise<boolean>;
    jog(axis: 'X' | 'Y' | 'Z', distance: number, feedrate?: number): Promise<boolean>;
}
//# sourceMappingURL=webSerial.d.ts.map