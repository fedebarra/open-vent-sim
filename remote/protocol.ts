/** Shared message shapes between ventilator screens, the server and the director console. */
import type { DeviceRemoteCommand, DeviceSnapshot } from '../device/remoteTypes';

export type Role = 'vent' | 'regia';

/** Director → ventilator. Device commands, plus the recording notice for the learner badge. */
export type RemoteCommand = DeviceRemoteCommand | { type: 'recording'; on: boolean };

/** Live state the ventilator publishes twice per second. */
export interface VentSnapshot extends DeviceSnapshot { at: number }

export interface RemoteEvent { at: number; text: string; source?: 'learner' | 'director' | 'device'; kind?: string }

export interface VentInfo { id: string; name: string; connected: boolean; lastSeen: number }

export type ServerMessage =
  | { t: 'welcome'; role: Role; id?: string; name: string; pin?: string; session?: string; regia?: boolean }
  | { t: 'denied'; reason: 'pin' | 'key' | 'full' | 'role' }
  | { t: 'vents'; list: VentInfo[] }
  | { t: 'state'; from: string; state: VentSnapshot }
  | { t: 'event'; from: string; event: RemoteEvent }
  | { t: 'events'; from: string; events: RemoteEvent[] }
  | { t: 'cmd'; cmd: RemoteCommand; cmdId: string }
  | { t: 'ack'; from: string; cmdId: string; ok: boolean; error?: string }
  | { t: 'sent'; cmdId: string; delivered: number }
  | { t: 'regia'; present: boolean }
  | { t: 'renamed'; name: string }
  | { t: 'pong' };
