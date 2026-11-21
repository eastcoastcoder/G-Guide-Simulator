import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type { LiveChannelRef } from './liveMatch';

export type LivePreviewStatus = 'tuning' | 'playing' | 'unavailable' | 'permission';

export interface LiveChannelListResult {
  channels: LiveChannelRef[];
  status: LivePreviewStatus;
}

const native = Platform.OS === 'android'
  ? NativeModules.LivePreview
  : null;

const emitter =
  native !== null ? new NativeEventEmitter(native) : null;

export async function listChannels(): Promise<LiveChannelListResult> {
  if (native === null) {
    return { channels: [], status: 'unavailable' };
  }
  const result = await native.listChannels();
  return {
    channels: Array.isArray(result?.channels) ? result.channels : [],
    status: result?.status ?? 'unavailable',
  };
}

export function setFrame(
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  native?.setFrame(x, y, width, height);
}

export function tune(inputId: string, channelId: string): void {
  native?.tune(inputId, channelId);
}

export function stop(): void {
  native?.stop();
}

export function openChannel(channelId: string): Promise<boolean> {
  if (native === null) {
    return Promise.resolve(false);
  }
  return native.openChannel(channelId);
}

export function subscribeStatus(
  listener: (status: LivePreviewStatus) => void,
): EmitterSubscription | null {
  if (emitter === null) {
    return null;
  }
  return emitter.addListener('LivePreviewStatus', event => {
    if (
      event?.status === 'tuning' ||
      event?.status === 'playing' ||
      event?.status === 'unavailable' ||
      event?.status === 'permission'
    ) {
      listener(event.status);
    }
  });
}
