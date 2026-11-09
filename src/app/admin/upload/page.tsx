"use client";

import { useState, useEffect, useRef } from "react";
import exifr from "exifr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Camera,
  MapPin,
  Tag,
  Folder,
  CheckCircle2,
  Lock,
  LogOut,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Sliders,
  Settings as SettingsIcon,
  Palette,
  ArrowUpDown,
  Clock,
  Save,
  Plus,
  X,
  History,
} from "lucide-react";
import { AdminMapPicker } from "@/components/AdminMapPicker";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { THEME_PRESETS, SiteSettings, DEFAULT_SETTINGS } from "@/types/settings";

interface MetadataResponse {
  albums: string[];
  popularTags: { tag: string; count: number }[];
  allTags: string[];
  commonTripods: string[];
}

export default function AdminUploadPage() {
  const router = useRouter();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"upload" | "settings">("upload");

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Metadata from backend (albums A-Z, tags, tripods)
  const [metadata, setMetadata] = useState<MetadataResponse>({
    albums: [],
    popularTags: [],
    allTags: [],
    commonTripods: [],
  });
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [showTagTray, setShowTagTray] = useState(false);

  // Upload & File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form & EXIF states
  const [photoID, setPhotoID] = useState("");
  const [idSourceNote, setIdSourceNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [captureDate, setCaptureDate] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tripod, setTripod] = useState("");
  const [availability, setAvailability] = useState("Available for Order");

  // Detected technical details
  const [detectedCamera, setDetectedCamera] = useState<any>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [publishedResult, setPublishedResult] = useState<any>(null);

  // Settings states
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth and load metadata on mount
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(!!data.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });

    // Load metadata (albums, tags, tripods)
    fetch("/api/admin/metadata")
      .then((res) => res.json())
      .then((data: MetadataResponse) => {
        setMetadata(data);
      })
      .catch(() => {});

    // Load settings
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data: SiteSettings) => {
        setSettings(data);
      })
      .catch(() => {});

    // Load recent tags & tripod from localStorage
    try {
      const storedTripod = localStorage.getItem("lumenist_last_tripod");
      if (storedTripod) {
        setTripod(storedTripod);
      } else {
        setTripod("None");
      }

      const storedTags = localStorage.getItem("lumenist_recent_tags");
      if (storedTags) {
        setRecentTags(JSON.parse(storedTags));
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setAuthError(data.error || "Incorrect password");
      }
    } catch {
      setAuthError("Network error during login");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  // Process dropped or selected image file
  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
      alert("Please upload a JPEG photograph (.jpg or .jpeg)");
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setSubmitError("");
    setPublishedResult(null);

    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/_desktop|_original/i, "");

    // 1. Check if filename matches standard photoID format (e.g. d20261027151131 or s00000613)
    const isConvention = /^[ds]\d+/i.test(baseName);

    // Extract EXIF in browser
    try {
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        gps: true,
      });

      if (exif) {
        const dateObj: Date | undefined = exif.DateTimeOriginal || exif.CreateDate;
        const now = dateObj instanceof Date && !isNaN(dateObj.getTime()) ? dateObj : new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hour = String(now.getHours()).padStart(2, "0");
        const minute = String(now.getMinutes()).padStart(2, "0");
        const second = String(now.getSeconds()).padStart(2, "0");

        setCaptureDate(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

        if (isConvention) {
          setPhotoID(baseName);
          setIdSourceNote(`Extracted from filename "${file.name}"`);
        } else if (exif.DateTimeOriginal || exif.CreateDate) {
          const generatedId = `d${year}${month}${day}${hour}${minute}${second}`;
          setPhotoID(generatedId);
          setIdSourceNote(
            `Auto-derived from EXIF capture time (${year}-${month}-${day} ${hour}:${minute}:${second})`
          );
        } else {
          const generatedId = `d${year}${month}${day}${hour}${minute}${second}`;
          setPhotoID(generatedId);
          setIdSourceNote("Defaulted to current date/time (no EXIF timestamp)");
        }

        // Coordinates
        if (exif.latitude !== undefined && exif.longitude !== undefined) {
          setLatitude(parseFloat(exif.latitude.toFixed(6)));
          setLongitude(parseFloat(exif.longitude.toFixed(6)));
        }

        // Camera Details
        setDetectedCamera({
          make: exif.Make,
          model: exif.Model,
          lens: exif.LensModel || exif.Lens,
          focalLength: exif.FocalLength
            ? `${Math.round(exif.FocalLength)} mm`
            : undefined,
          shutter: exif.ExposureTime
            ? exif.ExposureTime >= 1
              ? `${exif.ExposureTime}s`
              : `1/${Math.round(1 / exif.ExposureTime)} ss`
            : undefined,
          aperture: exif.FNumber ? `f${exif.FNumber}` : undefined,
          iso: exif.ISO ? `ISO ${exif.ISO}` : undefined,
          exposureComp:
            exif.ExposureCompensation !== undefined
              ? `${exif.ExposureCompensation} Ev`
              : undefined,
          whiteBalance: exif.WhiteBalance || "Auto",
        });

        // Set initial title if file has a friendly name (not an ID)
        if (!isConvention && baseName.length > 2) {
          setTitle(baseName.replace(/[-_]/g, " "));
        }
      } else {
        // No EXIF
        if (isConvention) {
          setPhotoID(baseName);
          setIdSourceNote(`Extracted from filename "${file.name}"`);
        } else {
          const now = new Date();
          const generatedId = `d${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
          setPhotoID(generatedId);
          setIdSourceNote("Generated from current date & time");
        }
      }
    } catch (err) {
      console.warn("Could not read EXIF:", err);
      if (isConvention) {
        setPhotoID(baseName);
        setIdSourceNote(`Extracted from filename "${file.name}"`);
      }
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addCustomCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
      setNewCategoryInput("");
    }
  };

  // Tag chip helper: appends or toggles tag in comma-separated input
  const handleTagChipClick = (tag: string) => {
    const currentTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const exists = currentTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );

    if (exists) {
      // Remove
      const next = currentTags.filter(
        (t) => t.toLowerCase() !== tag.toLowerCase()
      );
      setTagsInput(next.join(", "));
    } else {
      // Append
      const next = [...currentTags, tag];
      setTagsInput(next.join(", "));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSubmitError("Please choose a photograph to upload");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Please provide a photograph title");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("photoID", photoID.trim());
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("albums", selectedCategories.join(","));
    formData.append("tags", tagsInput.trim());
    formData.append("tripod", tripod.trim() || "None");
    formData.append("availability", availability);

    if (captureDate) {
      const d = new Date(captureDate);
      if (!isNaN(d.getTime())) {
        formData.append("year", String(d.getFullYear()));
        formData.append("month", String(d.getMonth() + 1));
        formData.append("day", String(d.getDate()));
        formData.append("hour", String(d.getHours()));
        formData.append("minute", String(d.getMinutes()));
        formData.append("second", String(d.getSeconds()));
      }
    }

    if (latitude !== null && longitude !== null) {
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
    }

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process photo");
      }

      // Remember tripod and tags in localStorage
      if (tripod.trim()) {
        try {
          localStorage.setItem("lumenist_last_tripod", tripod.trim());
        } catch {}
      }

      const submittedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (submittedTags.length > 0) {
        try {
          const updatedRecent = Array.from(
            new Set([...submittedTags, ...recentTags])
          ).slice(0, 20);
          setRecentTags(updatedRecent);
          localStorage.setItem(
            "lumenist_recent_tags",
            JSON.stringify(updatedRecent)
          );
        } catch {}
      }

      setPublishedResult(data);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to upload photo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setPhotoID("");
    setIdSourceNote("");
    setTitle("");
    setDescription("");
    setLatitude(null);
    setLongitude(null);
    setSelectedCategories([]);
    setTagsInput("");
    setDetectedCamera(null);
    setPublishedResult(null);
    setSubmitError("");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSuccess(true);
        // Apply theme variables immediately to active document
        document.documentElement.style.setProperty(
          "--accent",
          settings.themeAccent
        );
        document.documentElement.style.setProperty(
          "--accent-light",
          settings.themeAccentLight
        );
        document.documentElement.style.setProperty(
          "--accent-dark",
          settings.themeAccentDark
        );
        router.refresh();
        setTimeout(() => setSettingsSuccess(false), 3500);
      }
    } catch {
      alert("Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="py-24 text-center text-muted font-mono text-xs">
        Checking admin authentication...
      </div>
    );
  }

  // 1. Password Login View
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-surface border border-surface-border text-accent mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-light text-white tracking-tight">
            Lumenist Admin
          </h1>
          <p className="text-xs text-muted">
            Enter your admin passphrase to manage and publish photographs.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-surface border border-surface-border rounded-sm p-6 space-y-4 shadow-xl"
        >
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full bg-black border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          {authError && (
            <p className="text-xs text-red-400 font-medium">{authError}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-2.5 px-4 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {isLoggingIn ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  // All albums strictly alphabetical
  const displayedAlbums = metadata.albums.length > 0 ? metadata.albums : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin/upload" },
              {
                label:
                  activeTab === "upload" ? "Upload Photo" : "Site Settings",
              },
            ]}
          />
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mt-1">
            {activeTab === "upload"
              ? "Publish Fine Art Photograph"
              : "Studio & Site Settings"}
          </h1>
        </div>

        {/* Tab Buttons & Logout */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-black border border-surface-border rounded-sm p-1 text-xs">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1.5 ${
                activeTab === "upload"
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-gray-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1.5 ${
                activeTab === "settings"
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-gray-200"
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 border border-surface-border rounded-sm text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: UPLOAD PHOTOGRAPH */}
      {activeTab === "upload" && (
        <>
          {/* Success Banner */}
          {publishedResult && (
            <div className="bg-surface border border-accent/40 rounded-sm p-6 space-y-4">
              <div className="flex items-center space-x-3 text-accent">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-medium text-white">
                    Photograph Published Successfully
                  </h3>
                  <p className="text-xs text-muted">
                    Photo ID:{" "}
                    <code className="text-accent font-mono">
                      {publishedResult.photoID}
                    </code>{" "}
                    is now cataloged, optimized, and mapped.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={publishedResult.url}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-accent text-black font-semibold text-xs rounded hover:bg-accent-light transition-colors"
                >
                  <span>View Published Work</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-black border border-surface-border text-gray-300 font-medium text-xs rounded hover:text-white transition-colors"
                >
                  Upload Another Photograph
                </button>
              </div>
            </div>
          )}

          {!publishedResult && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* File Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-accent bg-accent/5 scale-[1.005]"
                    : selectedFile
                    ? "border-surface-border bg-surface/50 hover:border-gray-600"
                    : "border-surface-border hover:border-accent bg-surface/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {imagePreviewUrl ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="w-48 aspect-[3/2] bg-black rounded overflow-hidden border border-surface-border shadow-lg">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left space-y-1 text-xs">
                      <p className="text-white font-medium text-sm">
                        {selectedFile?.name}
                      </p>
                      <p className="text-muted">
                        Size:{" "}
                        {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)}{" "}
                        MB
                      </p>
                      <p className="text-accent flex items-center space-x-1 pt-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          EXIF extracted &bull; Click or drop another image to
                          replace
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-6">
                    <div className="inline-flex p-4 rounded-full bg-black border border-surface-border text-muted">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-200 font-medium">
                        Drag and drop your high-resolution JPEG here, or click to
                        browse
                      </p>
                      <p className="text-xs text-muted pt-1">
                        Supports full-size camera captures (.jpg / .jpeg).
                        EXIF, GPS, and optical specs are extracted
                        automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detected Technical Details Badge */}
              {detectedCamera && (
                <div className="bg-surface border border-surface-border rounded-sm p-4 text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-accent font-medium uppercase tracking-wider text-[11px]">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Auto-Detected Technical Metadata</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-300">
                    <div>
                      <span className="text-muted block text-[10px]">
                        Camera
                      </span>
                      <span>
                        {detectedCamera.make} {detectedCamera.model || "Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Lens</span>
                      <span className="truncate block">
                        {detectedCamera.lens || "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">
                        Exposure
                      </span>
                      <span>
                        {detectedCamera.focalLength || ""} &bull;{" "}
                        {detectedCamera.aperture || ""} &bull;{" "}
                        {detectedCamera.shutter || ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">
                        Sensitivity
                      </span>
                      <span>
                        {detectedCamera.iso || "ISO -"} &bull;{" "}
                        {detectedCamera.exposureComp || "0 Ev"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Photograph Title <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Mingus Mill in Autumn"
                    required
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Narrative Story / Description
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the atmosphere, historical context, geology, or optical technique..."
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent leading-relaxed"
                  />
                </div>

                {/* Photo ID & Capture Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-200 font-mono">
                        Photo ID
                      </label>
                      <span className="text-[10px] text-muted">
                        Editable canonical ID
                      </span>
                    </div>
                    <input
                      type="text"
                      value={photoID}
                      onChange={(e) => {
                        setPhotoID(e.target.value);
                        setIdSourceNote("Custom entry");
                      }}
                      placeholder="e.g. d20261027151131 or s00000613"
                      required
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                    />
                    {idSourceNote && (
                      <p className="text-[11px] text-gray-400 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-accent" />
                        <span>{idSourceNote}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-200">
                      Capture Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={captureDate}
                      onChange={(e) => setCaptureDate(e.target.value)}
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Curated Albums (STRICTLY ALPHABETICAL) */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <Folder className="w-3.5 h-3.5 text-accent" />
                    <span>Curated Albums (Alphabetical)</span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {selectedCategories.length} selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {displayedAlbums.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? "bg-accent/20 border-accent text-accent font-medium shadow-sm"
                            : "bg-black border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Album */}
                <div className="flex items-center space-x-2 pt-3">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                    placeholder="Add new album name..."
                    className="flex-1 bg-black border border-surface-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="px-3 py-1.5 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white hover:border-accent transition-colors"
                  >
                    + Add Album
                  </button>
                </div>
              </div>

              {/* Tags with Memory & Fast Popup Tray */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5 text-accent" />
                    <span>Keywords & Tags</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTagTray(!showTagTray)}
                    className="text-xs text-accent hover:underline flex items-center space-x-1"
                  >
                    <span>
                      {showTagTray ? "Hide Tag Tray" : "+ Quick-Add Tags"}
                    </span>
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Type or paste comma-separated tags (e.g. Washington, Fall color, sunset, river, trees)..."
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-muted">
                    Paste comma-separated tags freely, or click popular chips
                    below to toggle them.
                  </p>
                </div>

                {/* Quick-Add Tag Tray */}
                {(showTagTray || recentTags.length > 0) && (
                  <div className="border-t border-surface-border pt-3 mt-2 space-y-3">
                    {/* Recently Used Tags */}
                    {recentTags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold flex items-center space-x-1">
                          <History className="w-3 h-3 text-accent" />
                          <span>Recently Used Across Photos</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {recentTags.map((tag) => {
                            const isIncluded = tagsInput
                              .split(",")
                              .map((t) => t.trim().toLowerCase())
                              .includes(tag.toLowerCase());
                            return (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => handleTagChipClick(tag)}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  isIncluded
                                    ? "bg-accent text-black font-semibold border-accent"
                                    : "bg-black border-surface-border text-gray-300 hover:border-accent"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Common & Popular Tags */}
                    {metadata.popularTags.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                          Popular Library Keywords
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {metadata.popularTags.slice(0, 40).map(({ tag }) => {
                            const isIncluded = tagsInput
                              .split(",")
                              .map((t) => t.trim().toLowerCase())
                              .includes(tag.toLowerCase());
                            return (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => handleTagChipClick(tag)}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  isIncluded
                                    ? "bg-accent text-black font-semibold border-accent"
                                    : "bg-black/60 border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tripod & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface border border-surface-border p-6 rounded-sm">
                {/* Tripod Setup with Memory */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-200">
                      Tripod Setup
                    </label>
                    <span className="text-[10px] text-muted">
                      Remembers last used
                    </span>
                  </div>
                  <input
                    type="text"
                    list="tripod-list"
                    value={tripod}
                    onChange={(e) => setTripod(e.target.value)}
                    placeholder="e.g. Manfrotto Befree GT XPRO Carbon, 496 ball head, or None"
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <datalist id="tripod-list">
                    {metadata.commonTripods.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "None",
                      "Manfrotto Befree GT XPRO Carbon, 496 ball head",
                      "Gitzo GT3542XLS, Really Right Stuff BH-55",
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setTripod(opt)}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          tripod === opt
                            ? "bg-accent/20 border-accent text-accent font-medium"
                            : "bg-black border-surface-border text-gray-400 hover:text-white"
                        }`}
                      >
                        {opt.includes(",") ? opt.split(",")[0] : opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print Availability */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-200">
                    Print Order Availability
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="Available for Order">
                      Available for Order
                    </option>
                    <option value="Special Edition / By Request">
                      Special Edition / By Request
                    </option>
                    <option value="Archive Only / Not for Sale">
                      Archive Only / Not for Sale
                    </option>
                  </select>
                </div>
              </div>

              {/* Interactive Geospatial Pin Picker */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>Geographic Location & Map Pin</span>
                  </div>
                  {latitude !== null && longitude !== null ? (
                    <span className="text-xs font-mono text-accent">
                      {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      No coordinates chosen
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted">
                  Click anywhere on the dark map or drag the amber pin to place
                  or refine the capture coordinates.
                </p>

                <AdminMapPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lon) => {
                    setLatitude(lat);
                    setLongitude(lon);
                  }}
                />

                {latitude !== null && longitude !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(null);
                      setLongitude(null);
                    }}
                    className="text-xs text-muted hover:text-red-400 transition-colors"
                  >
                    Clear coordinates
                  </button>
                )}
              </div>

              {submitError && (
                <div className="p-4 bg-red-950/40 border border-red-800 rounded text-red-300 text-xs">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="w-full sm:w-auto px-8 py-3.5 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting
                    ? "Publishing Photograph & Writing Records..."
                    : "Publish Photograph"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* TAB 2: SITE & THEME SETTINGS */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Theme Palette & Accent Colors */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-accent" />
                <span>Theme Accent Color</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted">Active:</span>
                <span
                  className="w-4 h-4 rounded-full border border-white/20 inline-block shadow-sm"
                  style={{ backgroundColor: settings.themeAccent }}
                />
                <code className="text-xs font-mono text-white">
                  {settings.themeAccent}
                </code>
              </div>
            </div>

            <p className="text-xs text-muted">
              Choose an accent palette for interactive highlights, map pins,
              buttons, and progress indicators across the entire site.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {THEME_PRESETS.map((preset) => {
                const isSelected =
                  settings.themeAccent.toLowerCase() ===
                  preset.accent.toLowerCase();
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => {
                      setSettings((prev) => ({
                        ...prev,
                        themeAccent: preset.accent,
                        themeAccentLight: preset.light,
                        themeAccentDark: preset.dark,
                      }));
                    }}
                    className={`flex items-center space-x-3 p-3 rounded border text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-surface-border bg-black hover:border-gray-600"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0 border border-white/20 shadow-sm"
                      style={{ backgroundColor: preset.accent }}
                    />
                    <div className="truncate">
                      <span className="block text-xs font-medium text-white truncate">
                        {preset.name}
                      </span>
                      <span className="block text-[10px] font-mono text-muted">
                        {preset.accent}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="pt-2 flex items-center space-x-3">
              <label className="text-xs text-muted">Custom Hex:</label>
              <input
                type="color"
                value={settings.themeAccent}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeAccent: hex,
                    themeAccentLight: hex,
                    themeAccentDark: hex,
                  }));
                }}
                className="w-8 h-8 rounded border border-surface-border bg-black cursor-pointer p-0"
              />
              <input
                type="text"
                value={settings.themeAccent}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeAccent: hex,
                    themeAccentLight: hex,
                    themeAccentDark: hex,
                  }));
                }}
                placeholder="#f59e0b"
                className="w-28 bg-black border border-surface-border rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Catalog Sort Order */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider border-b border-surface-border pb-3">
              <ArrowUpDown className="w-3.5 h-3.5 text-accent" />
              <span>Default Catalog & Gallery Sort Order</span>
            </div>

            <p className="text-xs text-muted">
              Controls the default ordering of photographs in Galleries, All
              Photographs, and adjacent previous/next photo links.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "date-desc",
                  label: "Capture Date (Newest First)",
                  desc: "Chronological order based on camera exposure timestamp",
                },
                {
                  id: "date-asc",
                  label: "Capture Date (Oldest First)",
                  desc: "Historical progression starting from earliest film captures",
                },
                {
                  id: "created-desc",
                  label: "Recently Added (Newest Uploads First)",
                  desc: "Sort by upload time so newly published work appears first",
                },
                {
                  id: "title-asc",
                  label: "Alphabetical by Title (A to Z)",
                  desc: "Cataloged alphabetically by photograph title",
                },
              ].map((opt) => {
                const isSelected = settings.defaultSortOrder === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultSortOrder: opt.id as any,
                      }))
                    }
                    className={`p-4 rounded border text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-surface-border bg-black hover:border-gray-600"
                    }`}
                  >
                    <span className="block text-xs font-medium text-white">
                      {opt.label}
                    </span>
                    <span className="block text-[11px] text-muted pt-1">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slideshow & Studio Identity */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider border-b border-surface-border pb-3">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Slideshow & Studio Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Slideshow Interval (seconds)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={settings.slideshowInterval || 10}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        slideshowInterval: parseInt(e.target.value, 10),
                      }))
                    }
                    className="flex-1 accent-accent"
                  />
                  <span className="text-xs font-mono text-accent w-10">
                    {settings.slideshowInterval || 10}s
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={settings.artistName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      artistName: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-200">
                  Site Title
                </label>
                <input
                  type="text"
                  value={settings.siteTitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      siteTitle: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-200">
                  Site Tagline / Description
                </label>
                <input
                  type="text"
                  value={settings.siteTagline}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      siteTagline: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {settingsSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-700 rounded text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Settings successfully saved! Theme and sort order applied.
              </span>
            </div>
          )}

          {/* Save Button */}
          <div>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-8 py-3.5 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-all shadow-lg flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSavingSettings ? "Saving Settings..." : "Save Settings"}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
