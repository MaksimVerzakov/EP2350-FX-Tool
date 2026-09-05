import React, { useState } from 'react';
import { PackConfig } from '../types/config';
import { serializeToConfigJson, validatePackConfig } from '../utils/serializer';
import { Copy, Check, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface JsonPreviewProps {
  pack: PackConfig;
  onExport: () => void;
}

export const JsonPreview: React.FC<JsonPreviewProps> = ({ pack, onExport }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = serializeToConfigJson(pack);
  const issues = validatePackConfig(pack);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasErrors = issues.some((i) => i.type === 'error');
  const hasWarnings = issues.some((i) => i.type === 'warning');

  return (
    <div className="te-chassis-panel p-4 border border-[#18191a] shadow-md flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#18191a] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#18191a]">
            LIVE CONFIG.JSON (ANATOMY PREVIEW)
          </span>
          {hasErrors ? (
            <span className="bg-[#e05526] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> ERRORS DETECTED
            </span>
          ) : hasWarnings ? (
            <span className="bg-[#f15a22] text-black text-[8px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> WARNING
            </span>
          ) : (
            <span className="bg-[#00a69c] text-black text-[8px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> TE SPEC VALID
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="te-btn te-btn-secondary text-[10px] py-1 px-2.5"
            title="Copy JSON to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#00a69c]" /> COPIED!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> COPY
              </>
            )}
          </button>

          <button
            onClick={onExport}
            className="te-btn te-btn-orange text-[10px] py-1 px-2.5"
            title="Download config.json for fx-mic disk root"
          >
            <Download className="w-3 h-3" /> EXPORT
          </button>
        </div>
      </div>

      {/* Validation Issues Banner */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-1 bg-[#232424] text-white p-2 border border-[#18191a] text-[10px] font-mono">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-1.5 ${
                issue.type === 'error' ? 'text-[#e05526]' : 'text-[#f15a22]'
              }`}
            >
              <span>•</span>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Code Viewer Panel */}
      <div className="te-lcd p-3 border-2 border-[#18191a] max-h-[380px] overflow-y-auto">
        <pre className="text-[11px] font-mono leading-relaxed text-[#00a69c] te-lcd-glow select-text whitespace-pre">
          {jsonString}
        </pre>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-[#656d73]">
        <span>INSTALL PATH: <code>/Volumes/fx-mic disk/config.json</code></span>
        <span>RECOVERY: HOLD <code>WHITE + GREY</code> ON BOOT</span>
      </div>
    </div>
  );
};
