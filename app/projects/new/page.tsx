"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileText,
  MapIcon,
  Loader2,
  X,
  FileCheck,
  Leaf,
  CheckCircle2,
} from "@/components/icons";

export default function SubmitProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pddFiles, setPddFiles] = useState<File[]>([]);
  const [geoFiles, setGeoFiles] = useState<File[]>([]);
  const [parsedGeoJson, setParsedGeoJson] = useState<unknown | null>(null);
  const [geoStatusMsg, setGeoStatusMsg] = useState<string | null>(null);
  const pddInputRef = useRef<HTMLInputElement>(null);
  const geoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "GreenCorridor Carbon Reserve",
    project_type: "AFFORESTATION",
    area_hectares: 120.0,
    claimed_tco2e: 12000.0,
    description: "High-integrity multi-species reforestation project with biodiversity corridors.",
    country_code: "IN",
  });

  const handlePddAdd = (files: FileList | null) => {
    if (!files) return;
    setPddFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const handleGeoAdd = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setGeoFiles((prev) => [...prev, ...fileList]);

    const primaryFile = fileList[0];
    try {
      const text = await primaryFile.text();
      const json = JSON.parse(text);
      setParsedGeoJson(json);
      setGeoStatusMsg(`✓ Loaded ${primaryFile.name} — GeoJSON validated.`);
    } catch {
      setGeoStatusMsg(`⚠ File ${primaryFile.name} loaded (will be processed on server).`);
    }
  };

  const removeFile = (
    name: string,
    setter: React.Dispatch<React.SetStateAction<File[]>>,
  ) => {
    setter((prev) => prev.filter((f) => f.name !== name));
    if (setter === setGeoFiles) {
      setParsedGeoJson(null);
      setGeoStatusMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          project_type: formData.project_type,
          area_hectares: formData.area_hectares,
          claimed_tco2e: formData.claimed_tco2e,
          description: formData.description,
          boundary_geojson: parsedGeoJson,
          country_code: formData.country_code,
          pdd_filename: pddFiles[0]?.name,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Project registration failed");
      }

      const newId = body.data.id;
      router.push(`/projects/${newId}/verify`);
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to submit project. Please verify the boundary file and retry.",
      );
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[var(--cx-surface-inset)] border border-[var(--cx-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--cx-text-muted)] focus:outline-none focus:border-[var(--cx-accent)] transition text-sm";
  const labelClass =
    "text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-secondary)]";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[var(--cx-accent)] text-xs font-bold uppercase tracking-wider mb-1">
          <Leaf className="w-4 h-4" /> Multi-Modal Pipeline
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Submit Project for Verification
        </h1>
        <p className="text-[var(--cx-text-muted)] mt-1.5 text-sm">
          Upload project design documents (PDD) and GeoJSON boundary files to run the automated evidence reconciliation and AI Truth Score engine.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-6 sm:p-8 space-y-8 shadow-xl"
      >
        {/* Project Details */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cx-text-muted)] mb-4 border-b border-[var(--cx-border-subtle)] pb-2">
            Project Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Project Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Project Type</label>
              <select
                className={inputClass}
                value={formData.project_type}
                onChange={(e) =>
                  setFormData({ ...formData, project_type: e.target.value })
                }
              >
                <option value="AFFORESTATION">Afforestation (A/R)</option>
                <option value="CONSERVATION">Conservation (REDD+)</option>
                <option value="RENEWABLE">Renewable Energy</option>
                <option value="BLUE_CARBON">Blue Carbon</option>
                <option value="SOIL_CARBON">Soil Carbon</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Claimed Area (Hectares)</label>
              <input
                type="number"
                required
                min={0.1}
                step="0.01"
                value={formData.area_hectares}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    area_hectares: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Claimed Carbon (tCO2e)</label>
              <input
                type="number"
                required
                min={1}
                value={formData.claimed_tco2e}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    claimed_tco2e: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelClass}>
                Description{" "}
                <span className="text-[var(--cx-text-muted)] font-normal text-xs">
                  (optional)
                </span>
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className={`${inputClass} resize-none`}
                placeholder="Brief project description and methodology overview…"
              />
            </div>
          </div>
        </div>

        {/* Evidence Upload Dropzones */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cx-text-muted)] mb-4 border-b border-[var(--cx-border-subtle)] pb-2">
            Evidence Upload
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* PDD Upload */}
            <div className="space-y-2">
              <p className={labelClass}>Project Design Document (PDD)</p>
              <input
                ref={pddInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => handlePddAdd(e.target.files)}
              />
              <div
                onClick={() => pddInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--cx-border)] rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:border-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.05)] transition group"
              >
                <FileText className="w-7 h-7 text-[var(--cx-text-muted)] group-hover:text-[var(--cx-accent)] transition" />
                <span className="text-sm font-semibold text-white group-hover:text-[var(--cx-accent)] transition">
                  Upload PDD Document
                </span>
                <span className="text-xs text-[var(--cx-text-muted)]">
                  PDF, DOCX — max 50MB
                </span>
              </div>
              {pddFiles.length > 0 && (
                <div className="space-y-1">
                  {pddFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 text-xs bg-[rgba(114,176,132,0.12)] border border-[rgba(114,176,132,0.3)] rounded-lg px-3 py-2 text-[var(--cx-success)]"
                    >
                      <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(f.name, setPddFiles)}
                      >
                        <X className="w-3.5 h-3.5 hover:text-red-400 transition" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GeoJSON Upload */}
            <div className="space-y-2">
              <p className={labelClass}>Project Boundary Geometry</p>
              <input
                ref={geoInputRef}
                type="file"
                multiple
                accept=".geojson,.json,.kml,.tif,.tiff"
                className="hidden"
                onChange={(e) => void handleGeoAdd(e.target.files)}
              />
              <div
                onClick={() => geoInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--cx-border)] rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:border-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.05)] transition group"
              >
                <MapIcon className="w-7 h-7 text-[var(--cx-text-muted)] group-hover:text-[var(--cx-accent)] transition" />
                <span className="text-sm font-semibold text-white group-hover:text-[var(--cx-accent)] transition">
                  Upload Boundary File
                </span>
                <span className="text-xs text-[var(--cx-text-muted)]">
                  GeoJSON, KML, Shapefile
                </span>
              </div>
              {geoFiles.length > 0 && (
                <div className="space-y-1">
                  {geoFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 text-xs bg-[rgba(114,176,132,0.12)] border border-[rgba(114,176,132,0.3)] rounded-lg px-3 py-2 text-[var(--cx-success)]"
                    >
                      <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(f.name, setGeoFiles)}
                      >
                        <X className="w-3.5 h-3.5 hover:text-red-400 transition" />
                      </button>
                    </div>
                  ))}
                  {geoStatusMsg && (
                    <div className="text-[11px] text-[var(--cx-success)] font-mono px-1">
                      {geoStatusMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {pddFiles.length === 0 && geoFiles.length === 0 && (
            <p className="text-xs text-[var(--cx-warning)] bg-[rgba(237,142,89,0.1)] border border-[rgba(237,142,89,0.25)] rounded-lg px-4 py-2.5 mt-3">
              No custom files selected — the pipeline will automatically generate a verified reference boundary and registry dataset.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--cx-border-subtle)]">
          <Link
            href="/?mode=command"
            className="cx-mono text-xs text-[var(--cx-text-muted)] hover:text-white transition"
          >
            ← Back to Dashboard
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="cx-mono flex items-center gap-2 bg-[var(--cx-accent)] hover:bg-[var(--cx-accent-hover)] text-[#121025] px-8 py-3 rounded-xl font-bold tracking-wider uppercase transition shadow-lg disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? (
              <Loader2 className="w-4 h-4" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {loading ? "Registering & Starting Pipeline…" : "Start Verification"}
          </button>
        </div>
      </form>
    </div>
  );
}
