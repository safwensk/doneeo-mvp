import { api } from './api';

export const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type Day = typeof days[number];
export type Role = 'helper' | 'professional';
export type Hours = { day: Day; start: string; end: string };
export type Address = { street: string; unit: string; city: string; region: string; postalCode: string; country: string };
export type WorkSkill = { label: string; level: 'assist' | 'independent' };
export type Vehicle = { type: string; cargo: string };
export type Setup = {
  address: Address; radiusKm: number; workTypes: WorkSkill[]; kit: string[];
  vehicle: Vehicle | null; driverLicensed: boolean | null; blockedDates: string[]; about: string;
};
export type Profile = {
  role: Role | ''; serviceArea: string; skills: string; equipment: string; timeZone: string;
  availability: Hours[]; qualifications: { trade: string; region: string } | null; setup: Setup | null;
};
export type Draft = Profile & { setup: Setup };
export type Kind = 'photo' | 'identity' | 'trade' | 'driver';
export type Document = { kind: Kind; status: 'READY' | 'IN_REVIEW' | 'VERIFIED' | 'NEEDS_UPDATE'; note: string; revision: string; hasFile: boolean };
export type Pending = { accountId: string; name: string; document: Document };
export type JobStatus = 'OFFERED' | 'DECLINED' | 'UPCOMING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
export type JobStep = { fromMinute: number; toMinute: number; label: string };
export type Job = {
  id: string; start: number; end: number; status: JobStatus; progress: number; equipmentHold: boolean;
  plan: { title: string; location: string; role: string; scope: string; access: string; steps: JobStep[];
    workerKit: string[]; customerKit: string[]; sourced: { item: string; source: string; instructions: string }[];
    workPay: number; equipmentPay: number; paymentTerms: string; demo: boolean };
};
export type JobDetails = { job: Job; notes: { id: string; kind: string; message: string; createdAt: number }[] };
export type Notification = { id: string; jobId: string | null; title: string; message: string; createdAt: number; seen: boolean };
export type Workspace = { profile: Profile | null; demo: boolean; canReview: boolean; matchingReady: boolean;
  documents: Document[]; jobs: Job[]; notifications: Notification[] };

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const timeZones = [...new Set(['UTC', browserZone, ...(Intl.supportedValuesOf?.('timeZone') ?? [])])];
export const roles = [
  { value: 'helper', label: 'Local helper', brand: 'Doneeo Helper', description: 'For suitable work that doesn’t require a professional licence.' },
  { value: 'professional', label: 'Licensed professional', brand: 'Doneeo Pro', description: 'For work that uses your professional qualifications.' },
] as const;
export const workTypes = ['Furniture assembly', 'Organizing', 'Lifting and moving', 'Troubleshooting', 'Fixture installation', 'Cleaning', 'Outdoor work', 'Delivery'];
export const documentLabels: Record<Kind, string> = { photo: 'Profile photo', identity: 'Identity document', trade: 'Trade licence', driver: 'Driver’s licence' };

export function toDraft(profile: Profile | null): Draft {
  return {
    role: profile?.role ?? '', serviceArea: profile?.serviceArea ?? '', skills: profile?.skills ?? '', equipment: profile?.equipment ?? '',
    timeZone: profile?.timeZone ?? browserZone, availability: profile?.availability ?? [], qualifications: profile?.qualifications ?? null,
    setup: profile?.setup ?? {
      address: { street: '', unit: '', city: profile?.serviceArea ?? '', region: '', postalCode: '', country: 'Canada' },
      radiusKm: 20, workTypes: [], kit: profile?.equipment.split(/[,\n]/).map(item => item.trim().slice(0, 70)).filter(Boolean).slice(0, 30) ?? [],
      vehicle: null, driverLicensed: null, blockedDates: [], about: '',
    },
  };
}

export const profileUrl = '/api/executor/profile';
export const workspaceUrl = '/api/executor/workspace';
export const jobsUrl = '/api/executor/jobs';
export const money = (cents: number) => new Intl.NumberFormat('en-CA', { style:'currency', currency:'CAD', maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
export const clock = (time: number, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, hour:'numeric', minute:'2-digit' }).format(time);
export const dateLabel = (time: number, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, weekday:'long', month:'short', day:'numeric' }).format(time);
export const dateKey = (time: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(time);
  return ['year','month','day'].map(type => parts.find(part => part.type === type)?.value).join('-');
};
export const hourLabel = (hour: string) => {
  const [h,m] = hour.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const stepRange = (job: Job, step: JobStep, zone: string) =>
  `${clock(job.start + step.fromMinute * 60000, zone)} – ${clock(job.start + step.toMinute * 60000, zone)}`;

export async function uploadDocument(accountId: string, kind: Kind, file?: File) {
  let data: string | undefined;
  if (file) {
    if (file.size > 2 * 1024 * 1024) throw new Error('Choose a file up to 2 MB.');
    data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Doneeo couldn’t read that file.'));
      reader.readAsDataURL(file);
    });
  }
  return api<Document[]>('/api/executor/assets', { accountId, kind, data, sample: !file });
}
