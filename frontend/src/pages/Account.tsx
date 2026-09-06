import React from 'react';
import {
 API_BASE_URL,
 apiDelete,
 apiGet,
 apiPost,
 apiPut,
 apiUpload,
} from '../lib/api';
import { roleLabel } from '../lib/roles';
import Card from '../components/Card';
import SecuritySettingsCard from '../components/SecuritySettingsCard';
import { PageHeader } from '../components/ui';

// Employee self-service: the things every signed-in person owns about
// themselves — display name, photo, password, 2FA and their GDPR export.

type Me = {
 id: number;
 email: string;
 name: string | null;
 role: string;
 employeeId: number | null;
 totpEnabled: boolean;
};

const PHOTO_MAX_SIZE = 2 * 1024 * 1024;
const PHOTO_TYPES = ['image/png', 'image/jpeg'];

const inputClass =
 'form-input mt-1 disabled:bg-surface-2';

const successClass =
 'mb-3 rounded-md border border-ok bg-ok-tint px-3 py-2 text-sm text-ok ';

const errorClass =
 'mb-3 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad ';

function initials(me: Me | null) {
 const source = (me?.name || me?.email || '').trim();
 if (!source) return '?';
 const parts = source.split(/[\s.@_-]+/).filter(Boolean);
 return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function downloadBlob(blob: Blob, filename: string) {
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}

export default function Account() {
 const [me, setMe] = React.useState<Me | null>(null);
 const [name, setName] = React.useState('');
 const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
 const [profileMessage, setProfileMessage] = React.useState('');
 const [profileError, setProfileError] = React.useState('');

 const [currentPassword, setCurrentPassword] = React.useState('');
 const [newPassword, setNewPassword] = React.useState('');
 const [confirmPassword, setConfirmPassword] = React.useState('');
 const [passwordMessage, setPasswordMessage] = React.useState('');
 const [passwordError, setPasswordError] = React.useState('');

 const [exporting, setExporting] = React.useState('');
 const [exportError, setExportError] = React.useState('');

 React.useEffect(() => {
 apiGet('/auth/me')
      .then((user) => {
 setMe(user);
 setName(user.name || '');
 if (user.employeeId) {
 apiGet(`/employees/${user.employeeId}/photo`)
            .then((photo) => setPhotoUrl(photo.url || null))
            .catch(() => setPhotoUrl(null));
        }
      })
      .catch((e) => setProfileError(e.message));
  }, []);

 async function saveName(e: React.FormEvent) {
 e.preventDefault();
 setProfileError('');
 setProfileMessage('');
 try {
 const updated = await apiPut('/auth/me', { name });
 setMe(updated);
 setName(updated.name || '');
 setProfileMessage('Profile saved.');
    } catch (e: any) {
 setProfileError(e.message);
    }
  }

 async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file || !me?.employeeId) return;

 setProfileError('');
 setProfileMessage('');
 if (!PHOTO_TYPES.includes(file.type)) {
 setProfileError('Photo must be a PNG or JPG image.');
 return;
    }
 if (file.size > PHOTO_MAX_SIZE) {
 setProfileError('Photo is too large (max 2MB).');
 return;
    }

 try {
 const fd = new FormData();
 fd.append('file', file);
 const saved = await apiUpload(`/employees/${me.employeeId}/photo`, fd);
 setPhotoUrl(saved.url || null);
 setProfileMessage('Photo updated.');
    } catch (err: any) {
 setProfileError(err.message);
    }
  }

 async function removePhoto() {
 if (!me?.employeeId) return;
 setProfileError('');
 setProfileMessage('');
 try {
 await apiDelete(`/employees/${me.employeeId}/photo`);
 setPhotoUrl(null);
 setProfileMessage('Photo removed.');
    } catch (err: any) {
 setProfileError(err.message);
    }
  }

 async function changePassword(e: React.FormEvent) {
 e.preventDefault();
 setPasswordError('');
 setPasswordMessage('');

 if (newPassword.length < 8) {
 setPasswordError('New password must be at least 8 characters');
 return;
    }
 if (newPassword !== confirmPassword) {
 setPasswordError('New password and confirmation do not match');
 return;
    }

 try {
 const res = await apiPost('/auth/change-password', {
 currentPassword,
 newPassword,
      });
      // Every other session is invalidated server-side, so this session has to
      // adopt the fresh token or its next call signs the user out.
 if (res.token) localStorage.setItem('token', res.token);
 setCurrentPassword('');
 setNewPassword('');
 setConfirmPassword('');
 setPasswordMessage(
 'Password changed. Any other devices you were signed in on have been signed out.',
      );
    } catch (err: any) {
 setPasswordError(err.message);
    }
  }

 async function exportMyData(format: 'json' | 'excel') {
 if (!me?.employeeId) return;
 setExportError('');
 setExporting(format);
 try {
 const token = localStorage.getItem('token');
 const path =
 format === 'json'
          ? `/gdpr/subject-access-request/${me.employeeId}`
          : `/gdpr/export-employee-data/${me.employeeId}`;
 const response = await fetch(`${API_BASE_URL}${path}`, {
 headers: { Authorization: `Bearer ${token}` },
      });
 if (!response.ok) {
 const error = await response.json().catch(() => ({}));
 throw new Error(error.error || 'Export failed');
      }

 const stamp = new Date().toISOString().split('T')[0];
 if (format === 'json') {
 const data = await response.json();
 downloadBlob(
 new Blob([JSON.stringify(data, null, 2)], {
 type: 'application/json',
          }),
 `my-data-${stamp}.json`,
        );
      } else {
 downloadBlob(await response.blob(), `my-data-${stamp}.xlsx`);
      }
    } catch (err: any) {
 setExportError(err.message);
    } finally {
 setExporting('');
    }
  }

 return (
    <div>
      <PageHeader className="mb-6" title="My account" subline="Your profile, password, two-factor login and a copy of your data." />

      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-base font-semibold text-ink mb-1">
 Profile
          </h3>
          <p className="mb-4 text-sm text-ink-2">
 Your display name and photo are what colleagues see across the app.
 Email and access role are set by your HR administrator.
          </p>

          {profileMessage && (
            <div className={successClass}>{profileMessage}</div>
          )}
          {profileError && <div className={errorClass}>{profileError}</div>}

          <div className="mb-5 flex items-center gap-4">
            {photoUrl ? (
              <img
 src={photoUrl}
 alt="Your profile photo"
 className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div
 aria-hidden="true"
 className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-tint text-lg font-semibold text-link"
              >
                {initials(me)}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <label
 htmlFor="account-photo"
 className="btn-primary cursor-pointer"
                >
                  {photoUrl ? 'Replace photo' : 'Upload photo'}
                </label>
                <input
 id="account-photo"
 type="file"
 accept="image/png,image/jpeg"
 className="hidden"
 disabled={!me?.employeeId}
 onChange={uploadPhoto}
                />
                {photoUrl && (
                  <button
 type="button"
 onClick={removePhoto}
 className="btn-ghost"
                  >
 Remove
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {me && !me.employeeId
                  ? 'A photo needs an employee record — ask your HR administrator to link one.'
                  : 'PNG or JPG, up to 2MB.'}
              </p>
            </div>
          </div>

          <form onSubmit={saveName} className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Display name</span>
              <input
 value={name}
 onChange={(e) => setName(e.target.value)}
 required
 className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Email</span>
              <input value={me?.email ?? ''} disabled className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Access role</span>
              <input
 value={me ? roleLabel(me.role) : ''}
 disabled
 className={inputClass}
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary" disabled={!me}>
 Save profile
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-semibold text-ink mb-1">
 Change password
          </h3>
          <p className="mb-4 text-sm text-ink-2">
 Changing your password signs you out everywhere else. This device
 stays signed in.
          </p>

          {passwordMessage && (
            <div className={successClass}>{passwordMessage}</div>
          )}
          {passwordError && <div className={errorClass}>{passwordError}</div>}

          <form onSubmit={changePassword} className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="font-medium">Current password</span>
              <input
 type="password"
 autoComplete="current-password"
 value={currentPassword}
 onChange={(e) => setCurrentPassword(e.target.value)}
 required
 className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">New password</span>
              <input
 type="password"
 autoComplete="new-password"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 required
 className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Confirm new password</span>
              <input
 type="password"
 autoComplete="new-password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 required
 className={inputClass}
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">
 Change password
              </button>
            </div>
          </form>
        </Card>

        <SecuritySettingsCard />

        <Card className="p-6">
          <h3 className="text-base font-semibold text-ink mb-1">
 Download my data
          </h3>
          <p className="mb-4 text-sm text-ink-2">
 Your UK GDPR subject access request: personal and employment
 details, timesheets, leave, documents, consents and access history.
          </p>

          {exportError && <div className={errorClass}>{exportError}</div>}

          {me && !me.employeeId ? (
            <p className="text-sm text-ink-2">
 There is no employee record linked to your login yet, so there is
 nothing to export.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
 type="button"
 onClick={() => exportMyData('json')}
 disabled={!me || !!exporting}
 className="btn-primary disabled:opacity-50"
              >
                {exporting === 'json' ? 'Exporting…' : 'Download JSON'}
              </button>
              <button
 type="button"
 onClick={() => exportMyData('excel')}
 disabled={!me || !!exporting}
 className="btn-ghost disabled:opacity-50"
              >
                {exporting === 'excel' ? 'Exporting…' : 'Download Excel'}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
