import { AppSettings } from "../../types/models";

type SettingsPanelProps = {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
};

export function SettingsPanel({
  settings,
  onChange,
  onSave,
  isSaving
}: SettingsPanelProps) {
  return (
    <section className="panel stack">
      <header className="panel-header">
        <div>
          <h2>Settings</h2>
          <p>Manage the raw PDF inbox and archive output paths.</p>
          <p>
            If the Gemini API key is empty, the app runs in demo mode and
            generates sample classification and explanation instead of reading
            the actual PDF body.
          </p>
        </div>
      </header>
      <label className="field">
        <span>Gemini API Key</span>
        <input
          type="password"
          value={settings.geminiApiKey}
          onChange={(event) =>
            onChange({ ...settings, geminiApiKey: event.target.value })
          }
          placeholder="AIza..."
        />
      </label>
      <label className="field">
        <span>Gemini Model</span>
        <input
          value={settings.geminiModel}
          onChange={(event) =>
            onChange({ ...settings, geminiModel: event.target.value })
          }
          placeholder="gemini-2.0-flash"
        />
      </label>
      <label className="field">
        <span>Raw Root Folder</span>
        <input
          value={settings.rawFolder}
          onChange={(event) =>
            onChange({ ...settings, rawFolder: event.target.value })
          }
          placeholder="D:\\archive\\raw"
        />
      </label>
      <label className="field">
        <span>Archive Root Folder</span>
        <input
          value={settings.archiveFolder}
          onChange={(event) =>
            onChange({ ...settings, archiveFolder: event.target.value })
          }
          placeholder="D:\\archive"
        />
      </label>
      <label className="field">
        <span>Polling Interval (ms)</span>
        <input
          type="number"
          min={1000}
          step={500}
          value={settings.pollIntervalMs}
          onChange={(event) =>
            onChange({
              ...settings,
              pollIntervalMs: Number(event.target.value) || 3000
            })
          }
        />
      </label>
      <div className="actions">
        <button className="primary" onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
