import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  cropFaceThumbnail,
  detectFaces,
  matchDescriptorToProfiles,
} from '../../services/visionEngine';
import type {
  AuthorizedProfile,
  DetectedFaceResult,
  ModelLoadState,
  VisionSettings,
} from '../../types/vision';
import { formatPercent, formatTimestamp, generateId } from '../../utils/formatters';
import { SectionHeader, StatusNotice } from '../ui/Primitives';

interface FaceRecognitionViewProps {
  profiles: AuthorizedProfile[];
  settings: VisionSettings;
  onUpdateSettings: (next: VisionSettings) => void;
  onAddProfile: (profile: AuthorizedProfile) => void;
  onDeleteProfile: (id: string) => void;
  onModelStateChange: (state: ModelLoadState) => void;
}

const SAMPLE_LEAD_PORTRAIT = '/src/assets/images/sample_portrait_lead_1795266278417.jpg';
const SAMPLE_TEAM_PHOTO = '/src/assets/images/sample_studio_team_1795266277662.jpg';

export function FaceRecognitionView({
  profiles,
  settings,
  onUpdateSettings,
  onAddProfile,
  onDeleteProfile,
  onModelStateChange,
}: FaceRecognitionViewProps) {
  const enrollFileRef = useRef<HTMLInputElement | null>(null);
  const verifyFileRef = useRef<HTMLInputElement | null>(null);

  // Enrolment state
  const [enrollName, setEnrollName] = useState('');
  const [enrollRole, setEnrollRole] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [enrollPreviewSrc, setEnrollPreviewSrc] = useState<string | null>(null);
  const [enrollProcessing, setEnrollProcessing] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Verification test bench state
  const [verifyProcessing, setVerifyProcessing] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<
    Array<DetectedFaceResult & { thumbUrl?: string }>
  >([]);
  const [verifySourceLabel, setVerifySourceLabel] = useState<string>('');

  const handleEnrollFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setEnrollError('Please select a JPEG, PNG, or WebP portrait.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEnrollPreviewSrc(reader.result);
        setEnrollError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);

    const trimmedName = enrollName.trim();
    if (!trimmedName) {
      setEnrollError('Enter a name or identifier for the authorized profile.');
      return;
    }
    if (!consentChecked) {
      setEnrollError(
        'Explicit consent confirmation is mandatory before generating or storing a biometric descriptor.',
      );
      return;
    }
    if (!enrollPreviewSrc) {
      setEnrollError('Select a clear single-face portrait image to enroll.');
      return;
    }

    setEnrollProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Unable to load the selected portrait image.'));
        img.src = enrollPreviewSrc;
      });

      const detected = await detectFaces(img, {
        model: 'ssd',
        scoreThreshold: 0.5,
        includeLandmarks: true,
        includeDescriptors: true,
        onModelStateChange,
      });

      if (detected.length === 0) {
        setEnrollError(
          'No face was detected in this portrait. Choose a well-lit front-facing image.',
        );
        return;
      }
      if (detected.length > 1) {
        setEnrollError(
          `Detected ${detected.length} faces in the enrolment image. Enrolment requires exactly 1 clear face to prevent ambiguous identity assignment.`,
        );
        return;
      }

      const face = detected[0];
      if (!face.descriptor || face.descriptor.length !== 128) {
        setEnrollError('Could not compute a valid 128-dimensional face descriptor.');
        return;
      }

      const thumb = cropFaceThumbnail(img, face.box, 96);
      const profile: AuthorizedProfile = {
        id: generateId('prof'),
        name: trimmedName,
        role: enrollRole.trim() || 'Authorized Sample',
        consentGrantedAt: new Date().toISOString(),
        consentStatement:
          'Explicit user-confirmed authorization for local browser 128-d descriptor storage.',
        descriptor: face.descriptor,
        previewDataUrl: thumb,
      };

      onAddProfile(profile);
      setEnrollSuccess(
        `Enrolled "${profile.name}" locally with a 128-dimensional descriptor. You can revoke it anytime.`,
      );
      setEnrollName('');
      setEnrollRole('');
      setConsentChecked(false);
      setEnrollPreviewSrc(null);
    } catch (err) {
      setEnrollError(
        err instanceof Error ? err.message : 'Failed to enroll authorized profile.',
      );
    } finally {
      setEnrollProcessing(false);
    }
  };

  const runVerification = async (src: string, label: string, revokeOnLoad = false) => {
    setVerifyError(null);
    setVerifyProcessing(true);
    setVerifySourceLabel(label);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not decode test image.'));
        img.src = src;
      });

      const detected = await detectFaces(img, {
        model: 'ssd',
        scoreThreshold: settings.confidenceThreshold,
        includeLandmarks: true,
        includeDescriptors: true,
        authorizedProfiles: profiles,
        matchThreshold: settings.matchThreshold,
        onModelStateChange,
      });

      const enriched = detected.map((f) => {
        const match =
          f.descriptor && profiles.length > 0
            ? matchDescriptorToProfiles(f.descriptor, profiles, settings.matchThreshold)
            : null;
        return {
          ...f,
          match,
          thumbUrl: cropFaceThumbnail(img, f.box, 88),
        };
      });

      setVerifyResults(enriched);
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Verification inference failed.',
      );
    } finally {
      if (revokeOnLoad) URL.revokeObjectURL(src);
      setVerifyProcessing(false);
    }
  };

  React.useEffect(() => {
    setVerifyResults((prev) =>
      prev.map((res) => ({
        ...res,
        match:
          res.descriptor && profiles.length > 0
            ? matchDescriptorToProfiles(res.descriptor, profiles, settings.matchThreshold)
            : null,
      })),
    );
  }, [profiles, settings.matchThreshold]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Consent-Based Face Recognition"
        description="Optional identity matching strictly against locally authorized profiles. Detection never identifies individuals unless you enroll and enable matching."
        action={
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-[#0D1526] px-4 py-2.5 text-xs font-medium text-slate-100">
            <span>Global Recognition Matching</span>
            <input
              type="checkbox"
              checked={settings.recognitionEnabled}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  recognitionEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 accent-cyan-400 cursor-pointer"
            />
          </label>
        }
      />

      {/* Explicit Detection vs Recognition Distinction */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800/80 bg-[#0D1526] p-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Face Detection (Default Mode)</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Locates rectangular facial regions and confidence scores anonymously. No biometric
            descriptors are stored or matched against identities.
          </p>
        </div>
        <div className="space-y-1.5 border-t border-slate-800/80 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
            <UserCheck className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <span>Authorized Recognition (Opt-In Only)</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Computes 128-d mathematical descriptors only for consented portraits you explicitly
            enroll in this device&apos;s local storage. Unenrolled faces remain unidentified.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Enrolment Form */}
        <form
          onSubmit={(e) => void handleEnrollSubmit(e)}
          className="space-y-4 rounded-xl border border-slate-800/80 bg-[#0D1526] p-6 lg:col-span-5"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-100">
              Enroll Authorized Profile
            </h3>
          </div>

          {enrollError ? (
            <StatusNotice variant="error" title="Enrolment Blocked" message={enrollError} />
          ) : null}
          {enrollSuccess ? (
            <StatusNotice variant="success" title="Profile Enrolled" message={enrollSuccess} />
          ) : null}

          <div>
            <label htmlFor="enroll-name" className="block text-xs font-medium text-slate-300">
              Authorized Person Name
            </label>
            <input
              id="enroll-name"
              type="text"
              value={enrollName}
              onChange={(e) => setEnrollName(e.target.value)}
              placeholder="e.g. Dr. Maya Lin"
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="enroll-role" className="block text-xs font-medium text-slate-300">
              Role or Authorization Context (Optional)
            </label>
            <input
              id="enroll-role"
              type="text"
              value={enrollRole}
              onChange={(e) => setEnrollRole(e.target.value)}
              placeholder="e.g. Lab Researcher · Test Badge"
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-300">
              Single-Face Reference Portrait
            </span>
            <input
              ref={enrollFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleEnrollFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => enrollFileRef.current?.click()}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-700 bg-[#080E1A] px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                Upload Portrait
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrollPreviewSrc(SAMPLE_LEAD_PORTRAIT);
                  if (!enrollName.trim()) setEnrollName('Dr. Elena Vance (Sample)');
                  if (!enrollRole.trim()) setEnrollRole('Optical Systems Lead');
                  setEnrollError(null);
                }}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-700 bg-[#080E1A] px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 cursor-pointer"
              >
                Use Sample Portrait
              </button>
            </div>

            {enrollPreviewSrc ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-800 bg-[#080E1A] p-2.5">
                <img
                  src={enrollPreviewSrc}
                  alt="Enrolment reference portrait preview"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="text-xs text-slate-300">
                  Reference image loaded. Must contain exactly 1 unoccluded face.
                </div>
              </div>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-[#080E1A] p-3 text-xs leading-relaxed text-slate-300">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer"
            />
            <span>
              I confirm I have explicit permission from this individual to extract and store a
              local 128-dimensional biometric descriptor on this device for authorized matching.
            </span>
          </label>

          <button
            type="submit"
            disabled={enrollProcessing}
            className="min-h-[42px] w-full rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
          >
            {enrollProcessing ? 'Computing 128-D Descriptor…' : 'Enroll Authorized Profile'}
          </button>
        </form>

        {/* Authorized Profiles & Verification Test */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Authorized Local Profiles
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Stored exclusively in your browser with instant revocation
                </p>
              </div>
              <span className="font-mono text-xs text-cyan-400 tabular-nums">
                {profiles.length} Enrolled
              </span>
            </div>

            {profiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No authorized profiles enrolled. Use the enrolment panel to add a consented sample
                profile.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-800/80">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.previewDataUrl ? (
                        <img
                          src={p.previewDataUrl}
                          alt={p.name}
                          className="h-11 w-11 shrink-0 rounded-lg border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#080E1A] text-xs font-semibold text-cyan-400">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400 truncate">
                          {p.role} · Consented {formatTimestamp(p.consentGrantedAt)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteProfile(p.id)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-500/50 hover:bg-rose-950/30 whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification Test Bench */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
            <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Identity Verification Test
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Compare faces in a test photo against enrolled profiles (max Euclidean distance:{' '}
                  <span className="font-mono text-slate-200">{settings.matchThreshold}</span>)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={verifyFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      void runVerification(url, file.name, true);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={verifyProcessing || profiles.length === 0}
                  onClick={() => verifyFileRef.current?.click()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  Test Photo
                </button>
                <button
                  type="button"
                  disabled={verifyProcessing || profiles.length === 0}
                  onClick={() => void runVerification(SAMPLE_TEAM_PHOTO, 'Studio Team Sample')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  Test Group Photo
                </button>
              </div>
            </div>

            {verifyError ? (
              <div className="mt-4">
                <StatusNotice variant="error" title="Verification Error" message={verifyError} />
              </div>
            ) : null}

            {profiles.length === 0 ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <ShieldAlert className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span>Enroll at least one authorized profile above to run verification tests.</span>
              </div>
            ) : verifyProcessing ? (
              <div className="py-8 text-center text-xs text-slate-300">
                Extracting descriptors and computing Euclidean distances…
              </div>
            ) : verifyResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Select &ldquo;Test Photo&rdquo; or &ldquo;Test Group Photo&rdquo; to verify
                descriptor matching against your enrolled profiles.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="text-xs text-slate-400">
                  Source: <span className="text-slate-200">{verifySourceLabel}</span> ·{' '}
                  {verifyResults.length} detected{' '}
                  {verifyResults.length === 1 ? 'face' : 'faces'}
                </div>
                <div className="divide-y divide-slate-800/80">
                  {verifyResults.map((res) => (
                    <div key={res.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3">
                        {res.thumbUrl ? (
                          <img
                            src={res.thumbUrl}
                            alt={`Verified face ${res.index}`}
                            className="h-11 w-11 rounded-lg border border-slate-700 object-cover"
                          />
                        ) : null}
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                            {res.match ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                                <span>{res.match.name}</span>
                              </>
                            ) : (
                              <span>Unrecognized Face #{res.index}</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {res.match
                              ? `Authorized Match · Distance ${res.match.distance.toFixed(3)} · ${(res.match.similarity * 100).toFixed(0)}% similarity`
                              : 'Not matched to any authorized local profile'}
                          </div>
                        </div>
                      </div>

                      <span className="font-mono text-xs text-slate-300 tabular-nums">
                        Det {formatPercent(res.score)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
