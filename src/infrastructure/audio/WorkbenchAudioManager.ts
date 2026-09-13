export interface WorkbenchAudioChannelDescriptor<TChannelId extends string = string> {
  id: TChannelId;
  gainNode: GainNode;
  volume: number;
  muted: boolean;
}

export interface WorkbenchAudioManagerOptions {
  masterVolume?: number;
  masterMuted?: boolean;
}

export interface WorkbenchAudioChannelOptions {
  volume?: number;
  muted?: boolean;
}

type ManagedChannel<TChannelId extends string> = WorkbenchAudioChannelDescriptor<TChannelId>;

export class WorkbenchAudioManager<TChannelId extends string = string> {
  private readonly channels = new Map<TChannelId, ManagedChannel<TChannelId>>();
  private readonly masterGainNode: GainNode;
  private masterVolume: number;
  private masterMuted: boolean;

  constructor(
    private readonly audioContext: AudioContext,
    options: WorkbenchAudioManagerOptions = {}
  ) {
    this.masterGainNode = audioContext.createGain();
    this.masterGainNode.connect(audioContext.destination);
    this.masterVolume = this.normalizeGainValue(options.masterVolume, 1);
    this.masterMuted = options.masterMuted ?? false;
    this.applyGainValue(this.masterGainNode, this.masterMuted ? 0 : this.masterVolume);
  }

  get masterGain(): GainNode {
    return this.masterGainNode;
  }

  get masterVolumeValue(): number {
    return this.masterVolume;
  }

  get isMasterMuted(): boolean {
    return this.masterMuted;
  }

  getChannelIds(): TChannelId[] {
    return [...this.channels.keys()];
  }

  ensureChannel(
    id: TChannelId,
    options: WorkbenchAudioChannelOptions = {}
  ): WorkbenchAudioChannelDescriptor<TChannelId> {
    const existingChannel = this.channels.get(id);

    if (existingChannel) {
      const nextVolume = this.normalizeGainValue(options.volume, existingChannel.volume);
      const nextMuted = options.muted ?? existingChannel.muted;

      if (nextVolume !== existingChannel.volume || nextMuted !== existingChannel.muted) {
        existingChannel.volume = nextVolume;
        existingChannel.muted = nextMuted;
        this.applyGainValue(existingChannel.gainNode, nextMuted ? 0 : nextVolume);
      }

      return existingChannel;
    }

    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.masterGainNode);

    const channel: ManagedChannel<TChannelId> = {
      id,
      gainNode,
      volume: this.normalizeGainValue(options.volume, 1),
      muted: options.muted ?? false
    };

    this.applyGainValue(channel.gainNode, channel.muted ? 0 : channel.volume);
    this.channels.set(id, channel);
    return channel;
  }

  getChannel(id: TChannelId): WorkbenchAudioChannelDescriptor<TChannelId> | null {
    return this.channels.get(id) ?? null;
  }

  connect(node: AudioNode, channelId: TChannelId): AudioNode {
    const channel = this.ensureChannel(channelId);
    node.connect(channel.gainNode);
    return node;
  }

  setChannelVolume(channelId: TChannelId, volume: number): WorkbenchAudioChannelDescriptor<TChannelId> {
    const channel = this.ensureChannel(channelId);
    channel.volume = this.normalizeGainValue(volume, channel.volume);
    this.applyGainValue(channel.gainNode, channel.muted ? 0 : channel.volume);
    return channel;
  }

  setChannelMuted(channelId: TChannelId, muted: boolean): WorkbenchAudioChannelDescriptor<TChannelId> {
    const channel = this.ensureChannel(channelId);
    channel.muted = muted;
    this.applyGainValue(channel.gainNode, muted ? 0 : channel.volume);
    return channel;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = this.normalizeGainValue(volume, this.masterVolume);
    this.applyGainValue(this.masterGainNode, this.masterMuted ? 0 : this.masterVolume);
  }

  setMasterMuted(muted: boolean): void {
    this.masterMuted = muted;
    this.applyGainValue(this.masterGainNode, muted ? 0 : this.masterVolume);
  }

  dispose(): void {
    for (const channel of this.channels.values()) {
      channel.gainNode.disconnect();
    }

    this.channels.clear();
    this.masterGainNode.disconnect();
  }

  private applyGainValue(gainNode: GainNode, value: number): void {
    const nextValue = this.normalizeGainValue(value, 1);

    if (typeof gainNode.gain.setValueAtTime === 'function') {
      gainNode.gain.setValueAtTime(nextValue, this.audioContext.currentTime);
      return;
    }

    gainNode.gain.value = nextValue;
  }

  private normalizeGainValue(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(0, value);
  }
}
