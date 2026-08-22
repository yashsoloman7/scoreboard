'use client';

// src/components/importer/GoogleFormSheetImporter.tsx
import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Link as LinkIcon, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Music, 
  Users, 
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import { 
  parseGoogleFormRegistrations, 
  convertGoogleFormsToCompetitionActs, 
  GoogleFormChurchRegistration,
  ParsedParticipantRow 
} from '@/lib/importers/participantImporter';
import { importParticipantsBulk } from '@/actions/participants';
import { supabase } from '@/lib/supabase/client';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface GoogleFormSheetImporterProps {
  competitionId: string;
  onSuccess?: () => void;
}

export function GoogleFormSheetImporter({ competitionId, onSuccess }: GoogleFormSheetImporterProps) {
  const [importMode, setImportMode] = useState<'upload' | 'sheets_link' | 'paste'>('upload');
  const [pastedData, setPastedData] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [rawRegistrations, setRawRegistrations] = useState<GoogleFormChurchRegistration[]>([]);
  const [generatedActs, setGeneratedActs] = useState<ParsedParticipantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Process raw text or CSV
  const handleProcessText = (content: string) => {
    try {
      const parsed = parseGoogleFormRegistrations(content, 'csv');
      setRawRegistrations(parsed);
      const acts = convertGoogleFormsToCompetitionActs(parsed);
      setGeneratedActs(acts);
      setImportStatus(null);
    } catch (err) {
      alert(`Error parsing input: ${err instanceof Error ? err.message : 'Invalid CSV format'}`);
    }
  };

  // 1. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        handleProcessText(content);
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  // 2. Fetch from Google Sheets CSV Link
  const handleFetchSheetLink = async () => {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setImportStatus(null);

    try {
      let fetchUrl = sheetUrl.trim();
      // Auto convert standard Google Sheet Edit URL to CSV Export URL
      if (fetchUrl.includes('docs.google.com/spreadsheets/d/')) {
        const match = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error('Could not fetch sheet data. Ensure the Google Sheet is published or shared as "Anyone with link can view".');
      }

      const csvText = await res.text();
      handleProcessText(csvText);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to fetch Google Sheet data.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Commit to Database
  const handleCommitImport = async () => {
    if (generatedActs.length === 0 || importing) return;
    setImporting(true);
    setShowConfirmModal(false);

    try {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, rounds(id)')
        .eq('competition_id', competitionId)
        .limit(1)
        .maybeSingle();

      const categoryId = cat?.id || competitionId;
      const roundId = cat?.rounds?.[0]?.id || competitionId;

      const res = await importParticipantsBulk(competitionId, categoryId, roundId, generatedActs);

      if (res.success) {
        setImportStatus({
          success: true,
          message: `Successfully imported ${res.importedCount} competition acts across ${rawRegistrations.length} churches!`,
        });
        if (onSuccess) onSuccess();
      } else {
        setImportStatus({
          success: false,
          message: `Import completed with ${res.errors.length} errors: ${res.errors.join(', ')}`,
        });
      }
    } catch (err: unknown) {
      setImportStatus({
        success: false,
        message: `Database error: ${err instanceof Error ? err.message : 'Import failed'}`,
      });
    } finally {
      setImporting(false);
    }
  };

  const SAMPLE_SHEET_CSV = `Timestamp,Email Address,Church Name,Pastor Name,Choir Leader Name,Solo Participant Name,Duet Participant 1,Duet Participant 2,Keyboardist Name,Rhythmist / Drums Name,Guitarist Name,Total Participants
2026-08-20 10:00:00,bhilai@church.org,Bhilai Central Church,Rev. Thomas,Samuel K.,Pratush Hemrm,Parina H. George,B. Paulina,John Samuel,David Raj,Philip K.,15
2026-08-20 10:15:00,raipur@church.org,St. Thomas Cathedral Raipur,Fr. Mathew,Rachel J.,A. Nageshwar Rao,Raj Abhishek Singh,Shifa Masih,Grace Paul,Stephen M.,Daniel V.,18
2026-08-20 10:30:00,durg@church.org,Grace Fellowship Durg,Pastor John,Timothy B.,Sneha Singh,Vijay Kumar,Priya Sharma,Timothy B.,Karan Joshua,Anand M.,14
2026-08-20 10:45:00,bilaspur@church.org,Emmanuel Methodist Bilaspur,Rev. Wilson,Esther R.,Rohan Masih,Sunil Das,Anita Minz,Mark Philip,James Luke,Peter S.,16
2026-08-20 11:00:00,nagpur@church.org,Zion City Church Nagpur,Bishop Paul,Nehemiah T.,Debasish Sen,Rahul Verma,Preeti Toppo,Nehemiah T.,Samson G.,Joshua K.,20`;

  const handleLoadSampleData = () => {
    setPastedData(SAMPLE_SHEET_CSV);
    setImportMode('paste');
    handleProcessText(SAMPLE_SHEET_CSV);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Sheet & CSV Data Importer
            </h2>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Multi-Instrument Parser
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Supports exact sheet format: Sno, Church Name, Solo, Duet (both singers), Group Choir, and individual instrument columns.
          </p>
        </div>

        {/* Sample Data Trigger & Import Mode Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadSampleData}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-950 transition-all transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>⚡ Load Sample Contestant Sheet (15 Acts)</span>
          </button>

          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              onClick={() => setImportMode('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                importMode === 'upload' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" /> Upload CSV
            </button>
            <button
              onClick={() => setImportMode('sheets_link')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                importMode === 'sheets_link' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-4 h-4" /> Google Sheet Link
            </button>
            <button
              onClick={() => setImportMode('paste')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                importMode === 'paste' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clipboard className="w-4 h-4" /> Paste Text
            </button>
          </div>
        </div>
      </div>

      {/* Input Section */}
      {importMode === 'upload' && (
        <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-3xl p-8 text-center transition-all bg-slate-950/50 group">
          <FileSpreadsheet className="w-12 h-12 text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-base font-bold text-white mb-1">Select or Drag CSV File</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Supports exported CSV from Google Sheets / Excel containing Church Name, Solo, Duet, and individual instrument columns.
          </p>
          <label className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-950 cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span>Choose CSV File</span>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {importMode === 'sheets_link' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <LinkIcon className="w-4 h-4 text-cyan-400" />
            <span>Live Google Sheets Integration Link</span>
          </div>
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit#gid=0"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleFetchSheetLink}
              disabled={loading || !sheetUrl.trim()}
              className="px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-cyan-950 disabled:opacity-40 transition-all shrink-0"
            >
              {loading ? 'Fetching...' : 'Fetch Sheet Data'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Make sure your Google Sheet is shared as <strong>"Anyone with the link can view"</strong>.
          </p>
        </div>
      )}

      {importMode === 'paste' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-cyan-400" /> Direct Sheet Copy-Paste
            </span>
            <button
              onClick={() => handleProcessText(pastedData)}
              disabled={!pastedData.trim()}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow disabled:opacity-40 transition-all"
            >
              Parse Data
            </button>
          </div>
          <textarea
            rows={5}
            placeholder={`Sno.\tChurch Name\tSolo Name\tDuet Name\tGuitar\tElectric Guitar\tBass Guitar\tOctopad/Drums\tKeyboard\tDholak\tHarmonium\tTabla / Naal\tClap Box\tSaxophone\tBasuri`}
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      {/* Preview Section */}
      {rawRegistrations.length > 0 && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Parsed Registrations Preview ({rawRegistrations.length} Churches • {generatedActs.length} Scheduled Acts)
              </h3>
              <p className="text-xs text-slate-400">
                Each church submission generates Solo, Duet, and Group Choir acts with tagged instrumentalists.
              </p>
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={importing || generatedActs.length === 0}
              className="px-6 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-950 disabled:opacity-40 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>Import {generatedActs.length} Acts into Event</span>
            </button>
          </div>

          {/* Status Message */}
          {importStatus && (
            <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 ${
              importStatus.success ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-red-950/80 border-red-500 text-red-300'
            }`}>
              {importStatus.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Table Preview */}
          <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase font-extrabold">
                  <th className="py-3 px-4">Sno</th>
                  <th className="py-3 px-4">Church Name</th>
                  <th className="py-3 px-4">Solo Name</th>
                  <th className="py-3 px-4">Duet Name</th>
                  <th className="py-3 px-4">Guitars (Lead/Elec/Bass)</th>
                  <th className="py-3 px-4">Keys / Harmonium</th>
                  <th className="py-3 px-4">Rhythm (Drums/Dholak/Tabla/Cajon)</th>
                  <th className="py-3 px-4">Winds (Sax/Flute)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {rawRegistrations.map((reg, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">#{reg.performanceOrder || idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white">{reg.churchName}</td>
                    <td className="py-3 px-4">
                      {reg.soloParticipantName ? (
                        <span className="font-semibold text-emerald-300">{reg.soloParticipantName}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {reg.duetCombinedName || reg.duetParticipant1 ? (
                        <span className="font-semibold text-teal-300">{reg.duetCombinedName || reg.duetParticipant1}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 space-y-0.5 text-[11px]">
                      {reg.guitarist && <div className="text-purple-300">🎸 Acou: {reg.guitarist}</div>}
                      {reg.electricGuitarist && <div className="text-purple-300">⚡ Elec: {reg.electricGuitarist}</div>}
                      {reg.bassGuitarist && <div className="text-purple-300">🎸 Bass: {reg.bassGuitarist}</div>}
                      {!reg.guitarist && !reg.electricGuitarist && !reg.bassGuitarist && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 space-y-0.5 text-[11px]">
                      {reg.keyboardist && <div className="text-amber-300">🎹 Keys: {reg.keyboardist}</div>}
                      {reg.harmonium && <div className="text-amber-300">🪗 Harm: {reg.harmonium}</div>}
                      {!reg.keyboardist && !reg.harmonium && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 space-y-0.5 text-[11px]">
                      {reg.octopadDrums && <div className="text-rose-300">🥁 Octopad/Drums: {reg.octopadDrums}</div>}
                      {reg.dholak && <div className="text-rose-300">🪘 Dholak: {reg.dholak}</div>}
                      {reg.tablaNaal && <div className="text-rose-300">🪘 Tabla: {reg.tablaNaal}</div>}
                      {reg.clapBox && <div className="text-rose-300">📦 Cajon: {reg.clapBox}</div>}
                      {!reg.octopadDrums && !reg.dholak && !reg.tablaNaal && !reg.clapBox && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 space-y-0.5 text-[11px]">
                      {reg.saxophone && <div className="text-cyan-300">🎷 Sax: {reg.saxophone}</div>}
                      {reg.basuri && <div className="text-cyan-300">🪈 Basuri: {reg.basuri}</div>}
                      {!reg.saxophone && !reg.basuri && <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmModal}
        title="Confirm Participant Import"
        message={`Are you sure you want to import ${generatedActs.length} competition acts for ${rawRegistrations.length} churches into this event? This will generate performance slots and populate the stage queue.`}
        confirmLabel="Yes, Import Acts"
        cancelLabel="No, Review Again"
        variant="primary"
        isLoading={importing}
        onConfirm={handleCommitImport}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}
