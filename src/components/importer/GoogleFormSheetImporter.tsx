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
  const [expandThreeActs, setExpandThreeActs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

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

    try {
      // Resolve or get default category and round for the competition
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

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Google Form & CSV Data Importer
            </h2>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Form Schema Verified
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Seamlessly import Church Registrations, Soloists, Duet Pairs, Choir Leaders, and Instrumentalists.
          </p>
        </div>

        {/* Import Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            onClick={() => setImportMode('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              importMode === 'upload' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload CSV
          </button>
          <button
            onClick={() => setImportMode('sheets_link')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              importMode === 'sheets_link' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" /> Google Sheet Link
          </button>
          <button
            onClick={() => setImportMode('paste')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              importMode === 'paste' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clipboard className="w-4 h-4" /> Paste Text
          </button>
        </div>
      </div>

      {/* Input Section */}
      {importMode === 'upload' && (
        <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-3xl p-8 text-center transition-all bg-slate-950/50 group">
          <FileSpreadsheet className="w-12 h-12 text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-base font-bold text-white mb-1">Select or Drag Google Form CSV File</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Supports exported Google Sheets responses (.csv) containing CHURCH NAME, SOLO, DUET, and INSTRUMENT fields.
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
            Note: In Google Sheets, make sure the sheet is shared as <strong>"Anyone with the link can view"</strong>.
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
            placeholder={`Timestamp\tEmail Address\tCHURCH NAME\tPASTOR/ FATHER NAME\tCHOIR LEADER NAME\tSOLO PARTICPANT NAME\tDUET PARTICPANT NAME 1\tDUET PARTICPANT NAME 2\tTOTAL INSTRUMENT PLAYER WITH INSTRUMENT NAME\tNO. OF PARTICPANTS\tNO. Of EXTRA PERSON`}
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
                Each church submission is automatically divided into Solo, Duet, and Group acts with tagged instrumentalists.
              </p>
            </div>

            <button
              onClick={handleCommitImport}
              disabled={importing || generatedActs.length === 0}
              className="px-6 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-950 disabled:opacity-40 flex items-center gap-2 transition-all active:scale-95"
            >
              <Database className="w-4 h-4" />
              {importing ? 'Importing Acts...' : `1-Click Import ${generatedActs.length} Acts into Event`}
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
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Church & Pastor</th>
                  <th className="py-3 px-4">Solo Performer</th>
                  <th className="py-3 px-4">Duet Performers</th>
                  <th className="py-3 px-4">Choir Leader & Size</th>
                  <th className="py-3 px-4">Special Instrumentalists</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {rawRegistrations.map((reg, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{reg.churchName}</div>
                      {reg.pastorName && <div className="text-[11px] text-slate-400">Pastor: {reg.pastorName}</div>}
                    </td>
                    <td className="py-3 px-4">
                      {reg.soloParticipantName ? (
                        <span className="font-semibold text-emerald-300">{reg.soloParticipantName}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {reg.duetParticipant1 || reg.duetParticipant2 ? (
                        <span className="font-semibold text-teal-300">
                          {[reg.duetParticipant1, reg.duetParticipant2].filter(Boolean).join(' & ')}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-indigo-300">{reg.choirLeaderName || 'Church Choir'}</span>
                        {reg.numberOfParticipants && (
                          <span className="ml-1 text-[10px] text-slate-400">({reg.numberOfParticipants} members)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 space-y-0.5">
                      {reg.bestKeyboardist && (
                        <div className="text-[11px] text-amber-300">🎹 Keys: {reg.bestKeyboardist}</div>
                      )}
                      {reg.bestRhythmist && (
                        <div className="text-[11px] text-rose-300">🥁 Rhythm: {reg.bestRhythmist}</div>
                      )}
                      {reg.bestGuitarist && (
                        <div className="text-[11px] text-purple-300">🎸 Guitar: {reg.bestGuitarist}</div>
                      )}
                      {!reg.bestKeyboardist && !reg.bestRhythmist && !reg.bestGuitarist && (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
