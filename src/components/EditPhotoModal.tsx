"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Save,
  Upload,
  Image as ImageIcon,
  MapPin,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Camera,
  Tag,
  Folder,
  Sliders,
} from "lucide-react";
import { Photo } from "@/types/photo";
import { AdminMapPicker } from "@/components/AdminMapPicker";
import {
  parseCoordinates,
  formatDMS,
} from "@/lib/coordinates";

interface EditPhotoModalProps {
  photoID: string;
  initialPhoto?: Photo | null;
  availableAlbums?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedPhoto: Photo) => void;
}

export function EditPhotoModal({
  photoID,
  initialPhoto,
  availableAlbums,
  isOpen,
  onClose,
  onSaved,
}: EditPhotoModalProps) {
  const router = useRouter();

  // Loading & data states
  const [isLoading, setIsLoading] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(initialPhoto || null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAlbums, setSelectedAlbums] = useState<string[]>([]);
  const [existingAlbums, setExistingAlbums] = useState<string[]>(
    availableAlbums || []
  );
  const [tagsInput, setTagsInput] = useState("");
  const [tripod, setTripod] = useState("");
  const [availability, setAvailability] = useState("Available for Order");

  // Technical details
  const [camera, setCamera] = useState("");
  const [lens, setLens] = useState("");
  const [focalLength, setFocalLength] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [aperture, setAperture] = useState("");
  const [iso, setIso] = useState("");
  const [exposureComp, setExposureComp] = useState("");
  const [whiteBalance, setWhiteBalance] = useState("");

  // Coordinates
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [coordInput, setCoordInput] = useState("");
  const [coordError, setCoordError] = useState("");
  const [coordFeedback, setCoordFeedback] = useState("");

  // Replacement image file
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementPreview, setReplacementPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Populate form fields from photo
  const populateFields = (p: Photo) => {
    setPhoto(p);
    setTitle(p.title || "");
    setDescription(p.description || "");
    setSelectedAlbums(
      (p.categories || []).filter(
        (c) => c && c.trim() && c.trim().toLowerCase() !== "all"
      )
    );
    setTagsInput((p.keywords || []).join(", "));
    setTripod(p.tripod || "None");
    setAvailability(p.availability || "Available for Order");

    setCamera(p.camera || "");
    setLens(p.lens || "");
    setFocalLength(p.focalLength || "");
    setShutterSpeed(p.shutterspeed || (p as any).shutterSpeed || "");
    setAperture(p.aperture || "");
    setIso(p.sensitivity || (p as any).iso || "");
    setExposureComp(p.exposureCompensation || "");
    setWhiteBalance(p.whiteBalance || "");

    if (p.location && typeof p.location.latitude === "number" && typeof p.location.longitude === "number") {
      setLatitude(p.location.latitude);
      setLongitude(p.location.longitude);
      setCoordInput(`${p.location.latitude}, ${p.location.longitude}`);
    } else {
      setLatitude(null);
      setLongitude(null);
      setCoordInput("");
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage("");
    setSuccessMessage("");
    setReplacementFile(null);
    setReplacementPreview(null);

    if (availableAlbums && availableAlbums.length > 0) {
      setExistingAlbums(availableAlbums);
    } else {
      fetch("/api/admin/metadata")
        .then((res) => res.json())
        .then((data) => {
          if (data.albums) {
            setExistingAlbums(data.albums);
          }
        })
        .catch(() => {});
    }

    if (initialPhoto && initialPhoto.photoID === photoID) {
      populateFields(initialPhoto);
    } else {
      setIsLoading(true);
      fetch(`/api/admin/photo/${encodeURIComponent(photoID)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.photo) {
            populateFields(data.photo);
          } else {
            setErrorMessage(data.error || "Photograph not found");
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || "Failed to load photo details");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, photoID]);

  if (!isOpen) return null;

  // File replacement handler
  const handleFileChange = (file: File) => {
    setReplacementFile(file);
    const url = URL.createObjectURL(file);
    setReplacementPreview(url);
  };

  // Coordinate handlers
  const handleMapCoordinatesChange = (lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
    setCoordInput(`${lat}, ${lon}`);
    setCoordError("");
    setCoordFeedback("Pin position selected from interactive map");
  };

  const handleCoordInputChange = (val: string) => {
    setCoordInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setLatitude(null);
      setLongitude(null);
      setCoordError("");
      setCoordFeedback("");
      return;
    }
    const parsed = parseCoordinates(val);
    if (parsed) {
      setLatitude(parsed.latitude);
      setLongitude(parsed.longitude);
      setCoordError("");
      setCoordFeedback(`Coordinates applied: ${parsed.latitude}, ${parsed.longitude}`);
    }
  };

  const handleApplyCoordinates = () => {
    const trimmed = coordInput.trim();
    if (!trimmed) {
      setLatitude(null);
      setLongitude(null);
      setCoordError("");
      setCoordFeedback("");
      return;
    }
    const parsed = parseCoordinates(coordInput);
    if (parsed) {
      setLatitude(parsed.latitude);
      setLongitude(parsed.longitude);
      setCoordInput(`${parsed.latitude}, ${parsed.longitude}`);
      setCoordError("");
      setCoordFeedback(`Coordinates applied: ${parsed.latitude}, ${parsed.longitude}`);
    } else {
      setCoordError("Unrecognized format. Enter as 'lat, lon' (e.g. 35.799292, -82.954774), DMS, or map URL.");
    }
  };

  const handleCoordInputBlur = () => {
    const trimmed = coordInput.trim();
    if (!trimmed) {
      setCoordError("");
      return;
    }
    const parsed = parseCoordinates(coordInput);
    if (parsed) {
      setLatitude(parsed.latitude);
      setLongitude(parsed.longitude);
      setCoordInput(`${parsed.latitude}, ${parsed.longitude}`);
      setCoordError("");
    } else {
      setCoordError("Unrecognized format. Enter as 'lat, lon' (e.g. 35.799292, -82.954774), DMS, or map URL.");
    }
  };

  const handleClearCoordinates = () => {
    setLatitude(null);
    setLongitude(null);
    setCoordInput("");
    setCoordError("");
    setCoordFeedback("");
  };

  // Submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("albums", selectedAlbums.join(", "));
      formData.append("tags", tagsInput);
      formData.append("tripod", tripod);
      formData.append("availability", availability);

      formData.append("camera", camera);
      formData.append("lens", lens);
      formData.append("focalLength", focalLength);
      formData.append("shutterspeed", shutterSpeed);
      formData.append("aperture", aperture);
      formData.append("iso", iso);
      formData.append("exposureCompensation", exposureComp);
      formData.append("whiteBalance", whiteBalance);

      if (latitude !== null && longitude !== null) {
        formData.append("latitude", String(latitude));
        formData.append("longitude", String(longitude));
        formData.append("hasLocation", "true");
      } else {
        formData.append("latitude", "");
        formData.append("longitude", "");
        formData.append("hasLocation", "false");
      }

      if (replacementFile) {
        formData.append("file", replacementFile);
      }

      const res = await fetch(`/api/admin/photo/${encodeURIComponent(photoID)}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update photograph");
      }

      setSuccessMessage(
        data.imageReplaced
          ? "Photograph details and image file updated successfully!"
          : "Photograph details saved successfully!"
      );

      if (data.photo) {
        setPhoto(data.photo);
        if (onSaved) {
          onSaved(data.photo);
        }
      }

      // Refresh Next.js cache and data
      router.refresh();

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update photograph");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-border rounded-sm max-w-3xl w-full my-8 p-6 space-y-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-accent" />
            <h2 className="text-base font-medium text-foreground">
              Edit Photograph <span className="font-mono text-xs text-accent">({photoID})</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
            title="Close editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="space-y-6 overflow-y-auto pr-1 flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section: Image & Replacement */}
          <div className="space-y-3 bg-surface border border-surface-border p-4 rounded-sm">
            <label className="block text-xs font-medium text-foreground uppercase tracking-wider">
              Photograph Image File
            </label>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="relative w-32 h-24 bg-surface-hover/50 dark:bg-black border border-surface-border rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                {replacementPreview ? (
                  <img
                    src={replacementPreview}
                    alt="Replacement Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : photo?.imageDesktop ? (
                  <img
                    src={photo.imageDesktop}
                    alt={photo.title}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-xs text-muted leading-relaxed">
                  {replacementFile ? (
                    <span className="text-emerald-400 font-medium">
                      Replacement file chosen: {replacementFile.name} ({(replacementFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  ) : (
                    "Upload a replacement image file to overwrite the desktop JPEG and regenerate optimized thumbnails."
                  )}
                </p>

                <div className="flex items-center space-x-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent text-foreground text-xs rounded transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-accent" />
                    <span>{replacementFile ? "Choose Different Image" : "Replace Image File"}</span>
                  </button>

                  {replacementFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplacementFile(null);
                        setReplacementPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-xs text-muted hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Cancel Replacement
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Title & Description */}
          <div className="space-y-4 bg-surface border border-surface-border p-4 rounded-sm">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Photograph Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Max Patch View, Fall, Band of Trees"
                className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Artist Description & Story
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Narrative description, artistic intent, and natural history..."
                className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Section: Geographic Location & Coordinates */}
          <div className="space-y-4 bg-surface border border-surface-border p-4 rounded-sm">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <div className="flex items-center space-x-2 text-xs font-medium text-foreground uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span>Geographic Location & Coordinates</span>
              </div>
              {latitude !== null && longitude !== null ? (
                <span className="text-xs font-mono text-accent font-medium">
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </span>
              ) : (
                <span className="text-xs text-muted">No coordinates set</span>
              )}
            </div>

            {/* Unified Coordinates Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-muted uppercase tracking-wider">
                Coordinates (e.g. 35.799292, -82.954774 or 35°47&apos;57&quot;N 82°57&apos;17&quot;W)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Compass className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={coordInput}
                    onChange={(e) => handleCoordInputChange(e.target.value)}
                    onBlur={handleCoordInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoordinates();
                      }
                    }}
                    placeholder="Enter or paste coordinates (lat, lon, DMS, or Google Maps URL)..."
                    className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-border rounded text-xs font-mono text-foreground placeholder-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCoordinates}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent text-foreground text-xs rounded font-medium transition-colors flex-shrink-0 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            {coordError && (
              <p className="text-xs text-red-400 font-medium">{coordError}</p>
            )}

            {coordFeedback && !coordError && (
              <p className="text-xs text-accent flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{coordFeedback}</span>
              </p>
            )}

            {/* Interactive Map Picker */}
            <AdminMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={handleMapCoordinatesChange}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {latitude !== null && longitude !== null ? (
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleClearCoordinates}
                    className="text-xs text-muted hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear coordinates
                  </button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs text-accent hover:underline"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <span className="text-xs text-muted italic">
                  Tip: Paste from Google Maps or click anywhere on the map
                </span>
              )}

              {latitude !== null && longitude !== null && (
                <span className="text-[11px] font-mono text-muted">
                  {formatDMS(latitude, longitude)}
                </span>
              )}
            </div>
          </div>

          {/* Section: Albums & Tags */}
          <div className="space-y-4 bg-surface border border-surface-border p-4 rounded-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground">
                  Curated Albums ({selectedAlbums.length} selected)
                </label>
                <span className="text-[11px] text-muted">
                  Select from existing albums
                </span>
              </div>

              {/* Existing albums pill grid */}
              <div className="p-3 bg-surface-hover/50 border border-surface-border rounded max-h-44 overflow-y-auto">
                {existingAlbums.length === 0 ? (
                  <p className="text-xs text-muted">Loading albums...</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {existingAlbums.map((alb) => {
                      const isSelected = selectedAlbums.some(
                        (a) => a.toLowerCase() === alb.toLowerCase()
                      );
                      return (
                        <button
                          key={alb}
                          type="button"
                          onClick={() => {
                            setSelectedAlbums((prev) =>
                              prev.some((a) => a.toLowerCase() === alb.toLowerCase())
                                ? prev.filter((a) => a.toLowerCase() !== alb.toLowerCase())
                                : [...prev, alb]
                            );
                          }}
                          className={`px-2.5 py-1 rounded text-xs transition-all flex items-center space-x-1.5 cursor-pointer border ${
                            isSelected
                              ? "bg-accent text-accent-contrast border-accent font-medium shadow-sm"
                              : "bg-surface text-muted hover:text-foreground border-surface-border hover:border-accent/40"
                          }`}
                        >
                          <Folder className="w-3 h-3 flex-shrink-0" />
                          <span>{alb}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedAlbums.length === 0 ? (
                <p className="text-[11px] text-muted italic">
                  ℹ No curated album selected. This photograph will only appear in <strong>All Photographs</strong>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1 items-center text-[11px] text-muted">
                  <span>Assigned:</span>
                  {selectedAlbums
                    .map((a) => (
                      <span key={a} className="text-foreground font-medium">
                        {a}
                      </span>
                    ))
                    .reduce((prev, curr) => [prev, ", ", curr] as any)}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Tags / Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Appalachian Trail, Max Patch, sunrise, trees"
                className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Section: Camera & Technical Exposure */}
          <div className="space-y-3 bg-surface border border-surface-border p-4 rounded-sm">
            <div className="flex items-center space-x-2 text-xs font-medium text-foreground uppercase tracking-wider border-b border-surface-border pb-2">
              <Camera className="w-3.5 h-3.5 text-accent" />
              <span>Camera & Technical Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">Camera Model</label>
                <input
                  type="text"
                  value={camera}
                  onChange={(e) => setCamera(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Lens Model</label>
                <input
                  type="text"
                  value={lens}
                  onChange={(e) => setLens(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Focal Length</label>
                <input
                  type="text"
                  value={focalLength}
                  onChange={(e) => setFocalLength(e.target.value)}
                  placeholder="e.g. 70 mm"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Shutter Speed</label>
                <input
                  type="text"
                  value={shutterSpeed}
                  onChange={(e) => setShutterSpeed(e.target.value)}
                  placeholder="e.g. 1/125 ss or 0.8s"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Aperture</label>
                <input
                  type="text"
                  value={aperture}
                  onChange={(e) => setAperture(e.target.value)}
                  placeholder="e.g. f8 or f11"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">ISO Sensitivity</label>
                <input
                  type="text"
                  value={iso}
                  onChange={(e) => setIso(e.target.value)}
                  placeholder="e.g. ISO 100"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Exposure Comp</label>
                <input
                  type="text"
                  value={exposureComp}
                  onChange={(e) => setExposureComp(e.target.value)}
                  placeholder="e.g. 0 Ev or +0.7 Ev"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Tripod Gear</label>
                <input
                  type="text"
                  value={tripod}
                  onChange={(e) => setTripod(e.target.value)}
                  placeholder="e.g. Manfrotto Befree GT XPRO Carbon"
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-surface-border flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground text-xs rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-accent hover:bg-accent-light text-black text-xs font-semibold rounded shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
